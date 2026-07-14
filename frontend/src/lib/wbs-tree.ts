import type { GanttTask } from '@/types';

/**
 * Utilitários para montar e operar a árvore WBS do cronograma na tela de Medição.
 * A fonte de verdade é a mesma do Cronograma (ScheduleItem via ganttData), de modo
 * que ambas as telas leem/escrevem os mesmos itens (sync bidirecional automático).
 */

// Espelha ScheduleService.FLOOR_PATTERN no backend (schedule.service.ts).
export const FLOOR_PATTERN =
  /\b(subsolo|t[ée]rreo|pavimento|pav\.?|andar|cobertura|mezanino|garagem)\b/i;

export interface WbsNode {
  task: GanttTask;
  depth: number;
  children: WbsNode[];
  isLeaf: boolean;
  /** true quando a atividade-folha não tem ancestral de pavimento (vai ao Canteiro). */
  unlocated: boolean;
}

export function childrenMap(tasks: GanttTask[]): Map<string, GanttTask[]> {
  const m = new Map<string, GanttTask[]>();
  for (const t of tasks) {
    const key = t.parentId ?? '__root__';
    const arr = m.get(key);
    if (arr) arr.push(t); else m.set(key, [t]);
  }
  for (const arr of m.values()) arr.sort((a, b) => (a.code ? compareWbs(a.code, b.code) : 0));
  return m;
}

export function compareWbs(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Caminha o parentId acima procurando um ancestral que case o padrão de pavimento. */
export function hasFloorAncestor(task: GanttTask, byId: Map<string, GanttTask>): boolean {
  let cur = task.parentId ? byId.get(task.parentId) : undefined;
  let guard = 0;
  while (cur && guard++ < 50) {
    if (FLOOR_PATTERN.test(cur.name)) return true;
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return false;
}

/** Constrói a floresta WBS (normalmente uma raiz nível 0). */
export function buildForest(tasks: GanttTask[]): WbsNode[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const cmap = childrenMap(tasks);

  const make = (task: GanttTask, depth: number): WbsNode => {
    const kids = cmap.get(task.id) ?? [];
    const isLeaf = kids.length === 0;
    return {
      task,
      depth,
      isLeaf,
      unlocated: isLeaf && !hasFloorAncestor(task, byId) && !FLOOR_PATTERN.test(task.name),
      children: kids.map((k) => make(k, depth + 1)),
    };
  };

  const roots = cmap.get('__root__') ?? [];
  return roots.map((r) => make(r, 0));
}

export interface FlatRow {
  task: GanttTask;
  depth: number;
  isLeaf: boolean;
  unlocated: boolean;
  hasChildren: boolean;
}

/** Achata a floresta em linhas visíveis respeitando o conjunto `expanded`. */
export function flattenVisible(forest: WbsNode[], expanded: Set<string>): FlatRow[] {
  const out: FlatRow[] = [];
  const walk = (node: WbsNode) => {
    out.push({
      task: node.task,
      depth: node.depth,
      isLeaf: node.isLeaf,
      unlocated: node.unlocated,
      hasChildren: node.children.length > 0,
    });
    if (node.children.length > 0 && expanded.has(node.task.id)) {
      node.children.forEach(walk);
    }
  };
  forest.forEach(walk);
  return out;
}

/** Indexa todos os nós da floresta por task.id (para navegação drill-down). */
export function indexNodes(forest: WbsNode[]): Map<string, WbsNode> {
  const m = new Map<string, WbsNode>();
  const walk = (n: WbsNode) => { m.set(n.task.id, n); n.children.forEach(walk); };
  forest.forEach(walk);
  return m;
}

/** IDs de todos os nós com filhos (para expandir/recolher tudo). */
export function allParentIds(tasks: GanttTask[]): string[] {
  const parents = new Set<string>();
  for (const t of tasks) if (t.parentId) parents.add(t.parentId);
  return [...parents];
}

/** IDs do caminho da raiz até o nó (exclui o próprio), para auto-expandir. */
export function ancestorIds(taskId: string, byId: Map<string, GanttTask>): string[] {
  const ids: string[] = [];
  let cur = byId.get(taskId);
  let guard = 0;
  while (cur?.parentId && guard++ < 50) {
    ids.push(cur.parentId);
    cur = byId.get(cur.parentId);
  }
  return ids;
}

// ── Rollup de progresso (espelha recalculateParentProgress do Cronograma) ──────

function calcParentProgress(children: GanttTask[]): number {
  if (children.length === 0) return 0;
  const totalWeight = children.reduce((s, c) => s + (c.weight || 1), 0);
  if (totalWeight === 0) return 0;
  const weightedSum = children.reduce((s, c) => s + (c.physicalProgress || 0) * (c.weight || 1), 0);
  return Math.round((weightedSum / totalWeight) * 100) / 100;
}

/**
 * Recalcula o physicalProgress de todos os pais em cascata até estabilizar.
 * Retorna nova lista e o conjunto de pais cujo valor mudou (para persistir).
 */
export function recalcParents(tasks: GanttTask[]): { tasks: GanttTask[]; changed: GanttTask[] } {
  const originalById = new Map(tasks.map((t) => [t.id, t.physicalProgress]));
  const parentIds = new Set(tasks.filter((t) => t.parentId).map((t) => t.parentId!));
  let updated = [...tasks];

  for (let iter = 0; iter < 30; iter++) {
    let stable = true;
    updated = updated.map((task) => {
      if (!parentIds.has(task.id)) return task;
      const kids = updated.filter((t) => t.parentId === task.id);
      const np = calcParentProgress(kids);
      if (Math.abs(np - (task.physicalProgress || 0)) > 0.001) {
        stable = false;
        return { ...task, physicalProgress: np };
      }
      return task;
    });
    if (stable) break;
  }

  const changed = updated.filter(
    (t) => parentIds.has(t.id) && Math.abs((originalById.get(t.id) ?? 0) - t.physicalProgress) > 0.001,
  );
  return { tasks: updated, changed };
}

// ── Estatística de status das folhas de uma sub-árvore ─────────────────────────
export interface LeafStats {
  done: number;
  inProgress: number;
  delayed: number;
  notStarted: number;
  total: number;
}

/**
 * Conta as folhas por status: concluída (≥100%), atrasada (abaixo do previsto do
 * baseline), em andamento (iniciada e no ritmo) e não iniciada (0%).
 */
export function leafStats(root: WbsNode): LeafStats {
  const s: LeafStats = { done: 0, inProgress: 0, delayed: 0, notStarted: 0, total: 0 };
  const visit = (n: WbsNode) => {
    if (n.isLeaf) {
      s.total++;
      const phys = n.task.physicalProgress || 0;
      const plan = n.task.plannedProgress || 0;
      if (phys >= 100) s.done++;
      else if (phys + 0.01 < plan) s.delayed++;
      else if (phys > 0) s.inProgress++;
      else s.notStarted++;
    } else {
      n.children.forEach(visit);
    }
  };
  visit(root);
  return s;
}

/** Progresso agregado (ponderado por peso) de uma sub-árvore a partir das folhas. */
export function subtreeProgress(root: WbsNode): number {
  const leaves: GanttTask[] = [];
  const collect = (n: WbsNode) => {
    if (n.isLeaf) leaves.push(n.task);
    else n.children.forEach(collect);
  };
  collect(root);
  if (leaves.length === 0) return root.task.physicalProgress || 0;
  const tw = leaves.reduce((s, l) => s + (l.weight || 1), 0);
  if (tw === 0) return 0;
  return Math.round((leaves.reduce((s, l) => s + (l.physicalProgress || 0) * (l.weight || 1), 0) / tw) * 100) / 100;
}
