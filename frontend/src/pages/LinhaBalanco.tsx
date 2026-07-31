import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Save, Undo2, Redo2, ZoomIn, ZoomOut, Maximize2, Settings2, Filter, Search,
  GitBranch, Layers, History, ChevronDown, ChevronRight, X, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { useStore } from '@/store';
import { useHistoryStore } from '@/store/historyStore';
import { scheduleApi, baselineApi } from '@/services/api';
import type { GanttTask, ScheduleRevision } from '@/types';
import { useRealtime, useScheduleChanges } from '@/hooks/useRealtime';
import { buildFlowlineModel, listActivities, type ActivityOption } from '@/lib/lob/flowline-model';
import { applyMove } from '@/lib/lob/cascade-scheduler';
import { findEquivalents } from '@/lib/lob/equivalence';
import {
  durationFromRange, effectiveDates, endFromDuration, formatScheduleBR, parseScheduleDate, toScheduleDate,
  type DraftChange, type DraftMap,
} from '@/lib/lob/types';
import {
  LobCanvas, computeRowLayout, DEFAULT_DISPLAY, HEADER_H,
  type BarHit, type DisplayOptions, type BaselineRange, type DragResult,
} from '@/lib/lob/lob-canvas';

// ── Constantes ────────────────────────────────────────────────────────────────
const TREE_W = 210;
const SCALE_PRESETS: { label: string; pxPerDay: number }[] = [
  { label: 'Dias', pxPerDay: 24 },
  { label: 'Semana', pxPerDay: 7 },
  { label: 'Quinzena', pxPerDay: 3.5 },
  { label: 'Mês', pxPerDay: 1.5 },
];
const DISPLAY_LS_KEY = 'lob-display-options';

function loadDisplay(): DisplayOptions {
  try {
    const raw = localStorage.getItem(DISPLAY_LS_KEY);
    if (raw) return { ...DEFAULT_DISPLAY, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_DISPLAY };
}

// Datas trafegam como dia de calendário (mesma convenção do Cronograma):
// input date ⇄ YYYY-MM-DD ⇄ meia-noite local.
const msToInput = (ms: number) => toScheduleDate(ms);
const inputToMs = (s: string) => parseScheduleDate(s);
const fmtBR = (iso: string | number) =>
  formatScheduleBR(typeof iso === 'number' ? iso : parseScheduleDate(iso));

// ── Página ────────────────────────────────────────────────────────────────────
export default function LinhaBalanco() {
  const { currentProject, addToast } = useStore();
  const historyStore = useHistoryStore();
  const projectId = currentProject?.id;

  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [baselines, setBaselines] = useState<Map<string, BaselineRange>>(new Map());
  const [draft, setDraft] = useState<DraftMap>(new Map());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [hiddenActivities, setHiddenActivities] = useState<Set<string>>(new Set());
  const [display, setDisplay] = useState<DisplayOptions>(loadDisplay);
  const [scaleIdx, setScaleIdx] = useState(1);
  const [loading, setLoading] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  // overlays
  const [tooltip, setTooltip] = useState<{ hit: BarHit; x: number; y: number } | null>(null);
  const [popover, setPopover] = useState<{ taskId: string; x: number; y: number } | null>(null);
  const [massDialog, setMassDialog] = useState<{
    taskId: string; newStart: number; newEnd: number; newDur: number; equivalents: GanttTask[];
  } | null>(null);
  const [showDisplayMenu, setShowDisplayMenu] = useState(false);
  const [showActivityMenu, setShowActivityMenu] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [saveDescription, setSaveDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [revisions, setRevisions] = useState<ScheduleRevision[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<LobCanvas | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const displayBtnRef = useRef<HTMLButtonElement>(null);
  const activityBtnRef = useRef<HTMLButtonElement>(null);

  // refs para callbacks do engine (evita closures obsoletas)
  const tasksRef = useRef(tasks); tasksRef.current = tasks;
  const draftRef = useRef(draft); draftRef.current = draft;

  useRealtime(projectId);

  // ── Carregamento ────────────────────────────────────────────────────────────
  const loadData = useCallback(async (pid: string) => {
    setLoading(true);
    try {
      const [gantt, baseList] = await Promise.all([
        scheduleApi.ganttData(pid),
        baselineApi.list(pid).catch(() => []),
      ]);
      setTasks(gantt);
      if (baseList.length > 0) {
        // baseline ativa = última versão
        const latest = baseList[0];
        const full = await baselineApi.get(pid, latest.id).catch(() => null);
        const snap = (full as unknown as { scheduleSnapshot?: { id: string; startDate: string; endDate: string }[] })?.scheduleSnapshot;
        if (Array.isArray(snap)) {
          setBaselines(new Map(snap.map((s) => [s.id, {
            start: new Date(s.startDate).getTime(),
            end: new Date(s.endDate).getTime(),
          }])));
        }
      } else {
        setBaselines(new Map());
      }
    } catch {
      addToast({ type: 'error', title: 'Erro ao carregar o cronograma' });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    if (!projectId) return;
    setDraft(new Map());
    setConflict(false);
    setHiddenActivities(new Set());
    loadData(projectId);
  }, [projectId, loadData]);

  // Conflito multi-usuário: mudança externa com edições pendentes
  const reloadDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useScheduleChanges(projectId, () => {
    if (draftRef.current.size > 0) {
      setConflict(true);
      return;
    }
    if (reloadDebounce.current) clearTimeout(reloadDebounce.current);
    reloadDebounce.current = setTimeout(() => { if (projectId) loadData(projectId); }, 400);
  });

  // ── Modelo derivado ─────────────────────────────────────────────────────────
  const activities = useMemo(() => listActivities(tasks), [tasks]);
  /** null = todas visíveis (sem filtro). */
  const activityFilter = useMemo(() => {
    if (hiddenActivities.size === 0) return null;
    return new Set(activities.map((a) => a.key).filter((k) => !hiddenActivities.has(k)));
  }, [activities, hiddenActivities]);
  const visibleActivityCount = activityFilter ? activityFilter.size : activities.length;

  const model = useMemo(
    () => buildFlowlineModel(tasks, draft, collapsed, activityFilter),
    [tasks, draft, collapsed, activityFilter],
  );
  const layout = useMemo(() => computeRowLayout(model), [model]);
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const deps = useMemo(
    () => tasks.flatMap((t) => t.successorDeps ?? []),
    [tasks],
  );

  // ── Edição (draft + cascata + undo) ─────────────────────────────────────────
  const commitChange = useCallback((
    taskId: string,
    newStart: number,
    newEnd: number,
    newDur: number,
    equivalents: GanttTask[] = [],
  ) => {
    const prevDraft = draftRef.current;
    let working: DraftMap = new Map(prevDraft);

    const main = applyMove(tasksRef.current, working, taskId, newStart, newEnd, newDur);
    for (const [id, c] of main.changes) working.set(id, c);

    for (const eq of equivalents) {
      const cur = effectiveDates(eq, working);
      const eqEnd = endFromDuration(cur.start, newDur); // duração em dias úteis
      const res = applyMove(tasksRef.current, working, eq.id, cur.start, eqEnd, newDur);
      for (const [id, c] of res.changes) working.set(id, c);
    }

    // remove entradas idênticas ao original (ex.: undo manual até a posição inicial)
    const cleaned: DraftMap = new Map();
    for (const [id, c] of working) {
      const t = tasksRef.current.find((x) => x.id === id);
      if (!t) continue;
      const same =
        parseScheduleDate(t.startDate) === parseScheduleDate(c.startDate) &&
        parseScheduleDate(t.endDate) === parseScheduleDate(c.endDate) &&
        (t.durationDays ?? 0) === c.durationDays;
      if (!same) cleaned.set(id, c);
    }
    working = cleaned;

    setDraft(working);
    const nextDraft = working;
    const target = tasksRef.current.find((t) => t.id === taskId);
    historyStore.push({
      description: `LDB: ${target?.name ?? taskId}${equivalents.length > 0 ? ` (+${equivalents.length} equivalentes)` : ''}`,
      module: 'linha-de-balanco',
      undo: async () => setDraft(prevDraft),
      redo: async () => setDraft(nextDraft),
    });
  }, [historyStore]);

  const handleDrag = useCallback((result: DragResult) => {
    const task = tasksRef.current.find((t) => t.id === result.taskId);
    if (!task) return;
    const isResize = result.kind !== 'move';
    // Duração sempre derivada do novo intervalo (dias úteis) — mesmo ao mover,
    // pois atravessar um fim de semana muda a contagem.
    const newDur = durationFromRange(result.newStart, result.newEnd);

    if (isResize) {
      const eqs = findEquivalents(task, tasksRef.current);
      if (eqs.length > 0) {
        setMassDialog({ taskId: task.id, newStart: result.newStart, newEnd: result.newEnd, newDur, equivalents: eqs });
        return;
      }
    }
    commitChange(result.taskId, result.newStart, result.newEnd, newDur);
  }, [commitChange]);

  const handleDragRef = useRef(handleDrag); handleDragRef.current = handleDrag;

  // ── Engine ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new LobCanvas(canvasRef.current, {
      onBarHover: (hit, x, y) => setTooltip(hit ? { hit, x, y } : null),
      onBarClick: (hit, x, y) => {
        setPopover({ taskId: hit.bar.taskId, x, y });
        setTooltip(null);
        engineRef.current?.setSelected(hit.bar.taskId);
      },
      onBarDrag: (r) => handleDragRef.current(r),
      onViewportChange: (sy) => setScrollY(sy),
      onBackgroundClick: () => {
        setPopover(null);
        engineRef.current?.setSelected(null);
      },
    });
    engineRef.current = engine;
    engine.setOptions(loadDisplay());
    return () => { engine.destroy(); engineRef.current = null; };
  }, []);

  useEffect(() => { engineRef.current?.setModel(model); }, [model]);
  useEffect(() => { engineRef.current?.setBaselines(baselines); }, [baselines]);
  useEffect(() => { engineRef.current?.setDependencies(deps); }, [deps]);
  useEffect(() => {
    engineRef.current?.setOptions(display);
    try { localStorage.setItem(DISPLAY_LS_KEY, JSON.stringify(display)); } catch { /* ignore */ }
  }, [display]);

  // Esc fecha overlays
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setPopover(null); setMassDialog(null); setShowDisplayMenu(false); setShowActivityMenu(false);
        engineRef.current?.setSelected(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Salvamento ──────────────────────────────────────────────────────────────
  async function saveReport() {
    if (!projectId || draft.size === 0) return;
    setSaving(true);
    try {
      const changes = [...draft.entries()].map(([id, c]) => ({ id, ...c }));
      const result = await scheduleApi.batchUpdate(projectId, {
        description: saveDescription || undefined,
        changes,
      });
      addToast({
        type: 'success',
        title: 'Reprogramação gravada',
        description: `${result.updated} atividade(s) atualizada(s) no Cronograma Principal.`,
      });
      setDraft(new Map());
      setConflict(false);
      setShowSave(false);
      setSaveDescription('');
      await loadData(projectId);
    } catch {
      addToast({ type: 'error', title: 'Erro ao gravar', description: 'Nenhuma alteração foi perdida — tente novamente.' });
    } finally {
      setSaving(false);
    }
  }

  async function openHistory() {
    if (!projectId) return;
    setShowHistory(true);
    const data = await scheduleApi.listRevisions(projectId).catch(() => []);
    setRevisions(data);
  }

  // ── Helpers de UI ───────────────────────────────────────────────────────────
  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const applyScale = (idx: number) => {
    setScaleIdx(idx);
    engineRef.current?.setPxPerDay(SCALE_PRESETS[idx].pxPerDay);
  };

  if (!currentProject) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--t2)', fontSize: 13 }}>
        Selecione um projeto para abrir a Linha de Balanço.
      </div>
    );
  }

  return (
    // flex:1 → ocupa toda a altura livre do .ao-content (sem sobra em branco e
    // sem rolagem da página): o gráfico cresce até o rodapé. O minHeight evita
    // que a área do gráfico seja espremida em janelas muito baixas — aí, sim,
    // o container volta a rolar.
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 420 }}>
      {conflict && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 10,
          background: 'var(--amb-bg, #fef3c7)', border: '1px solid var(--amber, #f59e0b)', color: 'var(--amber, #92400e)', fontSize: 12,
        }}>
          <AlertTriangle size={15} />
          <span style={{ flex: 1 }}>
            O cronograma foi alterado por outro usuário. Suas {draft.size} edição(ões) pendente(s) podem estar defasadas.
          </span>
          <button className="ao-btn ao-btn-sm" onClick={() => { setDraft(new Map()); setConflict(false); if (projectId) loadData(projectId); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <RefreshCw size={12} /> Descartar e recarregar
          </button>
          <button className="ao-btn ao-btn-sm" onClick={() => setConflict(false)}>Continuar mesmo assim</button>
        </div>
      )}

      {/* ── Barra superior ── */}
      <div className="ao-card" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 800, fontSize: 13 }}>
          {currentProject.name}
          <span style={{ color: 'var(--t3)', fontWeight: 600, fontSize: 11 }}> · Linha de Balanço</span>
        </div>

        <select
          value={scaleIdx}
          onChange={(e) => applyScale(Number(e.target.value))}
          style={{ padding: '4px 8px', fontSize: 11, border: '1px solid var(--bd)', borderRadius: 6, background: 'var(--s0)', color: 'var(--t1)' }}
        >
          {SCALE_PRESETS.map((s, i) => <option key={s.label} value={i}>Escala: {s.label}</option>)}
        </select>

        <div style={{ position: 'relative' }}>
          <button
            ref={activityBtnRef}
            className="ao-btn ao-btn-sm"
            onClick={() => setShowActivityMenu((v) => !v)}
            title="Escolher quais atividades aparecem no gráfico"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              ...(activityFilter ? { background: 'var(--blu-bg, #eff6ff)', borderColor: 'var(--blue, #3b82f6)', color: 'var(--blue, #1d4ed8)' } : {}),
            }}
          >
            <Filter size={12} /> Filtro de Atividades
            {activityFilter && (
              <span style={{ fontWeight: 800 }}>· {visibleActivityCount}/{activities.length}</span>
            )}
          </button>
          {showActivityMenu && (
            <ActivityFilterMenu
              anchorRef={activityBtnRef}
              activities={activities}
              hidden={hiddenActivities}
              onChange={setHiddenActivities}
              onClose={() => setShowActivityMenu(false)}
            />
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <button ref={displayBtnRef} className="ao-btn ao-btn-sm" onClick={() => setShowDisplayMenu((v) => !v)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Settings2 size={12} /> Exibição
          </button>
          {showDisplayMenu && (
            <DisplayMenu anchorRef={displayBtnRef} display={display} onChange={setDisplay} onClose={() => setShowDisplayMenu(false)} />
          )}
        </div>

        <div style={{ width: 1, height: 18, background: 'var(--bd)' }} />

        <ToggleBtn active={display.showBaseline} icon={<Layers size={12} />} label="Baseline"
          onClick={() => setDisplay((d) => ({ ...d, showBaseline: !d.showBaseline }))} />
        <ToggleBtn active={display.showDeps} icon={<GitBranch size={12} />} label="Dependências"
          onClick={() => setDisplay((d) => ({ ...d, showDeps: !d.showDeps }))} />

        <div style={{ width: 1, height: 18, background: 'var(--bd)' }} />

        <button className="ao-btn ao-btn-sm" title="Diminuir zoom" onClick={() => engineRef.current?.zoomOut()}><ZoomOut size={13} /></button>
        <button className="ao-btn ao-btn-sm" title="Aumentar zoom" onClick={() => engineRef.current?.zoomIn()}><ZoomIn size={13} /></button>
        <button className="ao-btn ao-btn-sm" title="Ajustar à tela" onClick={() => engineRef.current?.fit()}><Maximize2 size={13} /></button>

        <div style={{ width: 1, height: 18, background: 'var(--bd)' }} />

        <button className="ao-btn ao-btn-sm" title="Desfazer (Ctrl+Z)" disabled={historyStore.past.length === 0}
          onClick={() => historyStore.undo()}><Undo2 size={13} /></button>
        <button className="ao-btn ao-btn-sm" title="Refazer (Ctrl+Y)" disabled={historyStore.future.length === 0}
          onClick={() => historyStore.redo()}><Redo2 size={13} /></button>

        <button className="ao-btn ao-btn-sm" title="Histórico de reprogramações" onClick={openHistory}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <History size={12} /> Histórico
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {draft.size > 0 && (
            <span style={{
              background: 'var(--amb-bg, #fef3c7)', color: 'var(--amber, #92400e)', border: '1px solid var(--amber, #f59e0b)',
              borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700,
            }}>
              ● {draft.size} alteração(ões) pendente(s)
            </span>
          )}
          <button
            className="ao-btn ao-btn-primary ao-btn-sm"
            disabled={draft.size === 0 || saving}
            onClick={() => setShowSave(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Save size={13} /> Gravar Report
          </button>
        </div>
      </div>

      {/* ── Área principal: árvore + canvas ── */}
      <div
        ref={wrapRef}
        className="ao-card"
        title="Arraste a barra para mover · bordas para redimensionar · Ctrl+scroll = zoom · Shift+scroll = rolagem horizontal · borda azul = alteração pendente · barra fina = baseline · linha vermelha = hoje"
        style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden', padding: 0, position: 'relative' }}
      >
        {/* Árvore de locais */}
        <div
          style={{ width: TREE_W, flexShrink: 0, borderRight: '1px solid var(--bd)', background: 'var(--s1)', overflow: 'hidden', position: 'relative' }}
          onWheel={(e) => engineRef.current?.setScrollY((engineRef.current?.getScrollY() ?? 0) + e.deltaY)}
        >
          <div style={{
            height: HEADER_H, display: 'flex', alignItems: 'flex-end', padding: '0 10px 6px',
            fontSize: 9, fontWeight: 800, color: 'var(--t3)', letterSpacing: 1, borderBottom: '1px solid var(--bd)',
          }}>
            LOCAIS
          </div>
          <div style={{ position: 'absolute', top: HEADER_H, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
            <div style={{ transform: `translateY(${-scrollY}px)` }}>
              {layout.entries.map(({ row, height }) => (
                <div
                  key={row.id}
                  onClick={row.kind === 'group' && row.collapsible ? () => toggleCollapse(row.id) : undefined}
                  style={{
                    height,
                    display: 'flex', alignItems: 'center', gap: 4,
                    paddingLeft: 8 + row.depth * 12,
                    fontSize: row.kind === 'group' ? 10.5 : 11,
                    fontWeight: row.kind === 'group' ? 800 : 500,
                    color: row.kind === 'group' ? 'var(--t2)' : 'var(--t1)',
                    background: row.kind === 'group' ? 'var(--s2)' : 'transparent',
                    borderBottom: '1px solid var(--bd)',
                    cursor: row.kind === 'group' ? 'pointer' : 'default',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    userSelect: 'none',
                  }}
                >
                  {row.kind === 'group' && (collapsed.has(row.id) ? <ChevronRight size={11} /> : <ChevronDown size={11} />)}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <canvas ref={canvasRef} style={{ display: 'block' }} />
          {loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.6)', fontSize: 12, color: 'var(--t2)' }}>
              Carregando cronograma…
            </div>
          )}
        </div>

        {/* Tooltip */}
        {tooltip && !popover && (
          <BarTooltip hit={tooltip.hit} x={tooltip.x} y={tooltip.y} taskById={taskById} draft={draft} wrapRef={wrapRef} />
        )}

        {/* Popover de edição */}
        {popover && (
          <EditPopover
            key={popover.taskId}
            taskId={popover.taskId}
            x={popover.x} y={popover.y}
            taskById={taskById}
            draft={draft}
            wrapRef={wrapRef}
            onClose={() => { setPopover(null); engineRef.current?.setSelected(null); }}
            onApply={(start, end, dur) => {
              const task = taskById.get(popover.taskId);
              if (!task) return;
              const curDur = effectiveDates(task, draft).durationDays;
              const eqs = dur !== curDur ? findEquivalents(task, tasks) : [];
              setPopover(null);
              engineRef.current?.setSelected(null);
              if (eqs.length > 0) {
                setMassDialog({ taskId: task.id, newStart: start, newEnd: end, newDur: dur, equivalents: eqs });
              } else {
                commitChange(task.id, start, end, dur);
              }
            }}
          />
        )}
      </div>

      {/* ── Dialogs ── */}
      {massDialog && (
        <MassEditDialog
          dialog={massDialog}
          taskById={taskById}
          onOnlyThis={() => {
            commitChange(massDialog.taskId, massDialog.newStart, massDialog.newEnd, massDialog.newDur);
            setMassDialog(null);
          }}
          onAll={() => {
            commitChange(massDialog.taskId, massDialog.newStart, massDialog.newEnd, massDialog.newDur, massDialog.equivalents);
            setMassDialog(null);
          }}
          onCancel={() => setMassDialog(null)}
        />
      )}

      {showSave && (
        <Modal title="Gravar Report de Reprogramação" onClose={() => setShowSave(false)}>
          <p style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 10 }}>
            {draft.size} atividade(s) serão atualizadas no <b>Cronograma Principal</b> (única fonte da verdade).
            As demais telas serão sincronizadas automaticamente.
          </p>
          <textarea
            value={saveDescription}
            onChange={(e) => setSaveDescription(e.target.value)}
            placeholder="Descrição da reprogramação (opcional)"
            rows={3}
            style={{ width: '100%', fontSize: 12, padding: 8, border: '1px solid var(--bd)', borderRadius: 8, background: 'var(--s0)', color: 'var(--t1)', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button className="ao-btn ao-btn-sm" onClick={() => setShowSave(false)} disabled={saving}>Cancelar</button>
            <button className="ao-btn ao-btn-primary ao-btn-sm" onClick={saveReport} disabled={saving}>
              {saving ? 'Gravando…' : 'Confirmar e Gravar'}
            </button>
          </div>
        </Modal>
      )}

      {showHistory && (
        <Modal title="Histórico de Reprogramações" onClose={() => setShowHistory(false)} wide>
          {revisions.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--t3)' }}>Nenhuma reprogramação gravada ainda.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '55vh', overflowY: 'auto' }}>
              {revisions.map((rev) => <RevisionCard key={rev.id} rev={rev} />)}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ── Componentes auxiliares ────────────────────────────────────────────────────

function ToggleBtn({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      className="ao-btn ao-btn-sm"
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        ...(active ? { background: 'var(--blu-bg, #eff6ff)', borderColor: 'var(--blue, #3b82f6)', color: 'var(--blue, #1d4ed8)' } : {}),
      }}
    >
      {icon} {label}
    </button>
  );
}

/**
 * Dropdown de filtro de atividades: busca + checkboxes multi-seleção.
 * Substitui a antiga legenda inferior — a bolinha colorida de cada item já
 * cumpre o papel de legenda, sem consumir altura do gráfico.
 */
function ActivityFilterMenu({ anchorRef, activities, hidden, onChange, onClose }: {
  anchorRef: React.RefObject<HTMLButtonElement>;
  activities: ActivityOption[];
  hidden: Set<string>;
  onChange: (next: Set<string>) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const filtered = query.trim()
    ? activities.filter((a) => norm(a.key).includes(norm(query.trim())))
    : activities;

  const toggle = (key: string) => {
    const next = new Set(hidden);
    if (next.has(key)) next.delete(key); else next.add(key);
    onChange(next);
  };
  /** Marca só as atividades da busca atual (atalho "Somente estas"). */
  const onlyThese = () => onChange(new Set(activities.filter((a) => !filtered.includes(a)).map((a) => a.key)));

  const MENU_W = 290;
  const rect = anchorRef.current?.getBoundingClientRect();
  const left = rect ? Math.min(rect.left, window.innerWidth - MENU_W - 8) : 8;
  const top = rect ? rect.bottom + 6 : 60;
  const selectedCount = activities.length - activities.filter((a) => hidden.has(a.key)).length;

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={onClose} />
      <div style={{
        position: 'fixed', top, left, zIndex: 41, width: MENU_W,
        background: 'var(--s0)', border: '1px solid var(--bd)', borderRadius: 10,
        boxShadow: '0 10px 30px rgba(0,0,0,.18)', display: 'flex', flexDirection: 'column',
        maxHeight: `min(70vh, ${Math.max(220, window.innerHeight - top - 16)}px)`,
      }}>
        <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid var(--bd)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Atividades ({selectedCount}/{activities.length})
            </span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', display: 'flex' }}>
              <X size={13} />
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)' }} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar atividade…"
              style={{
                width: '100%', fontSize: 11.5, padding: '5px 8px 5px 24px',
                border: '1px solid var(--bd)', borderRadius: 6, background: 'var(--s1)', color: 'var(--t1)',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button className="ao-btn ao-btn-sm" style={{ flex: 1, fontSize: 10.5 }} onClick={() => onChange(new Set())}>
              Selecionar todas
            </button>
            <button className="ao-btn ao-btn-sm" style={{ flex: 1, fontSize: 10.5 }}
              onClick={() => onChange(new Set(activities.map((a) => a.key)))}>
              Limpar
            </button>
            {query.trim() && filtered.length > 0 && (
              <button className="ao-btn ao-btn-sm" style={{ flex: 1, fontSize: 10.5 }} onClick={onlyThese}>
                Somente estas
              </button>
            )}
          </div>
        </div>

        <div style={{ overflowY: 'auto', padding: '6px 6px 8px' }}>
          {filtered.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--t3)', padding: '10px 6px', textAlign: 'center' }}>
              Nenhuma atividade encontrada.
            </div>
          )}
          {filtered.map((a) => (
            <label
              key={a.key}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: 'var(--t1)',
                padding: '4px 6px', borderRadius: 6, cursor: 'pointer',
              }}
            >
              <input type="checkbox" checked={!hidden.has(a.key)} onChange={() => toggle(a.key)} />
              <span style={{ width: 10, height: 10, borderRadius: 2, background: a.color.dark, flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.key}</span>
              <span style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 700 }}>{a.count}</span>
            </label>
          ))}
        </div>
      </div>
    </>
  );
}

function DisplayMenu({ anchorRef, display, onChange, onClose }: {
  anchorRef: React.RefObject<HTMLButtonElement>;
  display: DisplayOptions; onChange: (d: DisplayOptions) => void; onClose: () => void;
}) {
  const opts: { key: keyof DisplayOptions; label: string }[] = [
    { key: 'showWeekYear', label: 'Semana do ano (S36, S37…)' },
    { key: 'showWeekday', label: 'Dia da semana (S T Q Q S S D)' },
    { key: 'showDayNum', label: 'Número do dia (1, 2, 3…)' },
    { key: 'highlightWeekend', label: 'Destacar sáb/dom' },
  ];
  // position: fixed ancorado ao botão — escapa do overflow:hidden do .ao-card
  // (causa raiz do menu "não abrir": ele abria, mas era recortado pelo card).
  const MENU_W = 230;
  const rect = anchorRef.current?.getBoundingClientRect();
  const left = rect ? Math.min(rect.left, window.innerWidth - MENU_W - 8) : 8;
  const top = rect ? rect.bottom + 6 : 60;
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={onClose} />
      <div style={{
        position: 'fixed', top, left, zIndex: 41, width: MENU_W,
        background: 'var(--s0)', border: '1px solid var(--bd)', borderRadius: 10, padding: 12,
        boxShadow: '0 10px 30px rgba(0,0,0,.18)',
      }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          Cabeçalho de tempo
        </div>
        {opts.map((o) => (
          <label key={o.key} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: 'var(--t1)', marginBottom: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={display[o.key]}
              onChange={(e) => onChange({ ...display, [o.key]: e.target.checked })}
            />
            {o.label}
          </label>
        ))}
      </div>
    </>
  );
}

function overlayPos(wrapRef: React.RefObject<HTMLDivElement>, clientX: number, clientY: number, w: number, h: number) {
  const rect = wrapRef.current?.getBoundingClientRect();
  if (!rect) return { left: clientX, top: clientY };
  let left = clientX - rect.left + 12;
  let top = clientY - rect.top + 12;
  if (left + w > rect.width) left = Math.max(4, clientX - rect.left - w - 12);
  if (top + h > rect.height) top = Math.max(4, clientY - rect.top - h - 12);
  return { left, top };
}

function BarTooltip({ hit, x, y, taskById, draft, wrapRef }: {
  hit: BarHit; x: number; y: number;
  taskById: Map<string, GanttTask>; draft: DraftMap;
  wrapRef: React.RefObject<HTMLDivElement>;
}) {
  const task = taskById.get(hit.bar.taskId);
  if (!task) return null;
  const eff = effectiveDates(task, draft);
  const preds = (task.predecessorDeps ?? []).map((d) => {
    const p = taskById.get(d.predecessorId);
    return p ? `${p.name} (${d.type}${d.lagDays ? `+${d.lagDays}` : ''})` : null;
  }).filter(Boolean);
  const succs = (task.successorDeps ?? []).map((d) => {
    const s = taskById.get(d.successorId);
    return s ? `${s.name} (${d.type}${d.lagDays ? `+${d.lagDays}` : ''})` : null;
  }).filter(Boolean);

  // local = cadeia de ancestrais até o pavimento (nome da linha já ajuda; usa pai direto)
  const parent = task.parentId ? taskById.get(task.parentId) : undefined;

  const pos = overlayPos(wrapRef, x, y, 230, 190);
  const row = (label: string, value: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 3 }}>
      <span style={{ color: '#94a3b8' }}>{label}</span>
      <span style={{ textAlign: 'right' }}>{value}</span>
    </div>
  );

  return (
    <div style={{
      position: 'absolute', ...pos, zIndex: 50, width: 230, pointerEvents: 'none',
      background: '#0f172a', color: '#e2e8f0', borderRadius: 8, padding: '9px 11px',
      fontSize: 10, boxShadow: '0 8px 24px rgba(0,0,0,.35)',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{task.name}</div>
      {row('Grupo', hit.bar.color.label)}
      {parent && row('Local', parent.name)}
      {row('Início → Término', `${fmtBR(eff.start)} → ${fmtBR(eff.end)}`)}
      {row('Duração', `${eff.durationDays} dia(s)`)}
      {row('Executado', `${(task.physicalProgress ?? 0).toFixed(0)}%`)}
      {row('Produtividade', `${eff.durationDays} dias/pav`)}
      {preds.length > 0 && row('Predecessoras', preds.slice(0, 2).join(', ') + (preds.length > 2 ? '…' : ''))}
      {succs.length > 0 && row('Sucessoras', succs.slice(0, 2).join(', ') + (succs.length > 2 ? '…' : ''))}
      {hit.bar.pending && (
        <div style={{ marginTop: 5, color: '#93c5fd', fontWeight: 700 }}>● alteração pendente — não sincronizada</div>
      )}
    </div>
  );
}

function EditPopover({ taskId, x, y, taskById, draft, wrapRef, onClose, onApply }: {
  taskId: string; x: number; y: number;
  taskById: Map<string, GanttTask>; draft: DraftMap;
  wrapRef: React.RefObject<HTMLDivElement>;
  onClose: () => void;
  onApply: (startMs: number, endMs: number, durationDays: number) => void;
}) {
  const task = taskById.get(taskId);
  const eff = task ? effectiveDates(task, draft) : null;
  const [start, setStart] = useState(eff ? msToInput(eff.start) : '');
  const [end, setEnd] = useState(eff ? msToInput(eff.end) : '');
  const [dur, setDur] = useState(eff ? String(eff.durationDays) : '1');
  if (!task || !eff) return null;

  // Duração em dias úteis, inclusiva nas duas pontas — mesma regra do Cronograma.
  const setStartLinked = (v: string) => {
    setStart(v);
    const d = Math.max(1, parseInt(dur, 10) || 1);
    setEnd(msToInput(endFromDuration(inputToMs(v), d)));
  };
  const setEndLinked = (v: string) => {
    setEnd(v);
    setDur(String(durationFromRange(inputToMs(start), inputToMs(v))));
  };
  const setDurLinked = (v: string) => {
    setDur(v);
    const d = Math.max(1, parseInt(v, 10) || 1);
    setEnd(msToInput(endFromDuration(inputToMs(start), d)));
  };

  const pos = overlayPos(wrapRef, x, y, 250, 210);
  const fld: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 7, fontSize: 11 };
  const inp: React.CSSProperties = { width: 130, fontSize: 11, padding: '3px 6px', border: '1px solid var(--bd)', borderRadius: 6, background: 'var(--s0)', color: 'var(--t1)' };

  return (
    <div style={{
      position: 'absolute', ...pos, zIndex: 51, width: 250,
      background: 'var(--s0)', border: '1px solid var(--bd)', borderRadius: 10, padding: 12,
      boxShadow: '0 10px 30px rgba(0,0,0,.2)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          ✏️ {task.name}
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)' }}><X size={13} /></button>
      </div>
      <div style={fld}><span style={{ color: 'var(--t2)' }}>Início</span>
        <input type="date" style={inp} value={start} onChange={(e) => setStartLinked(e.target.value)} /></div>
      <div style={fld}><span style={{ color: 'var(--t2)' }}>Término</span>
        <input type="date" style={inp} value={end} onChange={(e) => setEndLinked(e.target.value)} /></div>
      <div style={fld}><span style={{ color: 'var(--t2)' }}>Duração (dias)</span>
        <input type="number" min={1} style={inp} value={dur} onChange={(e) => setDurLinked(e.target.value)} /></div>
      <div style={fld}><span style={{ color: 'var(--t2)' }}>Produtividade</span>
        <span style={{ fontSize: 11, color: 'var(--t1)', fontWeight: 600 }}>{Math.max(1, parseInt(dur, 10) || 1)} dias/pav</span></div>
      <div style={{ fontSize: 9.5, color: 'var(--t3)', marginBottom: 8 }}>
        Alterações ficam pendentes até Gravar Report. Sucessoras são empurradas automaticamente.
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
        <button className="ao-btn ao-btn-sm" onClick={onClose}>Cancelar</button>
        <button
          className="ao-btn ao-btn-primary ao-btn-sm"
          onClick={() => {
            const s = inputToMs(start);
            const e2 = inputToMs(end);
            if (e2 < s) return;
            onApply(s, e2, Math.max(1, parseInt(dur, 10) || 1));
          }}
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}

function MassEditDialog({ dialog, taskById, onOnlyThis, onAll, onCancel }: {
  dialog: { taskId: string; newDur: number; equivalents: GanttTask[] };
  taskById: Map<string, GanttTask>;
  onOnlyThis: () => void; onAll: () => void; onCancel: () => void;
}) {
  const task = taskById.get(dialog.taskId);
  return (
    <Modal title="Atividades equivalentes encontradas" onClose={onCancel}>
      <p style={{ fontSize: 12, color: 'var(--t1)', marginBottom: 6 }}>
        <b>{task?.name}</b> existe em <b>{dialog.equivalents.length}</b> outro(s) local(is).
      </p>
      <p style={{ fontSize: 11.5, color: 'var(--t2)', marginBottom: 12 }}>
        Deseja aplicar a nova duração de <b>{dialog.newDur} dia(s)</b> em todas as atividades equivalentes
        (mantendo o início de cada uma) ou apenas nesta?
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        <button className="ao-btn ao-btn-sm" onClick={onCancel}>Cancelar</button>
        <button className="ao-btn ao-btn-sm" onClick={onOnlyThis}>Apenas nesta atividade</button>
        <button className="ao-btn ao-btn-primary ao-btn-sm" onClick={onAll}>
          Aplicar em todas ({dialog.equivalents.length + 1})
        </button>
      </div>
    </Modal>
  );
}

function RevisionCard({ rev }: { rev: ScheduleRevision }) {
  const [open, setOpen] = useState(false);
  const changes = Array.isArray(rev.changes) ? rev.changes : [];
  return (
    <div style={{ border: '1px solid var(--bd)', borderRadius: 10, padding: '9px 12px', background: 'var(--s1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setOpen((v) => !v)}>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>
            {new Date(rev.createdAt).toLocaleString('pt-BR')} · {rev.user?.fullName ?? '—'}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--t3)' }}>
            {changes.length} atividade(s) reprogramada(s){rev.description ? ` · ${rev.description}` : ''}
          </div>
        </div>
      </div>
      {open && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
          {changes.map((c) => (
            <div key={c.itemId} style={{ fontSize: 10.5, color: 'var(--t2)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, color: 'var(--t1)' }}>{c.name}</span>
              <span>{fmtBR(c.before.startDate)} → {fmtBR(c.before.endDate)} ({c.before.durationDays}d)</span>
              <span style={{ color: 'var(--t3)' }}>⇒</span>
              <span style={{ fontWeight: 600 }}>{fmtBR(c.after.startDate)} → {fmtBR(c.after.endDate)} ({c.after.durationDays}d)</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Modal({ title, children, onClose, wide }: {
  title: string; children: React.ReactNode; onClose: () => void; wide?: boolean;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.45)' }}
      onClick={onClose}>
      <div style={{ width: wide ? 640 : 440, maxWidth: '92vw', background: 'var(--s0)', border: '1px solid var(--bd)', borderRadius: 14, padding: 18, boxShadow: '0 24px 60px rgba(0,0,0,.35)' }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--t1)' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)' }}><X size={15} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
