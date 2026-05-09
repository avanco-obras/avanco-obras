import { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  X,
} from 'lucide-react';
import { useStore } from '../store';
import { weeklyPlanningApi } from '../services/api';
import { calcPPC, formatDate } from '../utils/calculations';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import type { WeeklyPlan, WeeklyTask, Restriction, TaskStatus, RestrictionStatus } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

const PPC_META = 80;

function ppcBadgeVariant(ppc: number): 'success' | 'warning' | 'destructive' {
  if (ppc >= 80) return 'success';
  if (ppc >= 70) return 'warning';
  return 'destructive';
}

function statusLabel(status: TaskStatus): string {
  switch (status) {
    case 'COMPLETED': return 'Concluída';
    case 'PARTIALLY': return 'Parcial';
    case 'NOT_COMPLETED': return 'Não Concluída';
    default: return status;
  }
}

function statusColor(status: TaskStatus): string {
  switch (status) {
    case 'COMPLETED': return 'text-green-600';
    case 'PARTIALLY': return 'text-amber-500';
    case 'NOT_COMPLETED': return 'text-red-500';
    default: return 'text-muted-foreground';
  }
}

function restrictionBadge(status: RestrictionStatus) {
  switch (status) {
    case 'PENDING': return <Badge variant="destructive">Pendente</Badge>;
    case 'IN_ANALYSIS': return <Badge variant="warning">Em Análise</Badge>;
    case 'RELEASED': return <Badge variant="success">Liberada</Badge>;
    case 'EXPIRED': return <Badge className="border-transparent bg-gray-400 text-white">Expirada</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

// ── Add Task Form ─────────────────────────────────────────────────────────────

interface AddTaskFormProps {
  onSubmit: (data: { description: string; location: string; assignedToId?: string }) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}

function AddTaskForm({ onSubmit, onCancel, submitting }: AddTaskFormProps) {
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [assignedToId, setAssignedToId] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !location.trim()) return;
    await onSubmit({
      description: description.trim(),
      location: location.trim(),
      assignedToId: assignedToId.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="border border-border rounded-md p-4 bg-muted/30 space-y-3">
      <p className="text-sm font-medium text-foreground">Nova Tarefa</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="task-desc">Atividade *</Label>
          <Input
            id="task-desc"
            placeholder="Descrição da tarefa"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="task-loc">Local *</Label>
          <Input
            id="task-loc"
            placeholder="Ex: Bloco A, Andar 3"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="task-assigned">Responsável (opcional — ID do usuário)</Label>
        <Input
          id="task-assigned"
          placeholder="ID do usuário"
          value={assignedToId}
          onChange={(e) => setAssignedToId(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" size="sm" disabled={submitting || !description.trim() || !location.trim()}>
          {submitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Adicionar
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

// ── Add Restriction Form ──────────────────────────────────────────────────────

interface AddRestrictionFormProps {
  onSubmit: (data: { description: string; responsible: string; dueDate: string }) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}

function AddRestrictionForm({ onSubmit, onCancel, submitting }: AddRestrictionFormProps) {
  const [description, setDescription] = useState('');
  const [responsible, setResponsible] = useState('');
  const [dueDate, setDueDate] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !responsible.trim() || !dueDate) return;
    await onSubmit({
      description: description.trim(),
      responsible: responsible.trim(),
      dueDate,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="border border-border rounded-md p-4 bg-muted/30 space-y-3">
      <p className="text-sm font-medium text-foreground">Nova Restrição</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="rest-desc">Descrição *</Label>
          <Input
            id="rest-desc"
            placeholder="Descreva a restrição"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="rest-resp">Responsável *</Label>
          <Input
            id="rest-resp"
            placeholder="Nome do responsável"
            value={responsible}
            onChange={(e) => setResponsible(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="rest-date">Prazo *</Label>
          <Input
            id="rest-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button
          type="submit"
          size="sm"
          disabled={submitting || !description.trim() || !responsible.trim() || !dueDate}
        >
          {submitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Adicionar
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ProgramacaoSemanal() {
  const { currentProject, addToast } = useStore();
  const projectId = currentProject?.id;

  // Plans list + navigation
  const [plans, setPlans] = useState<WeeklyPlan[]>([]);
  const [planIndex, setPlanIndex] = useState(0); // index into sorted plans[]
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);

  // Loading states
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Tasks & restrictions local copies (for optimistic updates)
  const [tasks, setTasks] = useState<WeeklyTask[]>([]);
  const [restrictions, setRestrictions] = useState<Restriction[]>([]);

  // Inline forms
  const [showAddTask, setShowAddTask] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [showAddRestriction, setShowAddRestriction] = useState(false);
  const [addingRestriction, setAddingRestriction] = useState(false);

  // Status update loading per task
  const [updatingTask, setUpdatingTask] = useState<string | null>(null);
  const [updatingRestriction, setUpdatingRestriction] = useState<string | null>(null);

  // ── Load plans list ───────────────────────────────────────────────────────

  const loadPlans = useCallback(async () => {
    if (!projectId) return;
    setLoadingPlans(true);
    try {
      const data = await weeklyPlanningApi.list(projectId);
      // Sort ascending by year then weekNumber
      const sorted = [...data].sort((a, b) =>
        a.year !== b.year ? a.year - b.year : a.weekNumber - b.weekNumber
      );
      setPlans(sorted);
      // Start at most recent
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

  // ── Derived PPC ───────────────────────────────────────────────────────────

  const ppcActual = calcPPC(tasks);
  const ppcForecast = plan?.ppcForecast;

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

  // ── Update task status ────────────────────────────────────────────────────

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    setUpdatingTask(taskId);
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status } : t))
    );
    try {
      const updated = await weeklyPlanningApi.updateTask(taskId, { status });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    } catch {
      // Revert
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: t.status } : t))
      );
      addToast({ type: 'error', title: 'Erro ao atualizar status da tarefa.' });
    } finally {
      setUpdatingTask(null);
    }
  };

  const handleCauseChange = async (taskId: string, nonCompletionCause: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, nonCompletionCause } : t))
    );
  };

  const handleCauseBlur = async (taskId: string, nonCompletionCause: string) => {
    try {
      await weeklyPlanningApi.updateTask(taskId, { nonCompletionCause });
    } catch {
      addToast({ type: 'error', title: 'Erro ao salvar causa.' });
    }
  };

  // ── Add task ──────────────────────────────────────────────────────────────

  const handleAddTask = async (data: { description: string; location: string; assignedToId?: string }) => {
    if (!plan) return;
    setAddingTask(true);
    try {
      const newTask = await weeklyPlanningApi.addTask(plan.id, {
        ...data,
        status: 'NOT_COMPLETED' as TaskStatus,
      });
      setTasks((prev) => [...prev, newTask]);
      setShowAddTask(false);
      addToast({ type: 'success', title: 'Tarefa adicionada.' });
    } catch {
      addToast({ type: 'error', title: 'Erro ao adicionar tarefa.' });
    } finally {
      setAddingTask(false);
    }
  };

  // ── Add restriction ───────────────────────────────────────────────────────

  const handleAddRestriction = async (data: { description: string; responsible: string; dueDate: string }) => {
    if (!plan) return;
    setAddingRestriction(true);
    try {
      const newR = await weeklyPlanningApi.addRestriction(plan.id, {
        ...data,
        status: 'PENDING' as RestrictionStatus,
      });
      setRestrictions((prev) => [...prev, newR]);
      setShowAddRestriction(false);
      addToast({ type: 'success', title: 'Restrição adicionada.' });
    } catch {
      addToast({ type: 'error', title: 'Erro ao adicionar restrição.' });
    } finally {
      setAddingRestriction(false);
    }
  };

  // ── Release restriction ───────────────────────────────────────────────────

  const handleReleaseRestriction = async (id: string) => {
    setUpdatingRestriction(id);
    setRestrictions((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'RELEASED' as RestrictionStatus } : r))
    );
    try {
      const updated = await weeklyPlanningApi.updateRestriction(id, { status: 'RELEASED' });
      setRestrictions((prev) => prev.map((r) => (r.id === id ? updated : r)));
      addToast({ type: 'success', title: 'Restrição marcada como liberada.' });
    } catch {
      setRestrictions((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'PENDING' as RestrictionStatus } : r))
      );
      addToast({ type: 'error', title: 'Erro ao liberar restrição.' });
    } finally {
      setUpdatingRestriction(null);
    }
  };

  // ── No project guard ──────────────────────────────────────────────────────

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <AlertTriangle className="h-14 w-14 text-muted-foreground/40" />
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-1">Selecione um empreendimento</h2>
          <p className="text-sm text-muted-foreground">
            Escolha um projeto no seletor acima para visualizar a programação semanal.
          </p>
        </div>
      </div>
    );
  }

  const currentPlanMeta = plans[planIndex];

  // PPC stats
  const completedCount = tasks.filter((t) => t.status === 'COMPLETED').length;
  const partialCount = tasks.filter((t) => t.status === 'PARTIALLY').length;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Programação Semanal</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{currentProject.name}</p>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={generating || !plan}
          size="sm"
          className="self-start"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          Gerar Tarefas
        </Button>
      </div>

      {/* ── Week Selector + PPC Badges ──────────────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Week navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={goToPrevWeek}
                disabled={planIndex <= 0 || loadingPlans}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="text-center min-w-[200px]">
                {loadingPlans ? (
                  <div className="h-5 w-48 animate-pulse rounded bg-muted mx-auto" />
                ) : currentPlanMeta ? (
                  <>
                    <p className="text-sm font-semibold text-foreground">
                      Semana {currentPlanMeta.weekNumber} — {currentPlanMeta.year}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(currentPlanMeta.startDate)} a {formatDate(currentPlanMeta.endDate)}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum plano disponível</p>
                )}
              </div>

              <Button
                variant="outline"
                size="icon"
                onClick={goToNextWeek}
                disabled={planIndex >= plans.length - 1 || loadingPlans}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* PPC Badges */}
            <div className="flex flex-wrap items-center gap-2 sm:ml-4">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground font-medium">PPC Atual:</span>
                <Badge variant={ppcBadgeVariant(ppcActual)}>
                  {ppcActual.toFixed(1)}%
                </Badge>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground font-medium">PPC Meta:</span>
                <Badge variant="outline">{PPC_META}%</Badge>
              </div>
              {ppcForecast !== undefined && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground font-medium">PPC Forecast:</span>
                  <Badge variant={ppcBadgeVariant(ppcForecast)}>
                    {ppcForecast.toFixed(1)}%
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Tasks Table ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Tarefas da Semana</CardTitle>
            {plan && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddTask((v) => !v)}
              >
                {showAddTask ? (
                  <><X className="h-3.5 w-3.5 mr-1.5" />Cancelar</>
                ) : (
                  <><Plus className="h-3.5 w-3.5 mr-1.5" />Adicionar Tarefa</>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pb-4 space-y-4">
          {showAddTask && (
            <AddTaskForm
              onSubmit={handleAddTask}
              onCancel={() => setShowAddTask(false)}
              submitting={addingTask}
            />
          )}

          {loadingPlan ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <CheckCircle2 className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {plan
                  ? 'Nenhuma tarefa nesta semana. Clique em "Adicionar Tarefa" ou "Gerar Tarefas".'
                  : 'Selecione uma semana para visualizar tarefas.'}
              </p>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="hidden md:grid grid-cols-[1fr_160px_160px_160px_180px] gap-2 px-2 pb-1 border-b border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Atividade</p>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Local</p>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Responsável</p>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</p>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Causa (se não cumprida)</p>
              </div>

              {/* Task rows */}
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="grid grid-cols-1 md:grid-cols-[1fr_160px_160px_160px_180px] gap-2 items-start rounded-md border border-border p-3 md:p-2 bg-background"
                  >
                    {/* Description */}
                    <div>
                      <p className="md:hidden text-xs text-muted-foreground mb-0.5 font-medium">Atividade</p>
                      <p className="text-sm text-foreground">{task.description}</p>
                    </div>

                    {/* Location */}
                    <div>
                      <p className="md:hidden text-xs text-muted-foreground mb-0.5 font-medium">Local</p>
                      <p className="text-sm text-foreground">{task.location || '—'}</p>
                    </div>

                    {/* Assigned */}
                    <div>
                      <p className="md:hidden text-xs text-muted-foreground mb-0.5 font-medium">Responsável</p>
                      <p className="text-sm text-foreground">
                        {task.assignedTo?.fullName ?? task.assignedTo?.username ?? '—'}
                      </p>
                    </div>

                    {/* Status select */}
                    <div>
                      <p className="md:hidden text-xs text-muted-foreground mb-0.5 font-medium">Status</p>
                      <div className="relative">
                        <Select
                          value={task.status}
                          onValueChange={(val) => handleStatusChange(task.id, val as TaskStatus)}
                          disabled={updatingTask === task.id}
                        >
                          <SelectTrigger className={`h-8 text-xs ${statusColor(task.status)}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="COMPLETED">
                              <span className="text-green-600">Concluída</span>
                            </SelectItem>
                            <SelectItem value="PARTIALLY">
                              <span className="text-amber-500">Parcial</span>
                            </SelectItem>
                            <SelectItem value="NOT_COMPLETED">
                              <span className="text-red-500">Não Concluída</span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        {updatingTask === task.id && (
                          <Loader2 className="absolute right-7 top-2 h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Non-completion cause */}
                    <div>
                      {task.status === 'NOT_COMPLETED' || task.status === 'PARTIALLY' ? (
                        <>
                          <p className="md:hidden text-xs text-muted-foreground mb-0.5 font-medium">Causa</p>
                          <Input
                            className="h-8 text-xs"
                            placeholder="Informe a causa..."
                            value={task.nonCompletionCause ?? ''}
                            onChange={(e) => handleCauseChange(task.id, e.target.value)}
                            onBlur={(e) => handleCauseBlur(task.id, e.target.value)}
                          />
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground hidden md:block">—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* PPC counter */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{completedCount}</span> concluídas
                  {partialCount > 0 && (
                    <>, <span className="font-medium text-foreground">{partialCount}</span> parciais</>
                  )}{' '}
                  de <span className="font-medium text-foreground">{tasks.length}</span> tarefas
                </p>
                <Badge variant={ppcBadgeVariant(ppcActual)} className="text-sm px-3 py-1">
                  PPC: {ppcActual.toFixed(1)}%
                </Badge>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Restrictions ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Restrições
              {restrictions.filter((r) => r.status === 'PENDING' || r.status === 'IN_ANALYSIS').length > 0 && (
                <Badge variant="warning" className="ml-1">
                  {restrictions.filter((r) => r.status === 'PENDING' || r.status === 'IN_ANALYSIS').length}
                </Badge>
              )}
            </CardTitle>
            {plan && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddRestriction((v) => !v)}
              >
                {showAddRestriction ? (
                  <><X className="h-3.5 w-3.5 mr-1.5" />Cancelar</>
                ) : (
                  <><Plus className="h-3.5 w-3.5 mr-1.5" />Adicionar Restrição</>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pb-4 space-y-3">
          {showAddRestriction && (
            <AddRestrictionForm
              onSubmit={handleAddRestriction}
              onCancel={() => setShowAddRestriction(false)}
              submitting={addingRestriction}
            />
          )}

          {loadingPlan ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : restrictions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Clock className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {plan ? 'Nenhuma restrição registrada.' : 'Selecione uma semana para visualizar restrições.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {restrictions.map((restriction) => (
                <div
                  key={restriction.id}
                  className="rounded-md border border-border p-3 space-y-2 bg-background"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-foreground flex-1 leading-snug">
                      {restriction.description}
                    </p>
                    {restrictionBadge(restriction.status)}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span>
                      <span className="font-medium text-foreground">Resp.: </span>
                      {restriction.responsible}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(restriction.dueDate)}
                    </span>
                  </div>
                  {(restriction.status === 'PENDING' || restriction.status === 'IN_ANALYSIS') && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-7 text-xs text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                      onClick={() => handleReleaseRestriction(restriction.id)}
                      disabled={updatingRestriction === restriction.id}
                    >
                      {updatingRestriction === restriction.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        'Marcar como Liberada'
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
