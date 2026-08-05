import * as xlsx from 'xlsx';
import type { GanttTask } from '@/types';
import { formatDepsAsText, formatSuccessorsText } from '@/lib/schedule-deps';

/**
 * Exportação do cronograma em Excel (.xlsx).
 *
 * Isolado da página para ser testável sem montar o componente. Respeita as
 * colunas visíveis escolhidas pelo usuário e preserva a hierarquia da EAP
 * indentando o nome da atividade pelo nível.
 */

export interface ExportColumn {
  key: string;
  label: string;
}

/** Duas espaças por nível — legível no Excel sem depender de agrupamento. */
const INDENT = '  ';

function cellValue(task: GanttTask, key: string, tasks: GanttTask[]): string | number {
  switch (key) {
    case 'rowId':
      return task.rowId ?? '';
    case 'code':
      return task.code;
    case 'name':
      return INDENT.repeat(Math.max(0, task.level)) + task.name;
    case 'duration':
      return task.durationDays ?? '';
    case 'startDate':
      return task.startDate.slice(0, 10);
    case 'endDate':
      return task.endDate.slice(0, 10);
    case 'progress':
      return Number(task.physicalProgress ?? 0);
    case 'weight':
      return Number(task.weight ?? 0);
    case 'responsible':
      return task.responsible ?? '';
    case 'predecessors':
      return formatDepsAsText(task, tasks);
    case 'successors':
      return formatSuccessorsText(task, tasks);
    case 'critical':
      return task.isCriticalPath ? 'Sim' : 'Não';
    default:
      return '';
  }
}

/**
 * Monta a planilha. `columns` já vem filtrada e ordenada pela tela — a ordem
 * das colunas no arquivo espelha a ordem na tabela.
 */
export function buildScheduleWorkbook(tasks: GanttTask[], columns: ExportColumn[]): xlsx.WorkBook {
  const header = columns.map(c => c.label);
  const rows = tasks.map(task => columns.map(c => cellValue(task, c.key, tasks)));

  const ws = xlsx.utils.aoa_to_sheet([header, ...rows]);

  // Largura por conteúdo, com piso e teto para não gerar colunas ilegíveis.
  ws['!cols'] = columns.map((c, i) => {
    const longest = rows.reduce(
      (max, r) => Math.max(max, String(r[i] ?? '').length),
      c.label.length,
    );
    return { wch: Math.min(60, Math.max(8, longest + 2)) };
  });

  // Congela o cabeçalho.
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Cronograma');
  return wb;
}

/** `cronograma-<projeto>-<AAAA-MM-DD>.xlsx`, com o nome do projeto higienizado. */
export function scheduleExportFilename(projectName: string, today = new Date()): string {
  const slug = projectName
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'projeto';
  const date = today.toISOString().slice(0, 10);
  return `cronograma-${slug}-${date}.xlsx`;
}
