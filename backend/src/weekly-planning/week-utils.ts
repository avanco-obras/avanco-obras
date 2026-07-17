import { WeeklyActivityStatus, WeeklyRestrictionStatus } from '@prisma/client';

/**
 * Funções puras da Programação Semanal: cálculo de semana a partir do
 * weekStartDay do projeto, regras Status ↔ % Executado e indicadores (PPC).
 */

/** Início da semana (UTC, meia-noite) que contém `date`, dado o dia de início (0=Dom … 6=Sáb). */
export function startOfWeekUtc(date: Date, weekStartDay: number): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const diff = (d.getUTCDay() - weekStartDay + 7) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** Número/ano da semana ISO-8601 da data (para rótulo "Semana N"). */
export function isoWeek(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}

export interface WeekWindow {
  weekNumber: number;
  year: number;
  startDate: Date;
  endDate: Date;
  meetingDate: Date;
}

/**
 * Janela da semana que contém `reference`: 7 dias a partir do weekStartDay,
 * reunião no primeiro dia após o término (start + 7).
 */
export function weekWindow(reference: Date, weekStartDay: number): WeekWindow {
  const startDate = startOfWeekUtc(reference, weekStartDay);
  const { week, year } = isoWeek(startDate);
  return {
    weekNumber: week,
    year,
    startDate,
    endDate: addDays(startDate, 6),
    meetingDate: addDays(startDate, 7),
  };
}

/** Statuses que voltam para a próxima semana como REPROGRAMADA no fechamento. */
export const CARRYOVER_STATUSES: WeeklyActivityStatus[] = [
  WeeklyActivityStatus.PROGRAMADA,
  WeeklyActivityStatus.NAO_INICIADA,
  WeeklyActivityStatus.EM_ANDAMENTO,
  WeeklyActivityStatus.REPROGRAMADA,
];

/**
 * Regras Status ↔ % Executado. Recebe o par pretendido e devolve o par
 * consistente (o status manda no %):
 *  - NAO_INICIADA / CANCELADA → % = 0
 *  - CONCLUIDA → % = 100
 *  - EM_ANDAMENTO → % restrito a 1–99 (0→1, 100→99)
 *  - PROGRAMADA / REPROGRAMADA → % livre (0–100)
 */
export function reconcileStatusPercent(
  status: WeeklyActivityStatus,
  percent: number,
): { status: WeeklyActivityStatus; percentExecuted: number } {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  switch (status) {
    case WeeklyActivityStatus.NAO_INICIADA:
    case WeeklyActivityStatus.CANCELADA:
      return { status, percentExecuted: 0 };
    case WeeklyActivityStatus.CONCLUIDA:
      return { status, percentExecuted: 100 };
    case WeeklyActivityStatus.EM_ANDAMENTO:
      return { status, percentExecuted: Math.max(1, Math.min(99, clamped)) };
    default:
      return { status, percentExecuted: clamped };
  }
}

/** Sugestão de status a partir do % (usada quando só o % é alterado). */
export function suggestStatusFromPercent(
  current: WeeklyActivityStatus,
  percent: number,
): WeeklyActivityStatus {
  if (current === WeeklyActivityStatus.CANCELADA) return current;
  if (percent >= 100) return WeeklyActivityStatus.CONCLUIDA;
  if (percent > 0) return WeeklyActivityStatus.EM_ANDAMENTO;
  // 0%: só regride quem estava em andamento/concluída
  if (current === WeeklyActivityStatus.EM_ANDAMENTO || current === WeeklyActivityStatus.CONCLUIDA) {
    return WeeklyActivityStatus.NAO_INICIADA;
  }
  return current;
}

export interface IndicatorActivity {
  status: WeeklyActivityStatus;
  contractorId?: string | null;
  contractorName?: string | null;
  responsible?: string | null;
}

export interface IndicatorRestriction {
  typeName?: string | null;
  status: WeeklyRestrictionStatus;
}

export interface WeeklyIndicators {
  ppc: number;
  totalActivities: number;
  validActivities: number;
  completed: number;
  cancelled: number;
  carriedOver: number;
  reprogrammedPct: number;
  restrictionsCount: number;
  restrictionsPending: number;
  topCauses: Array<{ type: string; count: number }>;
  byContractor: Array<{
    contractorId: string | null;
    name: string;
    total: number;
    completed: number;
    ppc: number;
    reprogrammedPct: number;
  }>;
  byResponsible: Array<{ responsible: string; planned: number; delivered: number; ppc: number }>;
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

/**
 * Indicadores da semana — PPC binário Last Planner:
 * PPC = CONCLUIDA ÷ (total − CANCELADA). Canceladas fora de todos os KPIs.
 */
export function computeIndicators(
  activities: IndicatorActivity[],
  restrictions: IndicatorRestriction[],
): WeeklyIndicators {
  const valid = activities.filter((a) => a.status !== WeeklyActivityStatus.CANCELADA);
  const completed = valid.filter((a) => a.status === WeeklyActivityStatus.CONCLUIDA);
  const carried = valid.filter((a) => a.status !== WeeklyActivityStatus.CONCLUIDA);

  const byContractorMap = new Map<string, { contractorId: string | null; name: string; list: IndicatorActivity[] }>();
  for (const a of valid) {
    const key = a.contractorId ?? '__none__';
    if (!byContractorMap.has(key)) {
      byContractorMap.set(key, {
        contractorId: a.contractorId ?? null,
        name: a.contractorName ?? 'Sem empresa',
        list: [],
      });
    }
    byContractorMap.get(key)!.list.push(a);
  }
  const byContractor = Array.from(byContractorMap.values()).map(({ contractorId, name, list }) => {
    const done = list.filter((a) => a.status === WeeklyActivityStatus.CONCLUIDA).length;
    return {
      contractorId,
      name,
      total: list.length,
      completed: done,
      ppc: pct(done, list.length),
      reprogrammedPct: pct(list.length - done, list.length),
    };
  }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const byResponsibleMap = new Map<string, IndicatorActivity[]>();
  for (const a of valid) {
    const key = a.responsible?.trim() || 'Sem responsável';
    if (!byResponsibleMap.has(key)) byResponsibleMap.set(key, []);
    byResponsibleMap.get(key)!.push(a);
  }
  const byResponsible = Array.from(byResponsibleMap.entries()).map(([responsible, list]) => {
    const done = list.filter((a) => a.status === WeeklyActivityStatus.CONCLUIDA).length;
    return { responsible, planned: list.length, delivered: done, ppc: pct(done, list.length) };
  }).sort((a, b) => a.responsible.localeCompare(b.responsible, 'pt-BR'));

  const causesMap = new Map<string, number>();
  for (const r of restrictions) {
    const key = r.typeName ?? 'Sem tipo';
    causesMap.set(key, (causesMap.get(key) ?? 0) + 1);
  }
  const topCauses = Array.from(causesMap.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  return {
    ppc: pct(completed.length, valid.length),
    totalActivities: activities.length,
    validActivities: valid.length,
    completed: completed.length,
    cancelled: activities.length - valid.length,
    carriedOver: carried.length,
    reprogrammedPct: pct(carried.length, valid.length),
    restrictionsCount: restrictions.length,
    restrictionsPending: restrictions.filter((r) => r.status === WeeklyRestrictionStatus.PENDENTE).length,
    topCauses,
    byContractor,
    byResponsible,
  };
}

/**
 * Deriva Local/Torre/Pavimento do caminho EAP (nomes dos ancestrais, da raiz
 * para a folha). Heurística: pai → Pavimento, avô → Torre, bisavô/raiz → Local.
 */
export function deriveLocationFromPath(ancestorNames: string[]): {
  local: string;
  torre: string;
  pavimento: string;
} {
  const n = ancestorNames.length;
  return {
    pavimento: n >= 1 ? ancestorNames[n - 1] : '',
    torre: n >= 2 ? ancestorNames[n - 2] : '',
    local: n >= 3 ? ancestorNames[n - 3] : (n >= 1 ? ancestorNames[0] : ''),
  };
}
