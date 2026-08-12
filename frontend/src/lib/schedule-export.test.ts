import { describe, it, expect } from 'vitest';
import * as xlsx from 'xlsx';
import { buildScheduleWorkbook, scheduleExportFilename, type ExportColumn } from './schedule-export';
import type { GanttTask } from '@/types';

function task(over: Partial<GanttTask> & Pick<GanttTask, 'id' | 'code' | 'name' | 'level'>): GanttTask {
  return {
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-01-31T00:00:00.000Z',
    plannedProgress: 0,
    physicalProgress: 0,
    isCriticalPath: false,
    ...over,
  } as GanttTask;
}

const TASKS: GanttTask[] = [
  task({ id: 'a', rowId: 1, code: '1', name: 'OBRA', level: 0, physicalProgress: 30, durationDays: 365 }),
  task({ id: 'b', rowId: 2, code: '1.1', name: 'ESTRUTURA', level: 1, physicalProgress: 50, durationDays: 180, isCriticalPath: true }),
  task({
    id: 'c', rowId: 3, code: '1.1.1', name: 'Fundação', level: 2, physicalProgress: 100, durationDays: 60,
    predecessorDeps: [{ id: 'd1', predecessorId: 'b', successorId: 'c', lagDays: 0, type: 'FS' }],
  }),
];

/** Lê a planilha de volta como matriz, para verificar o conteúdo real. */
function sheetRows(wb: xlsx.WorkBook): unknown[][] {
  const ws = wb.Sheets[wb.SheetNames[0]];
  return xlsx.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
}

const ALL_COLS: ExportColumn[] = [
  { key: 'rowId', label: 'ID' },
  { key: 'code', label: 'Código WBS' },
  { key: 'name', label: 'Atividade' },
  { key: 'progress', label: '% Avanço Físico' },
  { key: 'critical', label: 'C. Crítico' },
];

describe('buildScheduleWorkbook', () => {
  it('usa a aba Cronograma', () => {
    const wb = buildScheduleWorkbook(TASKS, ALL_COLS);
    expect(wb.SheetNames).toEqual(['Cronograma']);
  });

  it('escreve o cabeçalho a partir dos rótulos das colunas', () => {
    const rows = sheetRows(buildScheduleWorkbook(TASKS, ALL_COLS));
    expect(rows[0]).toEqual(['ID', 'Código WBS', 'Atividade', '% Avanço Físico', 'C. Crítico']);
  });

  it('exporta apenas as colunas visíveis, na ordem recebida', () => {
    const cols: ExportColumn[] = [
      { key: 'name', label: 'Atividade' },
      { key: 'code', label: 'Código WBS' },
    ];
    const rows = sheetRows(buildScheduleWorkbook(TASKS, cols));
    expect(rows[0]).toEqual(['Atividade', 'Código WBS']);
    // '% Avanço Físico' foi omitido
    expect(rows[0]).toHaveLength(2);
    expect(rows[1]).toEqual(['OBRA', '1']);
  });

  it('preserva a hierarquia indentando o nome pelo nível', () => {
    const rows = sheetRows(buildScheduleWorkbook(TASKS, [{ key: 'name', label: 'Atividade' }]));
    expect(rows[1][0]).toBe('OBRA');          // nível 0
    expect(rows[2][0]).toBe('  ESTRUTURA');   // nível 1
    expect(rows[3][0]).toBe('    Fundação');  // nível 2
  });

  it('escreve o avanço como número, não texto', () => {
    const rows = sheetRows(buildScheduleWorkbook(TASKS, [{ key: 'progress', label: '%' }]));
    expect(rows[1][0]).toBe(30);
    expect(typeof rows[1][0]).toBe('number');
  });

  it('traduz o caminho crítico para Sim/Não', () => {
    const rows = sheetRows(buildScheduleWorkbook(TASKS, [{ key: 'critical', label: 'C. Crítico' }]));
    expect(rows[1][0]).toBe('Não');
    expect(rows[2][0]).toBe('Sim');
  });

  it('resolve predecessoras pelo rowId, omitindo TI sem defasagem', () => {
    const rows = sheetRows(buildScheduleWorkbook(TASKS, [{ key: 'predecessors', label: 'Predecessora' }]));
    expect(rows[3][0]).toBe('2');
  });

  it('congela o cabeçalho e define larguras para todas as colunas', () => {
    const wb = buildScheduleWorkbook(TASKS, ALL_COLS);
    const ws = wb.Sheets['Cronograma'];
    expect(ws['!freeze']).toEqual({ xSplit: 0, ySplit: 1 });
    expect(ws['!cols']).toHaveLength(ALL_COLS.length);
  });

  it('gera só o cabeçalho quando não há atividades', () => {
    const rows = sheetRows(buildScheduleWorkbook([], ALL_COLS));
    expect(rows).toHaveLength(1);
  });
});

describe('scheduleExportFilename', () => {
  const date = new Date('2026-07-30T12:00:00.000Z');

  it('monta nome com projeto e data', () => {
    expect(scheduleExportFilename('Residencial Horizonte', date))
      .toBe('cronograma-residencial-horizonte-2026-07-30.xlsx');
  });

  it('remove acentos e caracteres especiais', () => {
    expect(scheduleExportFilename('Edifício Açaí — Torre 1', date))
      .toBe('cronograma-edificio-acai-torre-1-2026-07-30.xlsx');
  });

  it('cai para "projeto" quando o nome não sobra nada utilizável', () => {
    expect(scheduleExportFilename('***', date)).toBe('cronograma-projeto-2026-07-30.xlsx');
  });
});
