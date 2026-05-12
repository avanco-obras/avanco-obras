import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useStore } from '@/store';
import { scheduleApi } from '@/services/api';
import type { GanttTask, ScheduleDependencyItem } from '@/types';

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

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function parseDate(s: string) {
  return new Date(s.slice(0, 10) + 'T00:00:00');
}

function addDays(date: Date, days: number): string {
  return new Date(date.getTime() + days * 86_400_000).toISOString().split('T')[0];
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

  // Scroll refs
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const hdrRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);

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
    if (projectId) loadData();
    else {
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

  function barLeft(task: GanttTask) { return daysBetween(minDate, parseDate(task.startDate)) * PX_PER_DAY; }
  function barWidth(task: GanttTask) { return Math.max(4, daysBetween(parseDate(task.startDate), parseDate(task.endDate)) * PX_PER_DAY); }

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
            <button className="ao-btn ao-btn-sm" onClick={handleExport}>CSV</button>
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
        <div style={{ display: 'flex', border: '0.5px solid var(--bd)', borderRadius: 12, overflow: 'hidden', height: 520 }}>

          {/* ── Left panel ── */}
          <div style={{ width: 290, flexShrink: 0, borderRight: '0.5px solid var(--bd)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ height: HDR_H, background: 'var(--bg2)', borderBottom: '0.5px solid var(--bd)', fontSize: 11, fontWeight: 500, color: 'var(--t2)', padding: '0 8px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              Atividade
            </div>

            <div ref={leftRef} onScroll={onLeftScroll} style={{ overflowY: 'scroll', overflowX: 'hidden', flex: 1 }}>
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
                    const isHov = hoveredRow === task.id;
                    return (
                      <div
                        key={task.id}
                        onMouseEnter={() => setHoveredRow(task.id)}
                        onMouseLeave={() => setHoveredRow(null)}
                        onClick={(e) => openEdit(task, e)}
                        title="Clique para editar"
                        style={{
                          height: ROW_H, display: 'flex', alignItems: 'center', gap: 4,
                          paddingLeft: basePad, paddingRight: 4,
                          borderBottom: '0.5px solid var(--bd)',
                          userSelect: 'none', cursor: 'pointer',
                          whiteSpace: 'nowrap', overflow: 'hidden',
                          background: isHov ? 'var(--bg2)' : (lvStyle.background as string ?? ''),
                          ...lvStyle,
                        }}
                      >
                        {/* Expand toggle */}
                        {task.hasChildren ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleExpand(task.id); }}
                            style={{ width: 16, height: 16, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--t2)', fontSize: 10, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, transition: 'transform .15s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                          >▶</button>
                        ) : (
                          <span style={{ width: 16, flexShrink: 0 }} />
                        )}

                        {/* Code */}
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, opacity: 0.55, flexShrink: 0 }}>{task.code}</span>

                        {/* Name */}
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={task.name}>{task.name}</span>

                        {/* Hover actions OR progress badge */}
                        {isHov ? (
                          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                            <button title="Adicionar subitem" onClick={(e) => openNewChild(task, e)} style={{ width: 18, height: 18, border: '0.5px solid var(--bd)', borderRadius: 4, background: 'var(--bg1)', cursor: 'pointer', color: 'var(--t2)', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}>+</button>
                            <button title="Editar" onClick={(e) => openEdit(task, e)} style={{ width: 18, height: 18, border: '0.5px solid var(--bd)', borderRadius: 4, background: 'var(--bg1)', cursor: 'pointer', color: 'var(--t2)', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}>✎</button>
                            <button title="Excluir" onClick={(e) => openDelete(task, e)} style={{ width: 18, height: 18, border: '0.5px solid var(--bd)', borderRadius: 4, background: 'var(--bg1)', cursor: 'pointer', color: '#C9312F', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}>×</button>
                          </div>
                        ) : (
                          <span className={badgeClass(task.actualProgress, task.plannedProgress)} style={{ flexShrink: 0, minWidth: 32, justifyContent: 'center', fontSize: 9, marginLeft: 4 }}>
                            {task.actualProgress}%
                          </span>
                        )}
                      </div>
                    );
                  })}
            </div>
          </div>

          {/* ── Right Gantt panel ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

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
        addToast={addToast}
        onClose={() => setModalOpen(false)}
        onSaved={loadData}
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
