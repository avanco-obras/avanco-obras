import type {
  WeeklyActivity,
  WeeklyActivityStatus,
  WeeklyActivityOrigin,
  WeeklyProgramStatus,
} from '../../types';

/** Lógica pura da Programação Semanal (espelha as regras do backend). */

export const STATUS_OPTIONS: WeeklyActivityStatus[] = [
  'PROGRAMADA',
  'NAO_INICIADA',
  'EM_ANDAMENTO',
  'CONCLUIDA',
  'CANCELADA',
  'REPROGRAMADA',
];

export const STATUS_LABEL: Record<WeeklyActivityStatus, string> = {
  PROGRAMADA: 'Programada',
  NAO_INICIADA: 'Não iniciada',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
  REPROGRAMADA: 'Reprogramada',
};

export const STATUS_BADGE: Record<WeeklyActivityStatus, string> = {
  PROGRAMADA: 'ao-badge ao-bk',
  NAO_INICIADA: 'ao-badge ao-bk',
  EM_ANDAMENTO: 'ao-badge ao-ba',
  CONCLUIDA: 'ao-badge ao-bg',
  CANCELADA: 'ao-badge ao-bk',
  REPROGRAMADA: 'ao-badge ao-bb',
};

export const PROGRAM_STATUS_LABEL: Record<WeeklyProgramStatus, string> = {
  RASCUNHO: 'Rascunho',
  PUBLICADA: 'Publicada',
  FECHADA: 'Fechada',
};

export const PROGRAM_STATUS_BADGE: Record<WeeklyProgramStatus, string> = {
  RASCUNHO: 'ao-badge ao-ba',
  PUBLICADA: 'ao-badge ao-bb',
  FECHADA: 'ao-badge ao-bg',
};

export const ORIGIN_LABEL: Record<WeeklyActivityOrigin, string> = {
  CRONOGRAMA: 'Cronograma',
  MANUAL: 'Manual (extra)',
  REPROGRAMADA: 'Reprogramada da semana anterior',
};

export const ORIGIN_SHORT: Record<WeeklyActivityOrigin, string> = {
  CRONOGRAMA: 'C',
  MANUAL: 'M',
  REPROGRAMADA: '↻',
};

export const WEEK_DAYS = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

/**
 * Regras Status → % (o status manda no %):
 * NAO_INICIADA/CANCELADA → 0 · CONCLUIDA → 100 · EM_ANDAMENTO → 1–99.
 */
export function percentForStatus(status: WeeklyActivityStatus, percent: number): number {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  switch (status) {
    case 'NAO_INICIADA':
    case 'CANCELADA':
      return 0;
    case 'CONCLUIDA':
      return 100;
    case 'EM_ANDAMENTO':
      // se estava em 0/100, sugere 50 como ponto de partida ajustável
      return clamped === 0 || clamped === 100 ? 50 : clamped;
    default:
      return clamped;
  }
}

/** Sugestão de status ao mudar o % (ajuste manual sempre possível). */
export function suggestStatusFromPercent(
  current: WeeklyActivityStatus,
  percent: number,
): WeeklyActivityStatus {
  if (current === 'CANCELADA') return current;
  if (percent >= 100) return 'CONCLUIDA';
  if (percent > 0) return 'EM_ANDAMENTO';
  if (current === 'EM_ANDAMENTO' || current === 'CONCLUIDA') return 'NAO_INICIADA';
  return current;
}

/** PPC live binário (Last Planner): CONCLUIDA ÷ (total − CANCELADA). */
export function calcPPC(activities: Pick<WeeklyActivity, 'status'>[]): number {
  const valid = activities.filter((a) => a.status !== 'CANCELADA');
  if (valid.length === 0) return 0;
  const done = valid.filter((a) => a.status === 'CONCLUIDA').length;
  return Math.round((done / valid.length) * 100);
}

// ── Filtro estilo Excel ──────────────────────────────────────────────────────

export type FilterableColumn =
  | 'local'
  | 'torre'
  | 'pavimento'
  | 'activityName'
  | 'contractor'
  | 'responsible'
  | 'status';

export type ColumnFilters = Partial<Record<FilterableColumn, string[]>>;

export function activityColumnValue(activity: WeeklyActivity, column: FilterableColumn): string {
  switch (column) {
    case 'contractor':
      return activity.contractor?.name ?? '—';
    case 'responsible':
      return activity.responsible?.trim() || '—';
    case 'status':
      return STATUS_LABEL[activity.status];
    default:
      return (activity[column] ?? '').toString().trim() || '—';
  }
}

/** Valores distintos da coluna, ordenados pt-BR (para o popover de filtro). */
export function distinctColumnValues(activities: WeeklyActivity[], column: FilterableColumn): string[] {
  const set = new Set<string>();
  activities.forEach((a) => set.add(activityColumnValue(a, column)));
  return Array.from(set).sort((a, b) =>
    a === '—' ? 1 : b === '—' ? -1 : a.localeCompare(b, 'pt-BR'),
  );
}

/** Aplica os filtros combinados (coluna sem entrada = sem filtro). */
export function applyColumnFilters(activities: WeeklyActivity[], filters: ColumnFilters): WeeklyActivity[] {
  const entries = Object.entries(filters) as Array<[FilterableColumn, string[]]>;
  if (entries.length === 0) return activities;
  return activities.filter((a) =>
    entries.every(([column, allowed]) => allowed.includes(activityColumnValue(a, column))),
  );
}
