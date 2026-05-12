import { useState, useEffect, useCallback, useMemo } from 'react';
import { useStore } from '@/store';
import { towersApi, measurementsApi, scheduleApi, activityTypesApi } from '@/services/api';
import type { Tower, Floor, Unit, ActivityType, Measurement, ScheduleItem } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EapEntry {
  scheduleItemId: string;
  activityTypeId?: string;
  code: string;
  name: string;
  plannedProgress: number;
  measurementMethod: 'PERCENT' | 'METRIC' | 'COUNT';
  unit: string;
  defaultQuantity: number;
  mode: 'PERCENT' | 'METRIC';
  percentValue: number;
  executedQty: number;
  totalQty: number;
  computed: number;
  isDirty: boolean;
  canMeasure: boolean;
}

interface EapSection {
  parentId: string;
  code: string;
  name: string;
  level: number;
  order: number;
  entries: EapEntry[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcFromMetric(executed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((executed / total) * 10000) / 100);
}

function calcOverallProgress(entries: { computed: number }[]): number {
  if (entries.length === 0) return 0;
  return Math.round(entries.reduce((acc, e) => acc + e.computed, 0) / entries.length);
}

function windowColor(pct: number): string {
  if (pct === 0) return '#ddd';
  if (pct >= 100) return '#9ed67b';
  if (pct > 50) return '#FAC775';
  return '#f0a040';
}

function unitState(p: number): 'ni' | 'ea' | 'co' {
  if (p === 0) return 'ni';
  if (p >= 100) return 'co';
  return 'ea';
}

function statusBadgeClass(p: number): string {
  if (p === 0) return 'ao-badge ao-bk';
  if (p >= 100) return 'ao-badge ao-bg';
  return 'ao-badge ao-ba';
}

function statusLabel(p: number): string {
  if (p === 0) return 'Não iniciado';
  if (p >= 100) return 'Concluído';
  return 'Em andamento';
}

function formatArea(area?: number): string {
  if (!area) return '—';
  return `${area.toLocaleString('pt-BR')} m²`;
}

// ── EAP section building ──────────────────────────────────────────────────────

function buildEapSections(
  items: ScheduleItem[],
  activityTypesMap: Record<string, ActivityType>,
  measurements: Measurement[],
): EapSection[] {
  if (items.length === 0) return [];

  const childIds = new Set(items.map((i) => i.parentId).filter(Boolean) as string[]);
  const leafItems = items.filter((i) => !childIds.has(i.id));
  if (leafItems.length === 0) return [];

  const sectionMap: Record<string, { meta: { order: number; code: string; name: string; level: number }; entries: EapEntry[] }> = {};

  for (const leaf of leafItems) {
    const at = leaf.activityTypeId ? activityTypesMap[leaf.activityTypeId] : null;
    const existing = at ? measurements.find((m) => m.activityTypeId === at.id) : null;

    const measurementMethod = (at?.measurementMethod ?? 'PERCENT') as 'PERCENT' | 'METRIC' | 'COUNT';
    const percentValue = existing?.percentComplete ?? 0;
    const execQty = existing?.executedQty ?? 0;
    const totalQty = existing?.totalQty ?? at?.defaultQuantity ?? 1;
    const mode: 'PERCENT' | 'METRIC' = measurementMethod !== 'PERCENT' && totalQty > 0 ? 'METRIC' : 'PERCENT';
    const computed = mode === 'METRIC' ? calcFromMetric(execQty, totalQty) : percentValue;

    const entry: EapEntry = {
      scheduleItemId: leaf.id,
      activityTypeId: leaf.activityTypeId,
      code: leaf.code,
      name: leaf.name,
      plannedProgress: leaf.plannedProgress,
      measurementMethod,
      unit: at?.unit ?? '%',
      defaultQuantity: at?.defaultQuantity ?? 1,
      mode,
      percentValue,
      executedQty: execQty,
      totalQty,
      computed,
      isDirty: false,
      canMeasure: !!leaf.activityTypeId,
    };

    const parentId = leaf.parentId ?? 'root';
    if (!sectionMap[parentId]) {
      const parent = items.find((i) => i.id === parentId);
      sectionMap[parentId] = {
        meta: {
          order: parent?.order ?? 999,
          code: parent?.code ?? '',
          name: parent?.name ?? 'Atividades',
          level: parent?.level ?? 0,
        },
        entries: [],
      };
    }
    sectionMap[parentId].entries.push(entry);
  }

  return Object.entries(sectionMap)
    .map(([parentId, { meta, entries }]) => ({ parentId, ...meta, entries }))
    .sort((a, b) => a.order - b.order);
}

function buildFallbackSections(
  activityTypes: ActivityType[],
  measurements: Measurement[],
): EapSection[] {
  if (activityTypes.length === 0) return [];
  const entries: EapEntry[] = activityTypes.map((at) => {
    const existing = measurements.find((m) => m.activityTypeId === at.id);
    const percentValue = existing?.percentComplete ?? 0;
    const execQty = existing?.executedQty ?? 0;
    const totalQty = existing?.totalQty ?? at.defaultQuantity;
    const mode: 'PERCENT' | 'METRIC' = at.measurementMethod !== 'PERCENT' && totalQty > 0 ? 'METRIC' : 'PERCENT';
    const computed = mode === 'METRIC' ? calcFromMetric(execQty, totalQty) : percentValue;
    return {
      scheduleItemId: at.id,
      activityTypeId: at.id,
      code: '',
      name: at.name,
      plannedProgress: 0,
      measurementMethod: at.measurementMethod as 'PERCENT' | 'METRIC' | 'COUNT',
      unit: at.unit,
      defaultQuantity: at.defaultQuantity,
      mode,
      percentValue,
      executedQty: execQty,
      totalQty,
      computed,
      isDirty: false,
      canMeasure: true,
    };
  });
  return [{ parentId: 'root', code: '', name: 'Tipos de Atividade', level: 0, order: 0, entries }];
}

// ── BuildingSVG ───────────────────────────────────────────────────────────────

interface BuildingSVGProps {
  floors: Floor[];
  unitsCache: Record<string, Unit[]>;
  selectedFloorId: string | null;
  onSelectFloor: (id: string) => void;
}

function BuildingSVG({ floors, unitsCache, selectedFloorId, onSelectFloor }: BuildingSVGProps) {
  const sorted = [...floors].sort((a, b) => b.level - a.level);
  const displayFloors = sorted.slice(0, 8);
  const count = displayFloors.length;
  const FLOOR_H = 38;
  const TOP_Y = 20;
  const SVG_H = 320;

  function avgProgress(floorId: string): number {
    const us = unitsCache[floorId] ?? [];
    if (us.length === 0) return 0;
    return us.reduce((acc, u) => acc + (u.progressPercent ?? 0), 0) / us.length;
  }

  return (
    <svg viewBox="0 0 220 320" width="204" height="296" style={{ display: 'block', margin: '0 auto' }}>
      <ellipse cx="130" cy="314" rx="75" ry="6" fill="rgba(0,0,0,.07)" />
      <polygon points="178,20 218,7 218,308 178,321" fill="var(--bg4,var(--bg3))" stroke="var(--bd2)" strokeWidth=".5" />
      <polygon points="22,20 62,7 218,7 178,20" fill="var(--bg3)" stroke="var(--bd2)" strokeWidth=".5" />
      <rect x="22" y="20" width="156" height="288" fill="var(--bg2)" stroke="var(--bd2)" strokeWidth=".5" />

      {displayFloors.map((floor, idx) => {
        const y = TOP_Y + idx * FLOOR_H;
        const h = idx === count - 1 ? SVG_H - 20 - idx * FLOOR_H - 12 : FLOOR_H;
        const avg = avgProgress(floor.id);
        const isSelected = floor.id === selectedFloorId;
        const winY = y + 8;
        const winXs = [28, 62, 96, 130];

        return (
          <g key={floor.id} onClick={() => onSelectFloor(floor.id)} style={{ cursor: 'pointer' }}>
            <rect x="22" y={y} width="156" height={h} fill="transparent" stroke={isSelected ? 'var(--blue)' : 'var(--bd)'} strokeWidth={isSelected ? 2 : 0.5} />
            {winXs.map((wx, wi) => (
              <rect key={wi} x={wx} y={winY} width={26} height={15} rx="2" fill={windowColor(avg)} opacity={0.85} />
            ))}
            <text x="186" y={y + 26} fontSize="7" fill="var(--t3)" fontFamily="sans-serif">{floor.name}</text>
          </g>
        );
      })}

      {count === 0 && (
        <text x="100" y="160" textAnchor="middle" fontSize="10" fill="var(--t3)" fontFamily="sans-serif">Nenhum andar</text>
      )}
    </svg>
  );
}

// ── stat chip ─────────────────────────────────────────────────────────────────

function StatChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', fontSize: 11 }}>
      <span style={{ color: 'var(--t3)' }}>{label}</span>
      <span style={{ color: 'var(--t1)', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Medicao() {
  const { currentProject, addToast } = useStore();
  const projectId = currentProject?.id;

  const [towers, setTowers] = useState<Tower[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [activityTypesMap, setActivityTypesMap] = useState<Record<string, ActivityType>>({});

  const [selectedTowerId, setSelectedTowerId] = useState<string | null>(null);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  const [floorUnitsCache, setFloorUnitsCache] = useState<Record<string, Unit[]>>({});

  const [loadingInit, setLoadingInit] = useState(false);
  const [loadingFloors, setLoadingFloors] = useState(false);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [loadingMeasurements, setLoadingMeasurements] = useState(false);
  const [saving, setSaving] = useState(false);

  const [sections, setSections] = useState<EapSection[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // ── Load towers + schedule + activity types ────────────────────────────────

  useEffect(() => {
    if (!projectId) return;
    setLoadingInit(true);
    Promise.all([
      towersApi.list(projectId),
      scheduleApi.list(projectId),
      activityTypesApi.list(projectId),
    ])
      .then(([t, si, at]) => {
        setTowers(t);
        setScheduleItems(si);
        const atMap: Record<string, ActivityType> = {};
        at.forEach((a) => { atMap[a.id] = a; });
        setActivityTypesMap(atMap);
        if (t.length > 0) setSelectedTowerId(t[0].id);
      })
      .catch(() => {
        addToast({ type: 'error', title: 'Erro ao carregar dados' });
      })
      .finally(() => setLoadingInit(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // ── Load floors when tower changes ────────────────────────────────────────

  useEffect(() => {
    if (!projectId || !selectedTowerId) { setFloors([]); return; }
    setLoadingFloors(true);
    setSelectedFloorId(null);
    setFloorUnitsCache({});
    towersApi.listFloors(projectId, selectedTowerId)
      .then((f) => {
        setFloors(f);
        if (f.length > 0) setSelectedFloorId(f[0].id);
      })
      .catch(() => {})
      .finally(() => setLoadingFloors(false));
  }, [selectedTowerId, projectId]);

  // ── Load units when floor changes ─────────────────────────────────────────

  useEffect(() => {
    if (!selectedFloorId) { setUnits([]); return; }
    setLoadingUnits(true);
    setSelectedUnitId(null);
    towersApi.listUnits(selectedFloorId)
      .then((u) => {
        setUnits(u);
        setFloorUnitsCache((prev) => ({ ...prev, [selectedFloorId]: u }));
      })
      .catch(() => {})
      .finally(() => setLoadingUnits(false));
  }, [selectedFloorId]);

  // ── Load measurements when unit changes ───────────────────────────────────

  const buildSections = useCallback(
    (meas: Measurement[]) => {
      if (scheduleItems.length > 0) {
        return buildEapSections(scheduleItems, activityTypesMap, meas);
      }
      return buildFallbackSections(Object.values(activityTypesMap), meas);
    },
    [scheduleItems, activityTypesMap],
  );

  useEffect(() => {
    if (!selectedUnitId) { setSections([]); return; }
    setLoadingMeasurements(true);
    measurementsApi.list(selectedUnitId)
      .then((meas) => setSections(buildSections(meas)))
      .catch(() => setSections(buildSections([])))
      .finally(() => setLoadingMeasurements(false));
  }, [selectedUnitId, buildSections]);

  // ── Computed ──────────────────────────────────────────────────────────────

  const allEntries = useMemo(() => sections.flatMap((s) => s.entries), [sections]);
  const measurableEntries = useMemo(() => allEntries.filter((e) => e.canMeasure), [allEntries]);
  const overallProgress = useMemo(() => calcOverallProgress(measurableEntries), [measurableEntries]);
  const hasDirty = useMemo(() => allEntries.some((e) => e.isDirty), [allEntries]);

  const selectedUnit = useMemo(() => units.find((u) => u.id === selectedUnitId) ?? null, [units, selectedUnitId]);
  const selectedFloor = useMemo(() => floors.find((f) => f.id === selectedFloorId) ?? null, [floors, selectedFloorId]);

  const totalFloorArea = useMemo(
    () => units.reduce((sum, u) => sum + (u.area ?? 0), 0),
    [units],
  );

  // ── Update helper ─────────────────────────────────────────────────────────

  function updateEntry(parentId: string, scheduleItemId: string, updates: Partial<EapEntry>) {
    setSections((prev) =>
      prev.map((s) =>
        s.parentId === parentId
          ? { ...s, entries: s.entries.map((e) => e.scheduleItemId === scheduleItemId ? { ...e, ...updates } : e) }
          : s,
      ),
    );
  }

  // ── Section toggle ────────────────────────────────────────────────────────

  function toggleSection(parentId: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId); else next.add(parentId);
      return next;
    });
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleMarkDone(parentId: string, entry: EapEntry) {
    updateEntry(parentId, entry.scheduleItemId, { computed: 100, percentValue: 100, isDirty: true });
  }

  function handleAllDone() {
    setSections((prev) =>
      prev.map((s) => ({
        ...s,
        entries: s.entries.map((e) => e.canMeasure ? { ...e, computed: 100, percentValue: 100, isDirty: true } : e),
      })),
    );
  }

  async function handleSave() {
    if (!selectedUnitId) return;
    const dirty = allEntries.filter((e) => e.isDirty && e.canMeasure);
    if (dirty.length === 0) return;
    setSaving(true);
    try {
      await Promise.all(
        dirty.map((e) =>
          measurementsApi.create(selectedUnitId, {
            activityTypeId: e.activityTypeId!,
            percentComplete: e.computed,
            executedQty: e.mode === 'METRIC' ? e.executedQty : undefined,
            totalQty: e.mode === 'METRIC' ? e.totalQty : undefined,
          }),
        ),
      );
      setSections((prev) => prev.map((s) => ({ ...s, entries: s.entries.map((e) => ({ ...e, isDirty: false })) })));
      if (selectedFloorId) {
        setFloorUnitsCache((prev) => ({
          ...prev,
          [selectedFloorId]: (prev[selectedFloorId] ?? []).map((u) =>
            u.id === selectedUnitId ? { ...u, progressPercent: overallProgress } : u,
          ),
        }));
      }
      addToast({ type: 'success', title: 'Medição salva', description: `${dirty.length} atividade${dirty.length > 1 ? 's' : ''} registrada${dirty.length > 1 ? 's' : ''}.` });
    } catch {
      addToast({ type: 'error', title: 'Erro ao salvar', description: 'Tente novamente.' });
    } finally {
      setSaving(false);
    }
  }

  // ── No project ────────────────────────────────────────────────────────────

  if (!currentProject) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16, textAlign: 'center', padding: '0 1rem' }}>
        <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--t1)', marginBottom: 4 }}>Selecione um projeto</p>
        <p style={{ fontSize: 13, color: 'var(--t2)' }}>Escolha um projeto no seletor acima para registrar medições.</p>
      </div>
    );
  }

  // ── Input style ───────────────────────────────────────────────────────────

  const inputSt: React.CSSProperties = {
    padding: '4px 6px', fontSize: 11, border: '0.5px solid var(--bd2)',
    borderRadius: 6, background: 'var(--bg1)', color: 'var(--t1)', fontFamily: 'var(--font)',
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>

      {/* ── Left: building + cadastro panel ─────────────────────────────────── */}
      <div style={{ flexShrink: 0, width: 230 }}>
        <div className="ao-card" style={{ padding: '.875rem' }}>

          {/* Tower selector */}
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', marginBottom: 10 }}>Empreendimento</p>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: 'var(--t2)', display: 'block', marginBottom: 4 }}>Torre</label>
            {loadingInit ? (
              <div style={{ height: 32, background: 'var(--bg3)', borderRadius: 8 }} />
            ) : (
              <select
                value={selectedTowerId ?? ''}
                onChange={(e) => setSelectedTowerId(e.target.value || null)}
                style={{ width: '100%', padding: '5px 8px', fontSize: 11, border: '0.5px solid var(--bd2)', borderRadius: 8, background: 'var(--bg1)', color: 'var(--t1)', fontFamily: 'var(--font)' }}
              >
                <option value="">Selecione a torre</option>
                {towers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </div>

          {/* Building SVG */}
          {loadingFloors
            ? <div style={{ height: 200, background: 'var(--bg3)', borderRadius: 8, marginBottom: 10 }} />
            : (
              <BuildingSVG
                floors={floors}
                unitsCache={floorUnitsCache}
                selectedFloorId={selectedFloorId}
                onSelectFloor={setSelectedFloorId}
              />
            )
          }

          {/* Floor selector */}
          <div style={{ marginTop: 10 }}>
            <label style={{ fontSize: 11, color: 'var(--t2)', display: 'block', marginBottom: 4 }}>Pavimento</label>
            <select
              value={selectedFloorId ?? ''}
              onChange={(e) => setSelectedFloorId(e.target.value || null)}
              disabled={floors.length === 0}
              style={{ width: '100%', padding: '5px 8px', fontSize: 11, border: '0.5px solid var(--bd2)', borderRadius: 8, background: 'var(--bg1)', color: 'var(--t1)', fontFamily: 'var(--font)' }}
            >
              <option value="">Selecione o pavimento</option>
              {floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>

          {/* Cadastro stats */}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '0.5px solid var(--bd)' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dados do Cadastro</p>
            <StatChip label="Área total" value={formatArea(currentProject.totalArea)} />
            <StatChip label="Torres" value={towers.length || '—'} />
            <StatChip label="Pavimentos" value={floors.length > 0 ? `${floors.length} / torre` : '—'} />
            {selectedFloor && (
              <>
                <div style={{ borderTop: '0.5px solid var(--bd)', margin: '6px 0' }} />
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--t1)', marginBottom: 4 }}>{selectedFloor.name}</p>
                <StatChip label="Unidades" value={units.length} />
                {totalFloorArea > 0 && <StatChip label="Área do pavimento" value={formatArea(totalFloorArea)} />}
                <StatChip label="Concluídas" value={`${units.filter((u) => (u.progressPercent ?? 0) >= 100).length} / ${units.length}`} />
                <StatChip label="Em andamento" value={units.filter((u) => { const p = u.progressPercent ?? 0; return p > 0 && p < 100; }).length} />
              </>
            )}
            {currentProject.startDate && (
              <>
                <div style={{ borderTop: '0.5px solid var(--bd)', margin: '6px 0' }} />
                <StatChip label="Início" value={new Date(currentProject.startDate).toLocaleDateString('pt-BR')} />
                {currentProject.endDate && <StatChip label="Entrega" value={new Date(currentProject.endDate).toLocaleDateString('pt-BR')} />}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Right: units + EAP activities ──────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0 }}>

        {/* Units card */}
        <div className="ao-card">
          <div className="ao-card-hdr" style={{ marginBottom: 10 }}>
            <span className="ao-card-title">
              Unidades {selectedFloor ? `— ${selectedFloor.name}` : ''}
            </span>
            {selectedUnit && (
              <span className={statusBadgeClass(overallProgress)}>
                {overallProgress}% {statusLabel(overallProgress)}
              </span>
            )}
          </div>

          {loadingUnits ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(78px,1fr))', gap: 5 }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ height: 60, background: 'var(--bg3)', borderRadius: 8 }} />
              ))}
            </div>
          ) : units.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: 'var(--t3)' }}>
              Selecione um pavimento para ver as unidades
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(78px,1fr))', gap: 5 }}>
              {units.map((unit) => {
                const p = unit.progressPercent ?? 0;
                const state = unitState(p);
                const isSelected = unit.id === selectedUnitId;
                const bgColor = state === 'ni' ? 'var(--bg2)' : state === 'co' ? 'var(--grn-bg)' : 'var(--amb-bg)';
                const textColor = state === 'ni' ? 'var(--t2)' : state === 'co' ? 'var(--grn-t)' : 'var(--amb-t)';
                return (
                  <button
                    key={unit.id}
                    onClick={() => setSelectedUnitId(unit.id)}
                    style={{
                      padding: 7, borderRadius: 8, fontSize: 10, textAlign: 'center', cursor: 'pointer',
                      border: isSelected ? '1.5px solid var(--blue)' : '1px solid var(--bd)',
                      background: bgColor, color: textColor, transition: 'all .15s',
                      boxShadow: isSelected ? '0 0 0 2px rgba(27,111,232,.18)' : 'none',
                      fontFamily: 'var(--font)',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.04)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    title={unit.area ? `Área: ${unit.area} m²` : undefined}
                  >
                    <div style={{ fontWeight: 500, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{unit.name}</div>
                    {unit.area && <div style={{ fontSize: 9, opacity: 0.7, marginBottom: 1 }}>{unit.area}m²</div>}
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{p.toFixed(0)}%</div>
                    <div className="ao-pbar" style={{ marginTop: 3 }}>
                      <div className="ao-pfill" style={{ width: `${p}%`, background: state === 'co' ? 'var(--green)' : state === 'ea' ? 'var(--amber)' : 'var(--bg3)' }} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* EAP Activities card */}
        <div className="ao-card" id="activities">
          <div className="ao-card-hdr" style={{ marginBottom: 4 }}>
            <div>
              <span className="ao-card-title">
                {selectedUnit ? `EAP — Atividades de ${selectedUnit.name}` : 'EAP — Atividades'}
              </span>
              {scheduleItems.length > 0 && (
                <span style={{ fontSize: 10, color: 'var(--t3)', marginLeft: 8 }}>
                  {scheduleItems.filter((i) => {
                    const childIds = new Set(scheduleItems.map((x) => x.parentId).filter(Boolean));
                    return !childIds.has(i.id);
                  }).length} atividades folha do EAP
                </span>
              )}
            </div>
            {selectedUnit && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="ao-btn ao-btn-sm ao-btn-ok" onClick={handleAllDone} disabled={saving}>
                  Tudo concluído
                </button>
                <button
                  className={`ao-btn ao-btn-sm${hasDirty ? ' ao-btn-primary' : ''}`}
                  onClick={handleSave}
                  disabled={saving || !hasDirty}
                  style={hasDirty ? { background: '#2563EB', color: '#fff', border: 'none' } : {}}
                >
                  {saving ? 'Salvando…' : 'Salvar Medição'}
                </button>
              </div>
            )}
          </div>

          {!selectedUnitId ? (
            <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 12, color: 'var(--t3)' }}>
              Selecione uma unidade para registrar medições
            </div>
          ) : loadingMeasurements ? (
            <div>{Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ height: 44, background: 'var(--bg3)', borderRadius: 8, marginBottom: 6 }} />)}</div>
          ) : sections.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: 'var(--t3)' }}>
              Nenhuma atividade encontrada no EAP ou tipos de atividade.
              <br />
              <span style={{ fontSize: 11, color: 'var(--t3)' }}>Crie atividades no cronograma EAP ou configure tipos de atividade nas configurações.</span>
            </div>
          ) : (
            <>
              {sections.map((section) => {
                const isCollapsed = collapsedSections.has(section.parentId);
                const sectionProgress = calcOverallProgress(section.entries.filter((e) => e.canMeasure));

                return (
                  <div key={section.parentId} style={{ marginBottom: 4 }}>
                    {/* Section header */}
                    <div
                      onClick={() => toggleSection(section.parentId)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px',
                        background: 'var(--bg2)', borderRadius: 8, cursor: 'pointer',
                        marginBottom: isCollapsed ? 0 : 4, userSelect: 'none',
                      }}
                    >
                      <span style={{ fontSize: 10, color: 'var(--t3)', transition: 'transform .15s', display: 'inline-block', transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)' }}>▶</span>
                      {section.code && (
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--t3)', flexShrink: 0 }}>{section.code}</span>
                      )}
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', flex: 1 }}>{section.name}</span>
                      <span style={{ fontSize: 10, color: 'var(--t2)' }}>{section.entries.length} atividade{section.entries.length !== 1 ? 's' : ''}</span>
                      {section.entries.some((e) => e.canMeasure) && (
                        <span className={statusBadgeClass(sectionProgress)} style={{ flexShrink: 0 }}>{sectionProgress}%</span>
                      )}
                    </div>

                    {/* Section entries */}
                    {!isCollapsed && section.entries.map((entry) => {
                      const isMetric = entry.mode === 'METRIC' && entry.measurementMethod !== 'PERCENT';
                      const p = entry.computed;

                      function handlePercentChange(val: string) {
                        const n = Math.min(100, Math.max(0, parseFloat(val) || 0));
                        updateEntry(section.parentId, entry.scheduleItemId, { percentValue: n, computed: n, isDirty: true });
                      }
                      function handleExecutedChange(val: string) {
                        const executed = parseFloat(val) || 0;
                        const computed = calcFromMetric(executed, entry.totalQty);
                        updateEntry(section.parentId, entry.scheduleItemId, { executedQty: executed, computed, isDirty: true });
                      }
                      function handleTotalChange(val: string) {
                        const total = parseFloat(val) || 0;
                        const computed = calcFromMetric(entry.executedQty, total);
                        updateEntry(section.parentId, entry.scheduleItemId, { totalQty: total, computed, isDirty: true });
                      }

                      return (
                        <div
                          key={entry.scheduleItemId}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px 6px 16px',
                            borderBottom: '0.5px solid var(--bd)',
                            background: entry.isDirty ? 'rgba(186,117,23,.04)' : undefined,
                            opacity: entry.canMeasure ? 1 : 0.6,
                          }}
                        >
                          {/* Code + name */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {entry.code && (
                                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--t3)', flexShrink: 0 }}>{entry.code}</span>
                              )}
                              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {entry.name}
                              </span>
                              {!entry.canMeasure && (
                                <span className="ao-badge ao-bk" style={{ fontSize: 9, flexShrink: 0 }} title="Vincule um tipo de atividade a este item no EAP para habilitar medição">
                                  Sem tipo
                                </span>
                              )}
                            </div>
                            {/* EAP planned progress mini bar */}
                            {entry.plannedProgress > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                <div style={{ flex: 1, height: 3, background: 'var(--bg3)', borderRadius: 2, maxWidth: 80 }}>
                                  <div style={{ height: '100%', width: `${entry.plannedProgress}%`, background: 'rgba(55,138,221,.5)', borderRadius: 2 }} />
                                </div>
                                <span style={{ fontSize: 9, color: 'var(--t3)' }}>Plan {entry.plannedProgress}%</span>
                              </div>
                            )}
                          </div>

                          {/* Mode toggle */}
                          {entry.canMeasure && entry.measurementMethod !== 'PERCENT' && (
                            <div style={{ display: 'flex', borderRadius: 6, border: '0.5px solid var(--bd2)', overflow: 'hidden', flexShrink: 0 }}>
                              <button onClick={() => updateEntry(section.parentId, entry.scheduleItemId, { mode: 'PERCENT', isDirty: true })} style={{ padding: '3px 7px', fontSize: 10, border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', background: !isMetric ? 'var(--blue)' : 'var(--s1)', color: !isMetric ? '#fff' : 'var(--t2)' }}>% Manual</button>
                              <button onClick={() => updateEntry(section.parentId, entry.scheduleItemId, { mode: 'METRIC', isDirty: true })} style={{ padding: '3px 7px', fontSize: 10, border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', background: isMetric ? 'var(--blue)' : 'var(--s1)', color: isMetric ? '#fff' : 'var(--t2)' }}>Métrica</button>
                            </div>
                          )}

                          {/* Input(s) */}
                          {entry.canMeasure && (
                            isMetric ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                                <input type="number" min={0} value={entry.executedQty} onChange={(e) => handleExecutedChange(e.target.value)} placeholder="Exec." style={{ ...inputSt, width: 60 }} />
                                <span style={{ fontSize: 10, color: 'var(--t3)' }}>/</span>
                                <input type="number" min={0} value={entry.totalQty} onChange={(e) => handleTotalChange(e.target.value)} placeholder="Total" style={{ ...inputSt, width: 60 }} />
                                <span style={{ fontSize: 10, color: 'var(--t3)' }}>{entry.unit}</span>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                                <input type="number" min={0} max={100} value={entry.percentValue} onChange={(e) => handlePercentChange(e.target.value)} placeholder="0–100" style={{ ...inputSt, width: 64 }} />
                                <span style={{ fontSize: 10, color: 'var(--t3)' }}>%</span>
                              </div>
                            )
                          )}

                          {/* Progress % */}
                          {entry.canMeasure && (
                            <span style={{ fontSize: 14, fontWeight: 500, minWidth: 38, textAlign: 'right', color: p >= 100 ? 'var(--green)' : p > 0 ? 'var(--amber)' : 'var(--t3)', flexShrink: 0 }}>
                              {p.toFixed(1)}%
                            </span>
                          )}

                          {/* Status badge */}
                          {entry.canMeasure && (
                            <span className={statusBadgeClass(p)} style={{ flexShrink: 0, minWidth: 74, justifyContent: 'center' }}>
                              {statusLabel(p)}
                            </span>
                          )}

                          {/* Mark done */}
                          {entry.canMeasure && (
                            <button
                              onClick={() => handleMarkDone(section.parentId, entry)}
                              title="Marcar 100%"
                              className="ao-btn ao-btn-sm ao-btn-ok"
                              style={{ flexShrink: 0, borderRadius: '50%', width: 24, height: 24, padding: 0, justifyContent: 'center' }}
                            >✓</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Footer save */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12 }}>
                <span style={{ fontSize: 11, color: 'var(--t3)' }}>
                  {measurableEntries.filter((e) => e.isDirty).length > 0 && `${measurableEntries.filter((e) => e.isDirty).length} alteração(ões) não salva(s)`}
                  {allEntries.some((e) => !e.canMeasure) && (
                    <span style={{ color: 'var(--t3)' }}>
                      {` · `}
                      {allEntries.filter((e) => !e.canMeasure).length} item(ns) sem tipo de atividade vinculado
                    </span>
                  )}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="ao-btn ao-btn-sm ao-btn-ok" onClick={handleAllDone} disabled={saving}>Tudo concluído</button>
                  <button
                    className={`ao-btn ao-btn-sm${hasDirty ? ' ao-btn-primary' : ''}`}
                    onClick={handleSave}
                    disabled={saving || !hasDirty}
                    style={hasDirty ? { background: '#2563EB', color: '#fff', border: 'none' } : {}}
                  >
                    {saving ? 'Salvando…' : 'Salvar Medição'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
