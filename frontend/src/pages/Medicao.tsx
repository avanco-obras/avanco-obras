import { useState, useEffect, useCallback, useMemo } from 'react';
import { useStore } from '@/store';
import { towersApi, measurementsApi, activityTypesApi } from '@/services/api';
import type { Tower, Floor, Unit, ActivityType, Measurement } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActivityEntry {
  activityTypeId: string;
  name: string;
  measurementMethod: 'PERCENT' | 'METRIC' | 'COUNT';
  unit: string;
  defaultQuantity: number;
  mode: 'PERCENT' | 'METRIC';
  percentValue: number;
  executedQty: number;
  totalQty: number;
  computed: number;
  isDirty: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcFromMetric(executed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((executed / total) * 10000) / 100);
}

function calcOverallProgress(entries: ActivityEntry[]): number {
  if (entries.length === 0) return 0;
  const sum = entries.reduce((acc, e) => acc + e.computed, 0);
  return Math.round(sum / entries.length);
}

function methodLabel(method: 'PERCENT' | 'METRIC' | 'COUNT'): string {
  if (method === 'PERCENT') return '%';
  if (method === 'METRIC') return 'm²';
  return 'un';
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

// ── Isometric Building SVG ────────────────────────────────────────────────────

interface BuildingSVGProps {
  floors: Floor[];
  unitsCache: Record<string, Unit[]>;
  selectedFloorId: string | null;
  onSelectFloor: (floorId: string) => void;
}

function BuildingSVG({ floors, unitsCache, selectedFloorId, onSelectFloor }: BuildingSVGProps) {
  // Sort descending by level (top floor first)
  const sorted = [...floors].sort((a, b) => b.level - a.level);
  // Use up to 7 floors for the isometric building
  const displayFloors = sorted.slice(0, 7);
  const count = displayFloors.length;

  function avgProgress(floorId: string): number {
    const us = unitsCache[floorId] ?? [];
    if (us.length === 0) return 0;
    return us.reduce((acc, u) => acc + (u.progressPercent ?? 0), 0) / us.length;
  }

  // Each floor is 42px tall; térreo (last) gets 54px but we simplify to 42 for all
  const FLOOR_H = 42;
  const TOP_Y = 22;
  const SVG_H = 340;

  return (
    <svg viewBox="0 0 220 340" width="210" height="323" style={{ display: 'block', margin: '0 auto' }}>
      {/* Shadow */}
      <ellipse cx="130" cy="334" rx="75" ry="7" fill="rgba(0,0,0,.08)" />
      {/* Side face (right) */}
      <polygon points="178,22 218,8 218,314 178,328" fill="var(--bg4)" stroke="var(--bd2)" strokeWidth=".5" />
      {/* Roof */}
      <polygon points="22,22 62,8 218,8 178,22" fill="var(--bg3)" stroke="var(--bd2)" strokeWidth=".5" />
      {/* Main facade */}
      <rect x="22" y="22" width="156" height="306" fill="var(--bg2)" stroke="var(--bd2)" strokeWidth=".5" />

      {/* Floor labels on side */}
      {displayFloors.map((floor, idx) => {
        const y = TOP_Y + idx * FLOOR_H;
        return (
          <text key={floor.id} x="186" y={y + 30} fontSize="8" fill="var(--t3)" fontFamily="sans-serif">
            {floor.name}
          </text>
        );
      })}

      {/* Clickable floor groups */}
      {displayFloors.map((floor, idx) => {
        const y = TOP_Y + idx * FLOOR_H;
        const h = idx === count - 1 ? SVG_H - 22 - idx * FLOOR_H - 14 : FLOOR_H;
        const avg = avgProgress(floor.id);
        const isSelected = floor.id === selectedFloorId;

        // 4 window columns, evenly spaced
        const winW = 26;
        const winH = 16;
        const winY = y + 10;
        const winXs = [28, 62, 96, 130];

        return (
          <g key={floor.id} onClick={() => onSelectFloor(floor.id)} style={{ cursor: 'pointer' }}>
            {/* Floor face */}
            <rect
              className="fface"
              x="22"
              y={y}
              width="156"
              height={h}
              fill="transparent"
              stroke={isSelected ? 'var(--amber)' : 'var(--bd)'}
              strokeWidth={isSelected ? 2.5 : 0.5}
            />
            {/* Windows colored by progress */}
            {winXs.map((wx, wi) => (
              <rect
                key={wi}
                x={wx}
                y={winY}
                width={winW}
                height={winH}
                rx="2"
                fill={windowColor(avg)}
                opacity={0.85}
              />
            ))}
          </g>
        );
      })}

      {/* Empty state if no floors */}
      {count === 0 && (
        <text x="100" y="170" textAnchor="middle" fontSize="10" fill="var(--t3)" fontFamily="sans-serif">
          Nenhum andar
        </text>
      )}
    </svg>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Medicao() {
  const { currentProject, addToast } = useStore();
  const projectId = currentProject?.id;

  const [towers, setTowers] = useState<Tower[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);

  const [selectedTowerId, setSelectedTowerId] = useState<string | null>(null);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  const [floorUnitsCache, setFloorUnitsCache] = useState<Record<string, Unit[]>>({});

  const [loadingTowers, setLoadingTowers] = useState(false);
  const [loadingFloors, setLoadingFloors] = useState(false);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [loadingMeasurements, setLoadingMeasurements] = useState(false);
  const [saving, setSaving] = useState(false);

  const [entries, setEntries] = useState<ActivityEntry[]>([]);

  // ── Load towers + activity types ─────────────────────────────────────────

  useEffect(() => {
    if (!projectId) return;
    setLoadingTowers(true);
    Promise.all([
      towersApi.list(projectId),
      activityTypesApi.list(projectId),
    ])
      .then(([t, at]) => {
        setTowers(t);
        setActivityTypes(at);
        if (t.length > 0) setSelectedTowerId(t[0].id);
      })
      .catch(() => {
        addToast({ type: 'error', title: 'Erro ao carregar dados', description: 'Não foi possível carregar as torres.' });
      })
      .finally(() => setLoadingTowers(false));
  }, [projectId]);

  // ── Load floors when tower changes ───────────────────────────────────────

  useEffect(() => {
    if (!projectId || !selectedTowerId) { setFloors([]); return; }
    setLoadingFloors(true);
    setSelectedFloorId(null);
    setFloorUnitsCache({});
    towersApi
      .listFloors(projectId, selectedTowerId)
      .then((f) => {
        setFloors(f);
        if (f.length > 0) setSelectedFloorId(f[0].id);
      })
      .catch(() => {})
      .finally(() => setLoadingFloors(false));
  }, [selectedTowerId, projectId]);

  // ── Load units when floor changes ────────────────────────────────────────

  useEffect(() => {
    if (!selectedFloorId) { setUnits([]); return; }
    setLoadingUnits(true);
    setSelectedUnitId(null);
    towersApi
      .listUnits(selectedFloorId)
      .then((u) => {
        setUnits(u);
        setFloorUnitsCache((prev) => ({ ...prev, [selectedFloorId]: u }));
      })
      .catch(() => {})
      .finally(() => setLoadingUnits(false));
  }, [selectedFloorId]);

  // ── Load measurements when unit changes ──────────────────────────────────

  const buildEntries = useCallback(
    (meas: Measurement[], types: ActivityType[]): ActivityEntry[] => {
      return types.map((at) => {
        const existing = meas.find((m) => m.activityTypeId === at.id);
        const percent = existing?.percentComplete ?? 0;
        const execQty = existing?.executedQty ?? 0;
        const totalQty = existing?.totalQty ?? at.defaultQuantity;
        const mode: 'PERCENT' | 'METRIC' = at.measurementMethod !== 'PERCENT' && totalQty > 0 ? 'METRIC' : 'PERCENT';
        const computed = mode === 'METRIC' ? calcFromMetric(execQty, totalQty) : percent;
        return {
          activityTypeId: at.id,
          name: at.name,
          measurementMethod: at.measurementMethod as 'PERCENT' | 'METRIC' | 'COUNT',
          unit: at.unit,
          defaultQuantity: at.defaultQuantity,
          mode,
          percentValue: percent,
          executedQty: execQty,
          totalQty,
          computed,
          isDirty: false,
        };
      });
    },
    [],
  );

  useEffect(() => {
    if (!selectedUnitId) { setEntries([]); return; }
    setLoadingMeasurements(true);
    measurementsApi
      .list(selectedUnitId)
      .then((meas) => {
        setMeasurements(meas);
        setEntries(buildEntries(meas, activityTypes));
      })
      .catch(() => {
        setEntries(buildEntries([], activityTypes));
      })
      .finally(() => setLoadingMeasurements(false));
  }, [selectedUnitId, activityTypes, buildEntries]);

  // ── Computed overall progress ─────────────────────────────────────────────

  const overallProgress = useMemo(() => calcOverallProgress(entries), [entries]);

  const selectedUnit = useMemo(
    () => units.find((u) => u.id === selectedUnitId) ?? null,
    [units, selectedUnitId],
  );

  const selectedFloor = useMemo(
    () => floors.find((f) => f.id === selectedFloorId) ?? null,
    [floors, selectedFloorId],
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleEntryChange(idx: number, updated: Partial<ActivityEntry>) {
    setEntries((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...updated };
      return next;
    });
  }

  function handleMarkDone(idx: number) {
    handleEntryChange(idx, { computed: 100, percentValue: 100, isDirty: true });
  }

  function handleAllDone() {
    setEntries((prev) => prev.map((e) => ({ ...e, computed: 100, percentValue: 100, isDirty: true })));
  }

  async function handleSave() {
    if (!selectedUnitId) return;
    const dirty = entries.filter((e) => e.isDirty);
    if (dirty.length === 0) return;
    setSaving(true);
    try {
      await Promise.all(
        dirty.map((e) =>
          measurementsApi.create(selectedUnitId, {
            activityTypeId: e.activityTypeId,
            percentComplete: e.computed,
            executedQty: e.mode === 'METRIC' ? e.executedQty : undefined,
            totalQty: e.mode === 'METRIC' ? e.totalQty : undefined,
          }),
        ),
      );
      setEntries((prev) => prev.map((e) => ({ ...e, isDirty: false })));
      setFloorUnitsCache((prev) => {
        if (!selectedFloorId) return prev;
        const floorUnits = (prev[selectedFloorId] ?? []).map((u) =>
          u.id === selectedUnitId ? { ...u, progressPercent: overallProgress } : u,
        );
        return { ...prev, [selectedFloorId]: floorUnits };
      });
      addToast({ type: 'success', title: 'Salvo com sucesso', description: 'Medição da unidade salva.' });
    } catch {
      addToast({ type: 'error', title: 'Erro ao salvar', description: 'Tente novamente.' });
    } finally {
      setSaving(false);
    }
  }

  // ── No project guard ──────────────────────────────────────────────────────

  if (!currentProject) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16, textAlign: 'center', padding: '0 1rem' }}>
        <div style={{ fontSize: 13, color: 'var(--t2)' }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--t1)', marginBottom: 4 }}>Selecione um projeto</p>
          <p>Escolha um projeto no seletor acima para registrar medições.</p>
        </div>
      </div>
    );
  }

  // ── Layout ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>

      {/* ── Left: building SVG card ── */}
      <div style={{ flexShrink: 0 }}>
        <div className="ao-card" style={{ padding: '.875rem', width: 230 }}>
          <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Modelo do empreendimento</p>

          {/* Tower select */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: 'var(--t2)', display: 'block', marginBottom: 4 }}>Torre</label>
            {loadingTowers ? (
              <div style={{ height: 32, background: 'var(--bg3)', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
            ) : (
              <select
                value={selectedTowerId ?? ''}
                onChange={(e) => setSelectedTowerId(e.target.value || null)}
                style={{ width: '100%', padding: '5px 8px', fontSize: 11, border: '0.5px solid var(--bd2)', borderRadius: 8, background: 'var(--bg1)', color: 'var(--t1)', fontFamily: 'var(--font)' }}
              >
                <option value="">Selecione a torre</option>
                {towers.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Building SVG */}
          {loadingFloors ? (
            <div style={{ height: 200, background: 'var(--bg3)', borderRadius: 8, marginBottom: 10 }} />
          ) : (
            <BuildingSVG
              floors={floors}
              unitsCache={floorUnitsCache}
              selectedFloorId={selectedFloorId}
              onSelectFloor={setSelectedFloorId}
            />
          )}

          {/* Floor select */}
          <div style={{ marginTop: 10 }}>
            <label style={{ fontSize: 11, color: 'var(--t2)', display: 'block', marginBottom: 4 }}>Andar</label>
            <select
              value={selectedFloorId ?? ''}
              onChange={(e) => setSelectedFloorId(e.target.value || null)}
              disabled={floors.length === 0}
              style={{ width: '100%', padding: '5px 8px', fontSize: 11, border: '0.5px solid var(--bd2)', borderRadius: 8, background: 'var(--bg1)', color: 'var(--t1)', fontFamily: 'var(--font)' }}
            >
              <option value="">Selecione o andar</option>
              {floors.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          {/* Floor summary */}
          {selectedFloor && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid var(--bd)', fontSize: 11, color: 'var(--t2)' }}>
              <p style={{ fontWeight: 500, color: 'var(--t1)', marginBottom: 3 }}>{selectedFloor.name}</p>
              <p>{units.length} unidades</p>
              <p>{units.filter((u) => (u.progressPercent ?? 0) >= 100).length} concluídas</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Right: units + activities ── */}
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
              Selecione um andar para ver as unidades
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
                      padding: 7,
                      borderRadius: 8,
                      fontSize: 10,
                      textAlign: 'center',
                      cursor: 'pointer',
                      border: isSelected ? '1.5px solid var(--amber)' : '0.5px solid var(--bd)',
                      background: bgColor,
                      color: textColor,
                      transition: 'all .15s',
                      boxShadow: isSelected ? '0 0 0 2px rgba(186,117,23,.25)' : 'none',
                      fontFamily: 'var(--font)',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.04)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                  >
                    <div style={{ fontWeight: 500, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{unit.name}</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{p.toFixed(0)}%</div>
                    {/* Mini progress bar */}
                    <div className="ao-pbar" style={{ marginTop: 4 }}>
                      <div
                        className="ao-pfill"
                        style={{
                          width: `${p}%`,
                          background: state === 'co' ? 'var(--green)' : state === 'ea' ? 'var(--amber)' : 'var(--bg3)',
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Activities card */}
        <div className="ao-card" id="activities">
          <div className="ao-card-hdr" style={{ marginBottom: 4 }}>
            <span className="ao-card-title">
              {selectedUnit ? `Atividades — ${selectedUnit.name}` : 'Atividades'}
            </span>
            {selectedUnit && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="ao-btn ao-btn-sm ao-btn-ok"
                  onClick={handleAllDone}
                  disabled={saving}
                >
                  Tudo concluído
                </button>
                <button
                  className={`ao-btn ao-btn-sm${entries.some((e) => e.isDirty) ? ' ao-btn-primary' : ''}`}
                  onClick={handleSave}
                  disabled={saving || entries.every((e) => !e.isDirty)}
                >
                  {saving ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            )}
          </div>

          {!selectedUnitId ? (
            <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 12, color: 'var(--t3)' }}>
              Selecione uma unidade para registrar medições
            </div>
          ) : loadingMeasurements ? (
            <div>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ height: 44, background: 'var(--bg3)', borderRadius: 8, marginBottom: 6 }} />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: 'var(--t3)' }}>
              Nenhum tipo de atividade cadastrado para este projeto.
            </div>
          ) : (
            <div>
              {entries.map((entry, idx) => {
                const isMetric = entry.mode === 'METRIC' && entry.measurementMethod !== 'PERCENT';
                const p = entry.computed;

                function handlePercentChange(val: string) {
                  const n = Math.min(100, Math.max(0, parseFloat(val) || 0));
                  handleEntryChange(idx, { percentValue: n, computed: n, isDirty: true });
                }

                function handleExecutedChange(val: string) {
                  const executed = parseFloat(val) || 0;
                  const computed = calcFromMetric(executed, entry.totalQty);
                  handleEntryChange(idx, { executedQty: executed, computed, isDirty: true });
                }

                function handleTotalChange(val: string) {
                  const total = parseFloat(val) || 0;
                  const computed = calcFromMetric(entry.executedQty, total);
                  handleEntryChange(idx, { totalQty: total, computed, isDirty: true });
                }

                return (
                  <div
                    key={entry.activityTypeId}
                    className="mrow"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '7px 0',
                      borderBottom: '0.5px solid var(--bd)',
                      background: entry.isDirty ? 'rgba(186,117,23,.04)' : undefined,
                    }}
                  >
                    {/* Name + method badge */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {entry.name}
                        </span>
                        <span className="ao-badge ao-bk" style={{ flexShrink: 0 }}>{methodLabel(entry.measurementMethod)}</span>
                      </div>
                    </div>

                    {/* Mode toggle */}
                    {entry.measurementMethod !== 'PERCENT' && (
                      <div style={{ display: 'flex', borderRadius: 6, border: '0.5px solid var(--bd2)', overflow: 'hidden', flexShrink: 0 }}>
                        <button
                          onClick={() => handleEntryChange(idx, { mode: 'PERCENT', isDirty: true })}
                          style={{
                            padding: '3px 8px',
                            fontSize: 10,
                            border: 'none',
                            cursor: 'pointer',
                            fontFamily: 'var(--font)',
                            background: !isMetric ? 'var(--amber)' : 'var(--bg2)',
                            color: !isMetric ? '#fff' : 'var(--t2)',
                            transition: 'all .15s',
                          }}
                        >
                          % Manual
                        </button>
                        <button
                          onClick={() => handleEntryChange(idx, { mode: 'METRIC', isDirty: true })}
                          style={{
                            padding: '3px 8px',
                            fontSize: 10,
                            border: 'none',
                            cursor: 'pointer',
                            fontFamily: 'var(--font)',
                            background: isMetric ? 'var(--amber)' : 'var(--bg2)',
                            color: isMetric ? '#fff' : 'var(--t2)',
                            transition: 'all .15s',
                          }}
                        >
                          Métrica
                        </button>
                      </div>
                    )}

                    {/* Input(s) */}
                    {isMetric ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <input
                          type="number"
                          min={0}
                          value={entry.executedQty}
                          onChange={(e) => handleExecutedChange(e.target.value)}
                          placeholder="Exec."
                          style={{ width: 60, padding: '4px 6px', fontSize: 11, border: '0.5px solid var(--bd2)', borderRadius: 6, background: 'var(--bg1)', color: 'var(--t1)', fontFamily: 'var(--font)' }}
                        />
                        <span style={{ fontSize: 10, color: 'var(--t3)' }}>/</span>
                        <input
                          type="number"
                          min={0}
                          value={entry.totalQty}
                          onChange={(e) => handleTotalChange(e.target.value)}
                          placeholder="Total"
                          style={{ width: 60, padding: '4px 6px', fontSize: 11, border: '0.5px solid var(--bd2)', borderRadius: 6, background: 'var(--bg1)', color: 'var(--t1)', fontFamily: 'var(--font)' }}
                        />
                        <span style={{ fontSize: 10, color: 'var(--t3)' }}>{entry.unit}</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={entry.percentValue}
                          onChange={(e) => handlePercentChange(e.target.value)}
                          placeholder="0–100"
                          style={{ width: 64, padding: '4px 6px', fontSize: 11, border: '0.5px solid var(--bd2)', borderRadius: 6, background: 'var(--bg1)', color: 'var(--t1)', fontFamily: 'var(--font)' }}
                        />
                        <span style={{ fontSize: 10, color: 'var(--t3)' }}>%</span>
                      </div>
                    )}

                    {/* Pct display */}
                    <span style={{ fontSize: 14, fontWeight: 500, minWidth: 38, textAlign: 'right', color: p >= 100 ? 'var(--green)' : p > 0 ? 'var(--amber)' : 'var(--t3)', flexShrink: 0 }}>
                      {p.toFixed(1)}%
                    </span>

                    {/* Status badge */}
                    <span className={statusBadgeClass(p)} style={{ flexShrink: 0, minWidth: 74, justifyContent: 'center' }}>
                      {statusLabel(p)}
                    </span>

                    {/* Mark done button */}
                    <button
                      onClick={() => handleMarkDone(idx)}
                      title="Marcar 100%"
                      className="ao-btn ao-btn-sm ao-btn-ok"
                      style={{ flexShrink: 0, borderRadius: '50%', width: 24, height: 24, padding: 0, justifyContent: 'center' }}
                    >
                      ✓
                    </button>
                  </div>
                );
              })}

              {/* Footer save */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 12 }}>
                <button className="ao-btn ao-btn-sm ao-btn-ok" onClick={handleAllDone} disabled={saving}>
                  Tudo concluído
                </button>
                <button
                  className={`ao-btn ao-btn-sm${entries.some((e) => e.isDirty) ? ' ao-btn-primary' : ''}`}
                  onClick={handleSave}
                  disabled={saving || entries.every((e) => !e.isDirty)}
                >
                  {saving ? 'Salvando…' : 'Salvar Medição'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
