import type { GanttTask } from '@/types';
import { DAY_MS, effectiveDates, type DraftChange, type DraftMap } from './types';

/**
 * Scheduler de cascata em memória (Linha de Balanço).
 *
 * Ao mover/redimensionar uma atividade, percorre as sucessoras (forward pass)
 * e EMPURRA para frente as que violarem a restrição da dependência
 * (FS/SS/FF/SF + lag), preservando a duração de cada uma. Nunca puxa
 * atividades para trás. Guarda anti-ciclo por contagem de visitas.
 *
 * Retorna o conjunto completo de alterações do gesto (inclui a atividade
 * movida), pronto para ser mesclado ao draft e registrado como UMA entrada
 * de undo.
 */

export interface CascadeResult {
  /** Alterações novas/atualizadas geradas pelo gesto (taskId → DraftChange). */
  changes: Map<string, DraftChange>;
  /** IDs empurrados além da atividade movida. */
  pushedIds: string[];
}

const MAX_VISITS = 3; // por nó — tolera diamantes; corta ciclos

function toDraftChange(startMs: number, endMs: number, durationDays: number): DraftChange {
  return {
    startDate: new Date(startMs).toISOString(),
    endDate: new Date(endMs).toISOString(),
    durationDays,
  };
}

/**
 * Aplica um movimento/redimensionamento e propaga a cascata.
 *
 * @param tasks   cronograma completo (com successorDeps embutidas)
 * @param draft   draft atual (NÃO é mutado)
 * @param taskId  atividade editada
 * @param newStartMs / newEndMs  novas datas da atividade editada
 * @param newDurationDays        nova duração (dias) da atividade editada
 */
export function applyMove(
  tasks: GanttTask[],
  draft: DraftMap,
  taskId: string,
  newStartMs: number,
  newEndMs: number,
  newDurationDays: number,
): CascadeResult {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const changes = new Map<string, DraftChange>();
  const pushedIds: string[] = [];
  const visits = new Map<string, number>();

  const getDates = (id: string): { start: number; end: number; durationDays: number } | null => {
    const c = changes.get(id);
    if (c) {
      return {
        start: new Date(c.startDate).getTime(),
        end: new Date(c.endDate).getTime(),
        durationDays: c.durationDays,
      };
    }
    const t = byId.get(id);
    return t ? effectiveDates(t, draft) : null;
  };

  const moved = byId.get(taskId);
  if (!moved) return { changes, pushedIds };

  changes.set(taskId, toDraftChange(newStartMs, newEndMs, newDurationDays));

  // BFS a partir da atividade movida.
  const queue: string[] = [taskId];
  while (queue.length > 0) {
    const predId = queue.shift()!;
    const pred = byId.get(predId);
    if (!pred) continue;
    const predDates = getDates(predId)!;

    for (const dep of pred.successorDeps ?? []) {
      const succId = dep.successorId;
      if (succId === predId) continue;
      const succ = byId.get(succId);
      if (!succ) continue;

      const v = visits.get(succId) ?? 0;
      if (v >= MAX_VISITS) continue; // ciclo/diamante profundo — corta

      const succDates = getDates(succId);
      if (!succDates) continue;

      const lagMs = (dep.lagDays ?? 0) * DAY_MS;
      const type = (dep.type ?? 'FS').toUpperCase();

      // Data mínima permitida para a sucessora conforme o tipo do vínculo.
      let requiredStart = -Infinity;
      let requiredEnd = -Infinity;
      switch (type) {
        case 'SS': requiredStart = predDates.start + lagMs; break;
        case 'FF': requiredEnd = predDates.end + lagMs; break;
        case 'SF': requiredEnd = predDates.start + lagMs; break;
        case 'FS':
        default: requiredStart = predDates.end + lagMs; break;
      }

      let delta = 0;
      if (requiredStart > -Infinity && succDates.start < requiredStart) {
        delta = requiredStart - succDates.start;
      } else if (requiredEnd > -Infinity && succDates.end < requiredEnd) {
        delta = requiredEnd - succDates.end;
      }

      if (delta > 0) {
        const newStart = succDates.start + delta;
        const newEnd = succDates.end + delta; // duração preservada
        changes.set(succId, toDraftChange(newStart, newEnd, succDates.durationDays));
        if (!pushedIds.includes(succId)) pushedIds.push(succId);
        visits.set(succId, v + 1);
        queue.push(succId);
      }
    }
  }

  return { changes, pushedIds };
}
