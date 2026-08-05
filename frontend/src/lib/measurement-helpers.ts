export type UnitState = 'ni' | 'ea' | 'co';
export type StatusFilter = 'todos' | UnitState;

export function calcFromMetric(executed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((executed / total) * 10000) / 100);
}

export function methodLabel(method: 'PERCENT' | 'METRIC' | 'COUNT'): string {
  if (method === 'PERCENT') return '%';
  if (method === 'METRIC') return 'm²';
  return 'un';
}

/** Cor do heatmap em hex (compatível com three.js MeshStandardMaterial.color) */
export function heatmapColor(pct: number): string {
  if (pct === 0) return '#EBF0F6';
  if (pct <= 30) return '#FEF3C7';
  if (pct <= 60) return '#FCD34D';
  if (pct < 100) return '#86EFAC';
  return '#4ADE80';
}

/** Cor BIM-style mais saturada (para faces 3D) */
export function heatmapColor3D(pct: number): string {
  if (pct === 0) return '#94A3B8';
  if (pct < 30) return '#DC2626';
  if (pct < 70) return '#D97706';
  if (pct < 100) return '#FBBF24';
  return '#16A34A';
}

export function unitState(p: number): UnitState {
  if (p === 0) return 'ni';
  if (p >= 100) return 'co';
  return 'ea';
}

export function statusBadgeClass(p: number): string {
  if (p === 0) return 'ao-badge ao-bk';
  if (p >= 100) return 'ao-badge ao-bg';
  return 'ao-badge ao-ba';
}

export function statusLabel(p: number): string {
  if (p === 0) return 'Não iniciado';
  if (p >= 100) return 'Concluído';
  return 'Em andamento';
}

/**
 * Cores de linha por status para a árvore de atividades:
 * cinza (não iniciado) · amarelo (em andamento) · verde (concluído).
 * Fundo levemente tingido + barra lateral de status, em harmonia com as
 * variáveis de tema (var(--grn-*), var(--amb-*)).
 */
export interface RowStatusStyle {
  bg: string;
  accent: string;
  text: string;
}
export function rowStatusStyle(p: number): RowStatusStyle {
  const s = unitState(p);
  if (s === 'co') return { bg: 'var(--grn-bg)', accent: '#16A34A', text: 'var(--grn-t)' };
  if (s === 'ea') return { bg: 'var(--amb-bg)', accent: '#D97706', text: 'var(--amb-t)' };
  return { bg: 'var(--s1)', accent: '#94A3B8', text: 'var(--t2)' };
}

export const LEGEND_ITEMS = [
  { color: '#94A3B8', label: 'Não iniciado' },
  { color: '#DC2626', label: 'Atrasado / Baixo' },
  { color: '#D97706', label: 'Em andamento' },
  { color: '#FBBF24', label: 'Avançado' },
  { color: '#16A34A', label: 'Concluído' },
];

/** Cores dos status usados em barras segmentadas e bordas de card. */
export const STATUS_COLORS = {
  done: '#16A34A',
  inProgress: '#D97706',
  delayed: '#DC2626',
  notStarted: '#94A3B8',
} as const;

// ── Disciplina (agrupamento das atividades) ────────────────────────────────────
// O cronograma não possui campo de categoria; a disciplina é inferida do nome da
// atividade por palavras-chave, com fallback "Geral". Ordem de exibição fixa.
export const DISCIPLINE_ORDER = ['Estrutura / Civil', 'Instalações', 'Acabamento', 'Geral'] as const;
export type Discipline = (typeof DISCIPLINE_ORDER)[number];

const DISCIPLINE_KEYWORDS: { d: Discipline; re: RegExp }[] = [
  { d: 'Instalações', re: /\b(el[ée]tric|hidr[áa]ulic|hidrossanit|sanit[áa]r|tubula|eletrodut|prumada|esgoto|[áa]gua|g[áa]s|inc[êe]ndio|spda|climatiz|ar[- ]?condicionado|l[óo]gica|cabeament|instala)/i },
  { d: 'Acabamento', re: /\b(acabament|pintura|revestiment|piso|porcelanat|cer[âa]mic|gesso|forro|lou[çc]a|metais|esquadria|vidro|marcenaria|bancada|soleira|rodap[ée]|textura|massa corrida)/i },
  { d: 'Estrutura / Civil', re: /\b(funda|estrutur|concret|alvenaria|laje|pilar|viga|forma|arma[çc][ãa]o|escava|contrapiso|reboco|chapisco|embo[çc]o|cobertura|telhad|impermeabiliz|reservat[óo]rio|movimenta[çc][ãa]o de terra)/i },
];

export function inferDiscipline(name: string): Discipline {
  for (const { d, re } of DISCIPLINE_KEYWORDS) if (re.test(name)) return d;
  return 'Geral';
}
