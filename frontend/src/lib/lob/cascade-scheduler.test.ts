import { describe, it, expect } from 'vitest';
import type { GanttTask, TaskDep } from '@/types';
import { applyMove } from './cascade-scheduler';
import { DAY_MS, parseScheduleDate } from './types';

// O backend serializa datas como meia-noite UTC; a LDB as lê como dia de
// calendário (meia-noite local) — ver parseScheduleDate.
const D = (s: string) => `${s}T00:00:00.000Z`;
const ms = (s: string) => parseScheduleDate(s);

function dep(predecessorId: string, successorId: string, type = 'FS', lagDays = 0): TaskDep {
  return { id: `${predecessorId}->${successorId}`, predecessorId, successorId, lagDays, type };
}

function mkTask(
  id: string,
  start: string,
  end: string,
  successorDeps: TaskDep[] = [],
): GanttTask {
  return {
    id,
    code: id,
    name: id,
    level: 0,
    startDate: D(start),
    endDate: D(end),
    durationDays: Math.round((ms(end) - ms(start)) / DAY_MS),
    plannedProgress: 0,
    physicalProgress: 0,
    isCriticalPath: false,
    successorDeps,
  } as GanttTask;
}

function dates(changes: Map<string, { startDate: string; endDate: string }>, id: string) {
  const c = changes.get(id)!;
  return { start: parseScheduleDate(c.startDate), end: parseScheduleDate(c.endDate) };
}

describe('applyMove (cascata)', () => {
  it('FS: empurra a sucessora quando o novo término invade o início dela', () => {
    const tasks = [
      mkTask('A', '2025-01-01', '2025-01-10', [dep('A', 'B')]),
      mkTask('B', '2025-01-10', '2025-01-20'),
    ];
    // A +5 dias: termina 15/01 → B (início 10/01) violada → empurra 5 dias
    const { changes, pushedIds } = applyMove(tasks, new Map(), 'A', ms('2025-01-06'), ms('2025-01-15'), 9);

    expect(pushedIds).toEqual(['B']);
    const b = dates(changes, 'B');
    expect(b.start).toBe(ms('2025-01-15'));
    expect(b.end).toBe(ms('2025-01-25')); // duração preservada (10 dias)
  });

  it('FS com lag: respeita o lag em dias', () => {
    const tasks = [
      mkTask('A', '2025-01-01', '2025-01-10', [dep('A', 'B', 'FS', 2)]),
      mkTask('B', '2025-01-12', '2025-01-20'),
    ];
    // A +1 dia: end 11/01; required B.start = 11/01 + 2 = 13/01 > 12/01 → empurra 1 dia
    const { changes } = applyMove(tasks, new Map(), 'A', ms('2025-01-02'), ms('2025-01-11'), 9);

    expect(dates(changes, 'B').start).toBe(ms('2025-01-13'));
  });

  it('SS: sucessora não pode começar antes do início da predecessora + lag', () => {
    const tasks = [
      mkTask('A', '2025-01-01', '2025-01-10', [dep('A', 'B', 'SS', 3)]),
      mkTask('B', '2025-01-02', '2025-01-08'),
    ];
    // A move p/ 05/01: required B.start = 05 + 3 = 08/01 → empurra 6 dias
    const { changes } = applyMove(tasks, new Map(), 'A', ms('2025-01-05'), ms('2025-01-14'), 9);

    const b = dates(changes, 'B');
    expect(b.start).toBe(ms('2025-01-08'));
    expect(b.end).toBe(ms('2025-01-14')); // duração preservada (6 dias)
  });

  it('FF: sucessora não pode terminar antes do término da predecessora + lag', () => {
    const tasks = [
      mkTask('A', '2025-01-01', '2025-01-10', [dep('A', 'B', 'FF', 0)]),
      mkTask('B', '2025-01-01', '2025-01-08'),
    ];
    // A move p/ terminar 15/01: required B.end = 15/01 → empurra 7 dias
    const { changes } = applyMove(tasks, new Map(), 'A', ms('2025-01-06'), ms('2025-01-15'), 9);

    expect(dates(changes, 'B').end).toBe(ms('2025-01-15'));
  });

  it('cadeia A→B→C: empurra em cascata', () => {
    const tasks = [
      mkTask('A', '2025-01-01', '2025-01-10', [dep('A', 'B')]),
      mkTask('B', '2025-01-10', '2025-01-20', [dep('B', 'C')]),
      mkTask('C', '2025-01-20', '2025-01-30'),
    ];
    const { changes, pushedIds } = applyMove(tasks, new Map(), 'A', ms('2025-01-06'), ms('2025-01-15'), 9);

    expect(pushedIds).toEqual(['B', 'C']);
    expect(dates(changes, 'B').start).toBe(ms('2025-01-15'));
    expect(dates(changes, 'C').start).toBe(ms('2025-01-25'));
  });

  it('mover para trás não puxa sucessoras', () => {
    const tasks = [
      mkTask('A', '2025-01-06', '2025-01-15', [dep('A', 'B')]),
      mkTask('B', '2025-01-15', '2025-01-25'),
    ];
    const { changes, pushedIds } = applyMove(tasks, new Map(), 'A', ms('2025-01-01'), ms('2025-01-10'), 9);

    expect(pushedIds).toEqual([]);
    expect(changes.has('B')).toBe(false);
    expect(changes.has('A')).toBe(true);
  });

  it('ciclo A→B→A: termina sem loop infinito', () => {
    const tasks = [
      mkTask('A', '2025-01-01', '2025-01-10', [dep('A', 'B')]),
      mkTask('B', '2025-01-10', '2025-01-20', [dep('B', 'A')]),
    ];
    const { changes } = applyMove(tasks, new Map(), 'A', ms('2025-01-06'), ms('2025-01-15'), 9);

    expect(changes.size).toBeGreaterThanOrEqual(2); // A + B (ciclo cortado)
  });

  it('considera o draft existente como ponto de partida da sucessora', () => {
    const tasks = [
      mkTask('A', '2025-01-01', '2025-01-10', [dep('A', 'B')]),
      mkTask('B', '2025-01-10', '2025-01-20'),
    ];
    // B já foi empurrada para 18/01 no draft — mover A até 15/01 NÃO viola mais.
    const draft = new Map([
      ['B', { startDate: D('2025-01-18'), endDate: D('2025-01-28'), durationDays: 10 }],
    ]);
    const { changes, pushedIds } = applyMove(tasks, draft, 'A', ms('2025-01-06'), ms('2025-01-15'), 9);

    expect(pushedIds).toEqual([]);
    expect(changes.has('B')).toBe(false);
  });
});
