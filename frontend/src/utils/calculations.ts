// Calculate physical progress using weighted average
export function calcWeightedProgress(items: { weight: number; progress: number }[]): number {
  const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
  if (totalWeight === 0) return 0;
  const weighted = items.reduce((sum, i) => sum + i.weight * i.progress, 0);
  return Math.round((weighted / totalWeight) * 100) / 100;
}

// Calculate SPI
export function calcSPI(actual: number, planned: number): number {
  if (planned === 0) return 1;
  return Math.round((actual / planned) * 100) / 100;
}

// Calculate PPC
export function calcPPC(tasks: { status: string }[]): number {
  if (tasks.length === 0) return 0;
  const completed = tasks.filter(t => t.status === 'COMPLETED').length;
  const partial = tasks.filter(t => t.status === 'PARTIALLY').length;
  return Math.round(((completed + partial * 0.5) / tasks.length) * 100 * 100) / 100;
}

// Calculate progress from metric measurement
export function calcProgressFromMetric(executed: number, total: number): number {
  if (total === 0) return 0;
  return Math.min(100, Math.round((executed / total) * 100 * 100) / 100);
}

// Format currency BRL
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// Format number with comma decimal (Brazilian)
export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}

// Format date to dd/MM/yyyy
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR');
}

// Get ISO week number
export function getWeekNumber(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}

// Get SPI status color
export function getSPIColor(spi: number): string {
  if (spi >= 1) return '#22c55e';
  if (spi >= 0.85) return '#f59e0b';
  return '#ef4444';
}

// Get PPC status color
export function getPPCColor(ppc: number): string {
  if (ppc >= 80) return '#22c55e';
  if (ppc >= 70) return '#f59e0b';
  return '#ef4444';
}

// Get progress color
export function getProgressColor(progress: number): string {
  if (progress === 0) return '#94a3b8';
  if (progress >= 100) return '#22c55e';
  if (progress >= 50) return '#3b82f6';
  return '#f59e0b';
}
