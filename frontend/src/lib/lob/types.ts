import type { GanttTask } from '@/types';

/** Um dia em milissegundos. */
export const DAY_MS = 86_400_000;

/** Alteração pendente (em memória) de uma atividade na Linha de Balanço. */
export interface DraftChange {
  startDate: string; // ISO
  endDate: string;   // ISO
  durationDays: number;
}

export type DraftMap = Map<string, DraftChange>;

/** Datas efetivas de uma task considerando o draft. */
export function effectiveDates(task: GanttTask, draft: DraftMap): { start: number; end: number; durationDays: number } {
  const d = draft.get(task.id);
  if (d) {
    return {
      start: new Date(d.startDate).getTime(),
      end: new Date(d.endDate).getTime(),
      durationDays: d.durationDays,
    };
  }
  return {
    start: new Date(task.startDate).getTime(),
    end: new Date(task.endDate).getTime(),
    durationDays: task.durationDays ?? Math.max(1, Math.round((new Date(task.endDate).getTime() - new Date(task.startDate).getTime()) / DAY_MS)),
  };
}

/** Duração (em dias) derivada de um intervalo — consistente com o rollup do backend. */
export function durationFromRange(startMs: number, endMs: number): number {
  return Math.max(1, Math.ceil((endMs - startMs) / DAY_MS));
}
