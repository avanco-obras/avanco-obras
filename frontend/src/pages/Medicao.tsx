import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Box, FileImage, LayoutGrid } from 'lucide-react';
import { useStore } from '@/store';
import { towersApi, measurementsApi, scheduleApi, uploadsApi, progressApi } from '@/services/api';
import type { Tower, Floor, Unit, GanttTask, ProjectReport, ProjectMetrics, ReportComparison, CurvaSPoint } from '@/types';
import {
  buildForest, indexNodes, recalcParents, subtreeProgress, FLOOR_PATTERN, normKey,
} from '@/lib/wbs-tree';
import BuildingViewer3D from '@/components/viewer/BuildingViewer3D';
import FloorPlanViewer2D from '@/components/viewer/FloorPlanViewer2D';
import ScheduleBlocksPanel from '@/components/medicao/ScheduleBlocksPanel';
import HeatmapMatrix, { type HeatRow, type HeatCell } from '@/components/medicao/HeatmapMatrix';
import { SaveReportModal, ReportHistoryModal } from '@/components/medicao/ReportDialogs';
import {
  Toolbar, ToolbarLabeledSelect, ToolbarSeparator, ToolbarToggleGroup,
} from '@/components/Toolbar';
import { useRealtime, useScheduleUpdates, useScheduleChanges } from '@/hooks/useRealtime';

type ViewerMode = '3d' | '2d' | 'heatmap';

// Altura DEFINIDA do viewer (evita canvas R3F crescendo sem limite / sobreposição).
const VIEWER_H = 'clamp(460px, 66vh, 760px)';


// ── KpiBar ────────────────────────────────────────────────────────────────────

export interface LeafStatusCounts { done: number; inProgress: number; delayed: number; total: number; }

// Cores dos 3 status usados na barra segmentada (espelham a legenda do viewer).
const ST_DONE = '#16A34A';
const ST_PROGRESS = '#D97706';
const ST_DELAYED = '#DC2626';

function KpiBar({ realized, planned, counts, curva }: {
  realized: number; planned: number | null;
  counts: LeafStatusCounts; curva: CurvaSPoint[];
}) {
  const deviation = planned == null ? null : Math.round((realized - planned) * 10) / 10;
  const devPositive = deviation != null && deviation >= 0;

  return (
    <div style={{
      background: 'var(--s0)', padding: '12px 16px', borderBottom: '1px solid var(--bd)',
      borderRadius: 12, border: '1px solid var(--bd)', marginBottom: 12,
    }}>
      {/* Header com badge de desvio do baseline */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Medição Física
        </div>
        {deviation != null && (
          <span
            title="Desvio do baseline: realizado − previsto (pontos percentuais)"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700,
              padding: '3px 10px', borderRadius: 999, fontFamily: 'var(--mono)',
              background: devPositive ? 'var(--grn-bg)' : 'var(--amb-bg)',
              color: devPositive ? 'var(--green)' : 'var(--amber)',
              border: `1px solid ${devPositive ? 'var(--green)' : 'var(--amber)'}`,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: devPositive ? 'var(--green)' : 'var(--amber)' }} />
            {devPositive ? '+' : ''}{deviation.toFixed(1)} p.p. vs baseline
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        {/* Card A — Avanço geral · previsto × realizado */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={kpiLabel}>Avanço geral · previsto × realizado</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 30, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--blue)', letterSpacing: '-1px', lineHeight: 1 }}>
                  {realized.toFixed(1).replace('.', ',')}%
                </span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>
                realizado
                {planned != null && <> · previsto <span style={{ color: 'var(--t2)', fontWeight: 600, fontFamily: 'var(--mono)' }}>{planned.toFixed(1).replace('.', ',')}%</span></>}
              </div>
            </div>
            <CurvaSSparkline points={curva} realized={realized} planned={planned} />
          </div>
        </div>

        {/* Card B — Atividades */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={kpiLabel}>Atividades</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--t1)', lineHeight: 1 }}>
              {counts.done}
            </span>
            <span style={{ fontSize: 13, color: 'var(--t3)', fontFamily: 'var(--mono)' }}>/ {counts.total}</span>
            <span style={{ fontSize: 10, color: 'var(--t3)' }}>concluídas</span>
          </div>
          <SegmentedStatusBar counts={counts} />
          <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--t3)', flexWrap: 'wrap' }}>
            <StatusLegendCount color={ST_DONE} label="concluídas" n={counts.done} />
            <StatusLegendCount color={ST_PROGRESS} label="em andamento" n={counts.inProgress} />
            <StatusLegendCount color={ST_DELAYED} label="atrasadas" n={counts.delayed} />
          </div>
        </div>
      </div>
    </div>
  );
}
const kpiLabel: React.CSSProperties = { fontSize: 9, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 };

function StatusLegendCount({ color, label, n }: { color: string; label: string; n: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
      <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--t2)' }}>{n}</span> {label}
    </span>
  );
}

function SegmentedStatusBar({ counts }: { counts: LeafStatusCounts }) {
  const total = Math.max(counts.total, 1);
  const seg = (n: number) => `${(n / total) * 100}%`;
  return (
    <div style={{ display: 'flex', width: '100%', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--s2)' }}>
      <div style={{ width: seg(counts.done), background: ST_DONE }} />
      <div style={{ width: seg(counts.inProgress), background: ST_PROGRESS }} />
      <div style={{ width: seg(counts.delayed), background: ST_DELAYED }} />
    </div>
  );
}

/** Mini Curva S (SVG): linha tracejada = previsto, sólida = realizado, ponto na medição atual. */
function CurvaSSparkline({ points, realized, planned }: { points: CurvaSPoint[]; realized: number; planned: number | null }) {
  const W = 132, H = 44, pad = 3;
  const data = points.length >= 2 ? points : null;

  const path = (key: 'planned' | 'actual') => {
    if (!data) return '';
    const n = data.length;
    return data.map((p, i) => {
      const x = pad + (i / (n - 1)) * (W - 2 * pad);
      const y = H - pad - (Math.min(100, Math.max(0, p[key])) / 100) * (H - 2 * pad);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  };

  // Ponto da medição atual = último ponto com realizado registrado.
  let curX = W - pad, curY = H - pad;
  if (data) {
    let idx = data.length - 1;
    for (let i = data.length - 1; i >= 0; i--) { if (data[i].actual > 0) { idx = i; break; } }
    curX = pad + (idx / (data.length - 1)) * (W - 2 * pad);
    curY = H - pad - (Math.min(100, Math.max(0, data[idx].actual)) / 100) * (H - 2 * pad);
  }

  if (!data) {
    // Fallback sem série: barrinhas previsto/realizado (mantém a leitura prev×real).
    const py = planned == null ? H / 2 : H - pad - (planned / 100) * (H - 2 * pad);
    const ry = H - pad - (realized / 100) * (H - 2 * pad);
    return (
      <svg width={W} height={H} style={{ flexShrink: 0 }} aria-label="Curva S indisponível">
        {planned != null && <line x1={pad} y1={py} x2={W - pad} y2={py} stroke="var(--t3)" strokeWidth={1.5} strokeDasharray="4 3" />}
        <line x1={pad} y1={ry} x2={W - pad} y2={ry} stroke="var(--blue)" strokeWidth={2} />
        <circle cx={W - pad} cy={ry} r={2.6} fill="var(--blue)" />
      </svg>
    );
  }

  return (
    <svg width={W} height={H} style={{ flexShrink: 0 }} aria-label="Curva S previsto × realizado">
      <path d={path('planned')} fill="none" stroke="var(--t3)" strokeWidth={1.5} strokeDasharray="4 3" />
      <path d={path('actual')} fill="none" stroke="var(--blue)" strokeWidth={2} strokeLinejoin="round" />
      <circle cx={curX} cy={curY} r={3} fill="var(--blue)" stroke="var(--s0)" strokeWidth={1} />
    </svg>
  );
}

// ── Toolbar ──────────────────────────────────────────────────────────────────

function MedicaoToolbar({ mode, onModeChange, towers, floors, selectedTowerId, selectedFloorId, onTowerChange, onFloorChange, hasIfc }: {
  mode: ViewerMode; onModeChange: (m: ViewerMode) => void; towers: Tower[]; floors: Floor[];
  selectedTowerId: string | null; selectedFloorId: string | null;
  onTowerChange: (id: string | null) => void; onFloorChange: (id: string | null) => void; hasIfc: boolean;
}) {
  return (
    <div className="ao-card" style={{ padding: '10px 12px', marginBottom: 12 }}>
      <Toolbar style={{ gap: 12 }}>
        <ToolbarToggleGroup
          value={mode}
          onChange={onModeChange}
          options={[
            {
              value: '3d' as const,
              icon: <Box size={12} />,
              label: <>Modelo 3D {hasIfc && <span style={{ fontSize: 8, opacity: .85 }}>· IFC</span>}</>,
            },
            { value: '2d' as const, icon: <FileImage size={12} />, label: 'Planta 2D' },
            { value: 'heatmap' as const, icon: <LayoutGrid size={12} />, label: 'Mapa de calor' },
          ]}
        />
        <ToolbarSeparator />
        <ToolbarLabeledSelect
          label="Torre:"
          value={selectedTowerId}
          onChange={onTowerChange}
          options={towers.map((t) => ({ value: t.id, label: t.name }))}
        />
        <ToolbarLabeledSelect
          label="Pavto:"
          value={selectedFloorId}
          onChange={onFloorChange}
          disabled={floors.length === 0}
          options={floors.map((f) => ({ value: f.id, label: f.name }))}
        />
      </Toolbar>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function Medicao() {
  const { currentProject, addToast } = useStore();
  const projectId = currentProject?.id;

  const [towers, setTowers] = useState<Tower[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [allFloors, setAllFloors] = useState<Floor[]>([]);
  const [floorUnitsCache, setFloorUnitsCache] = useState<Record<string, Unit[]>>({});

  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [navPath, setNavPath] = useState<string[]>([]);
  const [canteiroMode, setCanteiroMode] = useState(false);

  const [selectedTowerId, setSelectedTowerId] = useState<string | null>(null);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [hoveredFloorId, setHoveredFloorId] = useState<string | null>(null);

  const [viewerMode, setViewerMode] = useState<ViewerMode>('3d');
  const [ifcUrl, setIfcUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // KPIs / Curva S (topo)
  const [curva, setCurva] = useState<CurvaSPoint[]>([]);

  // Report state
  const [reports, setReports] = useState<ProjectReport[]>([]);
  const [metrics, setMetrics] = useState<ProjectMetrics | null>(null);
  const [showSaveReport, setShowSaveReport] = useState(false);
  const [reportDescription, setReportDescription] = useState('');
  const [savingReport, setSavingReport] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportComparison | null>(null);

  useRealtime(projectId);

  // ── Data loaders ──────────────────────────────────────────────────────────
  const loadSchedule = useCallback(async (pid: string) => {
    const g = await scheduleApi.ganttData(pid).catch(() => [] as GanttTask[]);
    setTasks(g);
    return g;
  }, []);

  const loadStructure = useCallback(async (pid: string) => {
    setLoading(true);
    try {
      const [t, bd, ifc] = await Promise.all([
        towersApi.list(pid),
        measurementsApi.buildingData(pid),
        uploadsApi.getIfcModel(pid).catch(() => null),
      ]);
      setTowers(t);
      setIfcUrl(ifc?.url ?? null);
      const unitsCache: Record<string, Unit[]> = {};
      const allFloorsAcc: Floor[] = [];
      bd.towers.forEach((tower) => {
        tower.floors.forEach((floor, fIdx) => {
          unitsCache[floor.id] = floor.units.map((unit, idx) => ({ id: unit.id, floorId: floor.id, name: unit.name, area: 0, order: idx } as Unit));
          allFloorsAcc.push({ id: floor.id, towerId: tower.id, name: floor.name, level: floor.level, order: fIdx } as Floor);
        });
      });
      setFloorUnitsCache(unitsCache);
      setAllFloors(allFloorsAcc);
      return t;
    } catch {
      addToast({ type: 'error', title: 'Erro ao carregar dados' });
      return [];
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const loadMetrics = useCallback(async (pid: string) => {
    const m = await progressApi.metrics(pid).catch(() => null);
    if (m) setMetrics(m);
  }, []);

  const loadCurva = useCallback(async (pid: string) => {
    const c = await scheduleApi.curvaS(pid).catch(() => [] as CurvaSPoint[]);
    setCurva(c);
  }, []);

  useEffect(() => {
    if (!projectId) return;
    loadStructure(projectId).then((t) => { if (t.length > 0) setSelectedTowerId((cur) => cur ?? t[0].id); });
    loadSchedule(projectId);
    loadMetrics(projectId);
    loadCurva(projectId);
  }, [projectId, loadStructure, loadSchedule, loadMetrics, loadCurva]);

  // ── Realtime sync (cronograma ↔ medição) ─────────────────────────────────
  const refreshDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useScheduleUpdates(projectId, (e) => {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === e.scheduleItemId);
      if (idx < 0) return prev;
      if (Math.abs((prev[idx].physicalProgress || 0) - e.physicalProgress) < 0.01) return prev;
      const next = prev.map((t) => (t.id === e.scheduleItemId ? { ...t, physicalProgress: e.physicalProgress } : t));
      return recalcParents(next).tasks;
    });
  });
  useScheduleChanges(projectId, () => {
    if (!projectId) return;
    if (refreshDebounce.current) clearTimeout(refreshDebounce.current);
    refreshDebounce.current = setTimeout(() => {
      loadSchedule(projectId);
      loadStructure(projectId);
    }, 400);
  });
  useEffect(() => {
    function onVisible() { if (document.visibilityState === 'visible' && projectId) { loadSchedule(projectId); loadMetrics(projectId); } }
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('focus', onVisible); };
  }, [projectId, loadSchedule, loadMetrics]);

  // ── Floors list for selected tower ────────────────────────────────────────
  useEffect(() => {
    if (!selectedTowerId) { setFloors([]); return; }
    const towerFloors = allFloors.filter((f) => f.towerId === selectedTowerId).sort((a, b) => a.level - b.level);
    setFloors(towerFloors);
    setSelectedFloorId((cur) => cur && towerFloors.some((f) => f.id === cur) ? cur : (towerFloors[0]?.id ?? null));
  }, [selectedTowerId, allFloors]);

  // ── Derived: schedule maps ─────────────────────────────────────────────────
  const forest = useMemo(() => buildForest(tasks), [tasks]);
  const nodeById = useMemo(() => indexNodes(forest), [forest]);

  // Floor (Tower/Floor model) → WBS node (level-1 com mesmo nome normalizado)
  const floorTaskByFloorId = useMemo(() => {
    const wbsByName = new Map<string, GanttTask>();
    for (const t of tasks) if ((t.level ?? 0) === 1 && FLOOR_PATTERN.test(t.name)) wbsByName.set(normKey(t.name), t);
    const m = new Map<string, GanttTask>();
    for (const f of allFloors) { const node = wbsByName.get(normKey(f.name)); if (node) m.set(f.id, node); }
    return m;
  }, [tasks, allFloors]);

  const floorProgress = useMemo(() => {
    const m: Record<string, number> = {};
    for (const node of forest) collectFloorProgress(node, m, floorTaskByFloorId);
    // map por floorId
    const out: Record<string, number> = {};
    for (const f of allFloors) {
      const node = floorTaskByFloorId.get(f.id);
      out[f.id] = node ? (m[node.id] ?? node.physicalProgress ?? 0) : 0;
    }
    return out;
  }, [forest, floorTaskByFloorId, allFloors]);

  const towerProgresses = useMemo(() => {
    const root = forest[0];
    const m: Record<string, number> = {};
    const overall = root ? subtreeProgress(root) : 0;
    for (const t of towers) m[t.id] = overall;
    return m;
  }, [forest, towers]);

  const overallProgress = useMemo(() => (forest[0] ? subtreeProgress(forest[0]) : 0), [forest]);

  // Contagem por status (live) das folhas: concluída / em andamento / atrasada.
  const leafCounts = useMemo<LeafStatusCounts>(() => {
    const leaves = tasks.filter((t) => !tasks.some((c) => c.parentId === t.id));
    let done = 0, delayed = 0, inProgress = 0;
    for (const l of leaves) {
      const phys = l.physicalProgress || 0;
      const plan = l.plannedProgress || 0;
      if (phys >= 100) done++;
      else if (phys + 0.01 < plan) delayed++; // abaixo do previsto do baseline
      else inProgress++;
    }
    return { done, inProgress, delayed, total: leaves.length };
  }, [tasks]);

  // Previsto geral (baseline) — ponderado pelas folhas, mesma lógica do realizado.
  const plannedOverall = useMemo<number | null>(() => {
    const leaves = tasks.filter((t) => !tasks.some((c) => c.parentId === t.id));
    const tw = leaves.reduce((s, l) => s + (l.weight || 1), 0);
    if (tw === 0) return null;
    return Math.round((leaves.reduce((s, l) => s + (l.plannedProgress || 0) * (l.weight || 1), 0) / tw) * 100) / 100;
  }, [tasks]);

  // Canteiro: folhas sem ancestral de pavimento
  const sitework = useMemo(() => {
    const leaves: GanttTask[] = [];
    const collect = (n: ReturnType<typeof buildForest>[number]) => { if (n.unlocated) leaves.push(n.task); else n.children.forEach(collect); };
    forest.forEach(collect);
    if (leaves.length === 0) return null;
    const tw = leaves.reduce((s, l) => s + (l.weight || 1), 0);
    const prog = tw > 0 ? Math.round((leaves.reduce((s, l) => s + (l.physicalProgress || 0) * (l.weight || 1), 0) / tw) * 100) / 100 : 0;
    return { progress: prog, count: leaves.length };
  }, [forest]);

  const unitProgressMap = useMemo(() => {
    // unidades (Geral) herdam o progresso do seu pavimento (via cronograma)
    const m: Record<string, number> = {};
    for (const [floorId, units] of Object.entries(floorUnitsCache)) {
      const p = floorProgress[floorId] ?? 0;
      for (const u of units) m[u.id] = p;
    }
    return m;
  }, [floorUnitsCache, floorProgress]);

  const selectedFloor = useMemo(() => floors.find((f) => f.id === selectedFloorId) ?? null, [floors, selectedFloorId]);
  // taskId (nó de pavimento) → floorId, para sincronizar navegação ↔ 3D.
  const floorIdByTaskId = useMemo(() => {
    const m = new Map<string, string>();
    for (const [floorId, node] of floorTaskByFloorId.entries()) m.set(node.id, floorId);
    return m;
  }, [floorTaskByFloorId]);

  // Matriz do mapa de calor: linhas = pavimentos (desc), colunas = unidades.
  const heatRows = useMemo<HeatRow[]>(() => {
    if (!selectedTowerId) return [];
    const towerFloors = allFloors.filter((f) => f.towerId === selectedTowerId).sort((a, b) => b.level - a.level);
    return towerFloors.map((f) => {
      const fNode = floorTaskByFloorId.get(f.id);
      const wnode = fNode ? nodeById.get(fNode.id) : undefined;
      const cells: HeatCell[] = [];
      // Só há "unidades" quando o pavimento tem sub-containers (Áreas comuns, Ap 1..N).
      if (wnode && wnode.children.length > 0 && !wnode.children.every((c) => c.isLeaf)) {
        for (const child of wnode.children) {
          cells.push({ nodeId: child.task.id, label: child.task.name, progress: subtreeProgress(child) });
        }
      }
      return { floorId: f.id, floorName: f.name, floorProgress: floorProgress[f.id] ?? 0, cells };
    });
  }, [selectedTowerId, allFloors, floorTaskByFloorId, nodeById, floorProgress]);

  // ── Navegação (blocos) ──────────────────────────────────────────────────────
  // Selecionar pavimento (toolbar/3D) → drilla os blocos até aquele pavimento.
  const goToFloor = useCallback((floorId: string | null) => {
    setCanteiroMode(false);
    setSelectedFloorId(floorId);
    if (!floorId) { setNavPath([]); return; }
    const node = floorTaskByFloorId.get(floorId);
    setNavPath(node ? [node.id] : []);
  }, [floorTaskByFloorId]);

  // Clique numa célula (unidade) do mapa de calor → abre as atividades da unidade.
  const openUnitActivities = useCallback((floorId: string, nodeId: string) => {
    setCanteiroMode(false);
    setSelectedFloorId(floorId);
    const floorNode = floorTaskByFloorId.get(floorId);
    setNavPath(floorNode ? [floorNode.id, nodeId] : [nodeId]);
  }, [floorTaskByFloorId]);

  // Mudança de navPath nos blocos → reflete o pavimento no 3D/breadcrumb.
  const handleNavPathChange = useCallback((path: string[]) => {
    setNavPath(path);
    const fid = path.length > 0 ? floorIdByTaskId.get(path[0]) : undefined;
    if (fid) setSelectedFloorId(fid);
  }, [floorIdByTaskId]);

  const commitLeaf = useCallback(async (taskId: string, value: number) => {
    const prevTasks = tasks;
    const target = prevTasks.find((t) => t.id === taskId);
    if (!target) return;
    const oldValue = target.physicalProgress || 0;

    // otimista: aplica folha + rollup de pais
    const withLeaf = prevTasks.map((t) => (t.id === taskId ? { ...t, physicalProgress: value } : t));
    const { tasks: rolled, changed } = recalcParents(withLeaf);
    setTasks(rolled);
    setSaving(true);
    try {
      await scheduleApi.update(taskId, { physicalProgress: value });
      await Promise.all(changed.map((c) => scheduleApi.update(c.id, { physicalProgress: c.physicalProgress })));
      loadMetrics(projectId!);
    } catch {
      setTasks(prevTasks);
      addToast({ type: 'error', title: 'Erro ao salvar', description: 'Não foi possível atualizar o avanço.' });
      return;
    } finally {
      setSaving(false);
    }
    addToast({ type: 'success', title: 'Avanço atualizado', description: `${target.name}: ${oldValue}% → ${value}%` });
  }, [tasks, addToast, projectId, loadMetrics]);

  // ── Report handlers ────────────────────────────────────────────────────────
  async function saveReport() {
    if (!projectId) return;
    setSavingReport(true);
    try {
      const result = await progressApi.createReport(projectId, reportDescription || undefined);
      addToast({ type: 'success', title: 'Report gravado', description: `Report #${result.reportNumber} criado. Cronograma e indicadores atualizados.` });
      setShowSaveReport(false);
      setReportDescription('');
      await Promise.all([loadMetrics(projectId), loadSchedule(projectId), loadCurva(projectId)]);
    } catch {
      addToast({ type: 'error', title: 'Erro ao gravar Report' });
    } finally {
      setSavingReport(false);
    }
  }
  async function openHistory() {
    if (!projectId) return;
    setShowHistory(true);
    const data = await progressApi.listReports(projectId).catch(() => []);
    setReports(data);
  }
  async function compareReport(r: ProjectReport) {
    if (!projectId) return;
    const cmp = await progressApi.getReport(projectId, r.id).catch(() => null);
    if (cmp) setSelectedReport(cmp);
  }

  const lastReportLabel = metrics
    ? (metrics.lastReportNumber > 0
        ? `Último Report #${metrics.lastReportNumber}${metrics.lastReportDate ? ` · ${new Date(metrics.lastReportDate).toLocaleDateString('pt-BR')}` : ''} · consolidado ${metrics.physicalProgress.toFixed(1)}%`
        : 'Nenhum Report gravado — grave para consolidar o avanço no cronograma')
    : null;

  // Esc limpa seleção; M alterna 3D/2D
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      const tag = (ev.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (ev.key === 'm' || ev.key === 'M') setViewerMode((m) => (m === '3d' ? '2d' : '3d'));
      if (ev.key === 'Escape') { setSelectedUnitId(null); setCanteiroMode(false); setNavPath([]); }
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
      <KpiBar realized={overallProgress} planned={plannedOverall} counts={leafCounts} curva={curva} />

      <MedicaoToolbar
        mode={viewerMode} onModeChange={setViewerMode}
        towers={towers} floors={floors}
        selectedTowerId={selectedTowerId} selectedFloorId={selectedFloorId}
        onTowerChange={(id) => { setSelectedTowerId(id); setCanteiroMode(false); }}
        onFloorChange={(id) => goToFloor(id)}
        hasIfc={!!ifcUrl}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(420px, 1fr)', gap: 12, alignItems: 'start', marginBottom: 24 }}>
        {/* Left: viewer — altura DEFINIDA (não %) p/ o canvas R3F não crescer indefinidamente */}
        <div style={{ minWidth: 0, height: VIEWER_H }}>
          {loading ? (
            <div style={{ height: '100%', minHeight: 460, background: 'var(--s2)', borderRadius: 12 }} />
          ) : viewerMode === '3d' ? (
            <BuildingViewer3D
              mode={ifcUrl ? 'ifc' : 'procedural'}
              ifcUrl={ifcUrl}
              towers={towers}
              floors={allFloors}
              unitsByFloor={floorUnitsCache}
              unitProgress={unitProgressMap}
              floorProgress={floorProgress}
              towerProgress={towerProgresses}
              selection={{ towerId: selectedTowerId, floorId: selectedFloorId, unitId: selectedUnitId }}
              hoveredFloorId={hoveredFloorId}
              onSelectTower={(id) => { setSelectedTowerId(id); setCanteiroMode(false); }}
              onSelectFloor={(id) => goToFloor(id)}
              onSelectUnit={(id) => setSelectedUnitId(id)}
              height="100%"
              sitework={sitework ? { ...sitework, selected: canteiroMode, onSelect: () => { setCanteiroMode(true); setNavPath([]); setSelectedFloorId(null); setSelectedUnitId(null); } } : null}
            />
          ) : viewerMode === '2d' ? (
            <FloorPlanViewer2D floorId={selectedFloorId} floorName={selectedFloor?.name} projectId={projectId!} height="100%" />
          ) : (
            <HeatmapMatrix
              rows={heatRows}
              selectedFloorId={selectedFloorId}
              onSelectUnit={openUnitActivities}
              onSelectFloor={(id) => goToFloor(id)}
              onHoverFloor={setHoveredFloorId}
              height="100%"
            />
          )}
        </div>

        {/* Right: activities blocks (drill-down) — breadcrumb único vive no painel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <ScheduleBlocksPanel
            tasks={tasks}
            navPath={navPath}
            onNavPathChange={handleNavPathChange}
            canteiroMode={canteiroMode}
            onCommitLeaf={commitLeaf}
            saving={saving || savingReport}
            onSaveReport={() => setShowSaveReport(true)}
            onOpenHistory={openHistory}
            lastReportLabel={lastReportLabel}
            onHoverNode={(taskId) => setHoveredFloorId(taskId ? floorIdByTaskId.get(taskId) ?? null : null)}
          />
        </div>
      </div>

      <SaveReportModal
        open={showSaveReport}
        description={reportDescription}
        saving={savingReport}
        onChange={setReportDescription}
        onCancel={() => { setShowSaveReport(false); setReportDescription(''); }}
        onConfirm={saveReport}
      />
      <ReportHistoryModal
        open={showHistory}
        reports={reports}
        selected={selectedReport}
        onCompare={compareReport}
        onClose={() => { setShowHistory(false); setSelectedReport(null); }}
      />
    </>
  );
}

// Helper: preenche map[node.id]=progress agregado para nós de pavimento.
function collectFloorProgress(
  node: ReturnType<typeof buildForest>[number],
  out: Record<string, number>,
  floorTaskByFloorId: Map<string, GanttTask>,
) {
  const floorTaskIds = new Set([...floorTaskByFloorId.values()].map((t) => t.id));
  if (floorTaskIds.has(node.task.id)) out[node.task.id] = subtreeProgress(node);
  node.children.forEach((c) => collectFloorProgress(c, out, floorTaskByFloorId));
}
