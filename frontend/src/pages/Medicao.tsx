import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Undo2, Redo2 } from 'lucide-react';
import { useStore } from '@/store';
import { towersApi, measurementsApi, activityTypesApi } from '@/services/api';
import type { Tower, Floor, Unit, ActivityType, Measurement } from '@/types';
import { useHistoryStore } from '@/store/historyStore';

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

type StatusFilter = 'todos' | 'ni' | 'ea' | 'co';

interface TowerProgress {
  [towerId: string]: number;
}

interface FloorProgress {
  [floorId: string]: number;
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

function heatmapColor(pct: number): string {
  if (pct === 0) return '#EBF0F6';
  if (pct <= 30) return '#FEF3C7';
  if (pct <= 60) return '#FCD34D';
  if (pct < 100) return '#86EFAC';
  return '#4ADE80';
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

// ── KpiBar Component ──────────────────────────────────────────────────────────

interface KpiBarProps {
  overallProgress: number;
  towerProgresses: TowerProgress;
  towers: Tower[];
  unitsTotal: number;
  unitsDone: number;
}

function KpiBar({ overallProgress, towerProgresses, towers, unitsTotal, unitsDone }: KpiBarProps) {
  return (
    <div style={{
      background: 'var(--s0)',
      padding: '12px 16px',
      borderBottom: '1px solid var(--bd)',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '16px',
      marginBottom: '12px',
    }}>
      {/* Progresso Geral */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>
          Avanço Geral da Obra
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--blue)', letterSpacing: '-1px' }}>
            {overallProgress}%
          </div>
          <div className="ao-pbar" style={{ flex: 1, minHeight: 6 }}>
            <div
              className="ao-pfill"
              style={{
                width: `${overallProgress}%`,
                background: heatmapColor(overallProgress),
                borderRadius: 3,
              }}
            />
          </div>
        </div>
      </div>

      {/* Unidades */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>
          Unidades
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--t1)' }}>
          {unitsDone} <span style={{ fontSize: 12, color: 'var(--t3)' }}>/ {unitsTotal}</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>concluídas</div>
      </div>

      {/* Torres */}
      {towers.length > 1 && towers.map((tower) => (
        <div key={tower.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>
            {tower.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--t1)' }}>
              {Math.round(towerProgresses[tower.id] ?? 0)}%
            </div>
            <div className="ao-pbar" style={{ flex: 1, minHeight: 4 }}>
              <div
                className="ao-pfill"
                style={{
                  width: `${towerProgresses[tower.id] ?? 0}%`,
                  background: heatmapColor(towerProgresses[tower.id] ?? 0),
                  borderRadius: 2,
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Building Model 3D (SVG Isométrico + Heatmap) ──────────────────────────────

interface BuildingModel3DProps {
  floors: Floor[];
  unitsCache: Record<string, Unit[]>;
  selectedFloorId: string | null;
  onSelectFloor: (floorId: string) => void;
  floorProgresses: FloorProgress;
}

function BuildingModel3D({
  floors,
  unitsCache,
  selectedFloorId,
  onSelectFloor,
  floorProgresses,
}: BuildingModel3DProps) {
  const sorted = [...floors].sort((a, b) => b.level - a.level);
  const displayFloors = sorted.slice(0, 12);

  const FLOOR_H = 36;
  const TOP_Y = 16;

  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
      {/* SVG */}
      <svg viewBox="0 0 220 340" width="180" height="290" style={{ display: 'block', flexShrink: 0 }}>
        {/* Shadow */}
        <ellipse cx="130" cy="334" rx="65" ry="6" fill="rgba(0,0,0,.06)" />
        {/* Side face */}
        <polygon points="178,22 218,8 218,314 178,328" fill="var(--s3)" stroke="var(--bd2)" strokeWidth=".5" />
        {/* Roof */}
        <polygon points="22,22 62,8 218,8 178,22" fill="var(--s2)" stroke="var(--bd2)" strokeWidth=".5" />
        {/* Main facade */}
        <rect x="22" y="22" width="156" height="274" fill="var(--s1)" stroke="var(--bd2)" strokeWidth=".5" />

        {/* Floor labels + windows */}
        {displayFloors.map((floor, idx) => {
          const y = TOP_Y + idx * FLOOR_H;
          const avg = floorProgresses[floor.id] ?? 0;
          const isSelected = floor.id === selectedFloorId;

          const winW = 20;
          const winH = 12;
          const winY = y + 7;
          const winXs = [32, 62, 92, 122];

          return (
            <g key={floor.id} onClick={() => onSelectFloor(floor.id)} style={{ cursor: 'pointer' }}>
              {/* Floor outline */}
              <rect
                x="22"
                y={y}
                width="156"
                height={FLOOR_H - 1}
                fill="transparent"
                stroke={isSelected ? 'var(--blue)' : 'var(--bd)'}
                strokeWidth={isSelected ? 2 : 0.5}
              />
              {/* Windows */}
              {winXs.map((wx, wi) => (
                <rect
                  key={wi}
                  x={wx}
                  y={winY}
                  width={winW}
                  height={winH}
                  rx="1.5"
                  fill={heatmapColor(avg)}
                  opacity={0.85}
                  stroke={isSelected ? 'var(--blue)' : 'none'}
                  strokeWidth={isSelected ? 0.5 : 0}
                />
              ))}
              {/* Floor label */}
              <text x="186" y={y + 22} fontSize="8" fill="var(--t3)" fontFamily="sans-serif" fontWeight="500">
                {floor.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Heatmap Sidebar */}
      <div style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        maxHeight: 290,
        overflowY: 'auto',
        paddingRight: '4px',
      }}>
        {displayFloors.map((floor) => {
          const progress = floorProgresses[floor.id] ?? 0;
          const isSelected = floor.id === selectedFloorId;

          return (
            <div
              key={floor.id}
              onClick={() => onSelectFloor(floor.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 6px',
                borderRadius: '5px',
                cursor: 'pointer',
                background: isSelected ? 'rgba(27,111,232,.12)' : 'transparent',
                border: isSelected ? '1px solid var(--blue)' : 'none',
                fontSize: '10px',
                fontWeight: 500,
              }}
            >
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--t2)' }}>
                {floor.name}
              </div>
              <div className="ao-pbar" style={{ minWidth: '40px', minHeight: '3px' }}>
                <div
                  className="ao-pfill"
                  style={{
                    width: `${progress}%`,
                    background: heatmapColor(progress),
                    borderRadius: '1px',
                  }}
                />
              </div>
              <div style={{ minWidth: '24px', textAlign: 'right', fontWeight: 600, color: 'var(--t1)' }}>
                {Math.round(progress)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Heatmap Legend ────────────────────────────────────────────────────────────

function HeatmapLegend() {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '8px',
      fontSize: '10px',
      marginTop: '10px',
      padding: '10px',
      background: 'var(--s2)',
      borderRadius: 'var(--r-md)',
      border: '1px solid var(--bd)',
    }}>
      {[
        { pct: 100, label: 'Concluído' },
        { pct: 70, label: 'Em andamento' },
        { pct: 30, label: 'Iniciado' },
        { pct: 0, label: 'Não iniciado' },
      ].map((item) => (
        <div key={item.pct} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div
            style={{
              width: '16px',
              height: '10px',
              borderRadius: '2px',
              background: heatmapColor(item.pct),
            }}
          />
          <span style={{ color: 'var(--t2)' }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Filter Buttons ────────────────────────────────────────────────────────────

interface FilterProps {
  current: StatusFilter;
  onChange: (filter: StatusFilter) => void;
}

function StatusFilterButtons({ current, onChange }: FilterProps) {
  const filters: Array<{ value: StatusFilter; label: string }> = [
    { value: 'todos', label: 'Todos' },
    { value: 'ni', label: 'Não iniciado' },
    { value: 'ea', label: 'Em andamento' },
    { value: 'co', label: 'Concluído' },
  ];

  return (
    <div className="ao-tab-bar" style={{ marginBottom: '10px', display: 'inline-flex', borderBottom: 'none', border: '1px solid var(--bd)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
      {filters.map((f) => (
        <button
          key={f.value}
          onClick={() => onChange(f.value)}
          className={`ao-tab${current === f.value ? ' active' : ''}`}
          style={{ borderTop: 'none', marginBottom: 0, padding: '5px 12px' }}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

// ── Progress Cascade ──────────────────────────────────────────────────────────

interface ProgressCascadeProps {
  unitProgress: number;
  floorProgress: number;
  towerProgress: number;
  overallProgress: number;
  selectedUnit: Unit | null;
  selectedFloor: Floor | null;
  selectedTower: Tower | null;
}

function ProgressCascade({
  unitProgress,
  floorProgress,
  towerProgress,
  overallProgress,
  selectedUnit,
  selectedFloor,
  selectedTower,
}: ProgressCascadeProps) {
  const cascadeItems = [
    { label: `${selectedUnit?.name ?? 'Unidade'}`, value: unitProgress },
    { label: `${selectedFloor?.name ?? 'Pavimento'}`, value: floorProgress },
    { label: `${selectedTower?.name ?? 'Torre'}`, value: towerProgress },
    { label: 'Obra Geral', value: overallProgress },
  ];

  return (
    <div style={{
      background: 'var(--s1)',
      border: '1px solid var(--bd)',
      borderRadius: '8px',
      padding: '12px',
      marginTop: '12px',
      fontSize: '11px',
    }}>
      <div style={{ fontWeight: 600, color: 'var(--t1)', marginBottom: '8px' }}>Progresso em Cascata</div>
      {cascadeItems.map((item, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: idx < cascadeItems.length - 1 ? '6px' : 0 }}>
          <div style={{ minWidth: '80px', textAlign: 'right', fontWeight: 500, color: 'var(--t1)' }}>
            {item.label}:
          </div>
          <div className="ao-pbar" style={{ flex: 1, minHeight: '6px' }}>
            <div
              className="ao-pfill"
              style={{
                width: `${item.value}%`,
                background: heatmapColor(item.value),
                borderRadius: '3px',
              }}
            />
          </div>
          <div style={{ minWidth: '36px', textAlign: 'right', fontWeight: 600, color: 'var(--t1)' }}>
            {Math.round(item.value)}%
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Medicao() {
  const { currentProject, addToast } = useStore();
  const projectId = currentProject?.id;
  const { push, triggerDataOnly, dataOnlyTrigger, past, future, undo, redo, isProcessing: historyProcessing } = useHistoryStore();
  // Tracks the last-saved state of entries per unit (for undo)
  const committedEntriesRef = useRef<Map<string, ActivityEntry[]>>(new Map());
  const [measurementRefreshTick, setMeasurementRefreshTick] = useState(0);

  // dataOnlyTrigger: undo/redo refreshes only measurements for current unit, preserving navigation
  useEffect(() => {
    if (dataOnlyTrigger > 0) setMeasurementRefreshTick((t) => t + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataOnlyTrigger]);

  const [towers, setTowers] = useState<Tower[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);

  const [selectedTowerId, setSelectedTowerId] = useState<string | null>(null);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');

  const [floorUnitsCache, setFloorUnitsCache] = useState<Record<string, Unit[]>>({});
  const [floorProgresses, setFloorProgresses] = useState<FloorProgress>({});
  const [towerProgresses, setTowerProgresses] = useState<TowerProgress>({});

  const [loadingTowers, setLoadingTowers] = useState(false);
  const [loadingFloors, setLoadingFloors] = useState(false);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [loadingMeasurements, setLoadingMeasurements] = useState(false);
  const [saving, setSaving] = useState(false);

  const [entries, setEntries] = useState<ActivityEntry[]>([]);

  // Calculates floor progress from units
  const calculateFloorProgress = useCallback((floorId: string, cache: Record<string, Unit[]>): number => {
    const floorUnits = cache[floorId] ?? [];
    if (floorUnits.length === 0) return 0;
    const sum = floorUnits.reduce((acc, u) => acc + (u.progressPercent ?? 0), 0);
    return Math.round(sum / floorUnits.length);
  }, []);

  // Calculates tower progress from floors
  const calculateTowerProgress = useCallback(
    (towerId: string, towerFloors: Floor[], cache: Record<string, Unit[]>): number => {
      const floorProgresses = towerFloors.map((f) => calculateFloorProgress(f.id, cache));
      if (floorProgresses.length === 0) return 0;
      const sum = floorProgresses.reduce((a, b) => a + b, 0);
      return Math.round(sum / floorProgresses.length);
    },
    [calculateFloorProgress],
  );

  // Calculates overall progress from towers
  const calculateOverallProgress = useCallback(
    (allTowers: Tower[], allFloors: Floor[], cache: Record<string, Unit[]>): number => {
      const towerProgs = allTowers.map((t) => {
        const towerFloors = allFloors.filter((f) => f.towerId === t.id);
        return calculateTowerProgress(t.id, towerFloors, cache);
      });
      if (towerProgs.length === 0) return 0;
      const sum = towerProgs.reduce((a, b) => a + b, 0);
      return Math.round(sum / towerProgs.length);
    },
    [calculateTowerProgress],
  );

  // ── Load towers + activity types + building data ─────────────────────────

  useEffect(() => {
    if (!projectId) return;
    setLoadingTowers(true);
    Promise.all([
      towersApi.list(projectId),
      activityTypesApi.list(projectId),
      measurementsApi.buildingData(projectId),
    ])
      .then(([t, at, bd]) => {
        setTowers(t);
        setActivityTypes(at);
        if (t.length > 0) setSelectedTowerId(t[0].id);

        // Populate floorUnitsCache and floorProgresses from buildingData
        const unitsCache: Record<string, Unit[]> = {};
        const floorProgs: FloorProgress = {};

        bd.towers.forEach((tower) => {
          tower.floors.forEach((floor) => {
            floorProgs[floor.id] = floor.averageProgress;
            unitsCache[floor.id] = floor.units.map((unit, idx) => ({
              id: unit.id,
              floorId: floor.id,
              name: unit.name,
              area: 0,
              order: idx,
              progressPercent: unit.progressPercent,
            } as Unit));
          });
        });

        setFloorUnitsCache(unitsCache);
        setFloorProgresses(floorProgs);
      })
      .catch(() => {
        addToast({ type: 'error', title: 'Erro ao carregar dados', description: 'Não foi possível carregar as torres.' });
      })
      .finally(() => setLoadingTowers(false));
  }, [projectId, addToast]);

  // ── Load floors when tower changes ───────────────────────────────────────

  useEffect(() => {
    if (!projectId || !selectedTowerId) {
      setFloors([]);
      return;
    }
    setLoadingFloors(true);
    setSelectedFloorId(null);
    setFloorUnitsCache({});
    setFloorProgresses({});
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
    if (!selectedFloorId) {
      setUnits([]);
      return;
    }
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
    if (!selectedUnitId) {
      setEntries([]);
      return;
    }
    setLoadingMeasurements(true);
    measurementsApi
      .list(selectedUnitId)
      .then((meas) => {
        setMeasurements(meas);
        const built = buildEntries(meas, activityTypes);
        setEntries(built);
        committedEntriesRef.current.set(selectedUnitId, built);
      })
      .catch(() => {
        const empty = buildEntries([], activityTypes);
        setEntries(empty);
        if (selectedUnitId) committedEntriesRef.current.set(selectedUnitId, empty);
      })
      .finally(() => setLoadingMeasurements(false));
  }, [selectedUnitId, activityTypes, buildEntries, measurementRefreshTick]);

  // ── Calculate all progress values ────────────────────────────────────────

  const overallProgress = useMemo(() => {
    return calculateOverallProgress(towers, floors, floorUnitsCache);
  }, [towers, floors, floorUnitsCache, calculateOverallProgress]);

  const currentUnitProgress = useMemo(() => calcOverallProgress(entries), [entries]);

  const currentFloorProgress = useMemo(() => {
    if (!selectedFloorId) return 0;
    return calculateFloorProgress(selectedFloorId, floorUnitsCache);
  }, [selectedFloorId, floorUnitsCache, calculateFloorProgress]);

  const currentTowerProgress = useMemo(() => {
    if (!selectedTowerId) return 0;
    const towerFloors = floors.filter((f) => f.towerId === selectedTowerId);
    return calculateTowerProgress(selectedTowerId, towerFloors, floorUnitsCache);
  }, [selectedTowerId, floors, floorUnitsCache, calculateTowerProgress]);

  // Update tower progresses for KPI
  useEffect(() => {
    const newTowerProgresses: TowerProgress = {};
    towers.forEach((t) => {
      const towerFloors = floors.filter((f) => f.towerId === t.id);
      newTowerProgresses[t.id] = calculateTowerProgress(t.id, towerFloors, floorUnitsCache);
    });
    setTowerProgresses(newTowerProgresses);
  }, [towers, floors, floorUnitsCache, calculateTowerProgress]);

  const selectedUnit = useMemo(() => units.find((u) => u.id === selectedUnitId) ?? null, [units, selectedUnitId]);
  const selectedFloor = useMemo(() => floors.find((f) => f.id === selectedFloorId) ?? null, [floors, selectedFloorId]);
  const selectedTower = useMemo(() => towers.find((t) => t.id === selectedTowerId) ?? null, [towers, selectedTowerId]);

  // Count units done
  const unitsDone = useMemo(() => {
    return Object.values(floorUnitsCache)
      .flat()
      .filter((u) => (u.progressPercent ?? 0) >= 100).length;
  }, [floorUnitsCache]);

  const unitsTotal = useMemo(() => {
    return Object.values(floorUnitsCache).flat().length;
  }, [floorUnitsCache]);

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
    if (!selectedUnitId || !selectedFloorId) return;
    const dirty = entries.filter((e) => e.isDirty);
    if (dirty.length === 0) return;
    setSaving(true);

    // Capture old (committed) state before overwriting
    const unitId = selectedUnitId;
    const oldCommitted = committedEntriesRef.current.get(unitId) ?? [];
    const oldSnapshots = dirty.map((e) => {
      const old = oldCommitted.find((o) => o.activityTypeId === e.activityTypeId);
      return { activityTypeId: e.activityTypeId, percentComplete: old?.computed ?? 0, executedQty: old?.executedQty, totalQty: old?.totalQty };
    });
    const newSnapshots = dirty.map((e) => ({
      activityTypeId: e.activityTypeId, percentComplete: e.computed,
      executedQty: e.mode === 'METRIC' ? e.executedQty : undefined,
      totalQty: e.mode === 'METRIC' ? e.totalQty : undefined,
    }));

    try {
      await Promise.all(
        dirty.map((e) =>
          measurementsApi.create(unitId, {
            activityTypeId: e.activityTypeId,
            percentComplete: e.computed,
            executedQty: e.mode === 'METRIC' ? e.executedQty : undefined,
            totalQty: e.mode === 'METRIC' ? e.totalQty : undefined,
          }),
        ),
      );

      // Calculate new unit progress from entries
      const cleanedEntries = entries.map((e) => ({ ...e, isDirty: false }));
      const newUnitProgress = calcOverallProgress(cleanedEntries);

      // Update entries to clean state
      setEntries(cleanedEntries);
      committedEntriesRef.current.set(unitId, cleanedEntries);

      // Update unit in cache with new progress
      const updatedUnits = (floorUnitsCache[selectedFloorId] ?? []).map((u) =>
        u.id === unitId ? { ...u, progressPercent: newUnitProgress } : u,
      );

      setFloorUnitsCache((prev) => ({ ...prev, [selectedFloorId]: updatedUnits }));

      // Recalculate floor progress from updated units
      const unitProgresses = updatedUnits.map((u) => u.progressPercent ?? 0);
      const newFloorProgress =
        unitProgresses.length > 0
          ? Math.round(unitProgresses.reduce((a, b) => a + b, 0) / unitProgresses.length)
          : 0;

      setFloorProgresses((prev) => ({ ...prev, [selectedFloorId]: newFloorProgress }));

      addToast({ type: 'success', title: 'Salvo com sucesso', description: 'Medição da unidade salva.' });

      // Record in history
      push({
        description: `Medição: ${dirty.length} atividade(s) salva(s)`,
        module: 'medicao',
        undo: async () => {
          await Promise.all(oldSnapshots.map((s) => measurementsApi.create(unitId, s)));
          triggerDataOnly();
        },
        redo: async () => {
          await Promise.all(newSnapshots.map((s) => measurementsApi.create(unitId, s)));
          triggerDataOnly();
        },
      });
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

  // ── Filtered units ────────────────────────────────────────────────────────

  const filteredUnits = useMemo(() => {
    if (statusFilter === 'todos') return units;
    return units.filter((u) => unitState(u.progressPercent ?? 0) === statusFilter);
  }, [units, statusFilter]);

  // ── Layout ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* KPI Bar */}
      <KpiBar
        overallProgress={overallProgress}
        towerProgresses={towerProgresses}
        towers={towers}
        unitsTotal={unitsTotal}
        unitsDone={unitsDone}
      />

      {/* Main content */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '2rem' }}>

        {/* Left: Building Model */}
        <div style={{ flexShrink: 0 }}>
          <div className="ao-card" style={{ padding: '.875rem', width: 280 }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--t1)' }}>Modelo do Empreendimento</p>

            {/* Tower select */}
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: 'var(--t2)', display: 'block', marginBottom: 4, fontWeight: 500 }}>Torre</label>
              {loadingTowers ? (
                <div style={{ height: 32, background: 'var(--s2)', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
              ) : (
                <select
                  value={selectedTowerId ?? ''}
                  onChange={(e) => setSelectedTowerId(e.target.value || null)}
                  style={{ width: '100%', padding: '5px 8px', fontSize: 11, border: '1px solid var(--bd)', borderRadius: 8, background: 'var(--s0)', color: 'var(--t1)', fontFamily: 'var(--font)' }}
                >
                  <option value="">Selecione a torre</option>
                  {towers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Building model 3D */}
            {loadingFloors ? (
              <div style={{ height: 290, background: 'var(--s2)', borderRadius: 8, marginBottom: 10 }} />
            ) : (
              <BuildingModel3D
                floors={floors}
                unitsCache={floorUnitsCache}
                selectedFloorId={selectedFloorId}
                onSelectFloor={setSelectedFloorId}
                floorProgresses={floorProgresses}
              />
            )}

            {/* Floor select */}
            <div style={{ marginTop: 10 }}>
              <label style={{ fontSize: 11, color: 'var(--t2)', display: 'block', marginBottom: 4, fontWeight: 500 }}>Andar</label>
              <select
                value={selectedFloorId ?? ''}
                onChange={(e) => setSelectedFloorId(e.target.value || null)}
                disabled={floors.length === 0}
                style={{ width: '100%', padding: '5px 8px', fontSize: 11, border: '1px solid var(--bd)', borderRadius: 8, background: 'var(--s0)', color: 'var(--t1)', fontFamily: 'var(--font)' }}
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
                <p style={{ fontWeight: 600, color: 'var(--t1)', marginBottom: 3 }}>{selectedFloor.name}</p>
                <p>{units.length} unidades</p>
                <p>{units.filter((u) => (u.progressPercent ?? 0) >= 100).length} concluídas</p>
              </div>
            )}

            {/* Heatmap Legend */}
            <HeatmapLegend />
          </div>
        </div>

        {/* Right: Units + Activities */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Units card */}
          <div className="ao-card">
            <div className="ao-card-hdr" style={{ marginBottom: 10 }}>
              <span className="ao-card-title">
                Unidades {selectedFloor ? `— ${selectedFloor.name}` : ''}
              </span>
              {selectedUnit && (
                <span className={statusBadgeClass(currentUnitProgress)}>
                  {Math.round(currentUnitProgress)}% {statusLabel(currentUnitProgress)}
                </span>
              )}
            </div>

            {/* Filters */}
            {units.length > 0 && <StatusFilterButtons current={statusFilter} onChange={setStatusFilter} />}

            {loadingUnits ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(78px,1fr))', gap: 5 }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} style={{ height: 60, background: 'var(--s2)', borderRadius: 8 }} />
                ))}
              </div>
            ) : units.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: 'var(--t3)' }}>
                Selecione um andar para ver as unidades
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(78px,1fr))', gap: 5 }}>
                {filteredUnits.map((unit) => {
                  const p = unit.progressPercent ?? 0;
                  const state = unitState(p);
                  const isSelected = unit.id === selectedUnitId;

                  const bgColor = state === 'ni' ? 'var(--s1)' : state === 'co' ? 'var(--grn-bg)' : 'var(--amb-bg)';
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
                        border: isSelected ? '1.5px solid var(--blue)' : '1px solid var(--bd)',
                        background: bgColor,
                        color: textColor,
                        transition: 'all .15s',
                        boxShadow: isSelected ? '0 0 0 2px rgba(27,111,232,.18)' : 'none',
                        fontFamily: 'var(--font)',
                      }}
                    >
                      <div style={{ fontWeight: 500, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{unit.name}</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{p.toFixed(0)}%</div>
                      <div className="ao-pbar" style={{ marginTop: 4 }}>
                        <div
                          className="ao-pfill"
                          style={{
                            width: `${p}%`,
                            background: heatmapColor(p),
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
          <div className="ao-card">
            <div className="ao-card-hdr" style={{ marginBottom: 4 }}>
              <span className="ao-card-title">
                {selectedUnit ? `Atividades — ${selectedUnit.name}` : 'Atividades'}
              </span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button
                  className="ao-btn ao-btn-sm"
                  onClick={undo}
                  disabled={past.length === 0 || historyProcessing}
                  title={past.length > 0 ? `Desfazer: ${past[past.length - 1]?.description} (Ctrl+Z)` : 'Nada para desfazer'}
                  style={{ opacity: past.length > 0 && !historyProcessing ? 1 : 0.4, padding: '4px 8px' }}
                >
                  <Undo2 style={{ width: 12, height: 12 }} />
                </button>
                <button
                  className="ao-btn ao-btn-sm"
                  onClick={redo}
                  disabled={future.length === 0 || historyProcessing}
                  title={future.length > 0 ? `Refazer: ${future[0]?.description} (Ctrl+Y)` : 'Nada para refazer'}
                  style={{ opacity: future.length > 0 && !historyProcessing ? 1 : 0.4, padding: '4px 8px' }}
                >
                  <Redo2 style={{ width: 12, height: 12 }} />
                </button>
                {selectedUnit && (
                  <>
                    <div style={{ width: 1, height: 16, background: 'var(--bd)' }} />
                    <button className="ao-btn ao-btn-sm ao-btn-ok" onClick={handleAllDone} disabled={saving}>
                      Tudo concluído
                    </button>
                    <button
                      className={`ao-btn ao-btn-sm${entries.some((e) => e.isDirty) ? ' ao-btn-primary' : ''}`}
                      onClick={handleSave}
                      disabled={saving || entries.every((e) => !e.isDirty)}
                    >
                      {saving ? 'Salvando…' : 'Salvar'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {!selectedUnitId ? (
              <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 12, color: 'var(--t3)' }}>
                Selecione uma unidade para registrar medições
              </div>
            ) : loadingMeasurements ? (
              <div>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ height: 44, background: 'var(--s2)', borderRadius: 8, marginBottom: 6 }} />
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
                      style={{
                        padding: '8px 0',
                        borderBottom: '0.5px solid var(--bd)',
                        background: entry.isDirty ? 'rgba(186,117,23,.04)' : undefined,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        {/* Name + method */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)' }}>{entry.name}</span>
                            <span className="ao-badge ao-bk" style={{ flexShrink: 0 }}>{methodLabel(entry.measurementMethod)}</span>
                          </div>
                        </div>

                        {/* Mode toggle */}
                        {entry.measurementMethod !== 'PERCENT' && (
                          <div style={{ display: 'flex', borderRadius: 6, border: '1px solid var(--bd)', overflow: 'hidden', flexShrink: 0 }}>
                            <button
                              onClick={() => handleEntryChange(idx, { mode: 'PERCENT', isDirty: true })}
                              style={{
                                padding: '3px 8px',
                                fontSize: 9,
                                border: 'none',
                                cursor: 'pointer',
                                fontFamily: 'var(--font)',
                                background: !isMetric ? 'var(--blue)' : 'var(--s1)',
                                color: !isMetric ? '#fff' : 'var(--t2)',
                              }}
                            >
                              %
                            </button>
                            <button
                              onClick={() => handleEntryChange(idx, { mode: 'METRIC', isDirty: true })}
                              style={{
                                padding: '3px 8px',
                                fontSize: 9,
                                border: 'none',
                                cursor: 'pointer',
                                fontFamily: 'var(--font)',
                                background: isMetric ? 'var(--blue)' : 'var(--s1)',
                                color: isMetric ? '#fff' : 'var(--t2)',
                              }}
                            >
                              Métrica
                            </button>
                          </div>
                        )}

                        {/* Progress display */}
                        <span style={{ fontSize: 12, fontWeight: 600, minWidth: 36, textAlign: 'right', color: p >= 100 ? 'var(--green)' : p > 0 ? 'var(--amber)' : 'var(--t3)' }}>
                          {p.toFixed(0)}%
                        </span>

                        {/* Status badge */}
                        <span className={statusBadgeClass(p)} style={{ flexShrink: 0, minWidth: 66, justifyContent: 'center', fontSize: 9 }}>
                          {statusLabel(p)}
                        </span>

                        {/* Mark done button */}
                        <button
                          onClick={() => handleMarkDone(idx)}
                          title="Marcar 100%"
                          className="ao-btn ao-btn-sm ao-btn-ok"
                          style={{ flexShrink: 0, borderRadius: '50%', width: 22, height: 22, padding: 0 }}
                        >
                          ✓
                        </button>
                      </div>

                      {/* Progress bar */}
                      <div className="ao-pbar" style={{ marginBottom: 6 }}>
                        <div
                          className="ao-pfill"
                          style={{
                            width: `${p}%`,
                            background: heatmapColor(p),
                          }}
                        />
                      </div>

                      {/* Inputs */}
                      {isMetric ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 11 }}>
                          <span style={{ color: 'var(--t2)' }}>Executado:</span>
                          <input
                            type="number"
                            min={0}
                            value={entry.executedQty}
                            onChange={(e) => handleExecutedChange(e.target.value)}
                            style={{ width: 60, padding: '4px 6px', fontSize: 10, border: '1px solid var(--bd)', borderRadius: 4, background: 'var(--s0)', color: 'var(--t1)', fontFamily: 'var(--font)' }}
                          />
                          <span style={{ color: 'var(--t3)' }}>/</span>
                          <input
                            type="number"
                            min={0}
                            value={entry.totalQty}
                            onChange={(e) => handleTotalChange(e.target.value)}
                            style={{ width: 60, padding: '4px 6px', fontSize: 10, border: '1px solid var(--bd)', borderRadius: 4, background: 'var(--s0)', color: 'var(--t1)', fontFamily: 'var(--font)' }}
                          />
                          <span style={{ color: 'var(--t2)', fontWeight: 500 }}>{entry.unit}</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                          <span style={{ color: 'var(--t2)' }}>Percentual:</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={entry.percentValue}
                            onChange={(e) => handlePercentChange(e.target.value)}
                            style={{ width: 70, padding: '4px 6px', fontSize: 10, border: '1px solid var(--bd)', borderRadius: 4, background: 'var(--s0)', color: 'var(--t1)', fontFamily: 'var(--font)' }}
                          />
                          <span style={{ color: 'var(--t2)', fontWeight: 500 }}>%</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Footer buttons */}
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

          {/* Progress Cascade */}
          {selectedUnit && (
            <ProgressCascade
              unitProgress={currentUnitProgress}
              floorProgress={currentFloorProgress}
              towerProgress={currentTowerProgress}
              overallProgress={overallProgress}
              selectedUnit={selectedUnit}
              selectedFloor={selectedFloor}
              selectedTower={selectedTower}
            />
          )}
        </div>
      </div>
    </>
  );
}
