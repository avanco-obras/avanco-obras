import type { GanttTask } from '@/types';
import { normKey } from '@/lib/wbs-tree';

/**
 * Atividades "equivalentes" (Linha de Balanço — alteração em massa):
 * folhas com o MESMO nome normalizado e MESMO grupo (activityTypeId),
 * em outros locais (ex.: "Alvenaria" nos pavimentos 2, 3, 4 e 5).
 */
export function findEquivalents(task: GanttTask, tasks: GanttTask[]): GanttTask[] {
  const key = normKey(task.name);
  const leafIds = new Set(tasks.filter((t) => !t.hasChildren).map((t) => t.id));
  return tasks.filter(
    (t) =>
      t.id !== task.id &&
      leafIds.has(t.id) &&
      normKey(t.name) === key &&
      (t.activityTypeId ?? null) === (task.activityTypeId ?? null),
  );
}
