import { describe, it, expect } from 'vitest';
import type { GanttTask } from '@/types';
import { buildFlowlineModel, assignSubLanes, orderFloorsPhysically, CANTEIRO_ROW_ID } from './flowline-model';
import { buildForest } from '@/lib/wbs-tree';
import type { DraftChange } from './types';

const D = (s: string) => `${s}T12:00:00.000Z`;

function mkTask(p: Partial<GanttTask> & { id: string; name: string }): GanttTask {
  return {
    code: p.code ?? '1',
    level: 0,
    startDate: D('2025-01-01'),
    endDate: D('2025-01-10'),
    plannedProgress: 0,
    physicalProgress: 0,
    isCriticalPath: false,
    durationDays: 10,
    ...p,
  } as GanttTask;
}

/** Obra → Bloco A → 1º/2º Pavimento → folhas */
function towerTasks(): GanttTask[] {
  return [
    mkTask({ id: 'obra', name: 'Obra Teste', code: '1' }),
    mkTask({ id: 'blocoA', name: 'Bloco A', code: '1.1', parentId: 'obra', level: 1 }),
    mkTask({ id: 'pav1', name: '1º Pavimento', code: '1.1.1', parentId: 'blocoA', level: 2 }),
    mkTask({ id: 'pav2', name: '2º Pavimento', code: '1.1.2', parentId: 'blocoA', level: 2 }),
    mkTask({ id: 'est1', name: 'Estrutura', code: '1.1.1.1', parentId: 'pav1', level: 3, startDate: D('2025-01-01'), endDate: D('2025-01-10'), physicalProgress: 80, activityTypeName: 'Estrutura' }),
    mkTask({ id: 'alv1', name: 'Alvenaria', code: '1.1.1.2', parentId: 'pav1', level: 3, startDate: D('2025-01-11'), endDate: D('2025-01-20'), activityTypeName: 'Alvenaria' }),
    mkTask({ id: 'est2', name: 'Estrutura', code: '1.1.2.1', parentId: 'pav2', level: 3, startDate: D('2025-01-11'), endDate: D('2025-01-20'), activityTypeName: 'Estrutura' }),
  ];
}

describe('buildFlowlineModel', () => {
  it('agrupa por pavimento: grupos acima, uma linha de fluxo por pavimento (níveis superiores no topo)', () => {
    const model = buildFlowlineModel(towerTasks(), new Map(), new Set());

    expect(model.rows.map((r) => `${r.kind}:${r.name}`)).toEqual([
      'group:Obra Teste',
      'group:Bloco A',
      'flow:2º Pavimento',
      'flow:1º Pavimento',
    ]);

    const pav1 = model.rows.find((r) => r.name === '1º Pavimento')!;
    expect(pav1.bars.map((b) => b.taskId).sort()).toEqual(['alv1', 'est1']);
    const pav2 = model.rows.find((r) => r.name === '2º Pavimento')!;
    expect(pav2.bars.map((b) => b.taskId)).toEqual(['est2']);
  });

  it('folhas sem pavimento vão para a faixa Canteiro', () => {
    const tasks = [
      mkTask({ id: 'obra', name: 'Obra' }),
      mkTask({ id: 'terra', name: 'Terraplenagem', parentId: 'obra', level: 1 }),
      mkTask({ id: 'pav1', name: '1º Pavimento', parentId: 'obra', level: 1 }),
      mkTask({ id: 'est1', name: 'Estrutura', parentId: 'pav1', level: 2 }),
    ];
    const model = buildFlowlineModel(tasks, new Map(), new Set());

    const canteiroGroup = model.rows.find((r) => r.id === CANTEIRO_ROW_ID);
    expect(canteiroGroup?.kind).toBe('group');
    const canteiroFlow = model.rows.find((r) => r.id === `${CANTEIRO_ROW_ID}:row`);
    expect(canteiroFlow?.bars.map((b) => b.taskId)).toEqual(['terra']);
  });

  it('barras sobrepostas no mesmo pavimento empilham em sub-faixas', () => {
    const bars = assignSubLanes([
      { taskId: 'a', name: 'A', start: 0, end: 10, durationDays: 1, progress: 0, color: { key: 'k', label: 'K', dark: '#000', light: '#fff' }, pending: false },
      { taskId: 'b', name: 'B', start: 5, end: 15, durationDays: 1, progress: 0, color: { key: 'k', label: 'K', dark: '#000', light: '#fff' }, pending: false },
      { taskId: 'c', name: 'C', start: 10, end: 20, durationDays: 1, progress: 0, color: { key: 'k', label: 'K', dark: '#000', light: '#fff' }, pending: false },
    ]);
    const byId = Object.fromEntries(bars.map((b) => [b.taskId, b.subLane]));
    expect(byId.a).toBe(0);
    expect(byId.b).toBe(1); // sobrepõe A
    expect(byId.c).toBe(0); // encaixa após A na faixa 0
  });

  it('draft sobrepõe as datas originais e marca pending', () => {
    const draft = new Map<string, DraftChange>([
      ['est1', { startDate: D('2025-02-01'), endDate: D('2025-02-10'), durationDays: 10 }],
    ]);
    const model = buildFlowlineModel(towerTasks(), draft, new Set());
    const bar = model.rows.flatMap((r) => r.bars).find((b) => b.taskId === 'est1')!;

    expect(new Date(bar.start).toISOString()).toBe(D('2025-02-01'));
    expect(bar.pending).toBe(true);
    const other = model.rows.flatMap((r) => r.bars).find((b) => b.taskId === 'alv1')!;
    expect(other.pending).toBe(false);
  });

  it('grupo recolhido oculta as linhas descendentes', () => {
    const model = buildFlowlineModel(towerTasks(), new Map(), new Set(['blocoA']));
    expect(model.rows.map((r) => r.name)).toEqual(['Obra Teste', 'Bloco A']);
  });

  it('eixo Y físico: cobertura no topo, subsolos embaixo, térreo entre eles', () => {
    const tasks = [
      mkTask({ id: 'obra', name: 'Obra', code: '1' }),
      // ordem de cadastro proposital: subsolo primeiro, cobertura no meio
      mkTask({ id: 'sub2', name: 'Subsolo 2', code: '1.1', parentId: 'obra', level: 1 }),
      mkTask({ id: 'cob', name: 'Cobertura', code: '1.2', parentId: 'obra', level: 1 }),
      mkTask({ id: 'terreo', name: 'Térreo', code: '1.3', parentId: 'obra', level: 1 }),
      mkTask({ id: 'pav10', name: '10º Pavimento', code: '1.4', parentId: 'obra', level: 1 }),
      mkTask({ id: 'sub1', name: 'Subsolo 1', code: '1.5', parentId: 'obra', level: 1 }),
      mkTask({ id: 'pav2', name: '2º Pavimento', code: '1.6', parentId: 'obra', level: 1 }),
      mkTask({ id: 'a1', name: 'Estrutura', code: '1.1.1', parentId: 'sub2', level: 2 }),
      mkTask({ id: 'a2', name: 'Estrutura', code: '1.2.1', parentId: 'cob', level: 2 }),
      mkTask({ id: 'a3', name: 'Estrutura', code: '1.3.1', parentId: 'terreo', level: 2 }),
      mkTask({ id: 'a4', name: 'Estrutura', code: '1.4.1', parentId: 'pav10', level: 2 }),
      mkTask({ id: 'a5', name: 'Estrutura', code: '1.5.1', parentId: 'sub1', level: 2 }),
      mkTask({ id: 'a6', name: 'Estrutura', code: '1.6.1', parentId: 'pav2', level: 2 }),
    ];
    const model = buildFlowlineModel(tasks, new Map(), new Set());
    expect(model.rows.filter((r) => r.kind === 'flow').map((r) => r.name)).toEqual([
      'Cobertura',
      '10º Pavimento',
      '2º Pavimento',
      'Térreo',
      'Subsolo 1',
      'Subsolo 2',
    ]);
  });

  it('múltiplas torres: cada torre respeita sua própria hierarquia física', () => {
    const tasks = [
      mkTask({ id: 'obra', name: 'Obra', code: '1' }),
      mkTask({ id: 'tA', name: 'Torre A', code: '1.1', parentId: 'obra', level: 1 }),
      mkTask({ id: 'tB', name: 'Torre B', code: '1.2', parentId: 'obra', level: 1 }),
      mkTask({ id: 'a-p1', name: '1º Pavimento', code: '1.1.1', parentId: 'tA', level: 2 }),
      mkTask({ id: 'a-p2', name: '2º Pavimento', code: '1.1.2', parentId: 'tA', level: 2 }),
      mkTask({ id: 'b-sub', name: 'Subsolo 1', code: '1.2.1', parentId: 'tB', level: 2 }),
      mkTask({ id: 'b-cob', name: 'Cobertura', code: '1.2.2', parentId: 'tB', level: 2 }),
      mkTask({ id: 'l1', name: 'Estrutura', code: '1.1.1.1', parentId: 'a-p1', level: 3 }),
      mkTask({ id: 'l2', name: 'Estrutura', code: '1.1.2.1', parentId: 'a-p2', level: 3 }),
      mkTask({ id: 'l3', name: 'Estrutura', code: '1.2.1.1', parentId: 'b-sub', level: 3 }),
      mkTask({ id: 'l4', name: 'Estrutura', code: '1.2.2.1', parentId: 'b-cob', level: 3 }),
    ];
    const model = buildFlowlineModel(tasks, new Map(), new Set());
    expect(model.rows.map((r) => r.name)).toEqual([
      'Obra',
      'Torre A', '2º Pavimento', '1º Pavimento',
      'Torre B', 'Cobertura', 'Subsolo 1',
    ]);
  });

  it('orderFloorsPhysically preserva posições de nós que não são pavimento', () => {
    const tasks = [
      mkTask({ id: 'obra', name: 'Obra', code: '1' }),
      mkTask({ id: 'prelim', name: 'Serviços Preliminares', code: '1.1', parentId: 'obra', level: 1 }),
      mkTask({ id: 'p1', name: '1º Pavimento', code: '1.2', parentId: 'obra', level: 1 }),
      mkTask({ id: 'p3', name: '3º Pavimento', code: '1.3', parentId: 'obra', level: 1 }),
      mkTask({ id: 'entrega', name: 'Entrega', code: '1.4', parentId: 'obra', level: 1 }),
    ];
    const forest = buildForest(tasks);
    const ordered = orderFloorsPhysically(forest[0].children);
    expect(ordered.map((n) => n.task.id)).toEqual(['prelim', 'p3', 'p1', 'entrega']);
  });

  it('cores por grupo: estrutura e alvenaria recebem grupos distintos', () => {
    const model = buildFlowlineModel(towerTasks(), new Map(), new Set());
    const bars = model.rows.flatMap((r) => r.bars);
    const est = bars.find((b) => b.taskId === 'est1')!;
    const alv = bars.find((b) => b.taskId === 'alv1')!;
    expect(est.color.key).toBe('estrutura');
    expect(alv.color.key).toBe('alvenaria');
    expect(est.color.dark).not.toBe(alv.color.dark);
    expect(model.groups.length).toBeGreaterThanOrEqual(2);
  });
});
