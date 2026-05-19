import { useState, useEffect, useCallback } from 'react';
import { useStore } from '../store';
import { weeklyPlanningApi } from '../services/api';
import { formatDate } from '../utils/calculations';
import type { WeeklyPlan, WeeklyTask, Restriction, TaskStatus, RestrictionStatus } from '../types';

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
    const newStatus: TaskStatus = checked ? 'COMPLETED' : 'NOT_COMPLETED';

    // Optimistic update — recalc PPC immediately
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));

    setUpdatingTask(taskId);
    try {
      const updated = await weeklyPlanningApi.updateTask(taskId, { status: newStatus });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    } catch {
      // Revert
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: t.status } : t)));
      addToast({ type: 'error', title: 'Erro ao atualizar status da tarefa.' });
    } finally {
      setUpdatingTask(null);
    }
  };

  const handleCauseBlur = async (taskId: string, nonCompletionCause: string) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, nonCompletionCause } : t)));
    try {
      await weeklyPlanningApi.updateTask(taskId, { nonCompletionCause });
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

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 500 }}>{weekLabel}{weekSubLabel ? ` · ${weekSubLabel}` : ''}</p>
          <p style={{ fontSize: 12, color: 'var(--t2)', marginTop: 2 }}>
            PPC: <strong>{ppcActual}%</strong> · Meta: 80%
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="ao-btn ao-btn-sm"
            onClick={goToPrevWeek}
            disabled={planIndex <= 0 || loadingPlans}
          >
            ← Semana anterior
          </button>
          <button
            className="ao-btn ao-btn-sm"
            onClick={goToNextWeek}
            disabled={planIndex >= plans.length - 1 || loadingPlans}
          >
            Próxima semana →
          </button>
          <button
            className="ao-btn ao-btn-sm"
            onClick={handleGenerate}
            disabled={generating || !plan}
          >
            {generating ? 'Gerando...' : 'Gerar tarefas'}
          </button>
          <button className="ao-btn ao-btn-sm" onClick={handleAddExtra} disabled={!plan}>
            + Extra
          </button>
        </div>
      </div>

      {/* ── Tasks Card ─────────────────────────────────────────────────── */}
      <div className="ao-card">
        <div className="ao-card-hdr">
          <p className="ao-card-title">Tarefas da semana</p>
          {tasks.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--t2)' }}>
              {tasks.filter((t) => t.status === 'COMPLETED').length} de {tasks.length} cumpridas
            </span>
          )}
        </div>

        {loadingPlan ? (
          <p style={{ fontSize: 12, color: 'var(--t2)', padding: '1rem 0' }}>Carregando tarefas...</p>
        ) : tasks.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--t2)', padding: '1rem 0' }}>
            {plan
              ? 'Nenhuma tarefa nesta semana. Clique em "Gerar tarefas" ou "+ Extra".'
              : 'Selecione uma semana para visualizar tarefas.'}
          </p>
        ) : (
          <table className="ao-table">
            <thead>
              <tr>
                <th>Atividade</th>
                <th>Local</th>
                <th>Responsável</th>
                <th style={{ textAlign: 'center' }}>Cumprida?</th>
                <th>Causa (se não)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>{task.description}</td>
                  <td style={{ color: 'var(--t2)' }}>{task.location || '—'}</td>
                  <td>{task.assignedTo?.fullName ?? task.assignedTo?.username ?? '—'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={task.status === 'COMPLETED'}
                      disabled={updatingTask === task.id}
                      onChange={(e) => handleCheckboxChange(task.id, e.target.checked)}
                      style={{ width: 15, height: 15, cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ color: 'var(--t2)', fontSize: 10 }}>
                    {task.status !== 'COMPLETED' ? (
                      <input
                        style={{
                          padding: '3px 6px',
                          fontSize: 10,
                          borderRadius: 'var(--r-md)',
                          border: '0.5px solid var(--bd2)',
                          background: 'var(--bg1)',
                          color: 'var(--t1)',
                          fontFamily: 'var(--font)',
                          width: '100%',
                          minWidth: 80,
                        }}
                        placeholder="Informe a causa..."
                        defaultValue={task.nonCompletionCause ?? ''}
                        onBlur={(e) => handleCauseBlur(task.id, e.target.value)}
                      />
                    ) : (
                      task.nonCompletionCause || ''
                    )}
                  </td>
                  <td>
                    <span className={taskBadgeClass(task.status)}>{statusLabel(task.status)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Restrictions Card ──────────────────────────────────────────── */}
      <div className="ao-card">
        <p className="ao-card-title" style={{ marginBottom: '.75rem' }}>
          🔒 Restrições da semana
        </p>

        {loadingPlan ? (
          <p style={{ fontSize: 12, color: 'var(--t2)' }}>Carregando restrições...</p>
        ) : restrictions.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--t2)', padding: '.5rem 0' }}>
            {plan ? 'Nenhuma restrição registrada.' : 'Selecione uma semana para visualizar restrições.'}
          </p>
        ) : (
          <table className="ao-table">
            <thead>
              <tr>
                <th>Restrição</th>
                <th>Responsável</th>
                <th>Prazo</th>
                <th style={{ textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {restrictions.map((r) => (
                <tr key={r.id}>
                  <td>{r.description}</td>
                  <td style={{ color: 'var(--t2)' }}>{r.responsible}</td>
                  <td style={{ color: 'var(--t2)' }}>{formatDate(r.dueDate)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={restrictionBadgeClass(r.status)}>
                      {restrictionStatusLabel(r.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
