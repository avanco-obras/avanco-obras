import { describe, it, expect } from 'vitest';
import type { GanttTask } from '@/types';
import { buildFlowlineModel } from './flowline-model';
import { computeRowLayout } from './lob-canvas';
import { applyMove } from './cascade-scheduler';

/**
 * Guarda de performance: a derivação do modelo flowline é o caminho quente
 * (roda a cada alteração do draft). Com 10.000 atividades deve permanecer
 * bem abaixo de um frame budget generoso.
 */

const DAY = 86_400_000;
const T0 = new Date('2025-01-01T12:00:00Z').getTime();

function syntheticProject(nBlocks: number, nFloors: number, nActs: number): GanttTask[] {
  const tasks: GanttTask[] = [];
  const mk = (p: Partial<GanttTask> & { id: string; name: string }): GanttTask => ({
    code: p.id, level: 0, startDate: new Date(T0).toISOString(), endDate: new Date(T0 + 10 * DAY).toISOString(),
    plannedProgress: 0, physicalProgress: 50, isCriticalPath: false, durationDays: 10, ...p,
  } as GanttTask);

  tasks.push(mk({ id: 'root', name: 'Obra Sintética' }));
  const groups = ['Estrutura', 'Alvenaria', 'Elétrica', 'Hidráulica', 'Pintura'];
  for (let b = 0; b < nBlocks; b++) {
    const bid = `b${b}`;
    tasks.push(mk({ id: bid, name: `Bloco ${b}`, parentId: 'root', level: 1 }));
    for (let f = 0; f < nFloors; f++) {
      const fid = `${bid}-f${f}`;
      tasks.push(mk({ id: fid, name: `${f}º Pavimento`, parentId: bid, level: 2 }));
      for (let a = 0; a < nActs; a++) {
        const start = T0 + (f * nActs + a) * 5 * DAY;
        tasks.push(mk({
          id: `${fid}-a${a}`,
          name: groups[a % groups.length],
          parentId: fid,
          level: 3,
          startDate: new Date(start).toISOString(),
          endDate: new Date(start + 8 * DAY).toISOString(),
          activityTypeName: groups[a % groups.length],
          activityTypeId: `at-${a % groups.length}`,
          successorDeps: a < nActs - 1
            ? [{ id: `d-${fid}-${a}`, predecessorId: `${fid}-a${a}`, successorId: `${fid}-a${a + 1}`, lagDays: 0, type: 'FS' }]
            : [],
        }));
      }
    }
  }
  return tasks;
}

describe('performance (10k atividades)', () => {
  // 4 blocos × 25 pavimentos × 100 atividades = 10.000 folhas (+105 nós de estrutura)
  const tasks = syntheticProject(4, 25, 100);

  it('buildFlowlineModel + layout < 500ms', () => {
    const t0 = performance.now();
    const model = buildFlowlineModel(tasks, new Map(), new Set());
    const layout = computeRowLayout(model);
    const elapsed = performance.now() - t0;

    const totalBars = model.rows.reduce((s, r) => s + r.bars.length, 0);
    expect(totalBars).toBe(10_000);
    expect(layout.entries.length).toBeGreaterThan(100);
    expect(elapsed).toBeLessThan(500);
  });

  it('cascata numa cadeia de 100 sucessoras < 100ms', () => {
    const t0 = performance.now();
    const { changes } = applyMove(tasks, new Map(), 'b0-f0-a0', T0 + 100 * DAY, T0 + 108 * DAY, 8);
    const elapsed = performance.now() - t0;

    expect(changes.size).toBeGreaterThan(50); // empurrou a cadeia do pavimento
    expect(elapsed).toBeLessThan(100);
  });
});
