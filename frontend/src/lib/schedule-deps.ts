import type { GanttTask } from '@/types';

/**
 * Formatação textual das dependências do cronograma.
 *
 * Extraído de pages/Cronograma.tsx para ser reutilizado pela exportação em
 * Excel — a planilha precisa exibir predecessoras e sucessoras exatamente
 * como a tabela da tela mostra.
 */

/** Tipos de vínculo: PT (usado na UI) ↔ DB. */
export const DEP_TYPE_PT_TO_DB: Record<string, string> = { TI: 'FS', II: 'SS', TT: 'FF', IT: 'SF' };
export const DEP_TYPE_DB_TO_PT: Record<string, string> = { FS: 'TI', SS: 'II', FF: 'TT', SF: 'IT' };

/**
 * Predecessoras no formato `<rowId><tipo><defasagem>`, separadas por `;`.
 * O tipo TI sem defasagem é omitido por ser o padrão (ex.: `12` em vez de `12TI`).
 */
export function formatDepsAsText(task: GanttTask, tasks: GanttTask[]): string {
  if (!task.predecessorDeps?.length) return '';
  return task.predecessorDeps.map(dep => {
    const pred = tasks.find(t => t.id === dep.predecessorId);
    const rowId = pred?.rowId ?? '?';
    const type = DEP_TYPE_DB_TO_PT[dep.type] ?? dep.type;
    const lag = dep.lagDays > 0 ? `+${dep.lagDays}` : dep.lagDays < 0 ? `${dep.lagDays}` : '';
    return type === 'TI' && lag === '' ? `${rowId}` : `${rowId}${type}${lag}`;
  }).join(';');
}

/** Sucessoras — só os rowIds, separados por `;`. */
export function formatSuccessorsText(task: GanttTask, tasks: GanttTask[]): string {
  if (!task.successorDeps?.length) return '';
  return task.successorDeps.map(dep => {
    const succ = tasks.find(t => t.id === dep.successorId);
    return succ?.rowId ?? '?';
  }).join(';');
}
