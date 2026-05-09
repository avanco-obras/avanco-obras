import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useStore } from '@/store';
import { scheduleApi } from '@/services/api';
import type { GanttTask } from '@/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const PX_PER_DAY = 4;
const ROW_H = 28;
const HDR_H = 30;
const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// ── Mock data ─────────────────────────────────────────────────────────────────

function buildMockTasks(): GanttTask[] {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();

  const d = (offsetMonths: number, offsetDays = 0) => {
    const dt = new Date(y, m + offsetMonths, 1 + offsetDays);
    return dt.toISOString().split('T')[0];
  };

  return [
    { id: '1', code: '1', name: 'OBRA', level: 0, startDate: d(-1), endDate: d(11), plannedProgress: 35, actualProgress: 30, isCriticalPath: false, hasChildren: true },
    { id: '2', code: '1.1', name: 'ESTRUTURA', level: 1, parentId: '1', startDate: d(-1), endDate: d(5), plannedProgress: 60, actualProgress: 50, isCriticalPath: true, hasChildren: true },
    { id: '3', code: '1.1.1', name: 'Fundação', level: 2, parentId: '2', startDate: d(-1), endDate: d(1), plannedProgress: 100, actualProgress: 100, isCriticalPath: true, hasChildren: true },
    { id: '4', code: '1.1.1.1', name: 'Estacas', level: 3, parentId: '3', startDate: d(-1), endDate: d(0, 15), plannedProgress: 100, actualProgress: 100, isCriticalPath: true, hasChildren: false },
    { id: '5', code: '1.1.1.2', name: 'Blocos', level: 3, parentId: '3', startDate: d(0, 10), endDate: d(1), plannedProgress: 100, actualProgress: 95, isCriticalPath: true, hasChildren: true },
    { id: '6', code: '1.1.1.2.1', name: 'Bloco tipo A', level: 4, parentId: '5', startDate: d(0, 10), endDate: d(0, 20), plannedProgress: 100, actualProgress: 100, isCriticalPath: false, hasChildren: false },
    { id: '7', code: '1.1.2', name: 'Pilares e Lajes', level: 2, parentId: '2', startDate: d(1), endDate: d(5), plannedProgress: 40, actualProgress: 25, isCriticalPath: true, hasChildren: false },
    { id: '8', code: '1.2', name: 'ALVENARIA', level: 1, parentId: '1', startDate: d(3), endDate: d(7), plannedProgress: 10, actualProgress: 5, isCriticalPath: false, hasChildren: true },
    { id: '9', code: '1.2.1', name: 'Vedação interna', level: 2, parentId: '8', startDate: d(3), endDate: d(6), plannedProgress: 15, actualProgress: 8, isCriticalPath: false, hasChildren: false },
    { id: '10', code: '1.2.2', name: 'Vedação externa', level: 2, parentId: '8', startDate: d(5), endDate: d(7), plannedProgress: 0, actualProgress: 0, isCriticalPath: false, hasChildren: false },
    { id: '11', code: '1.3', name: 'ACABAMENTO', level: 1, parentId: '1', startDate: d(7), endDate: d(11), plannedProgress: 0, actualProgress: 0, isCriticalPath: false, hasChildren: true },
    { id: '12', code: '1.3.1', name: 'Revestimento', level: 2, parentId: '11', startDate: d(7), endDate: d(10), plannedProgress: 0, actualProgress: 0, isCriticalPath: false, hasChildren: false },
    { id: '13', code: '1.3.2', name: 'Pintura', level: 2, parentId: '11', startDate: d(9), endDate: d(11), plannedProgress: 0, actualProgress: 0, isCriticalPath: false, hasChildren: false },
  ];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function parseDate(s: string) {
  return new Date(s + 'T00:00:00');
}

function monthsInRange(minDate: Date, maxDate: Date): { label: string; left: number; width: number }[] {
  const months: { label: string; left: number; width: number }[] = [];
  const cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  while (cur <= maxDate) {
    const start = cur < minDate ? minDate : new Date(cur);
    const endOfMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    const end = endOfMonth > maxDate ? maxDate : endOfMonth;
    const left = daysBetween(minDate, start) * PX_PER_DAY;
    const width = (daysBetween(start, end) + 1) * PX_PER_DAY;
    // Show year prefix on January only, matching HTML reference
    const mi = cur.getMonth();
    const label = mi === 0 ? `${cur.getFullYear()} ${MONTHS_PT[0]}` : MONTHS_PT[mi];
    months.push({ label, left, width });
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

// Same thresholds and colors as HTML reference
function barColor(actual: number, planned: number): string {
  if (actual >= planned) return '#3B6D11';
  if (actual >= planned - 15) return '#BA7517';
  return '#E24B4A';
}

function badgeClass(actual: number, planned: number): string {
  if (actual >= planned) return 'ao-badge ao-bg';
  if (actual >= planned - 15) return 'ao-badge ao-ba';
  return 'ao-badge ao-br';
}

// ── Level row styles ──────────────────────────────────────────────────────────

function levelStyle(level: number): React.CSSProperties {
  switch (level) {
    case 0: return { background: 'var(--bg3)', fontWeight: 600, fontSize: 12 };
    case 1: return { background: 'var(--bg2)', fontWeight: 500, fontSize: 11 };
    case 2: return { fontSize: 11, paddingLeft: 12 };
    case 3: return { fontSize: 10, color: 'var(--t2)', paddingLeft: 20 };
    default: return { fontSize: 10, color: 'var(--t3)', paddingLeft: 28 };
  }
}

function rowBg(level: number): string {
  if (level === 0) return 'var(--bg3)';
  if (level === 1) return 'var(--bg2)';
  return 'transparent';
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Cronograma() {
  const { currentProject, addToast } = useStore();
  const projectId = currentProject?.id;

  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchRaw, setSearchRaw] = useState('');
  const [search, setSearch] = useState('');

  // Synchronized scroll refs
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchRaw.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [searchRaw]);

  const loadData = useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    scheduleApi
      .ganttData(projectId)
      .then((data) => {
        setTasks(data);
        const ids = data.filter((t) => t.hasChildren && t.level <= 1).map((t) => t.id);
        setExpanded(new Set(ids));
      })
      .catch(() => {
        const mock = buildMockTasks();
        setTasks(mock);
        const ids = mock.filter((t) => t.hasChildren && t.level <= 1).map((t) => t.id);
        setExpanded(new Set(ids));
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      loadData();
    } else {
      const mock = buildMockTasks();
      setTasks(mock);
      const ids = mock.filter((t) => t.hasChildren && t.level <= 1).map((t) => t.id);
      setExpanded(new Set(ids));
    }
  }, [loadData, projectId]);

  // Ancestor set for search filtering
  const ancestorIds = useMemo((): Set<string> => {
    if (!search) return new Set();
    const idToParent: Record<string, string> = {};
    tasks.forEach((t) => { if (t.parentId) idToParent[t.id] = t.parentId; });
    const matched = tasks.filter((t) => t.name.toLowerCase().includes(search));
    const ancestors = new Set<string>();
    matched.forEach((t) => {
      let pid = t.parentId;
      while (pid) {
        ancestors.add(pid);
        pid = idToParent[pid];
      }
    });
    return ancestors;
  }, [search, tasks]);

  // Visible tasks (respecting expand + search)
  const visibleTasks = useMemo(() => {
    if (search) {
      const matchedIds = new Set(
        tasks.filter((t) => t.name.toLowerCase().includes(search)).map((t) => t.id)
      );
      return tasks.filter((t) => matchedIds.has(t.id) || ancestorIds.has(t.id));
    }
    const hidden = new Set<string>();
    tasks.forEach((t) => {
      if (!t.parentId) return;
      let pid: string | undefined = t.parentId;
      while (pid) {
        const parent = tasks.find((x) => x.id === pid);
        if (!parent) break;
        if (parent.hasChildren && !expanded.has(parent.id)) {
          hidden.add(t.id);
          break;
        }
        pid = parent.parentId;
      }
    });
    return tasks.filter((t) => !hidden.has(t.id));
  }, [tasks, expanded, search, ancestorIds]);

  // Date range
  const { minDate, maxDate, totalWidth } = useMemo(() => {
    if (tasks.length === 0) {
      const now = new Date();
      const min = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const max = new Date(now.getFullYear(), now.getMonth() + 6, 1);
      return { minDate: min, maxDate: max, totalWidth: daysBetween(min, max) * PX_PER_DAY };
    }
    const dates = tasks.flatMap((t) => [parseDate(t.startDate), parseDate(t.endDate)]);
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    min.setMonth(min.getMonth() - 1);
    max.setMonth(max.getMonth() + 1);
    return { minDate: min, maxDate: max, totalWidth: daysBetween(min, max) * PX_PER_DAY };
  }, [tasks]);

  const months = useMemo(() => monthsInRange(minDate, maxDate), [minDate, maxDate]);
  const todayLeft = useMemo(() => daysBetween(minDate, new Date()) * PX_PER_DAY, [minDate]);

  // Scroll sync (vertical only — horizontal is shared in same container)
  function onLeftScroll() {
    if (syncingRef.current) return;
    syncingRef.current = true;
    if (rightRef.current && leftRef.current) rightRef.current.scrollTop = leftRef.current.scrollTop;
    syncingRef.current = false;
  }

  function onRightScroll() {
    if (syncingRef.current) return;
    syncingRef.current = true;
    if (leftRef.current && rightRef.current) leftRef.current.scrollTop = rightRef.current.scrollTop;
    syncingRef.current = false;
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function expandAll() {
    setExpanded(new Set(tasks.filter((t) => t.hasChildren).map((t) => t.id)));
  }

  function collapseAll() {
    setExpanded(new Set());
  }

  function handleExport() {
    addToast({ type: 'info', title: 'Exportando...', description: 'Gerando arquivo CSV do cronograma.' });
  }

  function barLeft(task: GanttTask) {
    return daysBetween(minDate, parseDate(task.startDate)) * PX_PER_DAY;
  }

  function barWidth(task: GanttTask) {
    const days = daysBetween(parseDate(task.startDate), parseDate(task.endDate));
    return Math.max(4, days * PX_PER_DAY);
  }

  // ── No project selected ───────────────────────────────────────────────────

  if (!currentProject) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16, textAlign: 'center', padding: '0 1rem' }}>
        <div style={{ fontSize: 13, color: 'var(--t2)' }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--t1)', marginBottom: 4 }}>Selecione um projeto</p>
          <p>Escolha um projeto no seletor acima para visualizar o cronograma.</p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="ao-card" style={{ padding: '0.75rem 1rem', marginBottom: 0 }}>
      {/* Card header */}
      <div className="ao-card-hdr" style={{ marginBottom: 8 }}>
        <span className="ao-card-title">EAP — Cronograma completo</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            placeholder="Buscar atividade..."
            value={searchRaw}
            onChange={(e) => setSearchRaw(e.target.value)}
            style={{
              padding: '5px 9px',
              fontSize: 11,
              border: '0.5px solid var(--bd2)',
              borderRadius: 8,
              background: 'var(--bg1)',
              color: 'var(--t1)',
              width: 160,
            }}
          />
          <button className="ao-btn ao-btn-sm" onClick={expandAll}>Expandir</button>
          <button className="ao-btn ao-btn-sm" onClick={collapseAll}>Recolher</button>
          <button className="ao-btn ao-btn-sm" onClick={handleExport}>CSV</button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--t2)', marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 5, background: 'rgba(55,138,221,.3)', borderRadius: 2, display: 'inline-block' }} />
          Planejado
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 5, background: '#3B6D11', borderRadius: 2, display: 'inline-block' }} />
          No prazo
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 5, background: '#BA7517', borderRadius: 2, display: 'inline-block' }} />
          Leve atraso
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 5, background: '#E24B4A', borderRadius: 2, display: 'inline-block' }} />
          Crítico
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 1, height: 12, background: '#E24B4A', display: 'inline-block' }} />
          Hoje
        </span>
      </div>

      {/* Gantt wrap */}
      <div style={{ display: 'flex', border: '0.5px solid var(--bd)', borderRadius: 12, overflow: 'hidden', height: 520 }}>

        {/* ── Left panel ── */}
        <div style={{ width: 260, flexShrink: 0, borderRight: '0.5px solid var(--bd)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Sticky header */}
          <div style={{
            height: HDR_H,
            background: 'var(--bg2)',
            borderBottom: '0.5px solid var(--bd)',
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--t2)',
            padding: '0 8px',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            position: 'sticky',
            top: 0,
            zIndex: 3,
          }}>
            Atividade
          </div>

          {/* Scrollable list */}
          <div
            ref={leftRef}
            onScroll={onLeftScroll}
            style={{ overflowY: 'scroll', overflowX: 'hidden', flex: 1 }}
          >
            {loading
              ? Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} style={{ height: ROW_H, borderBottom: '0.5px solid var(--bd)', display: 'flex', alignItems: 'center', padding: '0 8px', gap: 6 }}>
                    <div style={{ height: 8, background: 'var(--bg3)', borderRadius: 4, width: '75%' }} />
                  </div>
                ))
              : visibleTasks.map((task) => {
                  const lvStyle = levelStyle(task.level);
                  const basePad = task.level === 0 || task.level === 1 ? 8 : 0;
                  const isExpanded = expanded.has(task.id) || !!search;
                  return (
                    <div
                      key={task.id}
                      style={{
                        height: ROW_H,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        paddingLeft: basePad,
                        paddingRight: 6,
                        borderBottom: '0.5px solid var(--bd)',
                        userSelect: 'none',
                        cursor: 'pointer',
                        transition: 'background .1s',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        ...lvStyle,
                      }}
                      onMouseEnter={(e) => { if (task.level > 1) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg2)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = lvStyle.background as string ?? ''; }}
                    >
                      {/* Expand toggle — ▶ rotates 90° when open */}
                      {task.hasChildren ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleExpand(task.id); }}
                          style={{
                            width: 16, height: 16, border: 'none', background: 'none',
                            cursor: 'pointer', color: 'var(--t2)', fontSize: 10, flexShrink: 0,
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            padding: 0,
                            transition: 'transform .15s',
                            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                          }}
                        >
                          ▶
                        </button>
                      ) : (
                        <span style={{ width: 16, flexShrink: 0 }} />
                      )}

                      {/* Code */}
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 9, opacity: 0.55, flexShrink: 0 }}>{task.code}</span>

                      {/* Name */}
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={task.name}>{task.name}</span>

                      {/* Progress badge */}
                      <span className={badgeClass(task.actualProgress, task.plannedProgress)} style={{ flexShrink: 0, minWidth: 32, justifyContent: 'center', fontSize: 9, marginLeft: 4 }}>
                        {task.actualProgress}%
                      </span>
                    </div>
                  );
                })}
          </div>
        </div>

        {/* ── Right Gantt panel ── */}
        {/* Single overflow:auto container — month header is sticky inside */}
        <div
          ref={rightRef}
          onScroll={onRightScroll}
          style={{ flex: 1, overflow: 'auto', background: 'var(--bg1)' }}
        >
          {/* Sticky month header */}
          <div style={{
            position: 'sticky',
            top: 0,
            zIndex: 3,
            background: 'var(--bg2)',
            borderBottom: '0.5px solid var(--bd)',
            height: HDR_H,
            width: totalWidth,
          }}>
            {months.map((mon, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: mon.left,
                  top: 0,
                  width: mon.width,
                  height: HDR_H,
                  borderLeft: '0.5px solid var(--bd)',
                  padding: '0 4px',
                  fontSize: 9,
                  color: 'var(--t2)',
                  display: 'flex',
                  alignItems: 'center',
                  whiteSpace: 'nowrap',
                }}
              >
                {mon.label}
              </div>
            ))}
            {/* Today line in header */}
            <div style={{ position: 'absolute', left: todayLeft, top: 0, width: 1, background: '#E24B4A', height: HDR_H, zIndex: 2 }} />
          </div>

          {/* Bar rows container */}
          <div style={{ position: 'relative', width: totalWidth, height: visibleTasks.length * ROW_H }}>
            {/* Today line through all rows */}
            <div style={{ position: 'absolute', left: todayLeft, top: 0, bottom: 0, width: 1, background: 'rgba(226,75,74,.25)', zIndex: 1, pointerEvents: 'none' }} />

            {/* Bars per visible row */}
            {!loading && visibleTasks.map((task, rowIdx) => {
              const left = barLeft(task);
              const width = barWidth(task);
              const barH = task.level <= 1 ? 12 : 8;
              const barTop = Math.round((ROW_H - barH) / 2);
              const actualW = Math.max(2, Math.round((task.actualProgress / 100) * width));
              const color = barColor(task.actualProgress, task.plannedProgress);
              const opacity = task.level <= 1 ? 0.9 : 0.7;
              const top = rowIdx * ROW_H;
              const bg = rowBg(task.level);

              return (
                <div
                  key={task.id}
                  style={{
                    position: 'absolute',
                    top,
                    left: 0,
                    width: totalWidth,
                    height: ROW_H,
                    background: bg,
                    borderBottom: '0.5px solid var(--bd)',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--bg2)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = bg; }}
                >
                  {/* Planned bar */}
                  <div
                    style={{
                      position: 'absolute',
                      left,
                      width,
                      height: barH,
                      top: barTop,
                      background: 'rgba(55,138,221,.2)',
                      borderRadius: 3,
                    }}
                  />
                  {/* Actual bar (overlaid on planned) */}
                  <div
                    style={{
                      position: 'absolute',
                      left,
                      width: actualW,
                      height: barH,
                      top: barTop,
                      background: color,
                      borderRadius: 3,
                      opacity,
                    }}
                  />
                  {/* % label to the right of actual bar */}
                  {task.level <= 2 && actualW > 20 && (
                    <span style={{
                      position: 'absolute',
                      left: left + actualW + 3,
                      top: barTop - 1,
                      fontSize: 9,
                      color,
                      whiteSpace: 'nowrap',
                    }}>
                      {task.actualProgress}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
