import { describe, it, expect } from 'vitest';
import type { GanttTask } from '@/types';
import {
  DAY_MS, durationFromRange, effectiveDates, endFromDuration, formatScheduleBR, parseScheduleDate,
  toScheduleDate, type DraftChange,
} from './types';

/** Meia-noite local de um dia de calendário — independente do fuso do runner. */
const localMidnight = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();

describe('parseScheduleDate — sincronia com o Cronograma', () => {
  it('lê a data ISO do backend como dia de calendário, sem deslocar por fuso', () => {
    // O backend grava meia-noite UTC. Em fusos negativos (BRT = UTC-3),
    // new Date(iso) cairia em 04/01 21:00 e a barra apareceria um dia antes.
    expect(parseScheduleDate('2026-01-05T00:00:00.000Z')).toBe(localMidnight(2026, 1, 5));
  });

  it('aceita data pura YYYY-MM-DD (formato gravado pelo draft)', () => {
    expect(parseScheduleDate('2026-01-05')).toBe(localMidnight(2026, 1, 5));
  });

  it('ignora a hora do ISO — o dia de calendário é o que vale', () => {
    expect(parseScheduleDate('2026-01-05T23:59:59.000Z')).toBe(parseScheduleDate('2026-01-05T00:00:00.000Z'));
  });

  it('faz round-trip com toScheduleDate', () => {
    const ms = parseScheduleDate('2026-03-31T00:00:00.000Z');
    expect(toScheduleDate(ms)).toBe('2026-03-31');
    expect(parseScheduleDate(toScheduleDate(ms))).toBe(ms);
  });

  it('formata em pt-BR sem conversão de fuso', () => {
    expect(formatScheduleBR(parseScheduleDate('2026-01-05T00:00:00.000Z'))).toBe('05/01/2026');
  });
});

describe('durationFromRange — dias úteis inclusivos, igual ao Cronograma', () => {
  it('05/01 (seg) → 09/01 (sex) = 5 dias', () => {
    expect(durationFromRange(parseScheduleDate('2026-01-05'), parseScheduleDate('2026-01-09'))).toBe(5);
  });

  it('não conta sábado e domingo: 05/01 (seg) → 12/01 (seg) = 6 dias', () => {
    expect(durationFromRange(parseScheduleDate('2026-01-05'), parseScheduleDate('2026-01-12'))).toBe(6);
  });

  it('reproduz a duração gravada no cronograma real (27/07/2026 → 04/09/2026 = 30)', () => {
    expect(durationFromRange(parseScheduleDate('2026-07-27'), parseScheduleDate('2026-09-04'))).toBe(30);
  });

  it('início igual ao término = 1 dia', () => {
    const d = parseScheduleDate('2026-01-05');
    expect(durationFromRange(d, d)).toBe(1);
  });
});

describe('endFromDuration — inverso de durationFromRange', () => {
  it('05/01 + 5 dias úteis = 09/01', () => {
    expect(endFromDuration(parseScheduleDate('2026-01-05'), 5)).toBe(parseScheduleDate('2026-01-09'));
  });

  it('atravessa o fim de semana: 05/01 + 6 dias úteis = 12/01', () => {
    expect(endFromDuration(parseScheduleDate('2026-01-05'), 6)).toBe(parseScheduleDate('2026-01-12'));
  });

  it('faz round-trip com durationFromRange', () => {
    const start = parseScheduleDate('2026-07-27');
    expect(durationFromRange(start, endFromDuration(start, 30))).toBe(30);
    expect(endFromDuration(start, 30)).toBe(parseScheduleDate('2026-09-04'));
  });
});

describe('effectiveDates', () => {
  const task = {
    id: 't1', code: '1', name: 'Pintura', level: 3,
    startDate: '2026-01-05T00:00:00.000Z',
    endDate: '2026-01-09T00:00:00.000Z',
    durationDays: 5,
    plannedProgress: 0, physicalProgress: 0, isCriticalPath: false,
  } as GanttTask;

  it('usa as datas do cronograma quando não há draft', () => {
    const eff = effectiveDates(task, new Map());
    expect(eff.start).toBe(localMidnight(2026, 1, 5));
    expect(eff.end).toBe(localMidnight(2026, 1, 9));
    expect(eff.durationDays).toBe(5);
  });

  it('deriva a duração em dias úteis quando o item não a traz', () => {
    const { durationDays } = effectiveDates({ ...task, durationDays: undefined }, new Map());
    expect(durationDays).toBe(5); // 05/01 (seg) → 09/01 (sex)
  });

  it('o draft (data pura) sobrepõe sem deslocar o dia', () => {
    const draft = new Map<string, DraftChange>([
      ['t1', { startDate: '2026-02-01', endDate: '2026-02-10', durationDays: 10 }],
    ]);
    const eff = effectiveDates(task, draft);
    expect(eff.start).toBe(localMidnight(2026, 2, 1));
    expect(eff.end - eff.start).toBe(9 * DAY_MS);
  });
});
