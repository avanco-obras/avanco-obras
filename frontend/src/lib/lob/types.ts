import type { GanttTask } from '@/types';

/** Um dia em milissegundos. */
export const DAY_MS = 86_400_000;

/** Alteração pendente (em memória) de uma atividade na Linha de Balanço. */
export interface DraftChange {
  startDate: string; // YYYY-MM-DD (data de calendário, sem fuso)
  endDate: string;   // YYYY-MM-DD
  durationDays: number;
}

export type DraftMap = Map<string, DraftChange>;

/**
 * Converte uma data do cronograma para o instante da MEIA-NOITE LOCAL do mesmo
 * dia de calendário.
 *
 * O backend grava datas como meia-noite UTC ("2026-01-05T00:00:00.000Z") e o
 * Cronograma as lê pelo prefixo textual (`iso.slice(0, 10)`), ou seja, trata-as
 * como data pura. Usar `new Date(iso)` aqui jogaria a barra para o dia anterior
 * em fusos negativos (UTC-3 → 04/01 21:00) — origem da divergência entre a
 * Linha de Balanço e o Cronograma. Lendo o mesmo prefixo textual, as duas telas
 * enxergam exatamente o mesmo dia.
 */
export function parseScheduleDate(value: string): number {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return new Date(value).setHours(0, 0, 0, 0);
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

/** Serializa um instante local como data pura YYYY-MM-DD (convenção do Cronograma). */
export function toScheduleDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Formata um instante local como dd/mm/aaaa, sem conversão de fuso. */
export function formatScheduleBR(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * Duração em DIAS ÚTEIS (seg–sex), inclusiva nas duas pontas — espelha
 * `workDaysBetween` do Cronograma, que é quem define a unidade do campo
 * `durationDays` gravado no banco. Ex.: 27/07/2026 → 04/09/2026 = 30.
 */
export function durationFromRange(startMs: number, endMs: number): number {
  if (endMs < startMs) return 1;
  let count = 0;
  const cur = new Date(startMs);
  const end = new Date(endMs);
  while (cur.getTime() <= end.getTime()) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return Math.max(1, count);
}

/** Avança/retrocede `days` dias úteis — espelha `addWorkDays` do Cronograma. */
export function addWorkDays(ms: number, days: number): number {
  const result = new Date(ms);
  if (days === 0) return result.getTime();
  const step = days > 0 ? 1 : -1;
  let remaining = Math.abs(days);
  while (remaining > 0) {
    result.setDate(result.getDate() + step);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) remaining--;
  }
  return result.getTime();
}

/** Término correspondente a uma duração em dias úteis (mesma regra do Cronograma). */
export function endFromDuration(startMs: number, durationDays: number): number {
  return addWorkDays(startMs, Math.max(1, durationDays) - 1);
}

/** Datas efetivas de uma task considerando o draft (meia-noite local). */
export function effectiveDates(task: GanttTask, draft: DraftMap): { start: number; end: number; durationDays: number } {
  const d = draft.get(task.id);
  if (d) {
    return {
      start: parseScheduleDate(d.startDate),
      end: parseScheduleDate(d.endDate),
      durationDays: d.durationDays,
    };
  }
  const start = parseScheduleDate(task.startDate);
  const end = parseScheduleDate(task.endDate);
  return {
    start,
    end,
    durationDays: task.durationDays ?? durationFromRange(start, end),
  };
}
