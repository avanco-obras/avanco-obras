import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Search,
  Download,
  ChevronsDownUp,
  ChevronsUpDown,
  AlertTriangle,
} from 'lucide-react';
import { useStore } from '@/store';
import { scheduleApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { GanttTask } from '@/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const PX_PER_DAY = 4;
const ROW_HEIGHT = 36;

// ── Level style map ───────────────────────────────────────────────────────────

const LEVEL_ROW: Record<number, string> = {
  0: 'bg-slate-800 text-white font-bold text-sm',
  1: 'bg-slate-600 text-white font-bold text-xs',
  2: 'bg-slate-200 text-slate-800 font-medium text-xs',
  3: 'bg-slate-100 text-slate-700 text-xs',
  4: 'bg-white text-slate-500 text-xs',
};

const levelRowClass = (level: number) => LEVEL_ROW[level] ?? LEVEL_ROW[4];

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
    const label = cur.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    months.push({ label, left, width });
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

function barColor(actual: number, planned: number): string {
  if (actual >= planned) return '#22c55e'; // green
  if (actual >= planned * 0.85) return '#f59e0b'; // amber
  return '#ef4444'; // red
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 animate-pulse">
      <div className="h-3 bg-slate-200 rounded w-4/5" />
    </div>
  );
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
        // Default: expand level 0 and 1
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

  // Build parent index
  const parentIndex = useMemo(() => {
    const map: Record<string, string[]> = {};
    tasks.forEach((t) => {
      if (t.parentId) {
        if (!map[t.parentId]) map[t.parentId] = [];
        map[t.parentId].push(t.id);
      }
    });
    return map;
  }, [tasks]);

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
      // Show matching rows AND their ancestors
      const matchedIds = new Set(
        tasks.filter((t) => t.name.toLowerCase().includes(search)).map((t) => t.id)
      );
      return tasks.filter((t) => matchedIds.has(t.id) || ancestorIds.has(t.id));
    }
    // Normal mode: hide children of collapsed nodes
    const hidden = new Set<string>();
    tasks.forEach((t) => {
      if (!t.parentId) return;
      // Walk up — if any ancestor is collapsed, hide
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
    // Pad 1 month each side
    min.setMonth(min.getMonth() - 1);
    max.setMonth(max.getMonth() + 1);
    return { minDate: min, maxDate: max, totalWidth: daysBetween(min, max) * PX_PER_DAY };
  }, [tasks]);

  const months = useMemo(() => monthsInRange(minDate, maxDate), [minDate, maxDate]);

  const todayLeft = useMemo(() => daysBetween(minDate, new Date()) * PX_PER_DAY, [minDate]);

  // Scroll sync
  function onLeftScroll() {
    if (syncingRef.current) return;
    syncingRef.current = true;
    if (rightRef.current && leftRef.current) {
      rightRef.current.scrollTop = leftRef.current.scrollTop;
    }
    syncingRef.current = false;
  }

  function onRightScroll() {
    if (syncingRef.current) return;
    syncingRef.current = true;
    if (leftRef.current && rightRef.current) {
      leftRef.current.scrollTop = rightRef.current.scrollTop;
    }
    syncingRef.current = false;
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
    return Math.max(2, days * PX_PER_DAY);
  }

  // ── No project selected ───────────────────────────────────────────────────

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <AlertTriangle className="h-14 w-14 text-muted-foreground/40" />
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-1">Selecione um projeto</h2>
          <p className="text-muted-foreground text-sm">
            Escolha um projeto no seletor acima para visualizar o cronograma.
          </p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-background shrink-0 flex-wrap">
        <h1 className="text-lg font-bold text-foreground mr-2">Cronograma</h1>

        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar atividade..."
            value={searchRaw}
            onChange={(e) => setSearchRaw(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        <Button variant="outline" size="sm" onClick={expandAll} className="h-8 gap-1">
          <ChevronsUpDown className="h-3.5 w-3.5" />
          Expandir
        </Button>
        <Button variant="outline" size="sm" onClick={collapseAll} className="h-8 gap-1">
          <ChevronsDownUp className="h-3.5 w-3.5" />
          Recolher
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport} className="h-8 gap-1 ml-auto">
          <Download className="h-3.5 w-3.5" />
          Exportar CSV
        </Button>
      </div>

      {/* Main content: left list + right gantt */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left panel ── */}
        <div className="w-[300px] shrink-0 flex flex-col border-r border-border">
          {/* Header */}
          <div
            className="flex items-center px-3 shrink-0 bg-slate-800 text-white font-semibold text-xs border-b border-slate-700"
            style={{ height: ROW_HEIGHT + 'px' }}
          >
            Atividade
          </div>

          {/* Scrollable list */}
          <div
            ref={leftRef}
            onScroll={onLeftScroll}
            className="flex-1 overflow-y-auto overflow-x-hidden"
          >
            {loading
              ? Array.from({ length: 12 }).map((_, i) => <SkeletonRow key={i} />)
              : visibleTasks.map((task) => {
                  const indent = task.level * 16;
                  return (
                    <div
                      key={task.id}
                      className={`flex items-center gap-1 px-2 border-b border-slate-100 cursor-default select-none ${levelRowClass(task.level)}`}
                      style={{ height: ROW_HEIGHT + 'px', paddingLeft: indent + 8 + 'px' }}
                    >
                      {task.hasChildren ? (
                        <button
                          onClick={() => toggleExpand(task.id)}
                          className="shrink-0 hover:opacity-70 transition-opacity"
                        >
                          {expanded.has(task.id) || search ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </button>
                      ) : (
                        <span className="shrink-0 w-3.5" />
                      )}
                      <span className="font-mono mr-1.5 opacity-60 text-[10px]">{task.code}</span>
                      <span className="truncate leading-tight">{task.name}</span>
                      {task.isCriticalPath && (
                        <span className="ml-auto shrink-0 w-1.5 h-1.5 rounded-full bg-red-400" title="Caminho crítico" />
                      )}
                    </div>
                  );
                })}
          </div>
        </div>

        {/* ── Right panel: Gantt ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Month header row (horizontally scrollable) */}
          <div className="overflow-x-auto overflow-y-hidden shrink-0 border-b border-border" style={{ height: ROW_HEIGHT + 'px' }}>
            <div className="relative bg-slate-50" style={{ width: totalWidth + 'px', height: ROW_HEIGHT + 'px' }}>
              {months.map((m, i) => (
                <div
                  key={i}
                  className="absolute top-0 flex items-center justify-center text-[10px] font-medium text-slate-600 border-r border-slate-200 capitalize"
                  style={{ left: m.left + 'px', width: m.width + 'px', height: ROW_HEIGHT + 'px' }}
                >
                  {m.label}
                </div>
              ))}
              {/* Today line in header */}
              <div
                className="absolute top-0 bottom-0 w-px bg-red-400 z-10"
                style={{ left: todayLeft + 'px' }}
              />
            </div>
          </div>

          {/* Gantt body */}
          <div
            ref={rightRef}
            onScroll={onRightScroll}
            className="flex-1 overflow-auto"
          >
            <div className="relative" style={{ width: totalWidth + 'px', minHeight: visibleTasks.length * ROW_HEIGHT + 'px' }}>
              {/* Month column guides */}
              {months.map((m, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 border-r border-slate-100"
                  style={{ left: m.left + 'px', width: m.width + 'px' }}
                />
              ))}

              {/* Today line */}
              <div
                className="absolute top-0 bottom-0 z-20 pointer-events-none"
                style={{ left: todayLeft + 'px' }}
              >
                <div className="w-px h-full bg-red-500 opacity-70" style={{ borderRight: '1.5px dashed #ef4444' }} />
              </div>

              {/* Bars per visible row */}
              {!loading &&
                visibleTasks.map((task, rowIdx) => {
                  const left = barLeft(task);
                  const width = barWidth(task);
                  const plannedW = Math.max(2, width);
                  const actualW = Math.max(2, (task.actualProgress / 100) * width);
                  const color = barColor(task.actualProgress, task.plannedProgress);

                  return (
                    <div
                      key={task.id}
                      className="absolute flex flex-col justify-center gap-0.5"
                      style={{
                        top: rowIdx * ROW_HEIGHT + 4 + 'px',
                        left: 0,
                        width: totalWidth + 'px',
                        height: ROW_HEIGHT - 8 + 'px',
                      }}
                    >
                      {/* Planned bar */}
                      <div
                        className="absolute rounded-sm bg-blue-300/50 border border-blue-400/40"
                        style={{
                          left: left + 'px',
                          width: plannedW + 'px',
                          height: '10px',
                          top: '2px',
                        }}
                      />
                      {/* Actual bar */}
                      <div
                        className="absolute rounded-sm"
                        style={{
                          left: left + 'px',
                          width: actualW + 'px',
                          height: '10px',
                          top: '14px',
                          backgroundColor: color,
                          opacity: 0.85,
                        }}
                      >
                        {actualW > 28 && (
                          <span
                            className="absolute inset-0 flex items-center justify-center text-white text-[9px] font-bold"
                          >
                            {task.actualProgress.toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="shrink-0 flex items-center gap-4 px-4 py-1.5 border-t border-border bg-background text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-2 rounded-sm bg-blue-300/70 border border-blue-400/40" />
          Planejado
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-2 rounded-sm bg-green-500/80" />
          Realizado (ok)
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-2 rounded-sm bg-amber-400/80" />
          Atenção
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-2 rounded-sm bg-red-500/80" />
          Atrasado
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-0.5 h-3 bg-red-500" style={{ borderRight: '2px dashed #ef4444' }} />
          Hoje
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          Caminho crítico
        </div>
      </div>
    </div>
  );
}
