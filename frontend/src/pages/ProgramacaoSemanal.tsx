import { useState, useEffect, useCallback } from 'react';
import { Undo2, Redo2 } from 'lucide-react';
import { useStore } from '../store';
import { weeklyPlanningApi } from '../services/api';
import { formatDate } from '../utils/calculations';
import type { WeeklyPlan, WeeklyTask, Restriction, TaskStatus, RestrictionStatus } from '../types';
import { useHistoryStore } from '../store/historyStore';

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcPPCLive(tasks: WeeklyTask[]): number {
  if (!tasks.length) return 0;
  const completed = tasks.filter((t) => t.status === 'COMPLETED').length;
  const partial = tasks.filter((t) => t.status === 'PARTIALLY').length;
  return Math.round(((completed + partial * 0.5) / tasks.length) * 100);
}

function statusLabel(status: TaskStatus): string {
  switch (status) {
    case 'COMPLETED': return 'Concluída';
    case 'PARTIALLY': return 'Parcial';
    case 'NOT_COMPLETED': return 'Não Cumprida';
    default: return status;
  }
}

function taskBadgeClass(status: TaskStatus): string {
  switch (status) {
    case 'COMPLETED': return 'ao-badge ao-bg';
    case 'PARTIALLY': return 'ao-badge ao-ba';
    case 'NOT_COMPLETED': return 'ao-badge ao-br';
    default: return 'ao-badge ao-bk';
  }
}

function restrictionBadgeClass(status: RestrictionStatus): string {
  switch (status) {
    case 'RELEASED': return 'ao-badge ao-bg';
    case 'PENDING': return 'ao-badge ao-br';
    case 'IN_ANALYSIS': return 'ao-badge ao-ba';
    case 'EXPIRED': return 'ao-badge ao-bk';
    default: return 'ao-badge ao-bk';
  }
}

function restrictionStatusLabel(status: RestrictionStatus): string {
  switch (status) {
    case 'RELEASED': return 'Liberada';
    case 'PENDING': return 'Pendente';
    case 'IN_ANALYSIS': return 'Em Análise';
    case 'EXPIRED': return 'Expirada';
    default: return status;
  }
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ProgramacaoSemanal() {
  const { currentProject, addToast } = useStore();
  const projectId = currentProject?.id;
  const { push, triggerDataOnly, dataOnlyTrigger, past, future, undo, redo, isProcessing: historyProcessing } = useHistoryStore();

  // Plans list + navigation
  const [plans, setPlans] = useState<WeeklyPlan[]>([]);
  const [planIndex, setPlanIndex] = useState(0);
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);

  // Loading states
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Tasks & restrictions local copies (for optimistic updates)
  const [tasks, setTasks] = useState<WeeklyTask[]>([]);
  const [restrictions, setRestrictions] = useState<Restriction[]>([]);

  // Status update loading per task
  const [updatingTask, setUpdatingTask] = useState<string | null>(null);

  // ── Load plans list ───────────────────────────────────────────────────────

  const loadPlans = useCallback(async () => {
    if (!projectId) return;
    setLoadingPlans(true);
    try {
      const data = await weeklyPlanningApi.list(projectId);
      const sorted = [...data].sort((a, b) =>
        a.year !== b.year ? a.year - b.year : a.weekNumber - b.weekNumber
      );
      setPlans(sorted);
      setPlanIndex(sorted.length > 0 ? sorted.length - 1 : 0);
    } catch {
      addToast({ type: 'error', title: 'Erro ao carregar programações semanais.' });
    } finally {
      setLoadingPlans(false);
    }
  }, [projectId, addToast]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  // dataOnlyTrigger: undo/redo reloads only the current plan, preserving week navigation
  useEffect(() => {
    if (dataOnlyTrigger > 0 && plans.length > 0 && planIndex >= 0 && planIndex < plans.length) {
      loadPlan(plans[planIndex].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataOnlyTrigger]);

  // ── Load selected plan detail ─────────────────────────────────────────────

  const loadPlan = useCallback(async (id: string) => {
    setLoadingPlan(true);
    try {
      const data = await weeklyPlanningApi.get(id);
      setPlan(data);
      setTasks(data.tasks ?? []);
      setRestrictions(data.restrictions ?? []);
    } catch {
      addToast({ type: 'error', title: 'Erro ao carregar detalhes do plano.' });
    } finally {
      setLoadingPlan(false);
    }
  }, [addToast]);

  useEffect(() => {
    if (plans.length > 0 && planIndex >= 0 && planIndex < plans.length) {
      loadPlan(plans[planIndex].id);
    } else {
      setPlan(null);
      setTasks([]);
      setRestrictions([]);
    }
  }, [plans, planIndex, loadPlan]);

  // ── Derived PPC (live) ────────────────────────────────────────────────────

  const ppcActual = calcPPCLive(tasks);

  // ── Week navigation ───────────────────────────────────────────────────────

  const goToPrevWeek = () => setPlanIndex((i) => Math.max(0, i - 1));
  const goToNextWeek = () => setPlanIndex((i) => Math.min(plans.length - 1, i + 1));

  // ── Generate tasks ────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!plan) return;
    setGenerating(true);
    try {
      await weeklyPlanningApi.generate(plan.id);
      await loadPlan(plan.id);
      addToast({ type: 'success', title: 'Tarefas geradas com sucesso!' });
    } catch {
      addToast({ type: 'error', title: 'Erro ao gerar tarefas.' });
    } finally {
      setGenerating(false);
    }
  };

  // ── Toggle task status via checkbox ──────────────────────────────────────

  const handleCheckboxChange = async (taskId: string, checked: boolean) => {
    const oldTask = tasks.find((t) => t.id === taskId);
    const oldStatus = oldTask?.status ?? 'NOT_COMPLETED';
    const newStatus: TaskStatus = checked ? 'COMPLETED' : 'NOT_COMPLETED';

    // Optimistic update — recalc PPC immediately
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));

    setUpdatingTask(taskId);
    try {
      const updated = await weeklyPlanningApi.updateTask(taskId, { status: newStatus });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));

      const taskDesc = oldTask?.description ?? 'Tarefa';
      push({
        description: `Status: "${taskDesc.slice(0, 40)}"`,
        module: 'programacao-semanal',
        undo: async () => {
          await weeklyPlanningApi.updateTask(taskId, { status: oldStatus });
          triggerDataOnly();
        },
        redo: async () => {
          await weeklyPlanningApi.updateTask(taskId, { status: newStatus });
          triggerDataOnly();
        },
      });
    } catch {
      // Revert
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: oldStatus } : t)));
      addToast({ type: 'error', title: 'Erro ao atualizar status da tarefa.' });
    } finally {
      setUpdatingTask(null);
    }
  };

  const handleCauseBlur = async (taskId: string, nonCompletionCause: string) => {
    const oldTask = tasks.find((t) => t.id === taskId);
    const oldCause = oldTask?.nonCompletionCause ?? '';
    if (oldCause === nonCompletionCause) return;

    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, nonCompletionCause } : t)));
    try {
      await weeklyPlanningApi.updateTask(taskId, { nonCompletionCause });

      const taskDesc = oldTask?.description ?? 'Tarefa';
      push({
        description: `Causa: "${taskDesc.slice(0, 40)}"`,
        module: 'programacao-semanal',
        undo: async () => {
          await weeklyPlanningApi.updateTask(taskId, { nonCompletionCause: oldCause });
          triggerDataOnly();
        },
        redo: async () => {
          await weeklyPlanningApi.updateTask(taskId, { nonCompletionCause });
          triggerDataOnly();
        },
      });
    } catch {
      addToast({ type: 'error', title: 'Erro ao salvar causa.' });
    }
  };

  // ── Add extra task (inline prompt) ────────────────────────────────────────

  const handleAddExtra = async () => {
    if (!plan) return;
    const description = window.prompt('Descrição da tarefa extra:');
    if (!description?.trim()) return;
    const location = window.prompt('Local da tarefa:') ?? '';
    try {
      const newTask = await weeklyPlanningApi.addTask(plan.id, {
        description: description.trim(),
        location: location.trim(),
        status: 'NOT_COMPLETED' as TaskStatus,
      });
      setTasks((prev) => [...prev, newTask]);
      addToast({ type: 'success', title: 'Tarefa adicionada.' });
    } catch {
      addToast({ type: 'error', title: 'Erro ao adicionar tarefa.' });
    }
  };

  // ── No project guard ──────────────────────────────────────────────────────

  if (!currentProject) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--t2)' }}>
        <p style={{ fontSize: 14 }}>Selecione um empreendimento para visualizar a programação semanal.</p>
      </div>
    );
  }

  const currentPlanMeta = plans[planIndex];

  // Build week label
  let weekLabel = 'Nenhum plano disponível';
  let weekSubLabel = '';
  if (loadingPlans) {
    weekLabel = 'Carregando...';
  } else if (currentPlanMeta) {
    weekLabel = `Semana ${currentPlanMeta.weekNumber} — ${formatDate(currentPlanMeta.startDate)} a ${formatDate(currentPlanMeta.endDate)}`;
    weekSubLabel = `${currentPlanMeta.year}`;
  }

  const ppcColor = ppcActual >= 80 ? 'var(--green)' : ppcActual >= 70 ? 'var(--amber)' : 'var(--red)';
  const completedCount = tasks.filter((t) => t.status === 'COMPLETED').length;

  const inputInlineStyle: React.CSSProperties = {
    padding: '4px 7px', fontSize: 11, borderRadius: 'var(--r-md)',
    border: '1px solid var(--bd)', background: 'var(--s0)', color: 'var(--t1)',
    fontFamily: 'var(--font)', width: '100%', minWidth: 80, outline: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Week header strip ──────────────────────────────────────── */}
      <div className="ao-card">
        <div className="ao-card-hdr" style={{ minHeight: 48, flexWrap: 'wrap', gap: 10 }}>
          {/* Week navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="ao-btn ao-btn-sm" onClick={goToPrevWeek} disabled={planIndex <= 0 || loadingPlans}>
              ←
            </button>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', lineHeight: 1.2 }}>
                {loadingPlans ? 'Carregando…' : currentPlanMeta
                  ? `Semana ${currentPlanMeta.weekNumber} · ${formatDate(currentPlanMeta.startDate)} – ${formatDate(currentPlanMeta.endDate)}`
                  : 'Nenhum plano disponível'}
              </div>
              {weekSubLabel && <div style={{ fontSize: 10, color: 'var(--t3)', fontFamily: 'var(--mono)' }}>{weekSubLabel}</div>}
            </div>
            <button className="ao-btn ao-btn-sm" onClick={goToNextWeek} disabled={planIndex >= plans.length - 1 || loadingPlans}>
              →
            </button>
          </div>

          <div style={{ flex: 1 }} />

          {/* PPC indicator */}
          {plan && tasks.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 12px', background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 'var(--r-md)' }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>PPC Semanal</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--mono)', color: ppcColor, lineHeight: 1.1 }}>{ppcActual}%</div>
              </div>
              <div style={{ width: 44, height: 44, position: 'relative', flexShrink: 0 }}>
                <svg viewBox="0 0 44 44" width="44" height="44">
                  <circle cx="22" cy="22" r="18" fill="none" stroke="var(--s3)" strokeWidth="5" />
                  <circle cx="22" cy="22" r="18" fill="none" stroke={ppcColor} strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray="113.1"
                    strokeDashoffset={113.1 * (1 - ppcActual / 100)}
                    transform="rotate(-90 22 22)" />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: ppcColor }}>
                  meta<br/>80%
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
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
            <div style={{ width: 1, height: 16, background: 'var(--bd)' }} />
            <button className="ao-btn ao-btn-sm" onClick={handleGenerate} disabled={generating || !plan}>
              {generating ? 'Gerando…' : 'Gerar tarefas'}
            </button>
            <button className="ao-btn ao-btn-sm ao-btn-primary" onClick={handleAddExtra} disabled={!plan}>
              + Tarefa extra
            </button>
          </div>
        </div>
      </div>

      {/* ── Tarefas ─────────────────────────────────────────────────── */}
      <div className="ao-card">
        <div className="ao-card-hdr">
          <span className="ao-card-title">Tarefas da semana</span>
          {tasks.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--t2)', fontFamily: 'var(--mono)' }}>
              {completedCount} / {tasks.length} cumpridas
            </span>
          )}
        </div>

        {loadingPlan ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>Carregando tarefas…</div>
        ) : tasks.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>
            {plan ? 'Nenhuma tarefa nesta semana. Use "Gerar tarefas" ou "+ Tarefa extra".' : 'Selecione uma semana para visualizar tarefas.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="ao-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}></th>
                  <th>Atividade</th>
                  <th>Local</th>
                  <th>Responsável</th>
                  <th>Status</th>
                  <th>Causa (se não cumprida)</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={task.status === 'COMPLETED'}
                        disabled={updatingTask === task.id}
                        onChange={(e) => handleCheckboxChange(task.id, e.target.checked)}
                        style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--blue)' }}
                      />
                    </td>
                    <td style={{ fontWeight: task.status === 'COMPLETED' ? 400 : 500 }}>
                      {task.description}
                    </td>
                    <td className="muted">{task.location || '—'}</td>
                    <td className="muted">{task.assignedTo?.fullName ?? task.assignedTo?.username ?? '—'}</td>
                    <td>
                      <span className={taskBadgeClass(task.status)}>{statusLabel(task.status)}</span>
                    </td>
                    <td>
                      {task.status !== 'COMPLETED' ? (
                        <input
                          style={inputInlineStyle}
                          placeholder="Informe a causa…"
                          defaultValue={task.nonCompletionCause ?? ''}
                          onBlur={(e) => handleCauseBlur(task.id, e.target.value)}
                        />
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--t3)' }}>{task.nonCompletionCause || '—'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Restrições ──────────────────────────────────────────────── */}
      <div className="ao-card">
        <div className="ao-card-hdr">
          <span className="ao-card-title">Restrições da semana</span>
          {restrictions.length > 0 && (
            <span className="ao-badge ao-ba">{restrictions.filter(r => r.status === 'PENDING').length} pendentes</span>
          )}
        </div>

        {loadingPlan ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>Carregando…</div>
        ) : restrictions.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>
            {plan ? 'Nenhuma restrição registrada nesta semana.' : 'Selecione uma semana para visualizar restrições.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="ao-table">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Responsável</th>
                  <th>Prazo</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {restrictions.map((r) => (
                  <tr key={r.id}>
                    <td>{r.description}</td>
                    <td className="muted">{r.responsible}</td>
                    <td className="mono">{formatDate(r.dueDate)}</td>
                    <td>
                      <span className={restrictionBadgeClass(r.status)}>{restrictionStatusLabel(r.status)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
