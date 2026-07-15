import { describe, it, expect } from 'vitest';
import type { GanttTask } from '@/types';
import { findEquivalents } from './equivalence';

function mkTask(p: Partial<GanttTask> & { id: string; name: string }): GanttTask {
  return {
    code: p.id,
    level: 0,
    startDate: '2025-01-01T12:00:00Z',
    endDate: '2025-01-10T12:00:00Z',
    plannedProgress: 0,
    physicalProgress: 0,
    isCriticalPath: false,
    durationDays: 10,
    hasChildren: false,
    ...p,
  } as GanttTask;
}

describe('findEquivalents', () => {
  const tasks = [
    mkTask({ id: 'alv2', name: 'Alvenaria', activityTypeId: 'at-alv' }),
    mkTask({ id: 'alv3', name: 'Alvenaria', activityTypeId: 'at-alv' }),
    mkTask({ id: 'alv4', name: 'ALVENARIA ', activityTypeId: 'at-alv' }), // caixa/espaço ≠
    mkTask({ id: 'alv5', name: 'Alvenaría', activityTypeId: 'at-alv' }), // acento ≠
    mkTask({ id: 'est2', name: 'Estrutura', activityTypeId: 'at-est' }),
    mkTask({ id: 'alvOther', name: 'Alvenaria', activityTypeId: 'at-other' }), // grupo ≠
    mkTask({ id: 'pav', name: 'Alvenaria', activityTypeId: 'at-alv', hasChildren: true }), // não é folha
  ];

  it('encontra folhas com mesmo nome normalizado e mesmo grupo', () => {
    const result = findEquivalents(tasks[0], tasks);
    expect(result.map((t) => t.id).sort()).toEqual(['alv3', 'alv4', 'alv5']);
  });

  it('exclui a própria atividade', () => {
    const result = findEquivalents(tasks[0], tasks);
    expect(result.some((t) => t.id === 'alv2')).toBe(false);
  });

  it('exclui grupos diferentes e não-folhas', () => {
    const result = findEquivalents(tasks[0], tasks);
    expect(result.some((t) => t.id === 'alvOther')).toBe(false);
    expect(result.some((t) => t.id === 'pav')).toBe(false);
  });

  it('nomes diferentes não são equivalentes', () => {
    const result = findEquivalents(tasks[4], tasks);
    expect(result).toEqual([]);
  });
});
