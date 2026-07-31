import type { GanttTask } from '@/types';
import { buildForest, childrenMap, FLOOR_PATTERN, inferFloorLevel, type WbsNode } from '@/lib/wbs-tree';
import { groupColor, type GroupColor } from './group-colors';
import { effectiveDates, type DraftMap } from './types';

/**
 * Modelo da visão flowline (Linha de Balanço, layout compacto):
 * - Nós acima dos pavimentos (obra, blocos/torres) viram linhas de grupo.
 * - Cada pavimento vira UMA linha de fluxo; todas as atividades-folha
 *   descendentes viram barras nessa linha, lado a lado no tempo.
 * - Sobreposições temporais empilham em sub-faixas (interval partitioning) —
 *   atividades nunca se fundem.
 * - Folhas sem ancestral de pavimento vão para a faixa "Canteiro".
 */

export const CANTEIRO_ROW_ID = '__canteiro__';

/**
 * Chave da atividade para o filtro: o tipo de atividade quando existir
 * (Pintura, Alvenaria…), senão o próprio nome. É a mesma base usada para a cor,
 * então filtrar por "Pintura" pega todas as barras de pintura da obra.
 */
export function activityKey(task: GanttTask): string {
  return (task.activityTypeName ?? task.name ?? '').trim() || 'Outros';
}

export interface ActivityOption {
  key: string;
  count: number;    // nº de atividades-folha com essa chave
  color: GroupColor;
}

/** Catálogo de atividades do cronograma (folhas), para o filtro da toolbar. */
export function listActivities(tasks: GanttTask[]): ActivityOption[] {
  const cmap = childrenMap(tasks);
  const byKey = new Map<string, ActivityOption>();
  for (const t of tasks) {
    if ((cmap.get(t.id)?.length ?? 0) > 0) continue; // só folhas viram barras
    const key = activityKey(t);
    const cur = byKey.get(key);
    if (cur) cur.count++;
    else byKey.set(key, { key, count: 1, color: groupColor(key) });
  }
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key, 'pt-BR'));
}

export interface FlowBar {
  taskId: string;
  name: string;
  start: number; // ms epoch (draft-aware)
  end: number;   // ms epoch (draft-aware)
  durationDays: number;
  progress: number; // physicalProgress 0-100
  color: GroupColor;
  subLane: number;  // 0-based dentro da linha
  pending: boolean; // tem alteração no draft
}

export interface FlowRow {
  kind: 'group' | 'flow';
  id: string;      // taskId do nó (ou CANTEIRO_ROW_ID)
  name: string;
  depth: number;   // nível de indentação visual
  bars: FlowBar[]; // vazio para kind='group'
  laneCount: number; // nº de sub-faixas (>=1) — define a altura da linha
  collapsible: boolean;
}

export interface FlowlineModel {
  rows: FlowRow[];      // apenas linhas visíveis (respeita collapsed)
  minDate: number;      // ms — início da janela de dados
  maxDate: number;      // ms — fim da janela de dados
  groups: GroupColor[]; // grupos presentes (para a legenda), ordenados por uso
}

/** Interval partitioning: atribui sub-faixa a cada barra (greedy por início). */
export function assignSubLanes(bars: Omit<FlowBar, 'subLane'>[]): FlowBar[] {
  const sorted = [...bars].sort((a, b) => a.start - b.start || a.end - b.end);
  const laneEnds: number[] = [];
  return sorted.map((bar) => {
    let lane = laneEnds.findIndex((end) => end <= bar.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(bar.end);
    } else {
      laneEnds[lane] = bar.end;
    }
    return { ...bar, subLane: lane };
  });
}

function collectLeaves(node: WbsNode, out: GanttTask[]): void {
  if (node.isLeaf) out.push(node.task);
  else node.children.forEach((c) => collectLeaves(c, out));
}

/**
 * Reordena os filhos-pavimento por elevação física DECRESCENTE (cobertura no
 * topo, subsolos embaixo), espelhando o empilhamento da visualização 3D da
 * Medição. Nós que não são pavimento mantêm suas posições originais — apenas
 * os pavimentos são permutados entre si (por torre/bloco, já que a ordenação
 * acontece entre irmãos).
 */
export function orderFloorsPhysically(children: WbsNode[]): WbsNode[] {
  const floorIdx: number[] = [];
  children.forEach((c, i) => {
    if (FLOOR_PATTERN.test(c.task.name)) floorIdx.push(i);
  });
  if (floorIdx.length < 2) return children;
  const sorted = floorIdx
    .map((i) => ({ node: children[i], i, level: inferFloorLevel(children[i].task.name) }))
    .sort((a, b) => b.level - a.level || a.i - b.i); // desc; empate = ordem original
  const out = [...children];
  floorIdx.forEach((pos, k) => { out[pos] = sorted[k].node; });
  return out;
}

function makeBar(task: GanttTask, draft: DraftMap): Omit<FlowBar, 'subLane'> {
  const { start, end, durationDays } = effectiveDates(task, draft);
  return {
    taskId: task.id,
    name: task.name,
    start,
    end,
    durationDays,
    progress: task.physicalProgress ?? 0,
    color: groupColor(activityKey(task)),
    pending: draft.has(task.id),
  };
}

/**
 * Monta o modelo flowline a partir do cronograma + draft.
 * `collapsed` contém IDs de linhas de grupo recolhidas (filhos ocultos).
 * `activityFilter` (opcional) restringe as barras às chaves selecionadas — as
 * linhas de local continuam visíveis, preservando o eixo Y da obra.
 */
export function buildFlowlineModel(
  tasks: GanttTask[],
  draft: DraftMap,
  collapsed: Set<string>,
  activityFilter?: ReadonlySet<string> | null,
): FlowlineModel {
  const forest = buildForest(tasks);
  const rows: FlowRow[] = [];
  const canteiroLeaves: GanttTask[] = [];
  const groupUse = new Map<string, { color: GroupColor; count: number }>();
  const filtering = !!activityFilter;
  const isVisible = (t: GanttTask) => !filtering || activityFilter!.has(activityKey(t));

  const registerGroups = (bars: FlowBar[]) => {
    for (const b of bars) {
      const cur = groupUse.get(b.color.key);
      if (cur) cur.count++;
      else groupUse.set(b.color.key, { color: b.color, count: 1 });
    }
  };

  const walk = (node: WbsNode, depth: number, hidden: boolean): void => {
    const isFloor = FLOOR_PATTERN.test(node.task.name);

    if (isFloor) {
      // Linha de fluxo: TODAS as folhas descendentes viram barras aqui.
      const leaves: GanttTask[] = [];
      collectLeaves(node, leaves);
      const bars = assignSubLanes(leaves.filter(isVisible).map((t) => makeBar(t, draft)));
      registerGroups(bars);
      if (!hidden) {
        rows.push({
          kind: 'flow',
          id: node.task.id,
          name: node.task.name,
          depth,
          bars,
          laneCount: bars.reduce((m, b) => Math.max(m, b.subLane + 1), 1),
          collapsible: false,
        });
      }
      return;
    }

    if (node.isLeaf) {
      // Folha fora de pavimento → Canteiro.
      canteiroLeaves.push(node.task);
      return;
    }

    // Nó de agrupamento (obra/bloco/torre).
    const isCollapsed = collapsed.has(node.task.id);
    if (!hidden) {
      rows.push({
        kind: 'group',
        id: node.task.id,
        name: node.task.name,
        depth,
        bars: [],
        laneCount: 1,
        collapsible: true,
      });
    }
    orderFloorsPhysically(node.children).forEach((c) => walk(c, depth + 1, hidden || isCollapsed));
  };

  orderFloorsPhysically(forest).forEach((root) => walk(root, 0, false));

  if (canteiroLeaves.length > 0) {
    const bars = assignSubLanes(canteiroLeaves.filter(isVisible).map((t) => makeBar(t, draft)));
    registerGroups(bars);
    const hidden = collapsed.has(CANTEIRO_ROW_ID);
    rows.push({
      kind: 'group',
      id: CANTEIRO_ROW_ID,
      name: 'Canteiro',
      depth: 0,
      bars: [],
      laneCount: 1,
      collapsible: true,
    });
    if (!hidden) {
      rows.push({
        kind: 'flow',
        id: `${CANTEIRO_ROW_ID}:row`,
        name: 'Atividades gerais',
        depth: 1,
        bars,
        laneCount: bars.reduce((m, b) => Math.max(m, b.subLane + 1), 1),
        collapsible: false,
      });
    }
  }

  // Janela de tempo: com filtro ativo acompanha as atividades selecionadas;
  // sem filtro usa TODAS as tasks (linhas recolhidas não encolhem o eixo X).
  let minDate = Infinity;
  let maxDate = -Infinity;
  for (const t of tasks) {
    if (filtering && !isVisible(t)) continue;
    const { start, end } = effectiveDates(t, draft);
    if (start < minDate) minDate = start;
    if (end > maxDate) maxDate = end;
  }
  if (!isFinite(minDate)) { minDate = Date.now(); maxDate = Date.now(); }

  const groups = [...groupUse.values()]
    .sort((a, b) => b.count - a.count)
    .map((g) => g.color);

  return { rows, minDate, maxDate, groups };
}
