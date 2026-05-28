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

export const LEGEND_ITEMS = [
  { color: '#94A3B8', label: 'Não iniciado' },
  { color: '#DC2626', label: 'Atrasado / Baixo' },
  { color: '#D97706', label: 'Em andamento' },
  { color: '#FBBF24', label: 'Avançado' },
  { color: '#16A34A', label: 'Concluído' },
];
