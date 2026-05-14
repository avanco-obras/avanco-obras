import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useStore } from '@/store';
import { scheduleApi } from '@/services/api';
import * as xlsx from 'xlsx';
import type { GanttTask, ScheduleDependencyItem } from '@/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const PX_PER_DAY = 4;
const ROW_H = 28;
const HDR_H = 30;
const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// ── Column definitions ────────────────────────────────────────────────────────
interface ColDef {
  key: string;
  label: string;
  width: number;
  fixed: boolean;
}
const COL_DEFS: ColDef[] = [
  { key: 'code', label: 'Código WBS', width: 80, fixed: false },
  { key: 'name', label: 'Atividade', width: 220, fixed: true },
  { key: 'duration', label: 'Duração', width: 72, fixed: false },
  { key: 'startDate', label: 'Início', width: 86, fixed: false },
  { key: 'endDate', label: 'Término', width: 86, fixed: false },
  { key: 'progress', label: '% Real', width: 62, fixed: false },
  { key: 'predecessors', label: 'Predecessora', width: 90, fixed: false },
  { key: 'successors', label: 'Sucessora', width: 90, fixed: false },
  { key: 'critical', label: 'C. Crítico', width: 72, fixed: false },
];

// ── Mock data ─────────────────────────────────────────────────────────────────

function buildMockTasks(): GanttTask[] {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = (om: number, od = 0) => new Date(y, m + om, 1 + od).toISOString().split('T')[0];
  return [
    { id: '1', code: '1', name: 'OBRA', level: 0, startDate: d(-1), endDate: d(11), plannedProgress: 35, actualProgress: 30, isCriticalPath: false, hasChildren: true, durationDays: 365, weight: 1 },
    { id: '2', code: '1.1', name: 'ESTRUTURA', level: 1, parentId: '1', startDate: d(-1), endDate: d(5), plannedProgress: 60, actualProgress: 50, isCriticalPath: true, hasChildren: true, durationDays: 180, weight: 0.4 },
    { id: '3', code: '1.1.1', name: 'Fundação', level: 2, parentId: '2', startDate: d(-1), endDate: d(1), plannedProgress: 100, actualProgress: 100, isCriticalPath: true, hasChildren: true, durationDays: 60, weight: 0.15 },
    { id: '4', code: '1.1.1.1', name: 'Estacas', level: 3, parentId: '3', startDate: d(-1), endDate: d(0, 15), plannedProgress: 100, actualProgress: 100, isCriticalPath: true, hasChildren: false, durationDays: 45, weight: 0.08 },
    { id: '5', code: '1.1.1.2', name: 'Blocos', level: 3, parentId: '3', startDate: d(0, 10), endDate: d(1), plannedProgress: 100, actualProgress: 95, isCriticalPath: true, hasChildren: true, durationDays: 20, weight: 0.07 },
    { id: '6', code: '1.1.1.2.1', name: 'Bloco tipo A', level: 4, parentId: '5', startDate: d(0, 10), endDate: d(0, 20), plannedProgress: 100, actualProgress: 100, isCriticalPath: false, hasChildren: false, durationDays: 10, weight: 0.03 },
    { id: '7', code: '1.1.2', name: 'Pilares e Lajes', level: 2, parentId: '2', startDate: d(1), endDate: d(5), plannedProgress: 40, actualProgress: 25, isCriticalPath: true, hasChildren: false, durationDays: 120, weight: 0.25 },
    { id: '8', code: '1.2', name: 'ALVENARIA', level: 1, parentId: '1', startDate: d(3), endDate: d(7), plannedProgress: 10, actualProgress: 5, isCriticalPath: false, hasChildren: true, durationDays: 120, weight: 0.3 },
    { id: '9', code: '1.2.1', name: 'Vedação interna', level: 2, parentId: '8', startDate: d(3), endDate: d(6), plannedProgress: 15, actualProgress: 8, isCriticalPath: false, hasChildren: false, durationDays: 90, weight: 0.15 },
    { id: '10', code: '1.2.2', name: 'Vedação externa', level: 2, parentId: '8', startDate: d(5), endDate: d(7), plannedProgress: 0, actualProgress: 0, isCriticalPath: false, hasChildren: false, durationDays: 60, weight: 0.15 },
    { id: '11', code: '1.3', name: 'ACABAMENTO', level: 1, parentId: '1', startDate: d(7), endDate: d(11), plannedProgress: 0, actualProgress: 0, isCriticalPath: false, hasChildren: true, durationDays: 120, weight: 0.3 },
    { id: '12', code: '1.3.1', name: 'Revestimento', level: 2, parentId: '11', startDate: d(7), endDate: d(10), plannedProgress: 0, actualProgress: 0, isCriticalPath: false, hasChildren: false, durationDays: 90, weight: 0.15 },
    { id: '13', code: '1.3.2', name: 'Pintura', level: 2, parentId: '11', startDate: d(9), endDate: d(11), plannedProgress: 0, actualProgress: 0, isCriticalPath: false, hasChildren: false, durationDays: 60, weight: 0.15 },
  ];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function compareWbs(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function fmtDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;
}

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function parseDate(s: string) {
  return new Date(s.slice(0, 10) + 'T00:00:00');
}

function addDays(date: Date, days: number): string {
  return new Date(date.getTime() + days * 86_400_000).toISOString().split('T')[0];
}

function monthsInRange(minDate: Date, maxDate: Date, pxPerDay: number): { label: string; left: number; width: number }[] {
  const months: { label: string; left: number; width: number }[] = [];
  const cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  while (cur <= maxDate) {
    const start = cur < minDate ? minDate : new Date(cur);
    const endOfMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    const end = endOfMonth > maxDate ? maxDate : endOfMonth;
    const left = daysBetween(minDate, start) * pxPerDay;
    const width = (daysBetween(start, end) + 1) * pxPerDay;
    const mi = cur.getMonth();
    const label = mi === 0 ? `${cur.getFullYear()} ${MONTHS_PT[0]}` : MONTHS_PT[mi];
    months.push({ label, left, width });
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

function barColor(actual: number, planned: number): string {
  if (actual >= planned) return '#16803C';
  if (actual >= planned - 15) return '#C47D0F';
  return '#C9312F';
}

function badgeClass(actual: number, planned: number): string {
  if (actual >= planned) return 'ao-badge ao-bg';
  if (actual >= planned - 15) return 'ao-badge ao-ba';
  return 'ao-badge ao-br';
}

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

// ── FormState ─────────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  code: string;
  level: number;
  parentId: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  plannedProgress: number;
  actualProgress: number;
  weight: number;
  isCriticalPath: boolean;
}

function defaultForm(parent: GanttTask | null, all: GanttTask[]): FormState {
  const today = new Date().toISOString().split('T')[0];
  const in30 = addDays(new Date(), 30);
  if (parent) {
    const siblings = all.filter((t) => t.parentId === parent.id);
    return {
      name: '', code: `${parent.code}.${siblings.length + 1}`,
      level: parent.level + 1, parentId: parent.id,
      startDate: today, endDate: in30, durationDays: 30,
      plannedProgress: 0, actualProgress: 0, weight: 1, isCriticalPath: false,
    };
  }
  const roots = all.filter((t) => !t.parentId);
  return {
    name: '', code: String(roots.length + 1),
    level: 0, parentId: '',
    startDate: today, endDate: in30, durationDays: 30,
    plannedProgress: 0, actualProgress: 0, weight: 1, isCriticalPath: false,
  };
}

function formFromTask(task: GanttTask): FormState {
  const start = parseDate(task.startDate);
  const end = parseDate(task.endDate);
  return {
    name: task.name,
    code: task.code,
    level: task.level,
    parentId: task.parentId ?? '',
    startDate: task.startDate.slice(0, 10),
    endDate: task.endDate.slice(0, 10),
    durationDays: task.durationDays ?? Math.max(1, daysBetween(start, end)),
    plannedProgress: task.plannedProgress,
    actualProgress: task.actualProgress,
    weight: task.weight ?? 1,
    isCriticalPath: task.isCriticalPath,
  };
}

// ── Shared input style ────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  padding: '5px 8px', fontSize: 12,
  border: '0.5px solid var(--bd2)', borderRadius: 6,
  background: 'var(--bg1)', color: 'var(--t1)',
  width: '100%', boxSizing: 'border-box',
};

// ── TaskModal ─────────────────────────────────────────────────────────────────

interface TaskModalProps {
  open: boolean;
  editingTask: GanttTask | null;
  parentTask: GanttTask | null;
  allTasks: GanttTask[];
  projectId: string;
  addToast: (t: { type: string; title: string; description?: string }) => void;
  onClose: () => void;
  onSaved: () => void;
}

function TaskModal({ open, editingTask, parentTask, allTasks, projectId, addToast, onClose, onSaved }: TaskModalProps) {
  const [form, setForm] = useState<FormState>(() =>
    editingTask ? formFromTask(editingTask) : defaultForm(parentTask, allTasks)
  );
  const [saving, setSaving] = useState(false);
  const [deps, setDeps] = useState<ScheduleDependencyItem[]>([]);
  const [loadingDeps, setLoadingDeps] = useState(false);
  const [addingDep, setAddingDep] = useState(false);
  const [addDepRole, setAddDepRole] = useState<'predecessor' | 'successor'>('predecessor');
  const [depSearch, setDepSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm(editingTask ? formFromTask(editingTask) : defaultForm(parentTask, allTasks));
    setDeps([]);
    setAddingDep(false);
    setDepSearch('');
    if (editingTask) {
      setLoadingDeps(true);
      scheduleApi.getDependencies(editingTask.id)
        .then(setDeps)
        .catch(() => setDeps([]))
        .finally(() => setLoadingDeps(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function change<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'startDate' || key === 'endDate') {
        const s = parseDate((key === 'startDate' ? value : prev.startDate) as string);
        const e = parseDate((key === 'endDate' ? value : prev.endDate) as string);
        if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e > s) {
          next.durationDays = daysBetween(s, e);
        }
      } else if (key === 'durationDays' && (value as number) > 0) {
        const s = parseDate(prev.startDate);
        if (!isNaN(s.getTime())) next.endDate = addDays(s, value as number);
      }
      return next;
    });
  }

  async function handleSave() {
    if (!form.name.trim()) {
      addToast({ type: 'error', title: 'Nome obrigatório' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(), code: form.code.trim(),
        level: form.level, parentId: form.parentId || undefined,
        startDate: form.startDate, endDate: form.endDate,
        durationDays: form.durationDays,
        plannedProgress: form.plannedProgress, actualProgress: form.actualProgress,
        weight: form.weight, isCriticalPath: form.isCriticalPath,
      };
      if (editingTask) {
        await scheduleApi.update(editingTask.id, payload);
        addToast({ type: 'success', title: 'Salvo', description: `"${form.name}" atualizado.` });
      } else {
        await scheduleApi.create(projectId, payload);
        addToast({ type: 'success', title: 'Criado', description: `"${form.name}" adicionado.` });
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      addToast({ type: 'error', title: 'Erro ao salvar', description: msg ?? 'Tente novamente.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleAddDep(targetId: string) {
    if (!editingTask) return;
    try {
      let dep: ScheduleDependencyItem;
      if (addDepRole === 'predecessor') {
        dep = await scheduleApi.addDependency(editingTask.id, { predecessorId: targetId });
      } else {
        dep = await scheduleApi.addDependency(targetId, { predecessorId: editingTask.id });
      }
      setDeps((prev) => [...prev, dep]);
      setAddingDep(false);
      setDepSearch('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      addToast({ type: 'error', title: 'Erro', description: msg ?? 'Não foi possível adicionar.' });
    }
  }

  async function handleRemoveDep(depId: string) {
    try {
      await scheduleApi.removeDependency(depId);
      setDeps((prev) => prev.filter((d) => d.id !== depId));
    } catch {
      addToast({ type: 'error', title: 'Erro', description: 'Não foi possível remover dependência.' });
    }
  }

  const predecessors = deps.filter((d) => d.successorId === editingTask?.id);
  const successors = deps.filter((d) => d.predecessorId === editingTask?.id);

  const depCandidates = useMemo(() => {
    if (!addingDep) return [];
    const usedIds = new Set([
      ...deps.map((d) => d.predecessorId),
      ...deps.map((d) => d.successorId),
      editingTask?.id ?? '',
    ]);
    const q = depSearch.toLowerCase();
    return allTasks
      .filter((t) => !usedIds.has(t.id) && (!q || t.name.toLowerCase().includes(q) || t.code.includes(q)))
      .slice(0, 25);
  }, [addingDep, deps, depSearch, allTasks, editingTask]);

  if (!open) return null;

  const depRow = (dep: ScheduleDependencyItem, side: 'pred' | 'succ') => {
    const item = side === 'pred' ? dep.predecessor : dep.successor;
    return (
      <div key={dep.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 11 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--t3)', minWidth: 32, flexShrink: 0 }}>{item?.code}</span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--t1)' }}>{item?.name}</span>
        <span style={{ color: 'var(--t3)', fontSize: 9, background: 'var(--bg2)', padding: '1px 5px', borderRadius: 4, flexShrink: 0 }}>
          {dep.type}{dep.lagDays ? `+${dep.lagDays}d` : ''}
        </span>
        <button onClick={() => handleRemoveDep(dep.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', fontSize: 14, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}>×</button>
      </div>
    );
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: 'var(--bg1)', border: '0.5px solid var(--bd)', borderRadius: 14, padding: '1.25rem', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--t1)' }}>
            {editingTask ? 'Editar atividade' : parentTask ? `Nova atividade em "${parentTask.name}"` : 'Nova atividade'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t2)', fontSize: 18, lineHeight: 1, padding: '0 2px' }}>✕</button>
        </div>

        {/* Form grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 11, color: 'var(--t2)', display: 'block', marginBottom: 3 }}>Nome *</label>
            <input style={inp} value={form.name} onChange={(e) => change('name', e.target.value)} placeholder="Nome da atividade" autoFocus />
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--t2)', display: 'block', marginBottom: 3 }}>Código WBS</label>
            <input style={inp} value={form.code} onChange={(e) => change('code', e.target.value)} placeholder="Ex: 1.2.3" />
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--t2)', display: 'block', marginBottom: 3 }}>Nível hierárquico</label>
            <input style={inp} type="number" min={0} max={10} value={form.level} onChange={(e) => change('level', parseInt(e.target.value) || 0)} />
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--t2)', display: 'block', marginBottom: 3 }}>Data de início</label>
            <input style={inp} type="date" value={form.startDate} onChange={(e) => change('startDate', e.target.value)} />
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--t2)', display: 'block', marginBottom: 3 }}>Data de término</label>
            <input style={inp} type="date" value={form.endDate} onChange={(e) => change('endDate', e.target.value)} />
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--t2)', display: 'block', marginBottom: 3 }}>Duração (dias)</label>
            <input style={inp} type="number" min={1} value={form.durationDays} onChange={(e) => change('durationDays', parseInt(e.target.value) || 1)} />
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--t2)', display: 'block', marginBottom: 3 }}>Peso</label>
            <input style={inp} type="number" min={0} step={0.01} value={form.weight} onChange={(e) => change('weight', parseFloat(e.target.value) || 0)} />
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--t2)', display: 'block', marginBottom: 3 }}>Prog. Planejado (%)</label>
            <input style={inp} type="number" min={0} max={100} value={form.plannedProgress} onChange={(e) => change('plannedProgress', Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))} />
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--t2)', display: 'block', marginBottom: 3 }}>Prog. Realizado (%)</label>
            <input style={inp} type="number" min={0} max={100} value={form.actualProgress} onChange={(e) => change('actualProgress', Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))} />
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" id="cp-chk" checked={form.isCriticalPath} onChange={(e) => change('isCriticalPath', e.target.checked)} style={{ cursor: 'pointer', accentColor: '#C9312F' }} />
            <label htmlFor="cp-chk" style={{ fontSize: 12, color: 'var(--t1)', cursor: 'pointer' }}>Caminho crítico</label>
          </div>
        </div>

        {/* Dependencies — only when editing */}
        {editingTask && (
          <div style={{ borderTop: '0.5px solid var(--bd)', paddingTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', marginBottom: 10 }}>Dependências</div>

            {loadingDeps ? (
              <div style={{ fontSize: 11, color: 'var(--t2)', padding: '4px 0' }}>Carregando...</div>
            ) : (
              <>
                {/* Predecessoras */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--t2)', marginBottom: 4 }}>Predecessoras (devem terminar antes desta iniciar)</div>
                  {predecessors.length === 0
                    ? <div style={{ fontSize: 11, color: 'var(--t3)', fontStyle: 'italic' }}>Nenhuma</div>
                    : predecessors.map((d) => depRow(d, 'pred'))
                  }
                </div>

                {/* Sucessoras */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--t2)', marginBottom: 4 }}>Sucessoras (iniciam após esta terminar)</div>
                  {successors.length === 0
                    ? <div style={{ fontSize: 11, color: 'var(--t3)', fontStyle: 'italic' }}>Nenhuma</div>
                    : successors.map((d) => depRow(d, 'succ'))
                  }
                </div>

                {/* Add dependency panel */}
                {!addingDep ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="ao-btn ao-btn-sm" onClick={() => { setAddingDep(true); setAddDepRole('predecessor'); }}>+ Predecessora</button>
                    <button className="ao-btn ao-btn-sm" onClick={() => { setAddingDep(true); setAddDepRole('successor'); }}>+ Sucessora</button>
                  </div>
                ) : (
                  <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: 10, border: '0.5px solid var(--bd)' }}>
                    <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 6 }}>
                      Selecionar {addDepRole === 'predecessor' ? 'predecessora' : 'sucessora'}:
                    </div>
                    <input
                      style={{ ...inp, marginBottom: 6 }}
                      placeholder="Buscar por nome ou código..."
                      value={depSearch}
                      onChange={(e) => setDepSearch(e.target.value)}
                      autoFocus
                    />
                    <div style={{ maxHeight: 140, overflowY: 'auto', marginBottom: 6 }}>
                      {depCandidates.length === 0
                        ? <div style={{ fontSize: 11, color: 'var(--t3)', fontStyle: 'italic', padding: '4px 0' }}>Nenhuma atividade encontrada</div>
                        : depCandidates.map((t) => (
                          <div
                            key={t.id}
                            onClick={() => handleAddDep(t.id)}
                            style={{ cursor: 'pointer', padding: '4px 6px', borderRadius: 4, fontSize: 11, display: 'flex', gap: 6, alignItems: 'center' }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--bg3)'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = ''; }}
                          >
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--t3)', minWidth: 32, flexShrink: 0 }}>{t.code}</span>
                            <span style={{ color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                          </div>
                        ))
                      }
                    </div>
                    <button className="ao-btn ao-btn-sm" onClick={() => { setAddingDep(false); setDepSearch(''); }}>Cancelar</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '0.5px solid var(--bd)', paddingTop: 12 }}>
          <button className="ao-btn ao-btn-sm" onClick={onClose} disabled={saving}>Cancelar</button>
          <button
            className="ao-btn ao-btn-sm"
            style={{ background: '#2563EB', color: '#fff', border: 'none', opacity: saving || !form.name.trim() ? 0.6 : 1 }}
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
          >
            {saving ? 'Salvando...' : editingTask ? 'Atualizar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DeleteConfirm ─────────────────────────────────────────────────────────────

interface DeleteConfirmProps {
  task: GanttTask | null;
  allTasks: GanttTask[];
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirm({ task, allTasks, loading, onConfirm, onCancel }: DeleteConfirmProps) {
  if (!task) return null;

  const childCount = allTasks.filter((t) => {
    let pid = t.parentId;
    while (pid) {
      if (pid === task.id) return true;
      pid = allTasks.find((x) => x.id === pid)?.parentId;
    }
    return false;
  }).length;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1001, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'var(--bg1)', border: '0.5px solid var(--bd)', borderRadius: 12, padding: '1.25rem', width: '100%', maxWidth: 360 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--t1)', marginBottom: 8 }}>Excluir atividade</div>
        <p style={{ fontSize: 12, color: 'var(--t2)', marginBottom: childCount > 0 ? 6 : 16 }}>
          Tem certeza que deseja excluir <strong style={{ color: 'var(--t1)' }}>"{task.name}"</strong>?
        </p>
        {childCount > 0 && (
          <p style={{ fontSize: 12, color: '#C9312F', marginBottom: 16 }}>
            ⚠ {childCount} atividade{childCount > 1 ? 's filha' : ' filha'} também {childCount > 1 ? 'serão excluídas' : 'será excluída'}.
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="ao-btn ao-btn-sm" onClick={onCancel} disabled={loading}>Cancelar</button>
          <button
            className="ao-btn ao-btn-sm"
            style={{ background: '#C9312F', color: '#fff', border: 'none', opacity: loading ? 0.6 : 1 }}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Import Modal ──────────────────────────────────────────────────────────────

interface ImportModalProps {
  open: boolean;
  step: 1 | 2 | 3;
  file: File | null;
  preview: Record<string, unknown>[];
  importing: boolean;
  projectId: string;
  onClose: () => void;
  setStep: (s: 1 | 2 | 3) => void;
  setFile: (f: File | null) => void;
  setPreview: (p: Record<string, unknown>[]) => void;
  setImporting: (b: boolean) => void;
  addToast: (t: any) => void;
  onImportSuccess: () => void;
}

function ImportModal({ open, step, file, preview, importing, projectId, onClose, setStep, setFile, setPreview, setImporting, addToast, onImportSuccess }: ImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const generateTemplate = () => {
    const templateData = [
      ['Código', 'Nome', 'Nível', 'Início', 'Término', 'Duração', '% Plan', '% Real', 'Caminho Crítico', 'Peso'],
      ['1', 'OBRA - Projeto Exemplo', '0', '2026-01-15', '2027-01-15', '365', '0', '0', 'N', '1'],
      ['1.1', 'ESTRUTURA', '1', '2026-01-15', '2026-07-15', '180', '10', '5', 'Y', '0.4'],
      ['1.1.1', 'Fundação', '2', '2026-01-15', '2026-03-15', '60', '100', '100', 'Y', '0.2'],
      ['1.1.1.1', 'Estacas', '3', '2026-01-15', '2026-02-28', '45', '100', '100', 'Y', '0.1'],
      ['1.1.1.2', 'Blocos', '3', '2026-03-01', '2026-03-15', '15', '100', '90', 'Y', '0.1'],
      ['1.1.2', 'Pilares e Lajes', '2', '2026-03-16', '2026-07-15', '120', '5', '0', 'Y', '0.2'],
      ['1.2', 'ALVENARIA', '1', '2026-05-15', '2026-09-15', '120', '0', '0', 'N', '0.3'],
      ['1.2.1', 'Vedação interna', '2', '2026-05-15', '2026-08-15', '90', '0', '0', 'N', '0.15'],
      ['1.2.2', 'Vedação externa', '2', '2026-07-15', '2026-09-15', '60', '0', '0', 'N', '0.15'],
      ['1.3', 'ACABAMENTO', '1', '2026-09-16', '2027-01-15', '120', '0', '0', 'N', '0.3'],
      ['1.3.1', 'Revestimento', '2', '2026-09-16', '2026-12-15', '90', '0', '0', 'N', '0.15'],
      ['1.3.2', 'Pintura', '2', '2026-12-01', '2027-01-15', '45', '0', '0', 'N', '0.15'],
    ];

    const ws = xlsx.utils.aoa_to_sheet(templateData);
    ws['!cols'] = [
      { wch: 12 }, // Código
      { wch: 25 }, // Nome
      { wch: 8 },  // Nível
      { wch: 12 }, // Início
      { wch: 12 }, // Término
      { wch: 10 }, // Duração
      { wch: 8 },  // % Plan
      { wch: 8 },  // % Real
      { wch: 16 }, // Caminho Crítico
      { wch: 8 },  // Peso
    ];

    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Cronograma');
    xlsx.writeFile(wb, 'template-cronograma.xlsx');

    addToast({ type: 'success', title: 'Template baixado', description: 'Abra o arquivo e adapte aos seus dados.' });
  };

  const handleFileInput = (f: File | null) => {
    if (!f) return;
    if (!/\.(csv|xlsx|xls)$/i.test(f.name)) {
      addToast({ type: 'error', title: 'Arquivo inválido', description: 'Selecione um arquivo CSV, XLSX ou XLS.' });
      return;
    }
    setFile(f);
    handlePreview(f);
  };

  const handlePreview = (f: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = xlsx.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
        setPreview(rows.slice(0, 5));
      } catch (err) {
        addToast({ type: 'error', title: 'Erro ao ler arquivo', description: 'Não foi possível processar o arquivo.' });
      }
    };
    reader.readAsArrayBuffer(f);
  };

  const handleImport = async () => {
    if (!file || !projectId) return;
    setImporting(true);
    try {
      const result = await scheduleApi.import(projectId, file);
      addToast({
        type: result.imported > 0 ? 'success' : 'warning',
        title: `Importação completa`,
        description: `${result.imported} atividades importadas.${result.skipped > 0 ? ` ${result.skipped} linhas puladas.` : ''}`,
      });
      if (result.errors.length > 0) {
        console.log('Erros na importação:', result.errors);
      }
      onImportSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      addToast({
        type: 'error',
        title: 'Erro ao importar',
        description: msg ?? 'Tente novamente com outro arquivo.',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1002, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'var(--bg1)', border: '0.5px solid var(--bd)', borderRadius: 12, padding: '1.25rem', width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Step 1: File selection */}
        {step === 1 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--t1)' }}>Importar CSV/XLSX</span>
              <button
                onClick={generateTemplate}
                style={{
                  fontSize: 11,
                  padding: '5px 10px',
                  border: '0.5px solid #3B82F6',
                  borderRadius: 6,
                  background: 'transparent',
                  color: '#3B82F6',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                📥 Baixar template
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 16 }}>
              Selecione um arquivo CSV ou XLSX com o formato correto. Clique em "Baixar template" para um exemplo de estrutura. O cronograma existente será substituído.
            </p>

            {/* Colunas esperadas */}
            <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--bd)', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 11, color: 'var(--t2)' }}>
              <div style={{ fontWeight: 600, color: 'var(--t1)', marginBottom: 8 }}>Colunas esperadas:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
                <div><strong>Código</strong></div>
                <div>WBS: 1, 1.1, 1.1.1 (obrigatório)</div>

                <div><strong>Nome</strong></div>
                <div>Descrição da atividade (obrigatório)</div>

                <div><strong>Nível</strong></div>
                <div>0-9 (opcional, derivado do código)</div>

                <div><strong>Início</strong></div>
                <div>YYYY-MM-DD (obrigatório)</div>

                <div><strong>Término</strong></div>
                <div>YYYY-MM-DD (obrigatório)</div>

                <div><strong>Duração</strong></div>
                <div>Dias (opcional, calculado se omitido)</div>

                <div><strong>% Plan</strong></div>
                <div>0-100 (opcional)</div>

                <div><strong>% Real</strong></div>
                <div>0-100 (opcional)</div>

                <div><strong>Caminho Crítico</strong></div>
                <div>Y/N (opcional)</div>

                <div><strong>Peso</strong></div>
                <div>Número (opcional, padrão 1)</div>
              </div>
            </div>

            <div
              style={{
                border: '2px dashed var(--bd)',
                borderRadius: 8,
                padding: '2rem',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'var(--bg2)',
                marginBottom: 12,
                transition: 'all 0.2s',
              }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.style.background = 'var(--bg3)';
                e.currentTarget.style.borderColor = '#2563EB';
              }}
              onDragLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg2)';
                e.currentTarget.style.borderColor = 'var(--bd)';
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.style.background = 'var(--bg2)';
                e.currentTarget.style.borderColor = 'var(--bd)';
                const f = e.dataTransfer.files[0];
                handleFileInput(f);
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)', marginBottom: 6 }}>
                {file ? `📁 ${file.name}` : '📤 Arraste um arquivo aqui'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--t3)' }}>
                ou clique para selecionar
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              style={{ display: 'none' }}
              onChange={(e) => handleFileInput(e.target.files?.[0] ?? null)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="ao-btn ao-btn-sm" onClick={onClose}>Cancelar</button>
              <button
                className="ao-btn ao-btn-sm"
                style={{ background: '#2563EB', color: '#fff', border: 'none', opacity: !file || preview.length === 0 ? 0.5 : 1 }}
                disabled={!file || preview.length === 0}
                onClick={() => setStep(2)}
              >
                {preview.length > 0 ? 'Avançar →' : 'Carregando...'}
              </button>
            </div>
          </>
        )}

        {/* Step 2: Preview */}
        {step === 2 && (
          <>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--t1)', marginBottom: 12 }}>Pré-visualização</div>
            <p style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 12 }}>
              {file?.name} — {preview.length > 0 ? `Primeiras ${preview.length} linhas` : 'Nenhuma linha'}
            </p>
            {preview.length > 0 ? (
              <div style={{ overflowX: 'auto', marginBottom: 16, border: '0.5px solid var(--bd)', borderRadius: 6, background: 'var(--bg2)' }}>
                <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {Object.keys(preview[0]).map((key) => (
                        <th key={key} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 500, color: 'var(--t2)', borderRight: '0.5px solid var(--bd)' }}>
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, idx) => (
                      <tr key={idx} style={{ borderTop: '0.5px solid var(--bd)' }}>
                        {Object.values(row).map((val, colIdx) => (
                          <td key={colIdx} style={{ padding: '6px 8px', color: 'var(--t1)', borderRight: '0.5px solid var(--bd)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="ao-btn ao-btn-sm" onClick={onClose}>Cancelar</button>
              <button className="ao-btn ao-btn-sm" onClick={() => setStep(1)}>← Voltar</button>
              <button
                className="ao-btn ao-btn-sm"
                style={{ background: '#2563EB', color: '#fff', border: 'none' }}
                onClick={() => setStep(3)}
              >
                Avançar →
              </button>
            </div>
          </>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && (
          <>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--t1)', marginBottom: 12 }}>Confirmar importação</div>
            <div style={{ padding: '12px', background: '#FEF3C7', border: '0.5px solid #F59E0B', borderRadius: 6, marginBottom: 16 }}>
              <p style={{ fontSize: 12, color: '#92400E', margin: 0 }}>
                ⚠ <strong>Atenção:</strong> Isso substituirá <strong>todas as atividades</strong> do cronograma atual. Esta ação não pode ser desfeita.
              </p>
            </div>
            <p style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 16 }}>
              {file?.name}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="ao-btn ao-btn-sm" onClick={onClose} disabled={importing}>Cancelar</button>
              <button className="ao-btn ao-btn-sm" onClick={() => setStep(2)} disabled={importing}>← Voltar</button>
              <button
                className="ao-btn ao-btn-sm"
                style={{ background: '#C9312F', color: '#fff', border: 'none', opacity: importing ? 0.6 : 1 }}
                onClick={handleImport}
                disabled={importing}
              >
                {importing ? 'Importando...' : 'Importar cronograma'}
              </button>
            </div>
          </>
        )}
      </div>
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
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<GanttTask | null>(null);
  const [parentTask, setParentTask] = useState<GanttTask | null>(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<GanttTask | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Import modal state
  const [showImport, setShowImport] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2 | 3>(1);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<Record<string, unknown>[]>([]);
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  // Column visibility state
  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set(COL_DEFS.map(c => c.key));
    const saved = localStorage.getItem('cronograma_cols');
    return saved ? new Set(JSON.parse(saved)) : new Set(COL_DEFS.map(c => c.key));
  });
  const [showColPicker, setShowColPicker] = useState(false);

  // Column widths state
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') return {};
    const saved = localStorage.getItem('cronograma_col_widths');
    return saved ? JSON.parse(saved) : {};
  });

  // Zoom state
  type ZoomLevel = 'year' | 'semester' | 'month' | 'week' | 'day';
  const PX_PER_DAY_MAP: Record<ZoomLevel, number> = {
    year: 0.3,
    semester: 0.6,
    month: 4,
    week: 14,
    day: 40,
  };
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('month');
  const pxPerDay = PX_PER_DAY_MAP[zoomLevel];

  // Splitter state
  const [splitterWidth, setSplitterWidth] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    const saved = localStorage.getItem('cronograma_splitter');
    return saved ? Number(saved) : null;
  });

  // Calculate visible column widths early
  const visibleColDefs = useMemo(() => COL_DEFS.filter(c => visibleCols.has(c.key)), [visibleCols]);
  const effectiveWidth = (col: ColDef) => colWidths[col.key] ?? col.width;
  const leftPanelWidth = useMemo(() => visibleColDefs.reduce((sum, c) => sum + effectiveWidth(c), 0), [visibleColDefs, colWidths]);
  const finalLeftWidth = splitterWidth ?? leftPanelWidth;

  // Scroll refs
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const hdrRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);
  const dragRef = useRef<{ colKey: string; startX: number; startWidth: number } | null>(null);
  const splitterDragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchRaw.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [searchRaw]);

  const loadData = useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    scheduleApi.ganttData(projectId)
      .then((data) => {
        const sorted = [...data].sort((a, b) => compareWbs(a.code, b.code));
        setTasks(sorted);
        const ids = sorted.filter((t) => t.hasChildren && t.level <= 1).map((t) => t.id);
        setExpanded(new Set(ids));
      })
      .catch(() => {
        const mock = buildMockTasks().sort((a, b) => compareWbs(a.code, b.code));
        setTasks(mock);
        const ids = mock.filter((t) => t.hasChildren && t.level <= 1).map((t) => t.id);
        setExpanded(new Set(ids));
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    if (projectId) loadData();
    else {
      const mock = buildMockTasks().sort((a, b) => compareWbs(a.code, b.code));
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
      while (pid) { ancestors.add(pid); pid = idToParent[pid]; }
    });
    return ancestors;
  }, [search, tasks]);

  // Visible tasks
  const visibleTasks = useMemo(() => {
    if (search) {
      const matchedIds = new Set(tasks.filter((t) => t.name.toLowerCase().includes(search)).map((t) => t.id));
      return tasks.filter((t) => matchedIds.has(t.id) || ancestorIds.has(t.id));
    }
    const hidden = new Set<string>();
    tasks.forEach((t) => {
      if (!t.parentId) return;
      let pid: string | undefined = t.parentId;
      while (pid) {
        const parent = tasks.find((x) => x.id === pid);
        if (!parent) break;
        if (parent.hasChildren && !expanded.has(parent.id)) { hidden.add(t.id); break; }
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
      return { minDate: min, maxDate: max, totalWidth: daysBetween(min, max) * pxPerDay };
    }
    const dates = tasks.flatMap((t) => [parseDate(t.startDate), parseDate(t.endDate)]);
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    min.setMonth(min.getMonth() - 1);
    max.setMonth(max.getMonth() + 1);
    return { minDate: min, maxDate: max, totalWidth: daysBetween(min, max) * pxPerDay };
  }, [tasks, pxPerDay]);

  const months = useMemo(() => monthsInRange(minDate, maxDate, pxPerDay), [minDate, maxDate, pxPerDay]);
  const todayLeft = useMemo(() => daysBetween(minDate, new Date()) * pxPerDay, [minDate, pxPerDay]);

  // Scroll sync
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
    if (hdrRef.current && rightRef.current) hdrRef.current.scrollLeft = rightRef.current.scrollLeft;
    syncingRef.current = false;
  }

  function onGanttWheel(e: React.WheelEvent) {
    e.preventDefault();
    const levels: ZoomLevel[] = ['year', 'semester', 'month', 'week', 'day'];
    setZoomLevel(prev => {
      const idx = levels.indexOf(prev);
      if (e.deltaY < 0) return levels[Math.min(idx + 1, levels.length - 1)];
      return levels[Math.max(idx - 1, 0)];
    });
  }

  function startSplitterResize(e: React.MouseEvent) {
    e.preventDefault();
    splitterDragRef.current = { startX: e.clientX, startWidth: finalLeftWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onSplitterResizeMove);
    document.addEventListener('mouseup', onSplitterResizeEnd);
  }

  function onSplitterResizeMove(e: MouseEvent) {
    if (!splitterDragRef.current) return;
    const delta = e.clientX - splitterDragRef.current.startX;
    const newWidth = Math.max(100, splitterDragRef.current.startWidth + delta);
    setSplitterWidth(newWidth);
  }

  function onSplitterResizeEnd() {
    if (!splitterDragRef.current) return;
    setSplitterWidth(prev => {
      localStorage.setItem('cronograma_splitter', String(prev ?? finalLeftWidth));
      return prev;
    });
    splitterDragRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', onSplitterResizeMove);
    document.removeEventListener('mouseup', onSplitterResizeEnd);
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function expandAll() { setExpanded(new Set(tasks.filter((t) => t.hasChildren).map((t) => t.id))); }
  function collapseAll() { setExpanded(new Set()); }

  function handleExport() {
    if (tasks.length === 0) return;
    const header = 'Código,Nome,Nível,Início,Fim,Duração (dias),Prog. Plan (%),Prog. Real (%),Caminho Crítico';
    const rows = tasks.map((t) =>
      `"${t.code}","${t.name}",${t.level},"${t.startDate.slice(0, 10)}","${t.endDate.slice(0, 10)}",${t.durationDays ?? ''},${t.plannedProgress},${t.actualProgress},${t.isCriticalPath ? 'Sim' : 'Não'}`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'cronograma.csv'; a.click();
    URL.revokeObjectURL(url);
    addToast({ type: 'success', title: 'Exportado', description: 'CSV gerado com sucesso.' });
  }

  // Column resize handlers
  function startResize(e: React.MouseEvent, colKey: string) {
    e.preventDefault();
    const currentWidth = effectiveWidth(COL_DEFS.find(c => c.key === colKey)!);
    dragRef.current = { colKey, startX: e.clientX, startWidth: currentWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onResizeMove);
    document.addEventListener('mouseup', onResizeEnd);
  }

  function onResizeMove(e: MouseEvent) {
    if (!dragRef.current) return;
    const delta = e.clientX - dragRef.current.startX;
    const newWidth = Math.max(40, dragRef.current.startWidth + delta);
    setColWidths(prev => ({ ...prev, [dragRef.current!.colKey]: newWidth }));
  }

  function onResizeEnd() {
    if (!dragRef.current) return;
    setColWidths(prev => {
      localStorage.setItem('cronograma_col_widths', JSON.stringify(prev));
      return prev;
    });
    dragRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', onResizeEnd);
  }

  // Column toggle handler
  function toggleCol(key: string) {
    const col = COL_DEFS.find(c => c.key === key);
    if (col?.fixed) return;
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      localStorage.setItem('cronograma_cols', JSON.stringify(Array.from(next)));
      return next;
    });
  }

  // Modal handlers
  function openNew() { setEditingTask(null); setParentTask(null); setModalOpen(true); }
  function openNewChild(task: GanttTask, e: React.MouseEvent) { e.stopPropagation(); setEditingTask(null); setParentTask(task); setModalOpen(true); }
  function openEdit(task: GanttTask, e: React.MouseEvent) { e.stopPropagation(); setEditingTask(task); setParentTask(null); setModalOpen(true); }
  function openDelete(task: GanttTask, e: React.MouseEvent) { e.stopPropagation(); setDeleteTarget(task); }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await scheduleApi.delete(deleteTarget.id);
      addToast({ type: 'success', title: 'Excluído', description: `"${deleteTarget.name}" removido.` });
      setDeleteTarget(null);
      loadData();
    } catch {
      addToast({ type: 'error', title: 'Erro', description: 'Não foi possível excluir.' });
    } finally {
      setDeleting(false);
    }
  }

  function barLeft(task: GanttTask) { return daysBetween(minDate, parseDate(task.startDate)) * pxPerDay; }
  function barWidth(task: GanttTask) { return Math.max(4, daysBetween(parseDate(task.startDate), parseDate(task.endDate)) * pxPerDay); }

  // ── No project selected ──────────────────────────────────────────────────────

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

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="ao-card" style={{ padding: '0.75rem 1rem', marginBottom: 0 }}>

        {/* Toolbar */}
        <div className="ao-card-hdr" style={{ marginBottom: 8 }}>
          <span className="ao-card-title">EAP — Cronograma completo</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              placeholder="Buscar atividade..."
              value={searchRaw}
              onChange={(e) => setSearchRaw(e.target.value)}
              style={{ padding: '5px 9px', fontSize: 11, border: '0.5px solid var(--bd2)', borderRadius: 8, background: 'var(--bg1)', color: 'var(--t1)', width: 160 }}
            />
            <button className="ao-btn ao-btn-sm" onClick={expandAll}>Expandir</button>
            <button className="ao-btn ao-btn-sm" onClick={collapseAll}>Recolher</button>
            <div style={{ position: 'relative' }}>
              <button className="ao-btn ao-btn-sm" onClick={() => setShowColPicker(!showColPicker)}>⚙ Colunas</button>
              {showColPicker && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--bg1)', border: '0.5px solid var(--bd)', borderRadius: 8, padding: 8, zIndex: 100, minWidth: 180, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                  {COL_DEFS.map(col => (
                    <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: col.fixed ? 'not-allowed' : 'pointer', fontSize: 12, opacity: col.fixed ? 0.6 : 1 }}>
                      <input
                        type="checkbox"
                        checked={visibleCols.has(col.key)}
                        disabled={col.fixed}
                        onChange={() => toggleCol(col.key)}
                        style={{ cursor: col.fixed ? 'not-allowed' : 'pointer' }}
                      />
                      <span>{col.label}</span>
                      {col.fixed && <span style={{ fontSize: 9, color: 'var(--t3)', marginLeft: 'auto' }}>obrigatória</span>}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <button className="ao-btn ao-btn-sm" onClick={handleExport}>CSV</button>
            <button className="ao-btn ao-btn-sm" onClick={() => { setImportStep(1); setImportFile(null); setImportPreview([]); setImportErrors([]); setShowImport(true); }}>↑ Importar</button>
            <button
              className="ao-btn ao-btn-sm"
              style={{ background: '#2563EB', color: '#fff', border: 'none' }}
              onClick={openNew}
            >
              + Nova atividade
            </button>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--t2)', marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 5, background: 'rgba(55,138,221,.3)', borderRadius: 2, display: 'inline-block' }} />Planejado
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 5, background: '#3B6D11', borderRadius: 2, display: 'inline-block' }} />No prazo
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 5, background: '#C47D0F', borderRadius: 2, display: 'inline-block' }} />Leve atraso
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 5, background: '#E24B4A', borderRadius: 2, display: 'inline-block' }} />Crítico
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 1, height: 12, background: '#E24B4A', display: 'inline-block' }} />Hoje
          </span>
          <span style={{ color: 'var(--t3)', fontStyle: 'italic' }}>· Clique em uma linha para editar · Passe o mouse para ver ações</span>
        </div>

        {/* Gantt wrap */}
        <div style={{ display: 'flex', border: '0.5px solid var(--bd)', borderRadius: 12, overflow: 'hidden', height: 'calc(100vh - 180px)' }}>

          {/* ── Left panel: Multi-column ── */}
          <div style={{ width: finalLeftWidth, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg1)' }}>
            {/* Header row */}
            <div style={{ height: HDR_H, background: 'var(--bg2)', borderBottom: '0.5px solid var(--bd)', display: 'flex', flexShrink: 0, position: 'sticky', top: 0, zIndex: 1 }}>
              {visibleColDefs.map((col, colIdx) => (
                <div
                  key={col.key}
                  style={{
                    width: effectiveWidth(col),
                    flexShrink: 0,
                    padding: '0 8px',
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: 11,
                    fontWeight: 500,
                    color: 'var(--t2)',
                    borderRight: colIdx < visibleColDefs.length - 1 ? '0.5px solid var(--bd)' : 'none',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  {col.label}
                  {colIdx < visibleColDefs.length - 1 && (
                    <div
                      onMouseDown={(e) => startResize(e, col.key)}
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        width: 6,
                        height: '100%',
                        cursor: 'col-resize',
                        zIndex: 2,
                        userSelect: 'none',
                      }}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Rows */}
            <div ref={leftRef} onScroll={onLeftScroll} style={{ overflowY: 'scroll', overflowX: 'hidden', flex: 1 }}>
              {loading
                ? Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} style={{ height: ROW_H, borderBottom: '0.5px solid var(--bd)', display: 'flex' }}>
                      {visibleColDefs.map((col, colIdx) => (
                        <div key={col.key} style={{ width: effectiveWidth(col), flexShrink: 0, borderRight: colIdx < visibleColDefs.length - 1 ? '0.5px solid var(--bd)' : 'none', display: 'flex', alignItems: 'center', padding: '0 8px' }}>
                          <div style={{ height: 8, background: 'var(--bg3)', borderRadius: 4, width: '60%' }} />
                        </div>
                      ))}
                    </div>
                  ))
                : visibleTasks.map((task) => {
                    const lvStyle = levelStyle(task.level);
                    const isExpanded = expanded.has(task.id) || !!search;
                    const isHov = hoveredRow === task.id;
                    return (
                      <div
                        key={task.id}
                        onMouseEnter={() => setHoveredRow(task.id)}
                        onMouseLeave={() => setHoveredRow(null)}
                        style={{
                          height: ROW_H,
                          display: 'flex',
                          borderBottom: '0.5px solid var(--bd)',
                          background: isHov ? 'var(--bg2)' : (lvStyle.background as string ?? ''),
                          userSelect: 'none',
                        }}
                      >
                        {visibleColDefs.map((col, colIdx) => {
                          const isNameCol = col.key === 'name';
                          return (
                            <div
                              key={col.key}
                              onClick={isNameCol ? (e) => openEdit(task, e) : undefined}
                              title={isNameCol ? 'Clique para editar' : ''}
                              style={{
                                width: effectiveWidth(col),
                                flexShrink: 0,
                                padding: '0 8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: isNameCol ? 4 : 0,
                                borderRight: colIdx < visibleColDefs.length - 1 ? '0.5px solid var(--bd)' : 'none',
                                cursor: isNameCol ? 'pointer' : 'default',
                                overflow: 'hidden',
                                ...(isNameCol ? lvStyle : { fontSize: 11 }),
                              }}
                            >
                              {col.key === 'code' && (
                                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, opacity: 0.55, whiteSpace: 'nowrap' }}>
                                  {task.code}
                                </span>
                              )}
                              {col.key === 'name' && (
                                <>
                                  {task.hasChildren ? (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); toggleExpand(task.id); }}
                                      style={{ width: 16, height: 16, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--t2)', fontSize: 10, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, transition: 'transform .15s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                                    >▶</button>
                                  ) : (
                                    <span style={{ width: 16, flexShrink: 0 }} />
                                  )}
                                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: (task.level - 1) * 12 }} title={task.name}>
                                    {task.name}
                                  </span>
                                  {isHov && (
                                    <div style={{ display: 'flex', gap: 2, flexShrink: 0, marginLeft: 'auto' }}>
                                      <button title="Adicionar subitem" onClick={(e) => openNewChild(task, e)} style={{ width: 18, height: 18, border: '0.5px solid var(--bd)', borderRadius: 4, background: 'var(--bg1)', cursor: 'pointer', color: 'var(--t2)', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}>+</button>
                                      <button title="Editar" onClick={(e) => openEdit(task, e)} style={{ width: 18, height: 18, border: '0.5px solid var(--bd)', borderRadius: 4, background: 'var(--bg1)', cursor: 'pointer', color: 'var(--t2)', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}>✎</button>
                                      <button title="Excluir" onClick={(e) => openDelete(task, e)} style={{ width: 18, height: 18, border: '0.5px solid var(--bd)', borderRadius: 4, background: 'var(--bg1)', cursor: 'pointer', color: '#C9312F', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}>×</button>
                                    </div>
                                  )}
                                </>
                              )}
                              {col.key === 'startDate' && (
                                <span style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                                  {fmtDate(task.startDate)}
                                </span>
                              )}
                              {col.key === 'endDate' && (
                                <span style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                                  {fmtDate(task.endDate)}
                                </span>
                              )}
                              {col.key === 'duration' && (
                                <span style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                                  {task.durationDays ?? '—'}
                                </span>
                              )}
                              {col.key === 'progress' && (
                                <span className={badgeClass(task.actualProgress, task.plannedProgress)} style={{ fontSize: 9, justifyContent: 'center', marginLeft: 'auto' }}>
                                  {task.actualProgress}%
                                </span>
                              )}
                              {col.key === 'predecessors' && (
                                <span style={{ fontSize: 11, whiteSpace: 'nowrap', color: 'var(--t2)' }}>
                                  —
                                </span>
                              )}
                              {col.key === 'successors' && (
                                <span style={{ fontSize: 11, whiteSpace: 'nowrap', color: 'var(--t2)' }}>
                                  —
                                </span>
                              )}
                              {col.key === 'critical' && (
                                <span style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                                  {task.isCriticalPath ? 'Sim' : 'Não'}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
            </div>
          </div>

          {/* Splitter */}
          <div
            onMouseDown={startSplitterResize}
            style={{
              width: 6,
              flexShrink: 0,
              cursor: 'col-resize',
              background: '0.5px solid var(--bd)',
              borderLeft: '0.5px solid var(--bd)',
              borderRight: '0.5px solid var(--bd)',
              userSelect: 'none',
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg2)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
          />

          {/* ── Right Gantt panel ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }} onWheel={onGanttWheel}>

            {/* Month header */}
            <div
              ref={hdrRef}
              style={{ height: HDR_H, flexShrink: 0, overflow: 'hidden', background: 'var(--bg2)', borderBottom: '0.5px solid var(--bd)', position: 'relative' }}
            >
              <div style={{ position: 'relative', width: totalWidth, height: HDR_H }}>
                {months.map((mon, i) => (
                  <div key={i} style={{ position: 'absolute', left: mon.left, top: 0, width: mon.width, height: HDR_H, borderLeft: '0.5px solid var(--bd)', padding: '0 4px', fontSize: 9, color: 'var(--t2)', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                    {mon.label}
                  </div>
                ))}
                <div style={{ position: 'absolute', left: todayLeft, top: 0, width: 1, background: '#E24B4A', height: HDR_H, zIndex: 2 }} />
              </div>
            </div>

            {/* Scrollable bar body */}
            <div ref={rightRef} onScroll={onRightScroll} style={{ flex: 1, overflow: 'auto', background: 'var(--bg1)' }}>
              <div style={{ position: 'relative', width: totalWidth, height: visibleTasks.length * ROW_H }}>
                <div style={{ position: 'absolute', left: todayLeft, top: 0, bottom: 0, width: 1, background: 'rgba(226,75,74,.25)', zIndex: 1, pointerEvents: 'none' }} />

                {!loading && visibleTasks.map((task, rowIdx) => {
                  const left = barLeft(task);
                  const width = barWidth(task);
                  const barH = task.level <= 1 ? 12 : 8;
                  const barTop = Math.round((ROW_H - barH) / 2);
                  const actualW = Math.max(2, Math.round((task.actualProgress / 100) * width));
                  const color = barColor(task.actualProgress, task.plannedProgress);
                  const top = rowIdx * ROW_H;
                  const bg = hoveredRow === task.id ? 'var(--bg2)' : rowBg(task.level);

                  return (
                    <div
                      key={task.id}
                      style={{ position: 'absolute', top, left: 0, width: totalWidth, height: ROW_H, background: bg, borderBottom: '0.5px solid var(--bd)' }}
                    >
                      {/* Planned bar */}
                      <div style={{ position: 'absolute', left, width, height: barH, top: barTop, background: 'rgba(55,138,221,.35)', borderRadius: 3 }} />
                      {/* Actual bar */}
                      <div style={{ position: 'absolute', left, width: actualW, height: barH, top: barTop, background: color, borderRadius: 3, opacity: task.level <= 1 ? 1 : 0.85 }} />
                      {task.level <= 2 && actualW > 20 && (
                        <span style={{ position: 'absolute', left: left + actualW + 3, top: barTop - 1, fontSize: 9, color, whiteSpace: 'nowrap' }}>
                          {task.actualProgress}%
                        </span>
                      )}
                      {/* Tooltip on bar hover */}
                      <div
                        style={{ position: 'absolute', left, width, height: ROW_H, top: 0, cursor: 'pointer', zIndex: 2 }}
                        title={`${task.code} — ${task.name}\nInício: ${task.startDate.slice(0, 10)}\nFim: ${task.endDate.slice(0, 10)}\nDuração: ${task.durationDays ?? '—'} dias\nPlanejado: ${task.plannedProgress}% | Realizado: ${task.actualProgress}%`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal create/edit */}
      <TaskModal
        open={modalOpen}
        editingTask={editingTask}
        parentTask={parentTask}
        allTasks={tasks}
        projectId={projectId!}
        addToast={addToast as any}
        onClose={() => setModalOpen(false)}
        onSaved={loadData}
      />

      {/* Import modal */}
      <ImportModal
        open={showImport}
        step={importStep}
        file={importFile}
        preview={importPreview}
        importing={importing}
        projectId={projectId!}
        onClose={() => setShowImport(false)}
        setStep={setImportStep}
        setFile={setImportFile}
        setPreview={setImportPreview}
        setImporting={setImporting}
        addToast={addToast as any}
        onImportSuccess={loadData}
      />

      {/* Delete confirmation */}
      <DeleteConfirm
        task={deleteTarget}
        allTasks={tasks}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
