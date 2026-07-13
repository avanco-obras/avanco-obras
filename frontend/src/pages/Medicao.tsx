import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Box, FileImage } from 'lucide-react';
import { useStore } from '@/store';
import { towersApi, measurementsApi, scheduleApi, uploadsApi, progressApi } from '@/services/api';
import type { Tower, Floor, Unit, GanttTask, ProjectReport, ProjectMetrics, ReportComparison } from '@/types';
import { heatmapColor } from '@/lib/measurement-helpers';
import {
  buildForest, recalcParents, subtreeProgress, FLOOR_PATTERN,
} from '@/lib/wbs-tree';
import BuildingViewer3D from '@/components/viewer/BuildingViewer3D';
import FloorPlanViewer2D from '@/components/viewer/FloorPlanViewer2D';
import ScheduleBlocksPanel from '@/components/medicao/ScheduleBlocksPanel';
import { SaveReportModal, ReportHistoryModal } from '@/components/medicao/ReportDialogs';
import { useRealtime, useScheduleUpdates, useScheduleChanges } from '@/hooks/useRealtime';

type ViewerMode = '3d' | '2d';

// Normalização (espelha ScheduleService.normalizeKey no backend) p/ casar Floor↔WBS.
function normKey(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

// ── KpiBar ────────────────────────────────────────────────────────────────────

function KpiBar({ overallProgress, leavesDone, leavesTotal, sitework }: {
  overallProgress: number; leavesDone: number; leavesTotal: number;
  sitework: { progress: number; count: number } | null;
}) {
  return (
    <div style={{
      background: 'var(--s0)', padding: '12px 16px', borderBottom: '1px solid var(--bd)',
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 12,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={kpiLabel}>Avanço Geral da Obra</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--blue)', letterSpacing: '-1px' }}>
            {Math.round(overallProgress)}%
          </div>
          <div className="ao-pbar" style={{ flex: 1, minHeight: 6 }}>
            <div className="ao-pfill" style={{ width: `${overallProgress}%`, background: heatmapColor(overallProgress), borderRadius: 3 }} />
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={kpiLabel}>Atividades</div>
        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--t1)' }}>
          {leavesDone} <span style={{ fontSize: 12, color: 'var(--t3)' }}>/ {leavesTotal}</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>concluídas</div>
      </div>
      {sitework && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={kpiLabel}>Canteiro de Obras</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--t1)' }}>{Math.round(sitework.progress)}%</div>
            <div style={{ fontSize: 10, color: 'var(--t3)' }}>· {sitework.count} sem local</div>
          </div>
        </div>
      )}
    </div>
  );
}
const kpiLabel: React.CSSProperties = { fontSize: 9, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 };

// ── Toolbar ──────────────────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  padding: '5px 8px', fontSize: 11, border: '1px solid var(--bd)', borderRadius: 6,
  background: 'var(--s0)', color: 'var(--t1)', fontFamily: 'var(--font)', minWidth: 130,
};

function MedicaoToolbar({ mode, onModeChange, towers, floors, selectedTowerId, selectedFloorId, onTowerChange, onFloorChange, hasIfc }: {
  mode: ViewerMode; onModeChange: (m: ViewerMode) => void; towers: Tower[]; floors: Floor[];
  selectedTowerId: string | null; selectedFloorId: string | null;
  onTowerChange: (id: string | null) => void; onFloorChange: (id: string | null) => void; hasIfc: boolean;
}) {
  return (
    <div className="ao-card" style={{ padding: '10px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', borderRadius: 8, border: '1px solid var(--bd)', overflow: 'hidden' }}>
        <button onClick={() => onModeChange('3d')} className="ao-btn ao-btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: mode === '3d' ? 'var(--blue)' : 'transparent', color: mode === '3d' ? '#fff' : 'var(--t2)', border: 'none', borderRadius: 0, padding: '6px 12px' }}>
          <Box size={12} /> Modelo 3D {hasIfc && <span style={{ fontSize: 8, opacity: .85 }}>· IFC</span>}
        </button>
        <button onClick={() => onModeChange('2d')} className="ao-btn ao-btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: mode === '2d' ? 'var(--blue)' : 'transparent', color: mode === '2d' ? '#fff' : 'var(--t2)', border: 'none', borderRadius: 0, padding: '6px 12px' }}>
          <FileImage size={12} /> Planta 2D
        </button>
      </div>
      <div style={{ width: 1, height: 20, background: 'var(--bd)' }} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
        <span style={{ color: 'var(--t2)' }}>Torre:</span>
        <select value={selectedTowerId ?? ''} onChange={(e) => onTowerChange(e.target.value || null)} style={selectStyle}>
          <option value="">—</option>
          {towers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
        <span style={{ color: 'var(--t2)' }}>Pavto:</span>
        <select value={selectedFloorId ?? ''} onChange={(e) => onFloorChange(e.target.value || null)} disabled={floors.length === 0} style={selectStyle}>
          <option value="">—</option>
          {floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </label>
    </div>
  );
}

// ── Breadcrumb ───────────────────────────────────────────────────────────────

function Breadcrumb({ tower, floor, canteiro }: { tower: Tower | null; floor: Floor | null; canteiro: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--t2)', marginBottom: 8, flexWrap: 'wrap' }}>
      <span style={{ color: 'var(--t3)' }}>📍</span>
      <span style={{ fontWeight: 500, color: tower ? 'var(--t1)' : 'var(--t3)' }}>{tower?.name ?? 'Obra'}</span>
      {canteiro
        ? <><span style={{ color: 'var(--t3)' }}>›</span><span style={{ fontWeight: 600, color: 'var(--amber)' }}>Canteiro de Obras</span></>
        : floor && <><span style={{ color: 'var(--t3)' }}>›</span><span style={{ fontWeight: 600, color: 'var(--blue)' }}>{floor.name}</span></>}
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

  const [viewerMode, setViewerMode] = useState<ViewerMode>('3d');
  const [ifcUrl, setIfcUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    if (!projectId) return;
    loadStructure(projectId).then((t) => { if (t.length > 0) setSelectedTowerId((cur) => cur ?? t[0].id); });
    loadSchedule(projectId);
    loadMetrics(projectId);
  }, [projectId, loadStructure, loadSchedule, loadMetrics]);

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

  const { leavesDone, leavesTotal } = useMemo(() => {
    const leaves = tasks.filter((t) => !tasks.some((c) => c.parentId === t.id));
    return { leavesTotal: leaves.length, leavesDone: leaves.filter((l) => (l.physicalProgress || 0) >= 100).length };
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
  const selectedTower = useMemo(() => towers.find((t) => t.id === selectedTowerId) ?? null, [towers, selectedTowerId]);
  // taskId (nó de pavimento) → floorId, para sincronizar navegação ↔ 3D.
  const floorIdByTaskId = useMemo(() => {
    const m = new Map<string, string>();
    for (const [floorId, node] of floorTaskByFloorId.entries()) m.set(node.id, floorId);
    return m;
  }, [floorTaskByFloorId]);

  // ── Navegação (blocos) ──────────────────────────────────────────────────────
  // Selecionar pavimento (toolbar/3D) → drilla os blocos até aquele pavimento.
  const goToFloor = useCallback((floorId: string | null) => {
    setCanteiroMode(false);
    setSelectedFloorId(floorId);
    if (!floorId) { setNavPath([]); return; }
    const node = floorTaskByFloorId.get(floorId);
    setNavPath(node ? [node.id] : []);
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
      await Promise.all([loadMetrics(projectId), loadSchedule(projectId)]);
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
      <KpiBar overallProgress={overallProgress} leavesDone={leavesDone} leavesTotal={leavesTotal} sitework={sitework} />

      <MedicaoToolbar
        mode={viewerMode} onModeChange={setViewerMode}
        towers={towers} floors={floors}
        selectedTowerId={selectedTowerId} selectedFloorId={selectedFloorId}
        onTowerChange={(id) => { setSelectedTowerId(id); setCanteiroMode(false); }}
        onFloorChange={(id) => goToFloor(id)}
        hasIfc={!!ifcUrl}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(420px, 1fr)', gap: 12, alignItems: 'stretch', marginBottom: 24 }}>
        {/* Left: viewer */}
        <div style={{ minWidth: 0 }}>
          {loading ? (
            <div style={{ height: 480, background: 'var(--s2)', borderRadius: 12 }} />
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
              onSelectTower={(id) => { setSelectedTowerId(id); setCanteiroMode(false); }}
              onSelectFloor={(id) => goToFloor(id)}
              onSelectUnit={(id) => setSelectedUnitId(id)}
              height={480}
              sitework={sitework ? { ...sitework, selected: canteiroMode, onSelect: () => { setCanteiroMode(true); setNavPath([]); setSelectedFloorId(null); setSelectedUnitId(null); } } : null}
            />
          ) : (
            <FloorPlanViewer2D floorId={selectedFloorId} floorName={selectedFloor?.name} projectId={projectId!} height={480} />
          )}
        </div>

        {/* Right: breadcrumb + activities blocks (drill-down) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <Breadcrumb tower={selectedTower} floor={selectedFloor} canteiro={canteiroMode} />

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
