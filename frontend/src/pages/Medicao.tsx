import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Undo2, Redo2, Box, FileImage, Filter, RotateCcw } from 'lucide-react';
import { useStore } from '@/store';
import { towersApi, measurementsApi, activityTypesApi, uploadsApi } from '@/services/api';
import type { Tower, Floor, Unit, ActivityType, Measurement } from '@/types';
import { useHistoryStore } from '@/store/historyStore';
import {
  calcFromMetric,
  heatmapColor,
  methodLabel,
  statusBadgeClass,
  statusLabel,
  unitState,
  type StatusFilter,
} from '@/lib/measurement-helpers';
import BuildingViewer3D from '@/components/viewer/BuildingViewer3D';
import FloorPlanViewer2D from '@/components/viewer/FloorPlanViewer2D';
import { useRealtime, useMeasurementUpdates, useScheduleUpdates, useScheduleChanges } from '@/hooks/useRealtime';

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

interface TowerProgress { [towerId: string]: number; }
interface FloorProgress { [floorId: string]: number; }

type ViewerMode = '3d' | '2d';

interface Filters {
  status: StatusFilter;
  disciplineId: string | 'all';
}

// ── KpiBar ────────────────────────────────────────────────────────────────────

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>
          Avanço Geral da Obra
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--blue)', letterSpacing: '-1px' }}>
            {overallProgress}%
          </div>
          <div className="ao-pbar" style={{ flex: 1, minHeight: 6 }}>
            <div className="ao-pfill" style={{ width: `${overallProgress}%`, background: heatmapColor(overallProgress), borderRadius: 3 }} />
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>
          Unidades
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--t1)' }}>
          {unitsDone} <span style={{ fontSize: 12, color: 'var(--t3)' }}>/ {unitsTotal}</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>concluídas</div>
      </div>
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
              <div className="ao-pfill" style={{ width: `${towerProgresses[tower.id] ?? 0}%`, background: heatmapColor(towerProgresses[tower.id] ?? 0), borderRadius: 2 }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Toolbar ──────────────────────────────────────────────────────────────────

interface ToolbarProps {
  mode: ViewerMode;
  onModeChange: (m: ViewerMode) => void;
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  activityTypes: ActivityType[];
  towers: Tower[];
  floors: Floor[];
  selectedTowerId: string | null;
  selectedFloorId: string | null;
  onTowerChange: (id: string | null) => void;
  onFloorChange: (id: string | null) => void;
  hasIfc: boolean;
}

function MedicaoToolbar({
  mode, onModeChange, filters, onFiltersChange,
  activityTypes, towers, floors,
  selectedTowerId, selectedFloorId,
  onTowerChange, onFloorChange, hasIfc,
}: ToolbarProps) {
  const filterActive = filters.status !== 'todos' || filters.disciplineId !== 'all';
  return (
    <div className="ao-card" style={{ padding: '10px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      {/* Mode toggle */}
      <div style={{ display: 'flex', borderRadius: 8, border: '1px solid var(--bd)', overflow: 'hidden' }}>
        <button
          onClick={() => onModeChange('3d')}
          className="ao-btn ao-btn-sm"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: mode === '3d' ? 'var(--blue)' : 'transparent',
            color: mode === '3d' ? '#fff' : 'var(--t2)',
            border: 'none', borderRadius: 0, padding: '6px 12px',
          }}
        >
          <Box size={12} /> Modelo 3D {hasIfc && <span style={{ fontSize: 8, opacity: .85 }}>· IFC</span>}
        </button>
        <button
          onClick={() => onModeChange('2d')}
          className="ao-btn ao-btn-sm"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: mode === '2d' ? 'var(--blue)' : 'transparent',
            color: mode === '2d' ? '#fff' : 'var(--t2)',
            border: 'none', borderRadius: 0, padding: '6px 12px',
          }}
        >
          <FileImage size={12} /> Planta 2D
        </button>
      </div>

      <div style={{ width: 1, height: 20, background: 'var(--bd)' }} />

      {/* Tower select */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
        <span style={{ color: 'var(--t2)' }}>Torre:</span>
        <select
          value={selectedTowerId ?? ''}
          onChange={(e) => onTowerChange(e.target.value || null)}
          style={selectStyle}
        >
          <option value="">—</option>
          {towers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>

      {/* Floor select */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
        <span style={{ color: 'var(--t2)' }}>Pavto:</span>
        <select
          value={selectedFloorId ?? ''}
          onChange={(e) => onFloorChange(e.target.value || null)}
          disabled={floors.length === 0}
          style={selectStyle}
        >
          <option value="">—</option>
          {floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </label>

      <div style={{ width: 1, height: 20, background: 'var(--bd)' }} />

      {/* Filters */}
      <Filter size={13} color={filterActive ? 'var(--blue)' : 'var(--t3)'} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
        <span style={{ color: 'var(--t2)' }}>Status:</span>
        <select
          value={filters.status}
          onChange={(e) => onFiltersChange({ ...filters, status: e.target.value as StatusFilter })}
          style={selectStyle}
        >
          <option value="todos">Todos</option>
          <option value="ni">Não iniciado</option>
          <option value="ea">Em andamento</option>
          <option value="co">Concluído</option>
        </select>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
        <span style={{ color: 'var(--t2)' }}>Disciplina:</span>
        <select
          value={filters.disciplineId}
          onChange={(e) => onFiltersChange({ ...filters, disciplineId: e.target.value })}
          style={selectStyle}
        >
          <option value="all">Todas</option>
          {activityTypes.map((at) => <option key={at.id} value={at.id}>{at.name}</option>)}
        </select>
      </label>

      {filterActive && (
        <button
          className="ao-btn ao-btn-sm"
          onClick={() => onFiltersChange({ status: 'todos', disciplineId: 'all' })}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}
        >
          <RotateCcw size={10} /> Limpar
        </button>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: '5px 8px',
  fontSize: 11,
  border: '1px solid var(--bd)',
  borderRadius: 6,
  background: 'var(--s0)',
  color: 'var(--t1)',
  fontFamily: 'var(--font)',
  minWidth: 110,
};

// ── Breadcrumb ───────────────────────────────────────────────────────────────

function Breadcrumb({ tower, floor, unit }: { tower: Tower | null; floor: Floor | null; unit: Unit | null }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--t2)', marginBottom: 10, flexWrap: 'wrap' }}>
      <span style={{ color: 'var(--t3)' }}>📍</span>
      <span style={{ fontWeight: 500, color: tower ? 'var(--t1)' : 'var(--t3)' }}>{tower?.name ?? 'Selecione a torre'}</span>
      {floor && <><span style={{ color: 'var(--t3)' }}>›</span><span style={{ fontWeight: 500, color: 'var(--t1)' }}>{floor.name}</span></>}
      {unit && <><span style={{ color: 'var(--t3)' }}>›</span><span style={{ fontWeight: 600, color: 'var(--blue)' }}>{unit.name}</span></>}
    </div>
  );
}

// ── ProgressCascade ──────────────────────────────────────────────────────────

function ProgressCascade({
  unitProgress, floorProgress, towerProgress, overallProgress,
  selectedUnit, selectedFloor, selectedTower,
}: {
  unitProgress: number; floorProgress: number; towerProgress: number; overallProgress: number;
  selectedUnit: Unit | null; selectedFloor: Floor | null; selectedTower: Tower | null;
}) {
  const cascadeItems = [
    { label: `${selectedUnit?.name ?? 'Unidade'}`, value: unitProgress },
    { label: `${selectedFloor?.name ?? 'Pavimento'}`, value: floorProgress },
    { label: `${selectedTower?.name ?? 'Torre'}`, value: towerProgress },
    { label: 'Obra Geral', value: overallProgress },
  ];
  return (
    <div style={{
      background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 8,
      padding: 12, marginTop: 12, fontSize: 11,
    }}>
      <div style={{ fontWeight: 600, color: 'var(--t1)', marginBottom: 8 }}>Progresso em Cascata</div>
      {cascadeItems.map((item, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: idx < cascadeItems.length - 1 ? 6 : 0 }}>
          <div style={{ minWidth: 80, textAlign: 'right', fontWeight: 500, color: 'var(--t1)' }}>{item.label}:</div>
          <div className="ao-pbar" style={{ flex: 1, minHeight: 6 }}>
            <div className="ao-pfill" style={{ width: `${item.value}%`, background: heatmapColor(item.value), borderRadius: 3 }} />
          </div>
          <div style={{ minWidth: 36, textAlign: 'right', fontWeight: 600, color: 'var(--t1)' }}>{Math.round(item.value)}%</div>
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
  const committedEntriesRef = useRef<Map<string, ActivityEntry[]>>(new Map());
  const [measurementRefreshTick, setMeasurementRefreshTick] = useState(0);

  useEffect(() => {
    if (dataOnlyTrigger > 0) setMeasurementRefreshTick((t) => t + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataOnlyTrigger]);

  const [towers, setTowers] = useState<Tower[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [allFloors, setAllFloors] = useState<Floor[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [, setMeasurements] = useState<Measurement[]>([]);

  const [selectedTowerId, setSelectedTowerId] = useState<string | null>(null);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  const [viewerMode, setViewerMode] = useState<ViewerMode>('3d');
  const [filters, setFilters] = useState<Filters>({ status: 'todos', disciplineId: 'all' });
  const [ifcUrl, setIfcUrl] = useState<string | null>(null);

  const [floorUnitsCache, setFloorUnitsCache] = useState<Record<string, Unit[]>>({});
  const [floorProgresses, setFloorProgresses] = useState<FloorProgress>({});
  const [towerProgresses, setTowerProgresses] = useState<TowerProgress>({});

  const [loadingTowers, setLoadingTowers] = useState(false);
  const [loadingFloors, setLoadingFloors] = useState(false);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [loadingMeasurements, setLoadingMeasurements] = useState(false);
  const [saving, setSaving] = useState(false);

  const [entries, setEntries] = useState<ActivityEntry[]>([]);

  // Realtime
  useRealtime(projectId);
  useMeasurementUpdates(projectId, (e) => {
    if (e.unitId === selectedUnitId) {
      setMeasurementRefreshTick((t) => t + 1);
    }
    // Update floor cache progress live
    setFloorUnitsCache((prev) => {
      const next = { ...prev };
      for (const [fid, list] of Object.entries(next)) {
        const idx = list.findIndex((u) => u.id === e.unitId);
        if (idx >= 0) {
          const newList = [...list];
          // Naive: recompute by averaging across activities is expensive here; use event % as one-activity sample.
          // For accuracy, the user can click the unit to reload all activities.
          newList[idx] = { ...newList[idx], progressPercent: e.percentComplete };
          next[fid] = newList;
        }
      }
      return next;
    });
    if (e.measuredByName) {
      addToast({ type: 'info', title: 'Atualização ao vivo', description: `${e.measuredByName} alterou medição` });
    }
  });
  // schedule refresh hooks are declared further down, after loadProjectData

  // ── Progress calculators ─────────────────────────────────────────────────
  const calculateFloorProgress = useCallback((floorId: string, cache: Record<string, Unit[]>): number => {
    const floorUnits = cache[floorId] ?? [];
    if (floorUnits.length === 0) return 0;
    const sum = floorUnits.reduce((acc, u) => acc + (u.progressPercent ?? 0), 0);
    return Math.round(sum / floorUnits.length);
  }, []);

  const calculateTowerProgress = useCallback(
    (towerId: string, towerFloors: Floor[], cache: Record<string, Unit[]>): number => {
      const fp = towerFloors.map((f) => calculateFloorProgress(f.id, cache));
      if (fp.length === 0) return 0;
      return Math.round(fp.reduce((a, b) => a + b, 0) / fp.length);
    },
    [calculateFloorProgress],
  );

  const calculateOverallProgress = useCallback(
    (allTowers: Tower[], allFloors: Floor[], cache: Record<string, Unit[]>): number => {
      const tp = allTowers.map((t) => calculateTowerProgress(t.id, allFloors.filter((f) => f.towerId === t.id), cache));
      if (tp.length === 0) return 0;
      return Math.round(tp.reduce((a, b) => a + b, 0) / tp.length);
    },
    [calculateTowerProgress],
  );

  // ── Initial load + reload helper ─────────────────────────────────────────

  const loadProjectData = useCallback(async (pid: string, opts: { showSpinner?: boolean } = {}) => {
    if (opts.showSpinner ?? true) setLoadingTowers(true);
    try {
      const [t, at, bd, ifc] = await Promise.all([
        towersApi.list(pid),
        activityTypesApi.list(pid),
        measurementsApi.buildingData(pid),
        uploadsApi.getIfcModel(pid).catch(() => null),
      ]);
      setTowers(t);
      setActivityTypes(at);
      setIfcUrl(ifc?.url ?? null);

      const unitsCache: Record<string, Unit[]> = {};
      const floorProgs: FloorProgress = {};
      const allFloorsAcc: Floor[] = [];
      bd.towers.forEach((tower) => {
        tower.floors.forEach((floor, fIdx) => {
          floorProgs[floor.id] = floor.averageProgress;
          unitsCache[floor.id] = floor.units.map((unit, idx) => ({
            id: unit.id, floorId: floor.id, name: unit.name, area: 0, order: idx,
            progressPercent: unit.progressPercent,
          } as Unit));
          allFloorsAcc.push({
            id: floor.id, towerId: tower.id, name: floor.name, level: floor.level, order: fIdx,
          } as Floor);
        });
      });
      setFloorUnitsCache(unitsCache);
      setFloorProgresses(floorProgs);
      setAllFloors(allFloorsAcc);
      return t;
    } catch {
      addToast({ type: 'error', title: 'Erro ao carregar dados' });
      return [];
    } finally {
      if (opts.showSpinner ?? true) setLoadingTowers(false);
    }
  }, [addToast]);

  useEffect(() => {
    if (!projectId) return;
    loadProjectData(projectId).then((t) => {
      if (t.length > 0) setSelectedTowerId((cur) => cur ?? t[0].id);
    });
  }, [projectId, loadProjectData]);

  // ── Schedule sync: refresh Medição when EAP changes (live + on focus) ───
  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefresh = useCallback((reason: 'schedule' | 'visibility') => {
    if (!projectId) return;
    if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
    refreshDebounceRef.current = setTimeout(() => {
      void loadProjectData(projectId, { showSpinner: false });
      if (selectedUnitId) setMeasurementRefreshTick((t) => t + 1);
      if (reason === 'schedule') {
        addToast({ type: 'info', title: 'Cronograma atualizado', description: 'Dados da medição sincronizados.' });
      }
    }, 400);
  }, [projectId, loadProjectData, selectedUnitId, addToast]);

  useScheduleUpdates(projectId, () => scheduleRefresh('schedule'));
  useScheduleChanges(projectId, () => scheduleRefresh('schedule'));

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') scheduleRefresh('visibility');
    }
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [scheduleRefresh]);

  useEffect(() => {
    if (!projectId || !selectedTowerId) { setFloors([]); return; }
    setLoadingFloors(true);
    setSelectedFloorId(null);
    towersApi.listFloors(projectId, selectedTowerId)
      .then((f) => { setFloors(f); if (f.length > 0) setSelectedFloorId(f[0].id); })
      .catch(() => {})
      .finally(() => setLoadingFloors(false));
  }, [selectedTowerId, projectId]);

  useEffect(() => {
    if (!selectedFloorId) { setUnits([]); return; }
    setLoadingUnits(true);
    setSelectedUnitId(null);
    towersApi.listUnits(selectedFloorId)
      .then((u) => {
        // preserve known progress from cache
        const cached = floorUnitsCache[selectedFloorId] ?? [];
        const merged = u.map((nu) => ({
          ...nu,
          progressPercent: cached.find((cu) => cu.id === nu.id)?.progressPercent ?? nu.progressPercent ?? 0,
        }));
        setUnits(merged);
        setFloorUnitsCache((prev) => ({ ...prev, [selectedFloorId]: merged }));
      })
      .catch(() => {})
      .finally(() => setLoadingUnits(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFloorId]);

  // ── Build entries from measurements ──────────────────────────────────────

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
          activityTypeId: at.id, name: at.name,
          measurementMethod: at.measurementMethod as 'PERCENT' | 'METRIC' | 'COUNT',
          unit: at.unit, defaultQuantity: at.defaultQuantity,
          mode, percentValue: percent, executedQty: execQty, totalQty,
          computed, isDirty: false,
        };
      });
    }, [],
  );

  useEffect(() => {
    if (!selectedUnitId) { setEntries([]); return; }
    setLoadingMeasurements(true);
    measurementsApi.list(selectedUnitId)
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

  // ── Derived progress values ──────────────────────────────────────────────

  const overallProgress = useMemo(
    () => calculateOverallProgress(towers, floors, floorUnitsCache),
    [towers, floors, floorUnitsCache, calculateOverallProgress],
  );
  const calcOverallEntries = (e: ActivityEntry[]) =>
    e.length === 0 ? 0 : Math.round(e.reduce((a, b) => a + b.computed, 0) / e.length);
  const currentUnitProgress = useMemo(() => calcOverallEntries(entries), [entries]);
  const currentFloorProgress = useMemo(() => selectedFloorId ? calculateFloorProgress(selectedFloorId, floorUnitsCache) : 0,
    [selectedFloorId, floorUnitsCache, calculateFloorProgress]);
  const currentTowerProgress = useMemo(() => selectedTowerId
    ? calculateTowerProgress(selectedTowerId, floors.filter((f) => f.towerId === selectedTowerId), floorUnitsCache) : 0,
    [selectedTowerId, floors, floorUnitsCache, calculateTowerProgress]);

  useEffect(() => {
    const newTowerProgresses: TowerProgress = {};
    towers.forEach((t) => {
      newTowerProgresses[t.id] = calculateTowerProgress(t.id, floors.filter((f) => f.towerId === t.id), floorUnitsCache);
    });
    setTowerProgresses(newTowerProgresses);
  }, [towers, floors, floorUnitsCache, calculateTowerProgress]);

  const selectedUnit = useMemo(() => units.find((u) => u.id === selectedUnitId) ?? null, [units, selectedUnitId]);
  const selectedFloor = useMemo(() => floors.find((f) => f.id === selectedFloorId) ?? null, [floors, selectedFloorId]);
  const selectedTower = useMemo(() => towers.find((t) => t.id === selectedTowerId) ?? null, [towers, selectedTowerId]);

  const unitsDone = useMemo(() => Object.values(floorUnitsCache).flat().filter((u) => (u.progressPercent ?? 0) >= 100).length, [floorUnitsCache]);
  const unitsTotal = useMemo(() => Object.values(floorUnitsCache).flat().length, [floorUnitsCache]);

  // Maps for the 3D viewer
  const unitProgressMap = useMemo(() => {
    const m: Record<string, number> = {};
    Object.values(floorUnitsCache).flat().forEach((u) => { m[u.id] = u.progressPercent ?? 0; });
    return m;
  }, [floorUnitsCache]);

  // Filter predicate for viewer + units grid
  const matchesStatus = useCallback((p: number) => {
    if (filters.status === 'todos') return true;
    return unitState(p) === filters.status;
  }, [filters.status]);

  const filterPredicate = useCallback((u: Unit) => matchesStatus(u.progressPercent ?? 0), [matchesStatus]);

  const filteredUnits = useMemo(() => units.filter(filterPredicate), [units, filterPredicate]);

  // For the right-side activity list, apply discipline filter
  const filteredEntries = useMemo(() => {
    if (filters.disciplineId === 'all') return entries;
    return entries.filter((e) => e.activityTypeId === filters.disciplineId);
  }, [entries, filters.disciplineId]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleEntryChange(idx: number, updated: Partial<ActivityEntry>) {
    setEntries((prev) => {
      const next = [...prev];
      const target = filteredEntries[idx];
      if (!target) return prev;
      const realIdx = next.findIndex((e) => e.activityTypeId === target.activityTypeId);
      if (realIdx < 0) return prev;
      next[realIdx] = { ...next[realIdx], ...updated };
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
        dirty.map((e) => measurementsApi.create(unitId, {
          activityTypeId: e.activityTypeId,
          percentComplete: e.computed,
          executedQty: e.mode === 'METRIC' ? e.executedQty : undefined,
          totalQty: e.mode === 'METRIC' ? e.totalQty : undefined,
        })),
      );

      const cleanedEntries = entries.map((e) => ({ ...e, isDirty: false }));
      const newUnitProgress = calcOverallEntries(cleanedEntries);

      setEntries(cleanedEntries);
      committedEntriesRef.current.set(unitId, cleanedEntries);

      const updatedUnits = (floorUnitsCache[selectedFloorId] ?? []).map((u) =>
        u.id === unitId ? { ...u, progressPercent: newUnitProgress } : u,
      );
      setFloorUnitsCache((prev) => ({ ...prev, [selectedFloorId]: updatedUnits }));

      const unitProgresses = updatedUnits.map((u) => u.progressPercent ?? 0);
      const newFloorProgress = unitProgresses.length > 0
        ? Math.round(unitProgresses.reduce((a, b) => a + b, 0) / unitProgresses.length) : 0;
      setFloorProgresses((prev) => ({ ...prev, [selectedFloorId]: newFloorProgress }));

      addToast({ type: 'success', title: 'Salvo com sucesso', description: 'Medição da unidade salva.' });

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

  // Keyboard shortcut: M to toggle 3D/2D, Esc to clear unit selection
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      const tag = (ev.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (ev.key === 'm' || ev.key === 'M') setViewerMode((m) => (m === '3d' ? '2d' : '3d'));
      if (ev.key === 'Escape') setSelectedUnitId(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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

  return (
    <>
      <KpiBar
        overallProgress={overallProgress}
        towerProgresses={towerProgresses}
        towers={towers}
        unitsTotal={unitsTotal}
        unitsDone={unitsDone}
      />

      <MedicaoToolbar
        mode={viewerMode}
        onModeChange={setViewerMode}
        filters={filters}
        onFiltersChange={setFilters}
        activityTypes={activityTypes}
        towers={towers}
        floors={floors}
        selectedTowerId={selectedTowerId}
        selectedFloorId={selectedFloorId}
        onTowerChange={setSelectedTowerId}
        onFloorChange={setSelectedFloorId}
        hasIfc={!!ifcUrl}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(380px, 1fr)', gap: 12, alignItems: 'stretch', marginBottom: 24 }}>
        {/* Left: Viewer */}
        <div style={{ minWidth: 0 }}>
          {loadingTowers ? (
            <div style={{ height: 480, background: 'var(--s2)', borderRadius: 12 }} />
          ) : viewerMode === '3d' ? (
            <BuildingViewer3D
              mode={ifcUrl ? 'ifc' : 'procedural'}
              ifcUrl={ifcUrl}
              towers={towers}
              floors={allFloors}
              unitsByFloor={floorUnitsCache}
              unitProgress={unitProgressMap}
              floorProgress={floorProgresses}
              towerProgress={towerProgresses}
              selection={{ towerId: selectedTowerId, floorId: selectedFloorId, unitId: selectedUnitId }}
              filterPredicate={filters.status === 'todos' ? undefined : filterPredicate}
              onSelectTower={(id) => setSelectedTowerId(id)}
              onSelectFloor={(id) => setSelectedFloorId(id)}
              onSelectUnit={(id) => setSelectedUnitId(id)}
              height={480}
            />
          ) : (
            <FloorPlanViewer2D
              floorId={selectedFloorId}
              floorName={selectedFloor?.name}
              projectId={projectId!}
              height={480}
            />
          )}
        </div>

        {/* Right: Units + Activities */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <Breadcrumb tower={selectedTower} floor={selectedFloor} unit={selectedUnit} />

          {/* Units */}
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

            {loadingUnits || (loadingFloors && !selectedFloorId) ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(78px,1fr))', gap: 5 }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} style={{ height: 60, background: 'var(--s2)', borderRadius: 8 }} />
                ))}
              </div>
            ) : units.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: 'var(--t3)' }}>
                Selecione um andar para ver as unidades
              </div>
            ) : filteredUnits.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: 'var(--t3)' }}>
                Nenhuma unidade corresponde ao filtro de status.
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
                        padding: 7, borderRadius: 8, fontSize: 10, textAlign: 'center', cursor: 'pointer',
                        border: isSelected ? '1.5px solid var(--blue)' : '1px solid var(--bd)',
                        background: bgColor, color: textColor, transition: 'all .15s',
                        boxShadow: isSelected ? '0 0 0 2px rgba(27,111,232,.18)' : 'none',
                        fontFamily: 'var(--font)',
                      }}
                    >
                      <div style={{ fontWeight: 500, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{unit.name}</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{p.toFixed(0)}%</div>
                      <div className="ao-pbar" style={{ marginTop: 4 }}>
                        <div className="ao-pfill" style={{ width: `${p}%`, background: heatmapColor(p) }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Activities */}
          <div className="ao-card">
            <div className="ao-card-hdr" style={{ marginBottom: 4 }}>
              <span className="ao-card-title">
                {selectedUnit ? `Atividades — ${selectedUnit.name}` : 'Atividades'}
                {filters.disciplineId !== 'all' && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--blue)' }}>· filtrado</span>}
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
            ) : filteredEntries.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: 'var(--t3)' }}>
                {filters.disciplineId !== 'all' ? 'Nenhuma atividade desta disciplina.' : 'Nenhum tipo de atividade cadastrado.'}
              </div>
            ) : (
              <div>
                {filteredEntries.map((entry, idx) => {
                  const isMetric = entry.mode === 'METRIC' && entry.measurementMethod !== 'PERCENT';
                  const p = entry.computed;
                  function handlePercentChange(val: string) {
                    const n = Math.min(100, Math.max(0, parseFloat(val) || 0));
                    handleEntryChange(idx, { percentValue: n, computed: n, isDirty: true });
                  }
                  function handleExecutedChange(val: string) {
                    const executed = parseFloat(val) || 0;
                    handleEntryChange(idx, { executedQty: executed, computed: calcFromMetric(executed, entry.totalQty), isDirty: true });
                  }
                  function handleTotalChange(val: string) {
                    const total = parseFloat(val) || 0;
                    handleEntryChange(idx, { totalQty: total, computed: calcFromMetric(entry.executedQty, total), isDirty: true });
                  }
                  return (
                    <div
                      key={entry.activityTypeId}
                      style={{ padding: '8px 0', borderBottom: '0.5px solid var(--bd)', background: entry.isDirty ? 'rgba(186,117,23,.04)' : undefined }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)' }}>{entry.name}</span>
                            <span className="ao-badge ao-bk" style={{ flexShrink: 0 }}>{methodLabel(entry.measurementMethod)}</span>
                          </div>
                        </div>
                        {entry.measurementMethod !== 'PERCENT' && (
                          <div style={{ display: 'flex', borderRadius: 6, border: '1px solid var(--bd)', overflow: 'hidden', flexShrink: 0 }}>
                            <button
                              onClick={() => handleEntryChange(idx, { mode: 'PERCENT', isDirty: true })}
                              style={{ padding: '3px 8px', fontSize: 9, border: 'none', cursor: 'pointer', fontFamily: 'var(--font)',
                                background: !isMetric ? 'var(--blue)' : 'var(--s1)', color: !isMetric ? '#fff' : 'var(--t2)' }}
                            >%</button>
                            <button
                              onClick={() => handleEntryChange(idx, { mode: 'METRIC', isDirty: true })}
                              style={{ padding: '3px 8px', fontSize: 9, border: 'none', cursor: 'pointer', fontFamily: 'var(--font)',
                                background: isMetric ? 'var(--blue)' : 'var(--s1)', color: isMetric ? '#fff' : 'var(--t2)' }}
                            >Métrica</button>
                          </div>
                        )}
                        <span style={{ fontSize: 12, fontWeight: 600, minWidth: 36, textAlign: 'right', color: p >= 100 ? 'var(--green)' : p > 0 ? 'var(--amber)' : 'var(--t3)' }}>
                          {p.toFixed(0)}%
                        </span>
                        <span className={statusBadgeClass(p)} style={{ flexShrink: 0, minWidth: 66, justifyContent: 'center', fontSize: 9 }}>
                          {statusLabel(p)}
                        </span>
                        <button
                          onClick={() => handleMarkDone(idx)}
                          title="Marcar 100%"
                          className="ao-btn ao-btn-sm ao-btn-ok"
                          style={{ flexShrink: 0, borderRadius: '50%', width: 22, height: 22, padding: 0 }}
                        >✓</button>
                      </div>
                      <div className="ao-pbar" style={{ marginBottom: 6 }}>
                        <div className="ao-pfill" style={{ width: `${p}%`, background: heatmapColor(p) }} />
                      </div>
                      {isMetric ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 11 }}>
                          <span style={{ color: 'var(--t2)' }}>Executado:</span>
                          <input type="number" min={0} value={entry.executedQty} onChange={(e) => handleExecutedChange(e.target.value)}
                            style={{ width: 60, padding: '4px 6px', fontSize: 10, border: '1px solid var(--bd)', borderRadius: 4, background: 'var(--s0)', color: 'var(--t1)', fontFamily: 'var(--font)' }} />
                          <span style={{ color: 'var(--t3)' }}>/</span>
                          <input type="number" min={0} value={entry.totalQty} onChange={(e) => handleTotalChange(e.target.value)}
                            style={{ width: 60, padding: '4px 6px', fontSize: 10, border: '1px solid var(--bd)', borderRadius: 4, background: 'var(--s0)', color: 'var(--t1)', fontFamily: 'var(--font)' }} />
                          <span style={{ color: 'var(--t2)', fontWeight: 500 }}>{entry.unit}</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                          <span style={{ color: 'var(--t2)' }}>Percentual:</span>
                          <input type="number" min={0} max={100} value={entry.percentValue} onChange={(e) => handlePercentChange(e.target.value)}
                            style={{ width: 70, padding: '4px 6px', fontSize: 10, border: '1px solid var(--bd)', borderRadius: 4, background: 'var(--s0)', color: 'var(--t1)', fontFamily: 'var(--font)' }} />
                          <span style={{ color: 'var(--t2)', fontWeight: 500 }}>%</span>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 12 }}>
                  <button className="ao-btn ao-btn-sm ao-btn-ok" onClick={handleAllDone} disabled={saving}>Tudo concluído</button>
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
