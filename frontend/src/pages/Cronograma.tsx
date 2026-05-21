import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Undo2, Redo2 } from 'lucide-react';
import { useStore } from '@/store';
import { scheduleApi, baselineApi, progressApi } from '@/services/api';
import { useHistoryStore } from '@/store/historyStore';
import * as xlsx from 'xlsx';
import type { GanttTask, ScheduleDependencyItem, ProjectMetrics, ProjectReport, ReportComparison } from '@/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const ROW_H = 28;
const HDR_H = 56;
const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const DAYS_PT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

type TimeScale = 'day' | 'week' | 'month' | 'quarter' | 'semester' | 'year';
const SCALE_ORDER: TimeScale[] = ['day', 'week', 'month', 'quarter', 'semester', 'year'];
const SCALE_LABELS: Record<TimeScale, string> = {
  day: 'Dias',
  week: 'Semanas',
  month: 'Meses',
  quarter: 'Trimestres',
  semester: 'Semestres',
  year: 'Anos',
};
const PX_PER_DAY_BY_SCALE: Record<TimeScale, number> = {
  day: 40,
  week: 14,
  month: 4,
  quarter: 1.4,
  semester: 0.7,
  year: 0.3,
};

// ── Column definitions ────────────────────────────────────────────────────────
interface ColDef {
  key: string;
  label: string;
  width: number;
  fixed: boolean;
}
const COL_DEFS: ColDef[] = [
  { key: 'rowId', label: 'ID', width: 44, fixed: true },
  { key: 'code', label: 'Código WBS', width: 80, fixed: false },
  { key: 'name', label: 'Atividade', width: 220, fixed: true },
  { key: 'duration', label: 'Duração', width: 72, fixed: false },
  { key: 'startDate', label: 'Início', width: 86, fixed: false },
  { key: 'endDate', label: 'Término', width: 86, fixed: false },
  { key: 'progress', label: '% Real', width: 62, fixed: false },
  { key: 'weight', label: 'Peso', width: 70, fixed: false },
  { key: 'responsible', label: 'Responsável', width: 120, fixed: false },
  { key: 'predecessors', label: 'Predecessora', width: 90, fixed: false },
  { key: 'successors', label: 'Sucessora', width: 90, fixed: false },
  { key: 'critical', label: 'C. Crítico', width: 72, fixed: false },
];

// ── Mock data ─────────────────────────────────────────────────────────────────

function buildMockTasks(): GanttTask[] {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = (om: number, od = 0) => new Date(y, m + om, 1 + od).toISOString().split('T')[0];
  return [
    { id: '1', code: '1', name: 'OBRA', level: 0, startDate: d(-1), endDate: d(11), plannedProgress: 35, actualProgress: 30, isCriticalPath: false, hasChildren: true, durationDays: 365, weight: 1 },
    { id: '2', code: '1.1', name: 'ESTRUTURA', level: 1, parentId: '1', startDate: d(-1), endDate: d(5), plannedProgress: 60, actualProgress: 50, isCriticalPath: true, hasChildren: true, durationDays: 180, weight: 0.4 },
    { id: '3', code: '1.1.1', name: 'Fundação', level: 2, parentId: '2', startDate: d(-1), endDate: d(1), plannedProgress: 100, actualProgress: 100, isCriticalPath: true, hasChildren: true, durationDays: 60, weight: 0.15 },
    { id: '4', code: '1.1.1.1', name: 'Estacas', level: 3, parentId: '3', startDate: d(-1), endDate: d(0, 15), plannedProgress: 100, actualProgress: 100, isCriticalPath: true, hasChildren: false, durationDays: 45, weight: 0.08 },
    { id: '5', code: '1.1.1.2', name: 'Blocos', level: 3, parentId: '3', startDate: d(0, 10), endDate: d(1), plannedProgress: 100, actualProgress: 95, isCriticalPath: true, hasChildren: true, durationDays: 20, weight: 0.07 },
    { id: '6', code: '1.1.1.2.1', name: 'Bloco tipo A', level: 4, parentId: '5', startDate: d(0, 10), endDate: d(0, 20), plannedProgress: 100, actualProgress: 100, isCriticalPath: false, hasChildren: false, durationDays: 10, weight: 0.03 },
    { id: '7', code: '1.1.2', name: 'Pilares e Lajes', level: 2, parentId: '2', startDate: d(1), endDate: d(5), plannedProgress: 40, actualProgress: 25, isCriticalPath: true, hasChildren: false, durationDays: 120, weight: 0.25 },
    { id: '8', code: '1.2', name: 'ALVENARIA', level: 1, parentId: '1', startDate: d(3), endDate: d(7), plannedProgress: 10, actualProgress: 5, isCriticalPath: false, hasChildren: true, durationDays: 120, weight: 0.3 },
    { id: '9', code: '1.2.1', name: 'Vedação interna', level: 2, parentId: '8', startDate: d(3), endDate: d(6), plannedProgress: 15, actualProgress: 8, isCriticalPath: false, hasChildren: false, durationDays: 90, weight: 0.15 },
    { id: '10', code: '1.2.2', name: 'Vedação externa', level: 2, parentId: '8', startDate: d(5), endDate: d(7), plannedProgress: 0, actualProgress: 0, isCriticalPath: false, hasChildren: false, durationDays: 60, weight: 0.15 },
    { id: '11', code: '1.3', name: 'ACABAMENTO', level: 1, parentId: '1', startDate: d(7), endDate: d(11), plannedProgress: 0, actualProgress: 0, isCriticalPath: false, hasChildren: true, durationDays: 120, weight: 0.3 },
    { id: '12', code: '1.3.1', name: 'Revestimento', level: 2, parentId: '11', startDate: d(7), endDate: d(10), plannedProgress: 0, actualProgress: 0, isCriticalPath: false, hasChildren: false, durationDays: 90, weight: 0.15 },
    { id: '13', code: '1.3.2', name: 'Pintura', level: 2, parentId: '11', startDate: d(9), endDate: d(11), plannedProgress: 0, actualProgress: 0, isCriticalPath: false, hasChildren: false, durationDays: 60, weight: 0.15 },
  ];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function compareWbs(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// Dependency type mapping: PT (português) → DB
const DEP_TYPE_PT_TO_DB: Record<string, string> = { 'TI':'FS', 'II':'SS', 'TT':'FF', 'IT':'SF' };
const DEP_TYPE_DB_TO_PT: Record<string, string> = { 'FS':'TI', 'SS':'II', 'FF':'TT', 'SF':'IT' };

interface ParsedDep { rowId: number; type: string; lag: number; }
interface ParseResult { deps: ParsedDep[]; errors: string[]; }

function parsePredecessorText(text: string, tasks: GanttTask[]): ParseResult {
  if (!text.trim()) return { deps: [], errors: [] };
  const parts = text.split(';').map(s => s.trim()).filter(Boolean);
  const deps: ParsedDep[] = [];
  const errors: string[] = [];
  for (const part of parts) {
    const m = part.match(/^(\d+)(TI|II|TT|IT|FS|SS|FF|SF)?([+-]\d+)?$/i);
    if (!m) { errors.push(`Sintaxe inválida: "${part}"`); continue; }
    const rowId = parseInt(m[1]);
    const typeRaw = (m[2] ?? 'TI').toUpperCase();
    const type = DEP_TYPE_PT_TO_DB[typeRaw] ?? typeRaw;
    const lag = m[3] ? parseInt(m[3]) : 0;
    if (!['FS','SS','FF','SF'].includes(type)) { errors.push(`Tipo inválido: "${typeRaw}"`); continue; }
    const target = tasks.find(t => t.rowId === rowId);
    if (!target) { errors.push(`Tarefa ID ${rowId} não encontrada`); continue; }
    deps.push({ rowId, type, lag });
  }
  return { deps, errors };
}

function formatDepsAsText(task: GanttTask, tasks: GanttTask[]): string {
  if (!task.predecessorDeps?.length) return '';
  return task.predecessorDeps.map(dep => {
    const pred = tasks.find(t => t.id === dep.predecessorId);
    const rowId = pred?.rowId ?? '?';
    const type = DEP_TYPE_DB_TO_PT[dep.type] ?? dep.type;
    const lag = dep.lagDays > 0 ? `+${dep.lagDays}` : dep.lagDays < 0 ? `${dep.lagDays}` : '';
    return type === 'TI' && lag === '' ? `${rowId}` : `${rowId}${type}${lag}`;
  }).join(';');
}

function formatSuccessorsText(task: GanttTask, tasks: GanttTask[]): string {
  if (!task.successorDeps?.length) return '';
  return task.successorDeps.map(dep => {
    const succ = tasks.find(t => t.id === dep.successorId);
    return succ?.rowId ?? '?';
  }).join(';');
}

function addWorkDays(date: Date, days: number): Date {
  const result = new Date(date);
  if (days === 0) return result;
  const step = days > 0 ? 1 : -1;
  let remaining = Math.abs(days);
  while (remaining > 0) {
    result.setDate(result.getDate() + step);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) remaining--;
  }
  return result;
}

function calculateScheduledStart(task: GanttTask, tasks: GanttTask[]): { start: Date; end: Date } | null {
  const deps = task.predecessorDeps ?? [];
  if (!deps.length) return null;
  const duration = task.durationDays ?? 1;
  let forcedStart: Date | null = null;
  let forcedEnd: Date | null = null;
  for (const dep of deps) {
    const pred = tasks.find(t => t.id === dep.predecessorId);
    if (!pred) continue;
    const predStart = parseDate(pred.startDate);
    const predEnd = parseDate(pred.endDate);
    switch (dep.type) {
      case 'FS': {
        // FS: successor starts 1 day after predecessor ends + lag
        const candidate = addWorkDays(predEnd, 1 + dep.lagDays);
        if (!forcedStart || candidate > forcedStart) forcedStart = candidate;
        break;
      }
      case 'SS': {
        // SS: successor starts when predecessor starts + lag
        const candidate = addWorkDays(predStart, dep.lagDays);
        if (!forcedStart || candidate > forcedStart) forcedStart = candidate;
        break;
      }
      case 'FF': {
        // FF: successor ends when predecessor ends + lag (same day if lag=0)
        const endCandidate = addWorkDays(predEnd, dep.lagDays);
        if (!forcedEnd || endCandidate > forcedEnd) forcedEnd = endCandidate;
        break;
      }
      case 'SF': {
        // SF: successor ends when predecessor starts + lag
        const endCandidate = addWorkDays(predStart, dep.lagDays);
        if (!forcedEnd || endCandidate > forcedEnd) forcedEnd = endCandidate;
        break;
      }
    }
  }
  if (forcedEnd && (!forcedStart || addWorkDays(forcedEnd, -duration) > forcedStart)) {
    forcedStart = addWorkDays(forcedEnd, -duration);
  }
  if (!forcedStart) return null;
  const start = forcedStart;
  const end = addWorkDays(start, duration - 1);
  return { start, end };
}

function propagateDates(tasks: GanttTask[]): GanttTask[] {
  let current = [...tasks];
  for (let iter = 0; iter < 10; iter++) {
    let changed = false;
    current = current.map(task => {
      const scheduled = calculateScheduledStart(task, current);
      if (!scheduled) return task;
      const newStart = scheduled.start.toISOString().split('T')[0];
      const newEnd = scheduled.end.toISOString().split('T')[0];
      if (newStart !== task.startDate.slice(0,10) || newEnd !== task.endDate.slice(0,10)) {
        changed = true;
        return { ...task, startDate: newStart, endDate: newEnd };
      }
      return task;
    });
    if (!changed) break;
  }
  return current;
}

function wouldCreateLoop(taskId: string, newPredId: string, tasks: GanttTask[]): boolean {
  const visited = new Set<string>();
  const queue = [newPredId];
  while (queue.length) {
    const current = queue.shift()!;
    if (current === taskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const t = tasks.find(x => x.id === current);
    t?.predecessorDeps?.forEach(d => queue.push(d.predecessorId));
  }
  return false;
}

function getAllDescendants(taskId: string, tasks: GanttTask[]): GanttTask[] {
  const children = tasks.filter(t => t.parentId === taskId);
  return children.flatMap(c => [c, ...getAllDescendants(c.id, tasks)]);
}

function recalculateWbs(flatList: GanttTask[]): GanttTask[] {
  const counters: Record<string, number> = {};
  const idToCode: Record<string, string> = {};
  return flatList.map(task => {
    const parentKey = task.parentId ?? '__ROOT__';
    counters[parentKey] = (counters[parentKey] ?? 0) + 1;
    const n = counters[parentKey];
    const parentCode = task.parentId ? idToCode[task.parentId] : null;
    const newCode = parentCode ? `${parentCode}.${n}` : String(n);
    idToCode[task.id] = newCode;
    return { ...task, code: newCode };
  });
}

function fmtDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;
}

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function workDaysBetween(start: Date, end: Date): number {
  // Count only business days (Mon-Fri) between start and end, inclusive
  if (start > end) return 0;
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const dow = current.getDay();
    if (dow !== 0 && dow !== 6) count++; // Not Sunday (0) or Saturday (6)
    current.setDate(current.getDate() + 1);
  }
  return count;
}

function parseDate(s: string) {
  return new Date(s.slice(0, 10) + 'T00:00:00');
}

function addDays(date: Date, days: number): string {
  // Use addWorkDays to count only business days (excluding weekends)
  if (days === 0) return date.toISOString().split('T')[0];
  const result = addWorkDays(date, days);
  return result.toISOString().split('T')[0];
}

interface HeaderCell { label: string; left: number; width: number; }

function generateHeaderCells(scale: TimeScale, minDate: Date, maxDate: Date, pxPerDay: number): { upper: HeaderCell[]; lower: HeaderCell[] } {
  if (scale === 'day') {
    const lower: HeaderCell[] = [];
    const cur = new Date(minDate);
    while (cur <= maxDate) {
      const left = daysBetween(minDate, cur) * pxPerDay;
      const dayOfWeek = DAYS_PT[cur.getDay()];
      lower.push({ label: dayOfWeek, left, width: pxPerDay });
      cur.setDate(cur.getDate() + 1);
    }

    const upper: HeaderCell[] = [];
    const weekStart = new Date(minDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekCur = new Date(weekStart);
    while (weekCur <= maxDate) {
      const weekEnd = new Date(weekCur);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const overlapStart = weekCur < minDate ? minDate : new Date(weekCur);
      const overlapEnd = weekEnd > maxDate ? maxDate : weekEnd;
      if (overlapStart <= overlapEnd) {
        const left = daysBetween(minDate, overlapStart) * pxPerDay;
        const width = (daysBetween(overlapStart, overlapEnd) + 1) * pxPerDay;
        const weekNum = Math.ceil((daysBetween(new Date(weekCur.getFullYear(), 0, 1), weekCur) + 1) / 7);
        const label = `${MONTHS_PT[overlapStart.getMonth()]} S${weekNum}`;
        upper.push({ label, left, width });
      }
      weekCur.setDate(weekCur.getDate() + 7);
    }
    return { upper, lower };
  }

  if (scale === 'week') {
    const lower: HeaderCell[] = [];
    const monthDays = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const cur = new Date(minDate);
    cur.setDate(cur.getDate() - cur.getDay() + 1); // Segunda-feira
    while (cur <= maxDate) {
      const weekEnd = new Date(cur);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const overlapStart = cur < minDate ? minDate : new Date(cur);
      const overlapEnd = weekEnd > maxDate ? maxDate : weekEnd;
      if (overlapStart <= overlapEnd) {
        const left = daysBetween(minDate, overlapStart) * pxPerDay;
        const width = (daysBetween(overlapStart, overlapEnd) + 1) * pxPerDay;
        const weekNum = Math.ceil((daysBetween(new Date(cur.getFullYear(), 0, 1), cur) + 1) / 7);
        lower.push({ label: `S${String(weekNum).padStart(2, '0')}`, left, width });
      }
      cur.setDate(cur.getDate() + 7);
    }

    const upper: HeaderCell[] = [];
    const monthCur = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    while (monthCur <= maxDate) {
      const monthStart = monthCur < minDate ? minDate : new Date(monthCur);
      const monthEnd = new Date(monthCur.getFullYear(), monthCur.getMonth() + 1, 0);
      const monthEndClamped = monthEnd > maxDate ? maxDate : monthEnd;
      if (monthStart <= monthEndClamped) {
        const left = daysBetween(minDate, monthStart) * pxPerDay;
        const width = (daysBetween(monthStart, monthEndClamped) + 1) * pxPerDay;
        upper.push({ label: `${MONTHS_PT[monthCur.getMonth()]} ${monthCur.getFullYear()}`, left, width });
      }
      monthCur.setMonth(monthCur.getMonth() + 1);
    }
    return { upper, lower };
  }

  if (scale === 'month') {
    const lower: HeaderCell[] = [];
    const cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    while (cur <= maxDate) {
      const monthStart = cur < minDate ? minDate : new Date(cur);
      const monthEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
      const monthEndClamped = monthEnd > maxDate ? maxDate : monthEnd;
      if (monthStart <= monthEndClamped) {
        const left = daysBetween(minDate, monthStart) * pxPerDay;
        const width = (daysBetween(monthStart, monthEndClamped) + 1) * pxPerDay;
        lower.push({ label: MONTHS_PT[cur.getMonth()], left, width });
      }
      cur.setMonth(cur.getMonth() + 1);
    }

    const upper: HeaderCell[] = [];
    const yearCur = minDate.getFullYear();
    const yearMax = maxDate.getFullYear();
    for (let y = yearCur; y <= yearMax; y++) {
      const yearStart = new Date(y, 0, 1);
      const yearEnd = new Date(y, 11, 31);
      const overlapStart = yearStart < minDate ? minDate : yearStart;
      const overlapEnd = yearEnd > maxDate ? maxDate : yearEnd;
      if (overlapStart <= overlapEnd) {
        const left = daysBetween(minDate, overlapStart) * pxPerDay;
        const width = (daysBetween(overlapStart, overlapEnd) + 1) * pxPerDay;
        upper.push({ label: String(y), left, width });
      }
    }
    return { upper, lower };
  }

  if (scale === 'quarter') {
    const quarters = [{ start: 0, end: 2, label: 'Q1' }, { start: 3, end: 5, label: 'Q2' }, { start: 6, end: 8, label: 'Q3' }, { start: 9, end: 11, label: 'Q4' }];
    const lower: HeaderCell[] = [];
    const yearCur = minDate.getFullYear();
    const yearMax = maxDate.getFullYear();
    for (let y = yearCur; y <= yearMax; y++) {
      quarters.forEach(q => {
        const qStart = new Date(y, q.start, 1);
        const qEnd = new Date(y, q.end + 1, 0);
        const overlapStart = qStart < minDate ? minDate : qStart;
        const overlapEnd = qEnd > maxDate ? maxDate : qEnd;
        if (overlapStart <= overlapEnd) {
          const left = daysBetween(minDate, overlapStart) * pxPerDay;
          const width = (daysBetween(overlapStart, overlapEnd) + 1) * pxPerDay;
          lower.push({ label: q.label, left, width });
        }
      });
    }

    const upper: HeaderCell[] = [];
    for (let y = yearCur; y <= yearMax; y++) {
      const yearStart = new Date(y, 0, 1);
      const yearEnd = new Date(y, 11, 31);
      const overlapStart = yearStart < minDate ? minDate : yearStart;
      const overlapEnd = yearEnd > maxDate ? maxDate : yearEnd;
      if (overlapStart <= overlapEnd) {
        const left = daysBetween(minDate, overlapStart) * pxPerDay;
        const width = (daysBetween(overlapStart, overlapEnd) + 1) * pxPerDay;
        upper.push({ label: String(y), left, width });
      }
    }
    return { upper, lower };
  }

  if (scale === 'semester') {
    const lower: HeaderCell[] = [];
    const yearCur = minDate.getFullYear();
    const yearMax = maxDate.getFullYear();
    for (let y = yearCur; y <= yearMax; y++) {
      [{ start: 0, end: 5, label: '1º Sem' }, { start: 6, end: 11, label: '2º Sem' }].forEach(s => {
        const sStart = new Date(y, s.start, 1);
        const sEnd = new Date(y, s.end + 1, 0);
        const overlapStart = sStart < minDate ? minDate : sStart;
        const overlapEnd = sEnd > maxDate ? maxDate : sEnd;
        if (overlapStart <= overlapEnd) {
          const left = daysBetween(minDate, overlapStart) * pxPerDay;
          const width = (daysBetween(overlapStart, overlapEnd) + 1) * pxPerDay;
          lower.push({ label: s.label, left, width });
        }
      });
    }

    const upper: HeaderCell[] = [];
    for (let y = yearCur; y <= yearMax; y++) {
      const yearStart = new Date(y, 0, 1);
      const yearEnd = new Date(y, 11, 31);
      const overlapStart = yearStart < minDate ? minDate : yearStart;
      const overlapEnd = yearEnd > maxDate ? maxDate : yearEnd;
      if (overlapStart <= overlapEnd) {
        const left = daysBetween(minDate, overlapStart) * pxPerDay;
        const width = (daysBetween(overlapStart, overlapEnd) + 1) * pxPerDay;
        upper.push({ label: String(y), left, width });
      }
    }
    return { upper, lower };
  }

  // year
  const lower: HeaderCell[] = [];
  const yearCur = minDate.getFullYear();
  const yearMax = maxDate.getFullYear();
  for (let y = yearCur; y <= yearMax; y++) {
    const yearStart = new Date(y, 0, 1);
    const yearEnd = new Date(y, 11, 31);
    const overlapStart = yearStart < minDate ? minDate : yearStart;
    const overlapEnd = yearEnd > maxDate ? maxDate : yearEnd;
    if (overlapStart <= overlapEnd) {
      const left = daysBetween(minDate, overlapStart) * pxPerDay;
      const width = (daysBetween(overlapStart, overlapEnd) + 1) * pxPerDay;
      lower.push({ label: String(y), left, width });
    }
  }

  const upper: HeaderCell[] = [];
  const decadeCur = Math.floor(yearCur / 10) * 10;
  const decadeMax = Math.floor(yearMax / 10) * 10 + 10;
  for (let d = decadeCur; d < decadeMax; d += 10) {
    const decadeStart = new Date(d, 0, 1);
    const decadeEnd = new Date(d + 9, 11, 31);
    const overlapStart = decadeStart < minDate ? minDate : decadeStart;
    const overlapEnd = decadeEnd > maxDate ? maxDate : decadeEnd;
    if (overlapStart <= overlapEnd) {
      const left = daysBetween(minDate, overlapStart) * pxPerDay;
      const width = (daysBetween(overlapStart, overlapEnd) + 1) * pxPerDay;
      upper.push({ label: `${d}s`, left, width });
    }
  }
  return { upper, lower };
}

function barColor(actual: number, planned: number): string {
  if (actual >= planned) return '#15803D';
  if (actual >= planned - 15) return '#D97706';
  return '#B91C1C';
}

function badgeClass(actual: number, planned: number): string {
  if (actual >= planned) return 'ao-badge ao-bg';
  if (actual >= planned - 15) return 'ao-badge ao-ba';
  return 'ao-badge ao-br';
}

/**
 * Calcula o %Real de uma tarefa pai baseado nos filhos com pesos
 */
function calculateParentProgress(parent: GanttTask, children: GanttTask[]): number {
  if (children.length === 0) return parent.actualProgress;

  const totalWeight = children.reduce((sum, child) => sum + (child.weight || 1), 0);
  if (totalWeight === 0) return parent.actualProgress;

  const weightedSum = children.reduce((sum, child) => {
    return sum + (child.actualProgress || 0) * (child.weight || 1);
  }, 0);

  return Math.round((weightedSum / totalWeight) * 100) / 100;
}

/**
 * Recalcula o %Real de todas as tarefas pai em cascata
 */
function recalculateParentProgress(tasks: GanttTask[]): GanttTask[] {
  let updated = [...tasks];

  // Identificar todas as tarefas pai
  const parentIds = new Set(updated.filter(t => t.parentId).map(t => t.parentId));

  // Processar cada pai, começando dos filhos diretos até a raiz
  // Iterar até estabilizar (max 10 vezes para evitar loop infinito)
  for (let iter = 0; iter < 10; iter++) {
    let changed = false;

    updated = updated.map(task => {
      if (!parentIds.has(task.id)) return task;

      const children = updated.filter(t => t.parentId === task.id);
      const newProgress = calculateParentProgress(task, children);

      if (newProgress !== task.actualProgress) {
        changed = true;
        return { ...task, actualProgress: newProgress };
      }
      return task;
    });

    if (!changed) break;
  }

  return updated;
}

/**
 * Recalcula datas e duração das tarefas pai com base nas filhas:
 * - startDate = MIN(filhas.startDate)
 * - endDate   = MAX(filhas.endDate)
 * - durationDays = workDaysBetween(start, end) inclusivo
 * Processa do nível mais profundo para o mais raso (children-first) e itera até estabilizar.
 */
interface ParentDateChange {
  oldStart: string; oldEnd: string; oldDuration: number;
  newStart: string; newEnd: string; newDuration: number;
}
function recalculateParentDates(tasks: GanttTask[]): { tasks: GanttTask[]; changes: Map<string, ParentDateChange> } {
  const originalById = new Map(tasks.map(t => [t.id, t]));
  const parentIds = new Set<string>();
  tasks.forEach(t => { if (t.parentId) parentIds.add(t.parentId); });
  const parentList = tasks
    .filter(t => parentIds.has(t.id))
    .sort((a, b) => b.level - a.level); // deepest first

  let updated = [...tasks];
  const changes = new Map<string, ParentDateChange>();

  for (let iter = 0; iter < 20; iter++) {
    let stable = true;
    for (const parent of parentList) {
      const children = updated.filter(t => t.parentId === parent.id);
      if (children.length === 0) continue;
      const currentParent = updated.find(t => t.id === parent.id);
      if (!currentParent) continue;

      let minStart = parseDate(children[0].startDate);
      let maxEnd = parseDate(children[0].endDate);
      for (const c of children) {
        const s = parseDate(c.startDate);
        const e = parseDate(c.endDate);
        if (s < minStart) minStart = s;
        if (e > maxEnd) maxEnd = e;
      }
      const newStart = minStart.toISOString().split('T')[0];
      const newEnd = maxEnd.toISOString().split('T')[0];
      const newDuration = Math.max(1, workDaysBetween(minStart, maxEnd));

      const curStart = currentParent.startDate.slice(0, 10);
      const curEnd = currentParent.endDate.slice(0, 10);
      const curDuration = currentParent.durationDays ?? 0;

      if (curStart !== newStart || curEnd !== newEnd || curDuration !== newDuration) {
        stable = false;
        updated = updated.map(t => t.id === parent.id
          ? { ...t, startDate: newStart, endDate: newEnd, durationDays: newDuration }
          : t);
        const orig = originalById.get(parent.id)!;
        changes.set(parent.id, {
          oldStart: orig.startDate.slice(0, 10),
          oldEnd: orig.endDate.slice(0, 10),
          oldDuration: orig.durationDays ?? 0,
          newStart, newEnd, newDuration,
        });
      }
    }
    if (stable) break;
  }
  return { tasks: updated, changes };
}

/**
 * Roda propagateDates (cascata por dependências) e recalculateParentDates (rollup
 * pais←filhas) em loop até convergir. Cobre o caso em que o ajuste de um pai dispara
 * propagação por dependências e vice-versa.
 */
function propagateAndRollup(tasks: GanttTask[]): { tasks: GanttTask[]; parentChanges: Map<string, ParentDateChange> } {
  let updated = tasks;
  const aggregatedChanges = new Map<string, ParentDateChange>();
  const baseById = new Map(tasks.map(t => [t.id, t]));

  for (let i = 0; i < 10; i++) {
    const afterDeps = propagateDates(updated);
    const { tasks: afterParents, changes } = recalculateParentDates(afterDeps);
    // Merge: keep original old* from first iteration, latest new*
    changes.forEach((c, id) => {
      const base = baseById.get(id)!;
      const existing = aggregatedChanges.get(id);
      aggregatedChanges.set(id, {
        oldStart: existing?.oldStart ?? base.startDate.slice(0, 10),
        oldEnd: existing?.oldEnd ?? base.endDate.slice(0, 10),
        oldDuration: existing?.oldDuration ?? (base.durationDays ?? 0),
        newStart: c.newStart, newEnd: c.newEnd, newDuration: c.newDuration,
      });
    });
    let changed = false;
    for (let j = 0; j < afterParents.length; j++) {
      const a = afterParents[j];
      const b = updated[j];
      if (a.startDate.slice(0, 10) !== b.startDate.slice(0, 10) ||
          a.endDate.slice(0, 10) !== b.endDate.slice(0, 10) ||
          (a.durationDays ?? 0) !== (b.durationDays ?? 0)) {
        changed = true; break;
      }
    }
    updated = afterParents;
    if (!changed) break;
  }
  return { tasks: updated, parentChanges: aggregatedChanges };
}

function levelStyle(level: number, hasChildren?: boolean): React.CSSProperties {
  if (level === 0) return { background: 'var(--s2)', fontWeight: 700, fontSize: 12 };
  if (level === 1) return { background: hasChildren ? 'var(--s1)' : undefined, fontWeight: hasChildren ? 600 : 400, fontSize: 11 };
  if (level === 2) return { fontSize: 11, fontWeight: hasChildren ? 500 : 400 };
  if (level === 3) return { fontSize: 10, color: 'var(--t2)' };
  return { fontSize: 10, color: 'var(--t3)' };
}

function rowBg(level: number): string {
  if (level === 0) return 'var(--s2)';
  if (level === 1) return 'var(--s1)';
  return 'transparent';
}

// ── FormState ─────────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  code: string;
  level: number;
  parentId: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  plannedProgress: number;
  actualProgress: number;
  weight: number;
  isCriticalPath: boolean;
  responsible: string;
}

function defaultForm(parent: GanttTask | null, all: GanttTask[]): FormState {
  const today = new Date().toISOString().split('T')[0];
  // endDate inclusive: para 30 dias úteis, end = start + 29 dias úteis
  const in30 = addDays(new Date(), 29);
  if (parent) {
    const siblings = all.filter((t) => t.parentId === parent.id);
    return {
      name: '', code: `${parent.code}.${siblings.length + 1}`,
      level: parent.level + 1, parentId: parent.id,
      startDate: today, endDate: in30, durationDays: 30,
      plannedProgress: 0, actualProgress: 0, weight: 1, isCriticalPath: false,
      responsible: '',
    };
  }
  const roots = all.filter((t) => !t.parentId);
  return {
    name: '', code: String(roots.length + 1),
    level: 0, parentId: '',
    startDate: today, endDate: in30, durationDays: 30,
    plannedProgress: 0, actualProgress: 0, weight: 1, isCriticalPath: false,
    responsible: '',
  };
}

function formFromTask(task: GanttTask): FormState {
  const start = parseDate(task.startDate);
  const end = parseDate(task.endDate);
  return {
    name: task.name,
    code: task.code,
    level: task.level,
    parentId: task.parentId ?? '',
    startDate: task.startDate.slice(0, 10),
    endDate: task.endDate.slice(0, 10),
    durationDays: task.durationDays ?? Math.max(1, workDaysBetween(start, end)),
    plannedProgress: task.plannedProgress,
    actualProgress: task.actualProgress,
    weight: task.weight ?? 1,
    isCriticalPath: task.isCriticalPath,
    responsible: task.responsible ?? '',
  };
}

// ── Helper functions for keyboard navigation ─────────────────────────────────

function getCellRawValue(task: GanttTask, colKey: string): string {
  switch (colKey) {
    case 'name': return task.name;
    case 'code': return task.code;
    case 'duration': return String(task.durationDays ?? '');
    case 'startDate': return task.startDate.slice(0, 10);
    case 'endDate': return task.endDate.slice(0, 10);
    case 'progress': return String(task.actualProgress);
    case 'weight': return String(task.weight ?? '');
    case 'responsible': return task.responsible ?? '';
    default: return '';
  }
}

function formatCellForFilter(task: GanttTask, colKey: string): string {
  switch (colKey) {
    case 'code': return task.code;
    case 'name': return task.name;
    case 'responsible': return task.responsible ?? '';
    case 'startDate': return task.startDate.slice(0, 10);
    case 'endDate': return task.endDate.slice(0, 10);
    case 'duration': return String(task.durationDays ?? '');
    case 'progress': return String(task.actualProgress);
    case 'weight': return String(task.weight ?? '');
    case 'predecessors': return '';
    case 'successors': return '';
    case 'critical': return task.isCriticalPath ? 'Sim' : 'Não';
    default: return '';
  }
}

// ── Shared input style ────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  padding: '5px 8px', fontSize: 12,
  border: '1px solid var(--bd)', borderRadius: 6,
  background: 'var(--s0)', color: 'var(--t1)',
  width: '100%', boxSizing: 'border-box',
};

// ── ColFilterDropdown ────────────────────────────────────────────────────────

interface ColFilterDropdownProps {
  colKey: string;
  label: string;
  allValues: string[];
  selected: string[];
  sortDir: 'asc' | 'desc' | null;
  onSortChange: (dir: 'asc' | 'desc' | null) => void;
  onFilterChange: (values: string[]) => void;
  onClose: () => void;
  triggerRef: HTMLButtonElement | null | undefined;
}

function ColFilterDropdown({ colKey, label, allValues, selected, sortDir, onSortChange, onFilterChange, onClose, triggerRef }: ColFilterDropdownProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (triggerRef) {
      const rect = triggerRef.getBoundingClientRect();
      setCoords({ top: rect.bottom + 4, left: rect.left });
    }
  }, [triggerRef]);

  const filtered = allValues.filter(v => v.toLowerCase().includes(searchTerm.toLowerCase()));
  const allSelected = selected.length === allValues.length && allValues.length > 0;

  return (
    <div
      style={{
        position: 'fixed',
        top: coords.top,
        left: coords.left,
        zIndex: 10000,
        background: 'var(--s0)',
        border: '1px solid var(--bd)',
        borderRadius: 6,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        width: 240,
        maxHeight: 400,
        display: 'flex',
        flexDirection: 'column',
        padding: 8,
        gap: 8,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Sort buttons */}
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={() => onSortChange(sortDir === 'asc' ? null : 'asc')}
          style={{
            flex: 1,
            padding: '4px 6px',
            fontSize: 11,
            border: `0.5px solid ${sortDir === 'asc' ? '#1A56A0' : 'var(--bd)'}`,
            background: sortDir === 'asc' ? '#1A56A0' : 'var(--s1)',
            color: sortDir === 'asc' ? '#fff' : 'var(--t1)',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          ▲ A-Z
        </button>
        <button
          onClick={() => onSortChange(sortDir === 'desc' ? null : 'desc')}
          style={{
            flex: 1,
            padding: '4px 6px',
            fontSize: 11,
            border: `0.5px solid ${sortDir === 'desc' ? '#1A56A0' : 'var(--bd)'}`,
            background: sortDir === 'desc' ? '#1A56A0' : 'var(--s1)',
            color: sortDir === 'desc' ? '#fff' : 'var(--t1)',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          ▼ Z-A
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Buscar..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{
          padding: '4px 6px',
          fontSize: 11,
          border: '1px solid var(--bd)',
          borderRadius: 4,
          background: 'var(--s1)',
          color: 'var(--t1)',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />

      {/* Checkboxes */}
      <div style={{ overflowY: 'auto', maxHeight: 250, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Select All */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', padding: '2px 4px', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => onFilterChange(e.target.checked ? allValues : [])}
            style={{ cursor: 'pointer' }}
          />
          <span><strong>Selecionar todos</strong></span>
        </label>

        {filtered.map(val => (
          <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', padding: '2px 4px', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={selected.includes(val)}
              onChange={(e) => {
                if (e.target.checked) {
                  onFilterChange([...selected, val]);
                } else {
                  onFilterChange(selected.filter(v => v !== val));
                }
              }}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ color: 'var(--t1)' }}>{val || '(vazio)'}</span>
          </label>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 4, fontSize: 10 }}>
        <button
          onClick={() => onFilterChange([])}
          style={{
            flex: 1,
            padding: '4px 6px',
            border: '1px solid var(--bd)',
            background: 'var(--s1)',
            color: 'var(--t2)',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Limpar
        </button>
        <button
          onClick={onClose}
          style={{
            flex: 1,
            padding: '4px 6px',
            border: '0.5px solid #1A56A0',
            background: '#1A56A0',
            color: '#fff',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          OK
        </button>
      </div>
    </div>
  );
}

// ── AdvancedFiltersPanel ────────────────────────────────────────────────────

interface AdvancedFiltersPanelProps {
  filters: { dateStart: string; dateEnd: string; progressMin: string; progressMax: string; onlyLate: boolean; onlyCritical: boolean; onlyDone: boolean; responsibles: string[] };
  allResponsibles: string[];
  onChange: (filters: any) => void;
  onClose: () => void;
}

function AdvancedFiltersPanel({ filters, allResponsibles, onChange, onClose }: AdvancedFiltersPanelProps) {
  const activeCount = [
    filters.dateStart ? 1 : 0,
    filters.dateEnd ? 1 : 0,
    filters.progressMin ? 1 : 0,
    filters.progressMax ? 1 : 0,
    filters.onlyLate ? 1 : 0,
    filters.onlyCritical ? 1 : 0,
    filters.onlyDone ? 1 : 0,
    filters.responsibles.length > 0 ? 1 : 0,
  ].filter(Boolean).length;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1999,
          background: 'rgba(0,0,0,0.3)',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          zIndex: 2000,
          width: 320,
          background: 'var(--s0)',
          border: '1px solid var(--bd)',
          borderLeft: '1px solid var(--bd)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-2px 0 8px rgba(0,0,0,0.1)',
          animation: 'slideIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div style={{ padding: 12, borderBottom: '0.5px solid var(--bd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--t1)' }}>Filtros avançados</span>
            {activeCount > 0 && <span style={{ marginLeft: 8, fontSize: 11, color: '#1A56A0', fontWeight: 500 }}>({activeCount})</span>}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--t2)', padding: 0, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 16, fontSize: 12 }}>
          {/* Date range */}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, color: 'var(--t1)' }}>Data de início</label>
            <input
              type="date"
              value={filters.dateStart}
              onChange={(e) => onChange({ ...filters, dateStart: e.target.value })}
              style={inp}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, color: 'var(--t1)' }}>Data de término</label>
            <input
              type="date"
              value={filters.dateEnd}
              onChange={(e) => onChange({ ...filters, dateEnd: e.target.value })}
              style={inp}
            />
          </div>

          {/* Progress range */}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, color: 'var(--t1)' }}>% Real mínimo</label>
            <input
              type="number"
              min="0"
              max="100"
              value={filters.progressMin}
              onChange={(e) => onChange({ ...filters, progressMin: e.target.value })}
              placeholder="0"
              style={inp}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, color: 'var(--t1)' }}>% Real máximo</label>
            <input
              type="number"
              min="0"
              max="100"
              value={filters.progressMax}
              onChange={(e) => onChange({ ...filters, progressMax: e.target.value })}
              placeholder="100"
              style={inp}
            />
          </div>

          {/* Checkboxes */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={filters.onlyLate}
              onChange={(e) => onChange({ ...filters, onlyLate: e.target.checked })}
              style={{ cursor: 'pointer' }}
            />
            <span>Apenas atrasadas</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={filters.onlyCritical}
              onChange={(e) => onChange({ ...filters, onlyCritical: e.target.checked })}
              style={{ cursor: 'pointer' }}
            />
            <span>Apenas críticas</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={filters.onlyDone}
              onChange={(e) => onChange({ ...filters, onlyDone: e.target.checked })}
              style={{ cursor: 'pointer' }}
            />
            <span>Apenas concluídas</span>
          </label>

          {/* Responsibles */}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, color: 'var(--t1)' }}>Responsáveis</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {allResponsibles.map(resp => (
                <label key={resp} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none', fontSize: 11 }}>
                  <input
                    type="checkbox"
                    checked={filters.responsibles.includes(resp)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onChange({ ...filters, responsibles: [...filters.responsibles, resp] });
                      } else {
                        onChange({ ...filters, responsibles: filters.responsibles.filter(r => r !== resp) });
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>{resp}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: 12, borderTop: '0.5px solid var(--bd)', display: 'flex', gap: 8 }}>
          <button
            onClick={() => onChange({ dateStart: '', dateEnd: '', progressMin: '', progressMax: '', onlyLate: false, onlyCritical: false, onlyDone: false, responsibles: [] })}
            style={{ flex: 1, padding: '6px 8px', fontSize: 11, border: '1px solid var(--bd)', background: 'var(--s1)', color: 'var(--t1)', borderRadius: 4, cursor: 'pointer' }}
          >
            Limpar tudo
          </button>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '6px 8px', fontSize: 11, border: 'none', background: '#1A56A0', color: '#fff', borderRadius: 4, cursor: 'pointer' }}
          >
            Fechar
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}

// ── TaskModal ─────────────────────────────────────────────────────────────────

interface TaskModalProps {
  open: boolean;
  editingTask: GanttTask | null;
  parentTask: GanttTask | null;
  allTasks: GanttTask[];
  projectId: string;
  addToast: (t: { type: string; title: string; description?: string }) => void;
  onClose: () => void;
  onSaved: () => void;
}

function TaskModal({ open, editingTask, parentTask, allTasks, projectId, addToast, onClose, onSaved }: TaskModalProps) {
  const { push, triggerDataOnly } = useHistoryStore();
  const [form, setForm] = useState<FormState>(() =>
    editingTask ? formFromTask(editingTask) : defaultForm(parentTask, allTasks)
  );
  const [saving, setSaving] = useState(false);
  const [deps, setDeps] = useState<ScheduleDependencyItem[]>([]);
  const [loadingDeps, setLoadingDeps] = useState(false);
  const [addingDep, setAddingDep] = useState(false);
  const [addDepRole, setAddDepRole] = useState<'predecessor' | 'successor'>('predecessor');
  const [depSearch, setDepSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm(editingTask ? formFromTask(editingTask) : defaultForm(parentTask, allTasks));
    setDeps([]);
    setAddingDep(false);
    setDepSearch('');
    if (editingTask) {
      setLoadingDeps(true);
      scheduleApi.getDependencies(editingTask.id)
        .then(setDeps)
        .catch(() => setDeps([]))
        .finally(() => setLoadingDeps(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function change<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'startDate' || key === 'endDate') {
        const s = parseDate((key === 'startDate' ? value : prev.startDate) as string);
        const e = parseDate((key === 'endDate' ? value : prev.endDate) as string);
        // e >= s: aceita início e término no mesmo dia (duração = 1)
        if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e >= s) {
          next.durationDays = Math.max(1, workDaysBetween(s, e));
        }
      } else if (key === 'durationDays' && (value as number) > 0) {
        const s = parseDate(prev.startDate);
        // endDate inclusive: duração N → end = start + (N-1) dias úteis (duração 1 = mesmo dia)
        if (!isNaN(s.getTime())) next.endDate = addDays(s, (value as number) - 1);
      }
      return next;
    });
  }

  async function handleSave() {
    if (!form.name.trim()) {
      addToast({ type: 'error', title: 'Nome obrigatório' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(), code: form.code.trim(),
        level: form.level, parentId: form.parentId || undefined,
        startDate: form.startDate, endDate: form.endDate,
        durationDays: form.durationDays,
        plannedProgress: form.plannedProgress, actualProgress: form.actualProgress,
        weight: form.weight, isCriticalPath: form.isCriticalPath,
        responsible: form.responsible.trim() || undefined,
      };
      let savedId: string | null = null;
      let nextTasks: GanttTask[];

      if (editingTask) {
        const oldPayload = formFromTask(editingTask);
        const taskId = editingTask.id;
        await scheduleApi.update(taskId, payload);
        addToast({ type: 'success', title: 'Salvo', description: `"${form.name}" atualizado.` });
        savedId = taskId;
        nextTasks = allTasks.map(t => t.id === taskId ? {
          ...t,
          name: payload.name, code: payload.code, level: payload.level,
          parentId: payload.parentId ?? undefined,
          startDate: payload.startDate, endDate: payload.endDate,
          durationDays: payload.durationDays,
          plannedProgress: payload.plannedProgress, actualProgress: payload.actualProgress,
          weight: payload.weight, isCriticalPath: payload.isCriticalPath,
          responsible: payload.responsible,
        } : t);

        push({
          description: `Editar: "${form.name.trim()}"`,
          module: 'cronograma',
          undo: async () => {
            await scheduleApi.update(taskId, {
              name: oldPayload.name, code: oldPayload.code, level: oldPayload.level,
              parentId: oldPayload.parentId || undefined, startDate: oldPayload.startDate,
              endDate: oldPayload.endDate, durationDays: oldPayload.durationDays,
              plannedProgress: oldPayload.plannedProgress, actualProgress: oldPayload.actualProgress,
              weight: oldPayload.weight, isCriticalPath: oldPayload.isCriticalPath,
              responsible: oldPayload.responsible || undefined,
            });
            triggerDataOnly();
          },
          redo: async () => {
            await scheduleApi.update(taskId, payload);
            triggerDataOnly();
          },
        });
      } else {
        const created = await scheduleApi.create(projectId, payload);
        addToast({ type: 'success', title: 'Criado', description: `"${form.name}" adicionado.` });

        const newId = (created as { id: string }).id;
        savedId = newId ?? null;
        const newTask: GanttTask = {
          id: newId,
          code: payload.code, name: payload.name, level: payload.level,
          parentId: payload.parentId ?? undefined,
          startDate: payload.startDate, endDate: payload.endDate,
          durationDays: payload.durationDays,
          plannedProgress: payload.plannedProgress, actualProgress: payload.actualProgress,
          isCriticalPath: payload.isCriticalPath,
          hasChildren: false,
          weight: payload.weight,
          responsible: payload.responsible,
          predecessorDeps: [], successorDeps: [],
        } as unknown as GanttTask;
        // Marca o pai como hasChildren para o cascade alcançá-lo
        const tasksWithParentFlag = payload.parentId
          ? allTasks.map(t => t.id === payload.parentId ? { ...t, hasChildren: true } : t)
          : allTasks;
        nextTasks = [...tasksWithParentFlag, newTask];

        if (newId) {
          push({
            description: `Criar: "${form.name.trim()}"`,
            module: 'cronograma',
            undo: async () => {
              await scheduleApi.delete(newId);
              triggerDataOnly();
            },
            redo: async () => {
              triggerDataOnly();
            },
          });
        }
      }

      // Rollup pais←filhas + cascata por dependências, persistindo pais alterados
      if (savedId) {
        const { tasks: cascaded } = propagateAndRollup(nextTasks);
        const parentsToSave = cascaded.filter(t => {
          const orig = nextTasks.find(o => o.id === t.id);
          return orig && (
            orig.startDate.slice(0, 10) !== t.startDate.slice(0, 10) ||
            orig.endDate.slice(0, 10) !== t.endDate.slice(0, 10) ||
            (orig.durationDays ?? 0) !== (t.durationDays ?? 0)
          );
        });
        if (parentsToSave.length > 0) {
          await Promise.all(parentsToSave.map(t => scheduleApi.update(t.id, {
            startDate: t.startDate.slice(0, 10),
            endDate: t.endDate.slice(0, 10),
            durationDays: t.durationDays,
          })));
        }
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      addToast({ type: 'error', title: 'Erro ao salvar', description: msg ?? 'Tente novamente.' });
    } finally {
      setSaving(false);
    }
  }

  // Recarrega tasks atualizadas, roda cascata (deps + rollup pais) e persiste mudanças
  async function cascadeAfterDepChange() {
    if (!projectId) return;
    try {
      const fresh = await scheduleApi.ganttData(projectId);
      const { tasks: cascaded } = propagateAndRollup(fresh);
      const changed = cascaded.filter(t => {
        const orig = fresh.find(o => o.id === t.id);
        return orig && (
          orig.startDate.slice(0, 10) !== t.startDate.slice(0, 10) ||
          orig.endDate.slice(0, 10) !== t.endDate.slice(0, 10) ||
          (orig.durationDays ?? 0) !== (t.durationDays ?? 0)
        );
      });
      if (changed.length > 0) {
        await Promise.all(changed.map(t => scheduleApi.update(t.id, {
          startDate: t.startDate.slice(0, 10),
          endDate: t.endDate.slice(0, 10),
          durationDays: t.durationDays,
        })));
      }
    } catch {
      // silencioso — usuário verá no próximo reload
    }
  }

  async function handleAddDep(targetId: string) {
    if (!editingTask) return;
    try {
      let dep: ScheduleDependencyItem;
      if (addDepRole === 'predecessor') {
        dep = await scheduleApi.addDependency(editingTask.id, { predecessorId: targetId });
      } else {
        dep = await scheduleApi.addDependency(targetId, { predecessorId: editingTask.id });
      }
      setDeps((prev) => [...prev, dep]);
      setAddingDep(false);
      setDepSearch('');
      await cascadeAfterDepChange();
      onSaved();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      addToast({ type: 'error', title: 'Erro', description: msg ?? 'Não foi possível adicionar.' });
    }
  }

  async function handleRemoveDep(depId: string) {
    try {
      await scheduleApi.removeDependency(depId);
      setDeps((prev) => prev.filter((d) => d.id !== depId));
      await cascadeAfterDepChange();
      onSaved();
    } catch {
      addToast({ type: 'error', title: 'Erro', description: 'Não foi possível remover dependência.' });
    }
  }

  const predecessors = deps.filter((d) => d.successorId === editingTask?.id);
  const successors = deps.filter((d) => d.predecessorId === editingTask?.id);

  const depCandidates = useMemo(() => {
    if (!addingDep) return [];
    const usedIds = new Set([
      ...deps.map((d) => d.predecessorId),
      ...deps.map((d) => d.successorId),
      editingTask?.id ?? '',
    ]);
    const q = depSearch.toLowerCase();
    return allTasks
      .filter((t) => !usedIds.has(t.id) && (!q || t.name.toLowerCase().includes(q) || t.code.includes(q)))
      .slice(0, 25);
  }, [addingDep, deps, depSearch, allTasks, editingTask]);

  if (!open) return null;

  const depRow = (dep: ScheduleDependencyItem, side: 'pred' | 'succ') => {
    const item = side === 'pred' ? dep.predecessor : dep.successor;
    return (
      <div key={dep.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 11 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--t3)', minWidth: 32, flexShrink: 0 }}>{item?.code}</span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--t1)' }}>{item?.name}</span>
        <span style={{ color: 'var(--t3)', fontSize: 9, background: 'var(--s1)', padding: '1px 5px', borderRadius: 4, flexShrink: 0 }}>
          {dep.type}{dep.lagDays ? `+${dep.lagDays}d` : ''}
        </span>
        <button onClick={() => handleRemoveDep(dep.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', fontSize: 14, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}>×</button>
      </div>
    );
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: 'var(--s0)', border: '1px solid var(--bd)', borderRadius: 6, padding: '1.25rem', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--t1)' }}>
            {editingTask ? 'Editar atividade' : parentTask ? `Nova atividade em "${parentTask.name}"` : 'Nova atividade'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t2)', fontSize: 18, lineHeight: 1, padding: '0 2px' }}>✕</button>
        </div>

        {/* Form grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 11, color: 'var(--t2)', display: 'block', marginBottom: 3 }}>Nome *</label>
            <input style={inp} value={form.name} onChange={(e) => change('name', e.target.value)} placeholder="Nome da atividade" autoFocus />
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--t2)', display: 'block', marginBottom: 3 }}>Código WBS</label>
            <input style={inp} value={form.code} onChange={(e) => change('code', e.target.value)} placeholder="Ex: 1.2.3" />
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--t2)', display: 'block', marginBottom: 3 }}>Nível hierárquico</label>
            <input style={inp} type="number" min={0} max={10} value={form.level} onChange={(e) => change('level', parseInt(e.target.value) || 0)} />
          </div>

          {(() => {
            const parentLocked = !!editingTask?.hasChildren;
            const lockedStyle: React.CSSProperties = parentLocked
              ? { ...inp, background: 'var(--s1)', color: 'var(--t3)', cursor: 'not-allowed', fontStyle: 'italic' }
              : inp;
            const lockedTitle = parentLocked ? 'Calculado automaticamente a partir das tarefas filhas' : undefined;
            return (
              <>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--t2)', display: 'block', marginBottom: 3 }}>Data de início</label>
                  <input style={lockedStyle} type="date" value={form.startDate} disabled={parentLocked} title={lockedTitle} onChange={(e) => change('startDate', e.target.value)} />
                </div>

                <div>
                  <label style={{ fontSize: 11, color: 'var(--t2)', display: 'block', marginBottom: 3 }}>Data de término</label>
                  <input style={lockedStyle} type="date" value={form.endDate} disabled={parentLocked} title={lockedTitle} onChange={(e) => change('endDate', e.target.value)} />
                </div>

                <div>
                  <label style={{ fontSize: 11, color: 'var(--t2)', display: 'block', marginBottom: 3 }}>Duração (dias)</label>
                  <input style={lockedStyle} type="number" min={1} value={form.durationDays} disabled={parentLocked} title={lockedTitle} onChange={(e) => change('durationDays', parseInt(e.target.value) || 1)} />
                </div>

                {parentLocked && (
                  <div style={{ gridColumn: '1 / -1', fontSize: 10, color: 'var(--t3)', fontStyle: 'italic', marginTop: -4 }}>
                    Datas e duração são calculadas automaticamente a partir das tarefas filhas.
                  </div>
                )}
              </>
            );
          })()}

          <div>
            <label style={{ fontSize: 11, color: 'var(--t2)', display: 'block', marginBottom: 3 }}>Peso</label>
            <input style={inp} type="number" min={0} step={0.01} value={form.weight} onChange={(e) => change('weight', parseFloat(e.target.value) || 0)} />
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--t2)', display: 'block', marginBottom: 3 }}>Responsável</label>
            <input style={inp} value={form.responsible} onChange={(e) => change('responsible', e.target.value)} placeholder="Nome do responsável" />
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--t2)', display: 'block', marginBottom: 3 }}>Prog. Planejado (%)</label>
            <input style={inp} type="number" min={0} max={100} value={form.plannedProgress} onChange={(e) => change('plannedProgress', Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))} />
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--t2)', display: 'block', marginBottom: 3 }}>Prog. Realizado (%)</label>
            <input style={inp} type="number" min={0} max={100} value={form.actualProgress} onChange={(e) => change('actualProgress', Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))} />
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" id="cp-chk" checked={form.isCriticalPath} onChange={(e) => change('isCriticalPath', e.target.checked)} style={{ cursor: 'pointer', accentColor: '#B91C1C' }} />
            <label htmlFor="cp-chk" style={{ fontSize: 12, color: 'var(--t1)', cursor: 'pointer' }}>Caminho crítico</label>
          </div>
        </div>

        {/* Dependencies — only when editing */}
        {editingTask && (
          <div style={{ borderTop: '0.5px solid var(--bd)', paddingTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', marginBottom: 10 }}>Dependências</div>

            {loadingDeps ? (
              <div style={{ fontSize: 11, color: 'var(--t2)', padding: '4px 0' }}>Carregando...</div>
            ) : (
              <>
                {/* Predecessoras */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--t2)', marginBottom: 4 }}>Predecessoras (devem terminar antes desta iniciar)</div>
                  {predecessors.length === 0
                    ? <div style={{ fontSize: 11, color: 'var(--t3)', fontStyle: 'italic' }}>Nenhuma</div>
                    : predecessors.map((d) => depRow(d, 'pred'))
                  }
                </div>

                {/* Sucessoras */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--t2)', marginBottom: 4 }}>Sucessoras (iniciam após esta terminar)</div>
                  {successors.length === 0
                    ? <div style={{ fontSize: 11, color: 'var(--t3)', fontStyle: 'italic' }}>Nenhuma</div>
                    : successors.map((d) => depRow(d, 'succ'))
                  }
                </div>

                {/* Add dependency panel */}
                {!addingDep ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="ao-btn ao-btn-sm" onClick={() => { setAddingDep(true); setAddDepRole('predecessor'); }}>+ Predecessora</button>
                    <button className="ao-btn ao-btn-sm" onClick={() => { setAddingDep(true); setAddDepRole('successor'); }}>+ Sucessora</button>
                  </div>
                ) : (
                  <div style={{ background: 'var(--s1)', borderRadius: 8, padding: 10, border: '1px solid var(--bd)' }}>
                    <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 6 }}>
                      Selecionar {addDepRole === 'predecessor' ? 'predecessora' : 'sucessora'}:
                    </div>
                    <input
                      style={{ ...inp, marginBottom: 6 }}
                      placeholder="Buscar por nome ou código..."
                      value={depSearch}
                      onChange={(e) => setDepSearch(e.target.value)}
                      autoFocus
                    />
                    <div style={{ maxHeight: 140, overflowY: 'auto', marginBottom: 6 }}>
                      {depCandidates.length === 0
                        ? <div style={{ fontSize: 11, color: 'var(--t3)', fontStyle: 'italic', padding: '4px 0' }}>Nenhuma atividade encontrada</div>
                        : depCandidates.map((t) => (
                          <div
                            key={t.id}
                            onClick={() => handleAddDep(t.id)}
                            style={{ cursor: 'pointer', padding: '4px 6px', borderRadius: 4, fontSize: 11, display: 'flex', gap: 6, alignItems: 'center' }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--s2)'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = ''; }}
                          >
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--t3)', minWidth: 32, flexShrink: 0 }}>{t.code}</span>
                            <span style={{ color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                          </div>
                        ))
                      }
                    </div>
                    <button className="ao-btn ao-btn-sm" onClick={() => { setAddingDep(false); setDepSearch(''); }}>Cancelar</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '0.5px solid var(--bd)', paddingTop: 12 }}>
          <button className="ao-btn ao-btn-sm" onClick={onClose} disabled={saving}>Cancelar</button>
          <button
            className="ao-btn ao-btn-sm"
            style={{ background: '#1A56A0', color: '#fff', border: 'none', opacity: saving || !form.name.trim() ? 0.6 : 1 }}
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
          >
            {saving ? 'Salvando...' : editingTask ? 'Atualizar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DeleteConfirm ─────────────────────────────────────────────────────────────

interface DeleteConfirmProps {
  task: GanttTask | null;
  allTasks: GanttTask[];
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirm({ task, allTasks, loading, onConfirm, onCancel }: DeleteConfirmProps) {
  if (!task) return null;

  const childCount = allTasks.filter((t) => {
    let pid = t.parentId;
    while (pid) {
      if (pid === task.id) return true;
      pid = allTasks.find((x) => x.id === pid)?.parentId;
    }
    return false;
  }).length;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1001, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'var(--s0)', border: '1px solid var(--bd)', borderRadius: 12, padding: '1.25rem', width: '100%', maxWidth: 360 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--t1)', marginBottom: 8 }}>Excluir atividade</div>
        <p style={{ fontSize: 12, color: 'var(--t2)', marginBottom: childCount > 0 ? 6 : 16 }}>
          Tem certeza que deseja excluir <strong style={{ color: 'var(--t1)' }}>"{task.name}"</strong>?
        </p>
        {childCount > 0 && (
          <p style={{ fontSize: 12, color: '#B91C1C', marginBottom: 16 }}>
            ⚠ {childCount} atividade{childCount > 1 ? 's filha' : ' filha'} também {childCount > 1 ? 'serão excluídas' : 'será excluída'}.
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="ao-btn ao-btn-sm" onClick={onCancel} disabled={loading}>Cancelar</button>
          <button
            className="ao-btn ao-btn-sm"
            style={{ background: '#B91C1C', color: '#fff', border: 'none', opacity: loading ? 0.6 : 1 }}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Import Modal ──────────────────────────────────────────────────────────────

interface ImportModalProps {
  open: boolean;
  step: 1 | 2 | 3;
  file: File | null;
  preview: Record<string, unknown>[];
  importing: boolean;
  projectId: string;
  onClose: () => void;
  setStep: (s: 1 | 2 | 3) => void;
  setFile: (f: File | null) => void;
  setPreview: (p: Record<string, unknown>[]) => void;
  setImporting: (b: boolean) => void;
  addToast: (t: any) => void;
  onImportSuccess: () => void;
}

function ImportModal({ open, step, file, preview, importing, projectId, onClose, setStep, setFile, setPreview, setImporting, addToast, onImportSuccess }: ImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const generateTemplate = () => {
    const templateData = [
      ['Código', 'Nome', 'Nível', 'Início', 'Término', 'Duração', '% Plan', '% Real', 'Caminho Crítico', 'Peso'],
      ['1', 'OBRA - Projeto Exemplo', '0', '2026-01-15', '2027-01-15', '365', '0', '0', 'N', '1'],
      ['1.1', 'ESTRUTURA', '1', '2026-01-15', '2026-07-15', '180', '10', '5', 'Y', '0.4'],
      ['1.1.1', 'Fundação', '2', '2026-01-15', '2026-03-15', '60', '100', '100', 'Y', '0.2'],
      ['1.1.1.1', 'Estacas', '3', '2026-01-15', '2026-02-28', '45', '100', '100', 'Y', '0.1'],
      ['1.1.1.2', 'Blocos', '3', '2026-03-01', '2026-03-15', '15', '100', '90', 'Y', '0.1'],
      ['1.1.2', 'Pilares e Lajes', '2', '2026-03-16', '2026-07-15', '120', '5', '0', 'Y', '0.2'],
      ['1.2', 'ALVENARIA', '1', '2026-05-15', '2026-09-15', '120', '0', '0', 'N', '0.3'],
      ['1.2.1', 'Vedação interna', '2', '2026-05-15', '2026-08-15', '90', '0', '0', 'N', '0.15'],
      ['1.2.2', 'Vedação externa', '2', '2026-07-15', '2026-09-15', '60', '0', '0', 'N', '0.15'],
      ['1.3', 'ACABAMENTO', '1', '2026-09-16', '2027-01-15', '120', '0', '0', 'N', '0.3'],
      ['1.3.1', 'Revestimento', '2', '2026-09-16', '2026-12-15', '90', '0', '0', 'N', '0.15'],
      ['1.3.2', 'Pintura', '2', '2026-12-01', '2027-01-15', '45', '0', '0', 'N', '0.15'],
    ];

    const ws = xlsx.utils.aoa_to_sheet(templateData);
    ws['!cols'] = [
      { wch: 12 }, // Código
      { wch: 25 }, // Nome
      { wch: 8 },  // Nível
      { wch: 12 }, // Início
      { wch: 12 }, // Término
      { wch: 10 }, // Duração
      { wch: 8 },  // % Plan
      { wch: 8 },  // % Real
      { wch: 16 }, // Caminho Crítico
      { wch: 8 },  // Peso
    ];

    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Cronograma');
    xlsx.writeFile(wb, 'template-cronograma.xlsx');

    addToast({ type: 'success', title: 'Template baixado', description: 'Abra o arquivo e adapte aos seus dados.' });
  };

  const handleFileInput = (f: File | null) => {
    if (!f) return;
    if (!/\.(csv|xlsx|xls)$/i.test(f.name)) {
      addToast({ type: 'error', title: 'Arquivo inválido', description: 'Selecione um arquivo CSV, XLSX ou XLS.' });
      return;
    }
    setFile(f);
    handlePreview(f);
  };

  const handlePreview = (f: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = xlsx.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
        setPreview(rows.slice(0, 5));
      } catch (err) {
        addToast({ type: 'error', title: 'Erro ao ler arquivo', description: 'Não foi possível processar o arquivo.' });
      }
    };
    reader.readAsArrayBuffer(f);
  };

  const handleImport = async () => {
    if (!file || !projectId) return;
    setImporting(true);
    try {
      const result = await scheduleApi.import(projectId, file);
      addToast({
        type: result.imported > 0 ? 'success' : 'warning',
        title: `Importação completa`,
        description: `${result.imported} atividades importadas.${result.skipped > 0 ? ` ${result.skipped} linhas puladas.` : ''}`,
      });
      if (result.errors.length > 0) {
        console.log('Erros na importação:', result.errors);
      }
      onImportSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      addToast({
        type: 'error',
        title: 'Erro ao importar',
        description: msg ?? 'Tente novamente com outro arquivo.',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1002, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'var(--s0)', border: '1px solid var(--bd)', borderRadius: 12, padding: '1.25rem', width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Step 1: File selection */}
        {step === 1 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--t1)' }}>Importar CSV/XLSX</span>
              <button
                onClick={generateTemplate}
                style={{
                  fontSize: 11,
                  padding: '5px 10px',
                  border: '0.5px solid #3B82F6',
                  borderRadius: 6,
                  background: 'transparent',
                  color: '#3B82F6',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                📥 Baixar template
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 16 }}>
              Selecione um arquivo CSV ou XLSX com o formato correto. Clique em "Baixar template" para um exemplo de estrutura. O cronograma existente será substituído.
            </p>

            {/* Colunas esperadas */}
            <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 11, color: 'var(--t2)' }}>
              <div style={{ fontWeight: 600, color: 'var(--t1)', marginBottom: 8 }}>Colunas esperadas:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
                <div><strong>Código</strong></div>
                <div>WBS: 1, 1.1, 1.1.1 (obrigatório)</div>

                <div><strong>Nome</strong></div>
                <div>Descrição da atividade (obrigatório)</div>

                <div><strong>Nível</strong></div>
                <div>0-9 (opcional, derivado do código)</div>

                <div><strong>Início</strong></div>
                <div>YYYY-MM-DD (obrigatório)</div>

                <div><strong>Término</strong></div>
                <div>YYYY-MM-DD (obrigatório)</div>

                <div><strong>Duração</strong></div>
                <div>Dias (opcional, calculado se omitido)</div>

                <div><strong>% Plan</strong></div>
                <div>0-100 (opcional)</div>

                <div><strong>% Real</strong></div>
                <div>0-100 (opcional)</div>

                <div><strong>Caminho Crítico</strong></div>
                <div>Y/N (opcional)</div>

                <div><strong>Peso</strong></div>
                <div>Número (opcional, padrão 1)</div>
              </div>
            </div>

            <div
              style={{
                border: '2px dashed var(--bd)',
                borderRadius: 8,
                padding: '2rem',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'var(--s1)',
                marginBottom: 12,
                transition: 'all 0.2s',
              }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.style.background = 'var(--s2)';
                e.currentTarget.style.borderColor = '#1A56A0';
              }}
              onDragLeave={(e) => {
                e.currentTarget.style.background = 'var(--s1)';
                e.currentTarget.style.borderColor = 'var(--bd)';
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.style.background = 'var(--s1)';
                e.currentTarget.style.borderColor = 'var(--bd)';
                const f = e.dataTransfer.files[0];
                handleFileInput(f);
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)', marginBottom: 6 }}>
                {file ? `📁 ${file.name}` : '📤 Arraste um arquivo aqui'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--t3)' }}>
                ou clique para selecionar
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              style={{ display: 'none' }}
              onChange={(e) => handleFileInput(e.target.files?.[0] ?? null)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="ao-btn ao-btn-sm" onClick={onClose}>Cancelar</button>
              <button
                className="ao-btn ao-btn-sm"
                style={{ background: '#1A56A0', color: '#fff', border: 'none', opacity: !file || preview.length === 0 ? 0.5 : 1 }}
                disabled={!file || preview.length === 0}
                onClick={() => setStep(2)}
              >
                {preview.length > 0 ? 'Avançar →' : 'Carregando...'}
              </button>
            </div>
          </>
        )}

        {/* Step 2: Preview */}
        {step === 2 && (
          <>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--t1)', marginBottom: 12 }}>Pré-visualização</div>
            <p style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 12 }}>
              {file?.name} — {preview.length > 0 ? `Primeiras ${preview.length} linhas` : 'Nenhuma linha'}
            </p>
            {preview.length > 0 ? (
              <div style={{ overflowX: 'auto', marginBottom: 16, border: '1px solid var(--bd)', borderRadius: 6, background: 'var(--s1)' }}>
                <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {Object.keys(preview[0]).map((key) => (
                        <th key={key} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 500, color: 'var(--t2)', borderRight: '0.5px solid var(--bd)' }}>
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, idx) => (
                      <tr key={idx} style={{ borderTop: '0.5px solid var(--bd)' }}>
                        {Object.values(row).map((val, colIdx) => (
                          <td key={colIdx} style={{ padding: '6px 8px', color: 'var(--t1)', borderRight: '0.5px solid var(--bd)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="ao-btn ao-btn-sm" onClick={onClose}>Cancelar</button>
              <button className="ao-btn ao-btn-sm" onClick={() => setStep(1)}>← Voltar</button>
              <button
                className="ao-btn ao-btn-sm"
                style={{ background: '#1A56A0', color: '#fff', border: 'none' }}
                onClick={() => setStep(3)}
              >
                Avançar →
              </button>
            </div>
          </>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && (
          <>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--t1)', marginBottom: 12 }}>Confirmar importação</div>
            <div style={{ padding: '12px', background: '#FEF3C7', border: '0.5px solid #F59E0B', borderRadius: 6, marginBottom: 16 }}>
              <p style={{ fontSize: 12, color: '#92400E', margin: 0 }}>
                ⚠ <strong>Atenção:</strong> Isso substituirá <strong>todas as atividades</strong> do cronograma atual. Esta ação não pode ser desfeita.
              </p>
            </div>
            <p style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 16 }}>
              {file?.name}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="ao-btn ao-btn-sm" onClick={onClose} disabled={importing}>Cancelar</button>
              <button className="ao-btn ao-btn-sm" onClick={() => setStep(2)} disabled={importing}>← Voltar</button>
              <button
                className="ao-btn ao-btn-sm"
                style={{ background: '#B91C1C', color: '#fff', border: 'none', opacity: importing ? 0.6 : 1 }}
                onClick={handleImport}
                disabled={importing}
              >
                {importing ? 'Importando...' : 'Importar cronograma'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Cronograma() {
  const { currentProject, addToast } = useStore();
  const projectId = currentProject?.id;
  const { push, triggerReload, reloadTrigger, triggerDataOnly, dataOnlyTrigger, past, future, undo, redo, isProcessing: historyProcessing } = useHistoryStore();

  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const expandedRef = useRef<Set<string>>(new Set());
  const [outlineLevel, setOutlineLevel] = useState<number | 'all'>('all');
  const [searchRaw, setSearchRaw] = useState('');
  const [search, setSearch] = useState('');
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<GanttTask | null>(null);
  const [parentTask, setParentTask] = useState<GanttTask | null>(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<GanttTask | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Import modal state
  const [showImport, setShowImport] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2 | 3>(1);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<Record<string, unknown>[]>([]);
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  // Column visibility state (ID column always visible)
  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set(COL_DEFS.map(c => c.key));
    try {
      const saved = localStorage.getItem('cronograma_cols');
      let cols: Set<string>;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          cols = new Set(parsed);
        } else {
          console.warn('Invalid cronograma_cols format, resetting');
          cols = new Set(COL_DEFS.map(c => c.key));
        }
      } else {
        cols = new Set(COL_DEFS.map(c => c.key));
      }
      cols.add('rowId'); // Ensure ID column is always included
      return cols;
    } catch (e) {
      console.error('Error loading visible columns:', e);
      // Clear corrupted data
      try {
        localStorage.removeItem('cronograma_cols');
      } catch {}
      return new Set(COL_DEFS.map(c => c.key));
    }
  });
  const [showColPicker, setShowColPicker] = useState(false);

  // Baseline state
  const [baselines, setBaselines] = useState<any[]>([]);
  const [showBaselineConfirm, setShowBaselineConfirm] = useState(false);
  const [baselineDescription, setBaselineDescription] = useState('');
  const [showBaselineHistory, setShowBaselineHistory] = useState(false);
  const [selectedBaseline, setSelectedBaseline] = useState<any | null>(null);
  const [baselineComparison, setBaselineComparison] = useState<any | null>(null);
  const [savingBaseline, setSavingBaseline] = useState(false);
  const [showBaselineMenu, setShowBaselineMenu] = useState(false);

  // Physical progress state
  const [metrics, setMetrics] = useState<ProjectMetrics | null>(null);
  const [reports, setReports] = useState<ProjectReport[]>([]);
  const [showSaveReportConfirm, setShowSaveReportConfirm] = useState(false);
  const [reportDescription, setReportDescription] = useState('');
  const [savingReport, setSavingReport] = useState(false);
  const [showReportHistory, setShowReportHistory] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportComparison | null>(null);
  const [showReportMenu, setShowReportMenu] = useState(false);

  // Inline edit state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [inlineEdit, setInlineEdit] = useState<{ taskId: string; colKey: string; value: string } | null>(null);
  const inlineInputRef = useRef<HTMLInputElement | null>(null);
  const inlineEditIdRef = useRef<string | null>(null);

  // Keyboard navigation state
  const [selectedColIdx, setSelectedColIdx] = useState<number>(0);
  const [clipboard, setClipboard] = useState<{ colKey: string; value: string } | null>(null);
  const afterCommitRef = useRef<'enter' | 'tab' | 'blur'>('blur');
  const rowRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());

  // Filter state
  const [colFilters, setColFilters] = useState<Record<string, string[]>>({});
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [filterDropdownCol, setFilterDropdownCol] = useState<string | null>(null);

  // Advanced filters state
  interface AdvancedFilters {
    dateStart: string;
    dateEnd: string;
    progressMin: string;
    progressMax: string;
    onlyLate: boolean;
    onlyCritical: boolean;
    onlyDone: boolean;
    responsibles: string[];
  }
  const [advFilters, setAdvFilters] = useState<AdvancedFilters>({
    dateStart: '', dateEnd: '', progressMin: '', progressMax: '',
    onlyLate: false, onlyCritical: false, onlyDone: false, responsibles: []
  });
  const [showAdvFilters, setShowAdvFilters] = useState(false);

  // Column widths state
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = localStorage.getItem('cronograma_col_widths');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed;
        } else {
          console.warn('Invalid cronograma_col_widths format, resetting');
          return {};
        }
      }
      return {};
    } catch (e) {
      console.error('Error loading column widths:', e);
      // Clear corrupted data
      try {
        localStorage.removeItem('cronograma_col_widths');
      } catch {}
      return {};
    }
  });

  // Time scale state
  const [timeScale, setTimeScale] = useState<TimeScale>('month');
  const pxPerDay = PX_PER_DAY_BY_SCALE[timeScale];

  // Splitter state
  const [splitterWidth, setSplitterWidth] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    const saved = localStorage.getItem('cronograma_splitter');
    return saved ? Number(saved) : null;
  });

  // Calculate visible column widths early
  const visibleColDefs = useMemo(() => COL_DEFS.filter(c => visibleCols.has(c.key)), [visibleCols]);
  const effectiveWidth = (col: ColDef) => colWidths[col.key] ?? col.width;
  const leftPanelWidth = useMemo(() => visibleColDefs.reduce((sum, c) => sum + effectiveWidth(c), 0), [visibleColDefs, colWidths]);
  const finalLeftWidth = splitterWidth ?? leftPanelWidth;

  // Scroll refs
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const hdrRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);
  const dragRef = useRef<{ colKey: string; startX: number; startWidth: number } | null>(null);
  const colRefsMap = useRef<Map<string, HTMLButtonElement | null>>(new Map());
  const splitterDragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchRaw.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [searchRaw]);

  // Sync visible columns to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const data = Array.from(visibleCols);
      localStorage.setItem('cronograma_cols', JSON.stringify(data));
      console.log('[Cronograma] Saved visible columns:', data);
    } catch (e) {
      console.error('[Cronograma] Failed to save visible columns:', e);
    }
  }, [visibleCols]);

  // Sync column widths to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('cronograma_col_widths', JSON.stringify(colWidths));
      console.log('[Cronograma] Saved column widths');
    } catch (e) {
      console.error('[Cronograma] Failed to save column widths:', e);
    }
  }, [colWidths]);

  // Clean up column refs map when visible columns change
  useEffect(() => {
    const visibleKeys = new Set(visibleColDefs.map(c => c.key));
    const keysToDelete: string[] = [];
    colRefsMap.current.forEach((_, key) => {
      if (!visibleKeys.has(key)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => colRefsMap.current.delete(key));
  }, [visibleColDefs]);

  // Get enterprise progress from root task (level 0 or no parent)
  const enterpriseProgress = useMemo(() => {
    // Try to find by ID first
    let root = tasks.find(t => t.id === '1');

    // If not found by ID, find first level-0 task
    if (!root) {
      root = tasks.find(t => t.level === 0 && !t.parentId);
    }

    // If still not found, use first task
    if (!root && tasks.length > 0) {
      root = tasks[0];
    }

    const progress = root?.actualProgress ?? 0;
    console.log('[Cronograma] Enterprise Progress:', {
      method: root?.id === '1' ? 'byId' : root?.level === 0 ? 'byLevel' : 'byFirst',
      taskId: root?.id,
      taskName: root?.name,
      progress,
    });
    return progress;
  }, [tasks]);

  // Keep expandedRef in sync so closures can read current value without stale deps
  useEffect(() => { expandedRef.current = expanded; }, [expanded]);

  const loadData = useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    scheduleApi.ganttData(projectId)
      .then((data) => {
        const sorted = [...data].sort((a, b) => compareWbs(a.code, b.code))
          .map((t, i) => ({ ...t, rowId: i + 1 }));
        // Aplica rollup pais←filhas em memória (DB pode estar fora de sync com dados antigos/seed)
        const { tasks: rolled } = propagateAndRollup(sorted);
        setTasks(rolled);
        const ids = rolled.filter((t) => t.hasChildren && t.level <= 1).map((t) => t.id);
        setExpanded(new Set(ids));
      })
      .catch(() => {
        const mock = buildMockTasks().sort((a, b) => compareWbs(a.code, b.code))
          .map((t, i) => ({ ...t, rowId: i + 1 }));
        const { tasks: rolled } = propagateAndRollup(mock);
        setTasks(rolled);
        const ids = rolled.filter((t) => t.hasChildren && t.level <= 1).map((t) => t.id);
        setExpanded(new Set(ids));
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  // Refresh only task data, preserving all UI state (expanded, scroll, filters, zoom)
  const loadTasksOnly = useCallback(() => {
    if (!projectId) return;
    const prevExpanded = expandedRef.current;
    scheduleApi.ganttData(projectId)
      .then((data) => {
        const sorted = [...data].sort((a, b) => compareWbs(a.code, b.code))
          .map((t, i) => ({ ...t, rowId: i + 1 }));
        const { tasks: rolled } = propagateAndRollup(sorted);
        setTasks(rolled);
        const validHasChildren = new Set(rolled.filter(t => t.hasChildren).map(t => t.id));
        setExpanded(new Set([...prevExpanded].filter(id => validHasChildren.has(id))));
      })
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      loadData();
      loadMetrics();
    } else {
      const mock = buildMockTasks().sort((a, b) => compareWbs(a.code, b.code))
        .map((t, i) => ({ ...t, rowId: i + 1 }));
      setTasks(mock);
      const ids = mock.filter((t) => t.hasChildren && t.level <= 1).map((t) => t.id);
      setExpanded(new Set(ids));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadData, projectId, reloadTrigger]);

  // dataOnlyTrigger: undo/redo refreshes data without resetting expanded/scroll/filters
  useEffect(() => {
    if (dataOnlyTrigger > 0) loadTasksOnly();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataOnlyTrigger]);

  // Ancestor set for search filtering
  const ancestorIds = useMemo((): Set<string> => {
    if (!search) return new Set();
    const idToParent: Record<string, string> = {};
    tasks.forEach((t) => { if (t.parentId) idToParent[t.id] = t.parentId; });
    const matched = tasks.filter((t) => t.name.toLowerCase().includes(search));
    const ancestors = new Set<string>();
    matched.forEach((t) => {
      let pid = t.parentId;
      while (pid) { ancestors.add(pid); pid = idToParent[pid]; }
    });
    return ancestors;
  }, [search, tasks]);

  // Unique values per column (for filter dropdowns)
  const colUniqueValues = useMemo<Record<string, string[]>>(() => {
    const result: Record<string, string[]> = {};
    COL_DEFS.forEach(col => {
      const vals = new Set(tasks.map(t => formatCellForFilter(t, col.key)).filter(v => v !== ''));
      result[col.key] = Array.from(vals).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    });
    return result;
  }, [tasks]);

  // Unique responsibles (for advanced filters)
  const uniqueResponsibles = useMemo(() => {
    const set = new Set(tasks.map(t => t.responsible).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [tasks]);

  // Visible tasks (with filters and sorting)
  const visibleTasks = useMemo(() => {
    // Step 1: Apply search and expand
    let result: GanttTask[] = [];
    if (search) {
      const matchedIds = new Set(tasks.filter((t) => t.name.toLowerCase().includes(search)).map((t) => t.id));
      result = tasks.filter((t) => matchedIds.has(t.id) || ancestorIds.has(t.id));
    } else {
      const hidden = new Set<string>();
      tasks.forEach((t) => {
        if (!t.parentId) return;
        let pid: string | undefined = t.parentId;
        while (pid) {
          const parent = tasks.find((x) => x.id === pid);
          if (!parent) break;
          if (parent.hasChildren && !expanded.has(parent.id)) { hidden.add(t.id); break; }
          pid = parent.parentId;
        }
      });
      result = tasks.filter((t) => !hidden.has(t.id));
    }

    // Step 2: Apply column filters
    Object.entries(colFilters).forEach(([key, vals]) => {
      if (!vals || vals.length === 0) return;
      result = result.filter(t => vals.includes(formatCellForFilter(t, key)));
    });

    // Step 3: Apply advanced filters
    if (advFilters.onlyLate) result = result.filter(t => t.actualProgress < t.plannedProgress);
    if (advFilters.onlyCritical) result = result.filter(t => t.isCriticalPath);
    if (advFilters.onlyDone) result = result.filter(t => t.actualProgress === 100);
    if (advFilters.responsibles.length > 0) {
      result = result.filter(t => advFilters.responsibles.includes(t.responsible ?? ''));
    }
    if (advFilters.progressMin !== '') {
      result = result.filter(t => t.actualProgress >= parseFloat(advFilters.progressMin));
    }
    if (advFilters.progressMax !== '') {
      result = result.filter(t => t.actualProgress <= parseFloat(advFilters.progressMax));
    }
    if (advFilters.dateStart) {
      result = result.filter(t => t.startDate >= advFilters.dateStart);
    }
    if (advFilters.dateEnd) {
      result = result.filter(t => t.endDate <= advFilters.dateEnd);
    }

    // Step 4: Apply sorting (respecting hierarchy)
    if (sortConfig) {
      const childrenMap = new Map<string | undefined, GanttTask[]>();
      result.forEach(t => {
        const pid = t.parentId as string | undefined;
        if (!childrenMap.has(pid)) childrenMap.set(pid, []);
        childrenMap.get(pid)!.push(t);
      });
      const sortSiblings = (group: GanttTask[]) => {
        return [...group].sort((a, b) => {
          const va = getCellRawValue(a, sortConfig.key);
          const vb = getCellRawValue(b, sortConfig.key);
          const cmp = va.localeCompare(vb, undefined, { numeric: true });
          return sortConfig.dir === 'asc' ? cmp : -cmp;
        });
      };
      const sorted: GanttTask[] = [];
      const dfs = (parentId: string | undefined) => {
        const children = childrenMap.get(parentId) ?? [];
        sortSiblings(children).forEach(t => {
          sorted.push(t);
          dfs(t.id);
        });
      };
      dfs(undefined);
      result = sorted;
    }

    return result;
  }, [tasks, expanded, search, ancestorIds, colFilters, advFilters, sortConfig]);

  // Date range
  const { minDate, maxDate, totalWidth } = useMemo(() => {
    if (tasks.length === 0) {
      const now = new Date();
      const min = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const max = new Date(now.getFullYear(), now.getMonth() + 6, 1);
      return { minDate: min, maxDate: max, totalWidth: daysBetween(min, max) * pxPerDay };
    }
    const dates = tasks.flatMap((t) => [parseDate(t.startDate), parseDate(t.endDate)]);
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    min.setMonth(min.getMonth() - 1);
    max.setMonth(max.getMonth() + 1);
    return { minDate: min, maxDate: max, totalWidth: daysBetween(min, max) * pxPerDay };
  }, [tasks, pxPerDay]);

  const todayLeft = useMemo(() => daysBetween(minDate, new Date()) * pxPerDay, [minDate, pxPerDay]);

  // Inline edit handlers
  function startInlineEdit(task: GanttTask, colKey: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    if (['successors', 'critical'].includes(colKey)) {
      openEdit(task, { stopPropagation: () => {} } as any);
      return;
    }
    // Tarefas pai: datas e duração são calculadas a partir das filhas (bloqueio de edição manual)
    if (task.hasChildren && ['startDate', 'endDate', 'duration'].includes(colKey)) {
      addToast({
        type: 'info',
        title: 'Campo automático',
        description: 'Datas e duração da tarefa pai são calculadas a partir das filhas.',
      });
      return;
    }

    let value: string;
    switch (colKey) {
      case 'name': value = task.name; break;
      case 'code': value = task.code; break;
      case 'duration': value = String(task.durationDays ?? ''); break;
      case 'startDate': value = task.startDate.slice(0, 10); break;
      case 'endDate': value = task.endDate.slice(0, 10); break;
      case 'progress': value = String(task.actualProgress); break;
      case 'weight': value = String(task.weight ?? '0'); break;
      case 'responsible': value = task.responsible ?? ''; break;
      case 'predecessors': value = formatDepsAsText(task, tasks); break;
      default: return;
    }
    setSelectedTaskId(task.id);
    setInlineEdit({ taskId: task.id, colKey, value });
  }

  async function commitInlineEdit() {
    if (!inlineEdit) return;
    const task = tasks.find(t => t.id === inlineEdit.taskId);
    if (!task) { setInlineEdit(null); return; }

    // Snapshot of the task BEFORE any change (for undo)
    const oldForm = formFromTask(task);
    const colKey = inlineEdit.colKey;

    const form = formFromTask(task);
    try {
      switch (colKey) {
        case 'name':
          form.name = inlineEdit.value.trim();
          break;
        case 'code':
          form.code = inlineEdit.value.trim();
          break;
        case 'duration': {
          const days = parseInt(inlineEdit.value) || 1;
          if (days < 1) return;
          form.durationDays = days;
          const s = parseDate(task.startDate);
          // endDate inclusive: duração N → end = start + (N-1) dias úteis (duração 1 = mesmo dia)
          if (!isNaN(s.getTime())) form.endDate = addDays(s, days - 1);
          break;
        }
        case 'startDate': {
          form.startDate = inlineEdit.value;
          const s = parseDate(inlineEdit.value);
          const e = parseDate(form.endDate);
          if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e >= s) {
            form.durationDays = Math.max(1, workDaysBetween(s, e));
          }
          break;
        }
        case 'endDate': {
          form.endDate = inlineEdit.value;
          const s = parseDate(form.startDate);
          const e = parseDate(inlineEdit.value);
          if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e >= s) {
            form.durationDays = Math.max(1, workDaysBetween(s, e));
          }
          break;
        }
        case 'progress': {
          form.actualProgress = Math.min(100, Math.max(0, parseInt(inlineEdit.value) || 0));
          break;
        }
        case 'weight': {
          form.weight = Math.max(0, parseFloat(inlineEdit.value) || 0);
          break;
        }
        case 'responsible': {
          form.responsible = inlineEdit.value.trim();
          break;
        }
        case 'predecessors': {
          setInlineEdit(null);
          await commitPredecessors(task, inlineEdit.value);
          return;
        }
      }

      if (!form.name.trim()) {
        setInlineEdit(null);
        return;
      }

      const payload = {
        name: form.name,
        code: form.code,
        level: form.level,
        parentId: form.parentId || undefined,
        startDate: form.startDate,
        endDate: form.endDate,
        durationDays: form.durationDays,
        plannedProgress: form.plannedProgress,
        actualProgress: form.actualProgress,
        weight: form.weight,
        isCriticalPath: form.isCriticalPath,
        responsible: form.responsible || undefined,
      };

      if (projectId) {
        await scheduleApi.update(task.id, payload);
      }

      let updatedTasks = tasks.map(t => t.id === task.id ? {
        ...t,
        name: form.name,
        code: form.code,
        startDate: form.startDate,
        endDate: form.endDate,
        durationDays: form.durationDays,
        actualProgress: form.actualProgress,
        weight: form.weight,
        responsible: form.responsible || undefined,
      } : t);

      // Progress cascade: recalculate parent progress
      type CascadeItem = { id: string; oldVal: number; newVal: number };
      const progressCascade: CascadeItem[] = [];

      if (colKey === 'progress') {
        const originalTasks = tasks;
        updatedTasks = recalculateParentProgress(updatedTasks);

        const parentsChanged = updatedTasks.filter(t => {
          const orig = originalTasks.find(o => o.id === t.id);
          return orig && t.parentId && orig.actualProgress !== t.actualProgress;
        });

        if (parentsChanged.length > 0 && projectId) {
          await Promise.all(parentsChanged.map(t => scheduleApi.update(t.id, {
            actualProgress: t.actualProgress,
          })));
        }

        parentsChanged.forEach(t => {
          const orig = originalTasks.find(o => o.id === t.id)!;
          progressCascade.push({ id: t.id, oldVal: orig.actualProgress, newVal: t.actualProgress });
        });
      }

      // Date cascade: propagate to dependent tasks + roll up parent dates from children
      type DateCascadeItem = { id: string; oldStart: string; oldEnd: string; oldDuration?: number; newStart: string; newEnd: string; newDuration?: number };
      const dateCascade: DateCascadeItem[] = [];

      // Sempre roda o rollup de pais (cobre mudança de parentId, criação, exclusão, etc.).
      // O propagateAndRollup também aplica a cascata por dependências quando aplicável.
      const runDateCascade = ['duration', 'startDate', 'endDate'].includes(colKey);
      if (runDateCascade) {
        const result = propagateAndRollup(updatedTasks);
        updatedTasks = result.tasks;
      } else {
        // Mesmo sem mudança de data, garante consistência dos pais (ex: troca de parentId via outras vias)
        const result = recalculateParentDates(updatedTasks);
        updatedTasks = result.tasks;
      }

      const dateChanged = updatedTasks.filter(t => {
        const orig = tasks.find(o => o.id === t.id);
        return orig && (
          orig.startDate.slice(0,10) !== t.startDate.slice(0,10) ||
          orig.endDate.slice(0,10) !== t.endDate.slice(0,10) ||
          (orig.durationDays ?? 0) !== (t.durationDays ?? 0)
        );
      });
      if (dateChanged.length > 0 && projectId) {
        await Promise.all(dateChanged.map(t => scheduleApi.update(t.id, {
          startDate: t.startDate.slice(0,10),
          endDate: t.endDate.slice(0,10),
          durationDays: t.durationDays,
        })));
      }
      dateChanged.forEach(t => {
        const orig = tasks.find(o => o.id === t.id)!;
        dateCascade.push({
          id: t.id,
          oldStart: orig.startDate.slice(0,10),
          oldEnd: orig.endDate.slice(0,10),
          oldDuration: orig.durationDays ?? 0,
          newStart: t.startDate.slice(0,10),
          newEnd: t.endDate.slice(0,10),
          newDuration: t.durationDays ?? 0,
        });
      });

      setTasks(updatedTasks);
      addToast({ type: 'success', title: 'Salvo', description: `"${form.name}" atualizado.` });

      // Record in history
      const taskId = task.id;
      const taskName = form.name;
      const colLabel = COL_DEFS.find(c => c.key === colKey)?.label ?? colKey;
      const undoPayload = {
        name: oldForm.name, code: oldForm.code, level: oldForm.level,
        parentId: oldForm.parentId || undefined, startDate: oldForm.startDate,
        endDate: oldForm.endDate, durationDays: oldForm.durationDays,
        plannedProgress: oldForm.plannedProgress, actualProgress: oldForm.actualProgress,
        weight: oldForm.weight, isCriticalPath: oldForm.isCriticalPath,
        responsible: oldForm.responsible || undefined,
      };

      push({
        description: `${colLabel}: "${taskName}"`,
        module: 'cronograma',
        undo: async () => {
          await scheduleApi.update(taskId, undoPayload);
          await Promise.all(progressCascade.map(c => scheduleApi.update(c.id, { actualProgress: c.oldVal })));
          await Promise.all(dateCascade.map(c => scheduleApi.update(c.id, {
            startDate: c.oldStart,
            endDate: c.oldEnd,
            ...(c.oldDuration !== undefined ? { durationDays: c.oldDuration } : {}),
          })));
          triggerDataOnly();
        },
        redo: async () => {
          await scheduleApi.update(taskId, payload);
          await Promise.all(progressCascade.map(c => scheduleApi.update(c.id, { actualProgress: c.newVal })));
          await Promise.all(dateCascade.map(c => scheduleApi.update(c.id, {
            startDate: c.newStart,
            endDate: c.newEnd,
            ...(c.newDuration !== undefined ? { durationDays: c.newDuration } : {}),
          })));
          triggerDataOnly();
        },
      });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      addToast({ type: 'error', title: 'Erro ao salvar', description: msg ?? 'Tente novamente.' });
    }

    const mode = afterCommitRef.current;
    afterCommitRef.current = 'blur';
    setInlineEdit(null);

    // Move to next row if Enter was pressed
    if (mode === 'enter' && task) {
      const rowIdx = visibleTasks.findIndex(t => t.id === task.id);
      const next = visibleTasks[rowIdx + 1];
      if (next) {
        setSelectedTaskId(next.id);
        setTimeout(() => scrollToRow(rowIdx + 1), 0);
      }
    }
  }

  function cancelInlineEdit() {
    setInlineEdit(null);
  }

  // Focus on inline input when edit starts
  useEffect(() => {
    if (inlineEdit && inlineInputRef.current) {
      const editId = `${inlineEdit.taskId}-${inlineEdit.colKey}`;
      const isNewEdit = inlineEditIdRef.current !== editId;
      inlineEditIdRef.current = editId;

      inlineInputRef.current.focus();
      if (isNewEdit && inlineEdit.colKey !== 'duration' && inlineEdit.colKey !== 'progress' && inlineEdit.colKey !== 'startDate' && inlineEdit.colKey !== 'endDate') {
        inlineInputRef.current.select();
      }
    } else {
      inlineEditIdRef.current = null;
    }
  }, [inlineEdit?.taskId, inlineEdit?.colKey]);

  // Focus on selected row
  useEffect(() => {
    if (selectedTaskId && !inlineEdit) {
      const el = leftRef.current?.querySelector<HTMLDivElement>(`[data-task-id="${selectedTaskId}"]`);
      if (el && document.activeElement !== el) {
        el.focus({ preventScroll: true });
      }
    }
  }, [selectedTaskId, inlineEdit]);

  // Scroll sync
  function onLeftScroll() {
    if (syncingRef.current) return;
    syncingRef.current = true;
    if (rightRef.current && leftRef.current) rightRef.current.scrollTop = leftRef.current.scrollTop;
    syncingRef.current = false;
  }
  function onRightScroll() {
    if (syncingRef.current) return;
    syncingRef.current = true;
    if (leftRef.current && rightRef.current) leftRef.current.scrollTop = rightRef.current.scrollTop;
    if (hdrRef.current && rightRef.current) hdrRef.current.scrollLeft = rightRef.current.scrollLeft;
    syncingRef.current = false;
  }

  function scrollToRow(rowIdx: number) {
    const el = leftRef.current;
    if (!el) return;
    const top = rowIdx * ROW_H;
    if (top < el.scrollTop) {
      el.scrollTop = top;
    } else if (top + ROW_H > el.scrollTop + el.clientHeight) {
      el.scrollTop = top + ROW_H - el.clientHeight;
    }
  }

  function onGanttWheel(e: React.WheelEvent) {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setTimeScale(prev => {
      const idx = SCALE_ORDER.indexOf(prev);
      if (e.deltaY < 0) return SCALE_ORDER[Math.max(0, idx - 1)];
      return SCALE_ORDER[Math.min(SCALE_ORDER.length - 1, idx + 1)];
    });
  }

  function onTableWheel(e: React.WheelEvent) {
    if (e.ctrlKey) return; // Let Gantt handle Ctrl+wheel for zoom
    if (!leftRef.current || !rightRef.current) return;
    e.preventDefault();
    const scrollDelta = e.deltaY;
    leftRef.current.scrollTop += scrollDelta;
    rightRef.current.scrollTop += scrollDelta;
  }

  function startSplitterResize(e: React.MouseEvent) {
    e.preventDefault();
    splitterDragRef.current = { startX: e.clientX, startWidth: finalLeftWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onSplitterResizeMove);
    document.addEventListener('mouseup', onSplitterResizeEnd);
  }

  function onSplitterResizeMove(e: MouseEvent) {
    if (!splitterDragRef.current) return;
    const delta = e.clientX - splitterDragRef.current.startX;
    const newWidth = Math.max(100, splitterDragRef.current.startWidth + delta);
    setSplitterWidth(newWidth);
  }

  function onSplitterResizeEnd() {
    if (!splitterDragRef.current) return;
    setSplitterWidth(prev => {
      try {
        localStorage.setItem('cronograma_splitter', String(prev ?? finalLeftWidth));
      } catch (e) {
        console.error('Failed to save splitter position:', e);
      }
      return prev;
    });
    splitterDragRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', onSplitterResizeMove);
    document.removeEventListener('mouseup', onSplitterResizeEnd);
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function expandAll() { setExpanded(new Set(tasks.filter((t) => t.hasChildren).map((t) => t.id))); }
  function collapseAll() { setExpanded(new Set()); }

  async function indentTask(taskId: string) {
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx <= 0) return;
    const task = tasks[idx];
    const prev = tasks[idx - 1];
    const levelDelta = (prev.level + 1) - task.level;
    const descendants = getAllDescendants(taskId, tasks);
    let updated = tasks.map(t => {
      if (t.id === taskId) return { ...t, parentId: prev.id, level: prev.level + 1 };
      if (descendants.some(d => d.id === t.id)) return { ...t, level: t.level + levelDelta };
      return t;
    });
    updated = updated.map(t => ({ ...t, hasChildren: updated.some(o => o.parentId === t.id) }));
    const recalculated = recalculateWbs(updated).map((t, i) => ({ ...t, rowId: i + 1 }));
    setTasks(recalculated);
    const changed = recalculated.filter(t => {
      const orig = tasks.find(o => o.id === t.id);
      return orig && (orig.code !== t.code || orig.parentId !== t.parentId || orig.level !== t.level);
    });
    // Snapshot before/after for undo
    const undoItems = changed.map(t => {
      const orig = tasks.find(o => o.id === t.id)!;
      return { id: t.id, code: orig.code, parentId: orig.parentId || undefined, level: orig.level };
    });
    const redoItems = changed.map(t => ({ id: t.id, code: t.code, parentId: t.parentId || undefined, level: t.level }));

    await Promise.all(changed.map(t =>
      scheduleApi.update(t.id, { code: t.code, parentId: t.parentId || undefined, level: t.level })
    ));

    push({
      description: `Indentar: "${task.name}"`,
      module: 'cronograma',
      undo: async () => {
        await Promise.all(undoItems.map(u => scheduleApi.update(u.id, { code: u.code, parentId: u.parentId, level: u.level })));
        triggerDataOnly();
      },
      redo: async () => {
        await Promise.all(redoItems.map(r => scheduleApi.update(r.id, { code: r.code, parentId: r.parentId, level: r.level })));
        triggerDataOnly();
      },
    });
  }

  async function outdentTask(taskId: string) {
    const task = tasks.find(t => t.id === taskId);
    if (!task?.parentId) return;
    const parent = tasks.find(t => t.id === task.parentId);
    if (!parent) return;
    const levelDelta = -1;
    const descendants = getAllDescendants(taskId, tasks);
    let updated = tasks.map(t => {
      if (t.id === taskId) return { ...t, parentId: parent.parentId, level: parent.level };
      if (descendants.some(d => d.id === t.id)) return { ...t, level: t.level + levelDelta };
      return t;
    });
    updated = updated.map(t => ({ ...t, hasChildren: updated.some(o => o.parentId === t.id) }));
    const recalculated = recalculateWbs(updated).map((t, i) => ({ ...t, rowId: i + 1 }));
    setTasks(recalculated);
    const changed = recalculated.filter(t => {
      const orig = tasks.find(o => o.id === t.id);
      return orig && (orig.code !== t.code || orig.parentId !== t.parentId || orig.level !== t.level);
    });
    const undoItems = changed.map(t => {
      const orig = tasks.find(o => o.id === t.id)!;
      return { id: t.id, code: orig.code, parentId: orig.parentId || undefined, level: orig.level };
    });
    const redoItems = changed.map(t => ({ id: t.id, code: t.code, parentId: t.parentId || undefined, level: t.level }));

    await Promise.all(changed.map(t =>
      scheduleApi.update(t.id, { code: t.code, parentId: t.parentId || undefined, level: t.level })
    ));

    push({
      description: `Recuar: "${task.name}"`,
      module: 'cronograma',
      undo: async () => {
        await Promise.all(undoItems.map(u => scheduleApi.update(u.id, { code: u.code, parentId: u.parentId, level: u.level })));
        triggerDataOnly();
      },
      redo: async () => {
        await Promise.all(redoItems.map(r => scheduleApi.update(r.id, { code: r.code, parentId: r.parentId, level: r.level })));
        triggerDataOnly();
      },
    });
  }

  function handleOutlineLevelChange(newLevel: number | 'all') {
    setOutlineLevel(newLevel);
    if (newLevel === 'all') {
      setExpanded(new Set(tasks.filter(t => t.hasChildren).map(t => t.id)));
    } else {
      setExpanded(new Set(tasks.filter(t => t.hasChildren && t.level <= (newLevel as number) - 2).map(t => t.id)));
    }
  }

  async function commitPredecessors(task: GanttTask, text: string) {
    const { deps: parsed, errors } = parsePredecessorText(text, tasks);
    if (errors.length) {
      addToast({ type: 'error', title: 'Erro nas predecessoras', description: errors.join('\n') });
      return;
    }
    // Snapshot of old dependencies for undo
    const oldDeps = (task.predecessorDeps ?? []).map(d => ({
      predecessorId: d.predecessorId, lagDays: d.lagDays, type: d.type,
    }));
    const taskId = task.id;
    const taskName = task.name;

    const existing = task.predecessorDeps ?? [];
    try {
      await Promise.all(existing.map(d => scheduleApi.removeDependency(d.id)));
      const created: { id: string; predecessorId: string; successorId: string; lagDays: number; type: string }[] = [];
      for (const p of parsed) {
        const predTask = tasks.find(t => t.rowId === p.rowId);
        if (!predTask) continue;
        if (wouldCreateLoop(task.id, predTask.id, tasks)) {
          addToast({ type: 'error', title: 'Dependência circular', description: `Vínculo com tarefa ${p.rowId} criaria um loop.` });
          continue;
        }
        const dep = await scheduleApi.addDependency(task.id, { predecessorId: predTask.id, lagDays: p.lag, type: p.type });
        created.push({ id: dep.id, predecessorId: dep.predecessorId, successorId: dep.successorId, lagDays: dep.lagDays, type: dep.type });
      }

      // New set of predecessor specs (for redo)
      const newDepSpecs = created.map(d => ({ predecessorId: d.predecessorId, lagDays: d.lagDays, type: d.type }));

      let updatedTasks = tasks.map(t => {
        if (t.id === task.id) return { ...t, predecessorDeps: created };
        const wasSuccessor = existing.some(d => d.predecessorId === t.id);
        const isSuccessor = created.some(d => d.predecessorId === t.id);
        if (wasSuccessor || isSuccessor) {
          const newSuccDeps = [
            ...(t.successorDeps ?? []).filter(d => d.successorId !== task.id),
            ...created.filter(d => d.predecessorId === t.id),
          ];
          return { ...t, successorDeps: newSuccDeps };
        }
        return t;
      });
      updatedTasks = propagateDates(updatedTasks);
      setTasks(updatedTasks);
      const dateChanged = updatedTasks.filter(t => {
        const orig = tasks.find(o => o.id === t.id);
        return orig && (orig.startDate.slice(0,10) !== t.startDate.slice(0,10) || orig.endDate.slice(0,10) !== t.endDate.slice(0,10));
      });
      await Promise.all(dateChanged.map(t => scheduleApi.update(t.id, {
        startDate: t.startDate.slice(0,10),
        endDate: t.endDate.slice(0,10),
      })));
      addToast({ type: 'success', title: 'Predecessoras atualizadas', description: `${created.length} vínculo(s) criado(s).` });

      // Record in history
      push({
        description: `Predecessoras: "${taskName}"`,
        module: 'cronograma',
        undo: async () => {
          const current = await scheduleApi.getDependencies(taskId);
          await Promise.all(current.map(d => scheduleApi.removeDependency(d.id)));
          for (const dep of oldDeps) {
            await scheduleApi.addDependency(taskId, dep);
          }
          triggerDataOnly();
        },
        redo: async () => {
          const current = await scheduleApi.getDependencies(taskId);
          await Promise.all(current.map(d => scheduleApi.removeDependency(d.id)));
          for (const dep of newDepSpecs) {
            await scheduleApi.addDependency(taskId, dep);
          }
          triggerDataOnly();
        },
      });
    } catch (err) {
      addToast({ type: 'error', title: 'Erro ao salvar', description: String(err) });
    }
  }

  // Baseline functions
  async function loadBaselineHistory() {
    if (!projectId) return;
    try {
      const data = await baselineApi.list(projectId);
      setBaselines(data);
    } catch (err) {
      addToast({ type: 'error', title: 'Erro ao carregar histórico', description: String(err) });
    }
  }

  async function saveBaseline() {
    if (!projectId) return;
    setSavingBaseline(true);
    try {
      const result = await baselineApi.create(projectId, baselineDescription || undefined);
      addToast({
        type: 'success',
        title: 'Linha de Base Gravada',
        description: `Versão ${result.version} criada com sucesso.`,
      });
      setShowBaselineConfirm(false);
      setBaselineDescription('');
      await loadBaselineHistory();
    } catch (err) {
      addToast({ type: 'error', title: 'Erro ao gravar', description: String(err) });
    } finally {
      setSavingBaseline(false);
    }
  }

  async function loadBaselineComparison(baseline: any) {
    if (!projectId) return;
    try {
      const comparison = await baselineApi.compare(projectId, baseline.id);
      setBaselineComparison(comparison);
      setSelectedBaseline(baseline);
    } catch (err) {
      addToast({ type: 'error', title: 'Erro ao comparar', description: String(err) });
    }
  }

  // Physical progress functions
  async function loadMetrics() {
    if (!projectId) return;
    try {
      const data = await progressApi.metrics(projectId);
      setMetrics(data);
    } catch (err) {
      console.error('Erro ao carregar métricas:', err);
    }
  }

  async function loadReportHistory() {
    if (!projectId) return;
    try {
      const data = await progressApi.listReports(projectId);
      setReports(data);
    } catch (err) {
      addToast({ type: 'error', title: 'Erro ao carregar histórico', description: String(err) });
    }
  }

  async function saveReport() {
    if (!projectId) return;
    setSavingReport(true);
    try {
      const result = await progressApi.createReport(projectId, reportDescription || undefined);
      addToast({
        type: 'success',
        title: 'Relatório Gravado',
        description: `Report #${result.reportNumber} criado com sucesso.`,
      });
      setShowSaveReportConfirm(false);
      setReportDescription('');
      // Reload all data to show updated enterprise progress
      await loadData();
      await loadMetrics();
      await loadReportHistory();
    } catch (err) {
      addToast({ type: 'error', title: 'Erro ao gravar', description: String(err) });
    } finally {
      setSavingReport(false);
    }
  }

  async function loadReportComparison(report: ProjectReport) {
    if (!projectId) return;
    try {
      const comparison = await progressApi.getReport(projectId, report.id);
      setSelectedReport(comparison);
    } catch (err) {
      addToast({ type: 'error', title: 'Erro ao carregar comparação', description: String(err) });
    }
  }

  function handleExport() {
    if (tasks.length === 0) return;
    const header = 'Código,Nome,Nível,Início,Fim,Duração (dias),Prog. Plan (%),Prog. Real (%),Caminho Crítico';
    const rows = tasks.map((t) =>
      `"${t.code}","${t.name}",${t.level},"${t.startDate.slice(0, 10)}","${t.endDate.slice(0, 10)}",${t.durationDays ?? ''},${t.plannedProgress},${t.actualProgress},${t.isCriticalPath ? 'Sim' : 'Não'}`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'cronograma.csv'; a.click();
    URL.revokeObjectURL(url);
    addToast({ type: 'success', title: 'Exportado', description: 'CSV gerado com sucesso.' });
  }

  // Column resize handlers
  function startResize(e: React.MouseEvent, colKey: string) {
    e.preventDefault();
    const currentWidth = effectiveWidth(COL_DEFS.find(c => c.key === colKey)!);
    dragRef.current = { colKey, startX: e.clientX, startWidth: currentWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onResizeMove);
    document.addEventListener('mouseup', onResizeEnd);
  }

  function onResizeMove(e: MouseEvent) {
    if (!dragRef.current) return;
    const delta = e.clientX - dragRef.current.startX;
    const newWidth = Math.max(40, dragRef.current.startWidth + delta);
    setColWidths(prev => ({ ...prev, [dragRef.current!.colKey]: newWidth }));
  }

  function onResizeEnd() {
    if (!dragRef.current) return;
    dragRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', onResizeEnd);
  }

  // Column toggle handler (ID column always required)
  function toggleCol(key: string) {
    console.log('[Cronograma] toggleCol called for:', key);
    if (key === 'rowId') return; // ID column cannot be toggled
    const col = COL_DEFS.find(c => c.key === key);
    if (col?.fixed) return;
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        console.log('[Cronograma] Hiding column:', key);
      } else {
        next.add(key);
        console.log('[Cronograma] Showing column:', key);
      }
      next.add('rowId'); // Always ensure ID column is in the saved state
      console.log('[Cronograma] New visible columns:', Array.from(next));
      return next;
    });
  }

  // Modal handlers
  function openNew() { setEditingTask(null); setParentTask(null); setModalOpen(true); }
  function openNewChild(task: GanttTask, e: React.MouseEvent) { e.stopPropagation(); setEditingTask(null); setParentTask(task); setModalOpen(true); }
  function openEdit(task: GanttTask, e: React.MouseEvent) { e.stopPropagation(); setEditingTask(task); setParentTask(null); setModalOpen(true); }
  function openDelete(task: GanttTask, e: React.MouseEvent) { e.stopPropagation(); setDeleteTarget(task); }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    // Snapshot the task before deleting (for undo)
    const snapshot = deleteTarget;
    const hasChildren = deleteTarget.hasChildren;

    try {
      await scheduleApi.delete(deleteTarget.id);
      addToast({ type: 'success', title: 'Excluído', description: `"${deleteTarget.name}" removido.` });
      setDeleteTarget(null);

      // Rollup: ao excluir uma filha, datas do pai podem encolher
      const nextLocal = tasks.filter(t => t.id !== deleteTarget.id);
      const { tasks: cascaded } = propagateAndRollup(nextLocal);
      const parentsToSave = cascaded.filter(t => {
        const orig = nextLocal.find(o => o.id === t.id);
        return orig && (
          orig.startDate.slice(0, 10) !== t.startDate.slice(0, 10) ||
          orig.endDate.slice(0, 10) !== t.endDate.slice(0, 10) ||
          (orig.durationDays ?? 0) !== (t.durationDays ?? 0)
        );
      });
      if (parentsToSave.length > 0 && projectId) {
        await Promise.all(parentsToSave.map(t => scheduleApi.update(t.id, {
          startDate: t.startDate.slice(0, 10),
          endDate: t.endDate.slice(0, 10),
          durationDays: t.durationDays,
        })));
      }
      loadTasksOnly();

      // Record undo only for leaf tasks (parent deletion cascades children — complex to undo)
      if (!hasChildren && projectId) {
        push({
          description: `Excluir: "${snapshot.name}"`,
          module: 'cronograma',
          undo: async () => {
            await scheduleApi.create(projectId, {
              name: snapshot.name,
              code: snapshot.code,
              level: snapshot.level,
              parentId: snapshot.parentId || undefined,
              startDate: snapshot.startDate.slice(0, 10),
              endDate: snapshot.endDate.slice(0, 10),
              durationDays: snapshot.durationDays,
              plannedProgress: snapshot.plannedProgress,
              actualProgress: snapshot.actualProgress,
              weight: snapshot.weight,
              isCriticalPath: snapshot.isCriticalPath,
              responsible: snapshot.responsible,
            });
            triggerDataOnly();
          },
          redo: async () => {
            triggerDataOnly();
          },
        });
      }
    } catch {
      addToast({ type: 'error', title: 'Erro', description: 'Não foi possível excluir.' });
    } finally {
      setDeleting(false);
    }
  }

  function barLeft(task: GanttTask) { return daysBetween(minDate, parseDate(task.startDate)) * pxPerDay; }
  function barWidth(task: GanttTask) {
    // intervalo inclusivo: 1 dia (start=end) ocupa uma célula inteira (pxPerDay)
    const spanDays = daysBetween(parseDate(task.startDate), parseDate(task.endDate)) + 1;
    return Math.max(pxPerDay, spanDays * pxPerDay);
  }

  // ── No project selected ──────────────────────────────────────────────────────

  if (!currentProject) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16, textAlign: 'center', padding: '0 1rem' }}>
        <div style={{ fontSize: 13, color: 'var(--t2)' }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--t1)', marginBottom: 4 }}>Selecione um projeto</p>
          <p>Escolha um projeto no seletor acima para visualizar o cronograma.</p>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="ao-card" style={{ padding: '0.75rem 1rem', marginBottom: 0, display: 'flex', flexDirection: 'column', height: '100vh', maxHeight: '100vh', overflow: 'hidden' }}>

        {/* Toolbar */}
        <div className="ao-card-hdr" style={{ marginBottom: 4, flexShrink: 0 }}>
          <span className="ao-card-title">EAP — Cronograma completo</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              placeholder="Buscar atividade..."
              value={searchRaw}
              onChange={(e) => setSearchRaw(e.target.value)}
              style={{ padding: '5px 9px', fontSize: 11, border: '1px solid var(--bd)', borderRadius: 8, background: 'var(--s0)', color: 'var(--t1)', width: 160 }}
            />
            <button className="ao-btn ao-btn-sm" onClick={expandAll}>Expandir</button>
            <button className="ao-btn ao-btn-sm" onClick={collapseAll}>Recolher</button>
            <select
              value={timeScale}
              onChange={(e) => setTimeScale(e.target.value as TimeScale)}
              style={{
                padding: '5px 8px',
                fontSize: 11,
                border: '1px solid var(--bd)',
                borderRadius: 6,
                background: 'var(--s0)',
                color: 'var(--t1)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {SCALE_ORDER.map(scale => <option key={scale} value={scale}>{SCALE_LABELS[scale]}</option>)}
            </select>
            <button
              className="ao-btn ao-btn-sm"
              disabled={!selectedTaskId || !tasks.find(t => t.id === selectedTaskId)?.parentId}
              onClick={() => selectedTaskId && outdentTask(selectedTaskId)}
              title="Remover recuo (subir um nível)"
            >←</button>
            <button
              className="ao-btn ao-btn-sm"
              disabled={!selectedTaskId || tasks.findIndex(t => t.id === selectedTaskId) <= 0}
              onClick={() => selectedTaskId && indentTask(selectedTaskId)}
              title="Adicionar recuo (tornar filho da tarefa acima)"
            >→</button>
            <select
              value={outlineLevel}
              onChange={(e) => handleOutlineLevelChange(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              style={{ padding: '5px 8px', fontSize: 11, border: '1px solid var(--bd)', borderRadius: 6, background: 'var(--s0)', color: 'var(--t1)', cursor: 'pointer', fontFamily: 'inherit' }}
              title="Mostrar até este nível hierárquico"
            >
              <option value="all">Todos os níveis</option>
              {[1,2,3,4,5].map(n => <option key={n} value={n}>Nível {n}</option>)}
            </select>
            <div style={{ position: 'relative' }}>
              <button className="ao-btn ao-btn-sm" onClick={() => setShowColPicker(!showColPicker)}>⚙ Colunas</button>
              {showColPicker && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--s0)', border: '1px solid var(--bd)', borderRadius: 8, padding: 8, zIndex: 100, minWidth: 180, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                  {COL_DEFS.filter(col => col.key !== 'rowId').map(col => (
                    <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: col.fixed ? 'not-allowed' : 'pointer', fontSize: 12, opacity: col.fixed ? 0.6 : 1 }}>
                      <input
                        type="checkbox"
                        checked={visibleCols.has(col.key)}
                        disabled={col.fixed}
                        onChange={() => toggleCol(col.key)}
                        style={{ cursor: col.fixed ? 'not-allowed' : 'pointer' }}
                      />
                      <span>{col.label}</span>
                      {col.fixed && <span style={{ fontSize: 9, color: 'var(--t3)', marginLeft: 'auto' }}>obrigatória</span>}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <button
              className="ao-btn ao-btn-sm"
              onClick={() => setShowAdvFilters(!showAdvFilters)}
              style={{
                background: Object.values(advFilters).some((v: any) => v && (typeof v === 'string' ? v !== '' : v.length > 0 || v === true)) ? '#1A56A0' : undefined,
                color: Object.values(advFilters).some((v: any) => v && (typeof v === 'string' ? v !== '' : v.length > 0 || v === true)) ? '#fff' : undefined,
              }}
            >
              🔍 Filtros avançados
            </button>
            <div style={{ position: 'relative' }}>
              <button className="ao-btn ao-btn-sm" style={{ background: '#7c3aed', color: '#fff', border: 'none' }} onClick={() => setShowBaselineMenu(!showBaselineMenu)} title="Opções de baseline">
                📊 Baseline
              </button>
              {showBaselineMenu && (
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--bg1)', border: '0.5px solid var(--bd)', borderRadius: 8, padding: 0, zIndex: 100, minWidth: 180, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                  <button className="ao-btn ao-btn-sm" onClick={() => { loadBaselineHistory(); setShowBaselineHistory(true); setShowBaselineMenu(false); }} style={{ width: '100%', textAlign: 'left', borderRadius: '8px 8px 0 0', border: 'none', background: 'transparent', padding: '8px 12px', color: 'var(--t1)' }} title="Visualizar histórico de linhas de base">
                    📊 Histórico Baseline
                  </button>
                  <button className="ao-btn ao-btn-sm" onClick={() => { setShowBaselineConfirm(true); setShowBaselineMenu(false); }} style={{ width: '100%', textAlign: 'left', borderRadius: '0 0 8px 8px', border: 'none', background: 'transparent', padding: '8px 12px', color: 'var(--t1)', borderTop: '0.5px solid var(--bd)' }} title="Gravar uma nova linha de base do cronograma">
                    💾 Gravar Baseline
                  </button>
                </div>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <button className="ao-btn ao-btn-sm" style={{ background: '#ec4899', color: '#fff', border: 'none' }} onClick={() => setShowReportMenu(!showReportMenu)} title="Opções de report">
                📈 Report
              </button>
              {showReportMenu && (
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--bg1)', border: '0.5px solid var(--bd)', borderRadius: 8, padding: 0, zIndex: 100, minWidth: 180, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                  <button className="ao-btn ao-btn-sm" onClick={() => { setShowSaveReportConfirm(true); setShowReportMenu(false); }} style={{ width: '100%', textAlign: 'left', borderRadius: '8px 8px 0 0', border: 'none', background: 'transparent', padding: '8px 12px', color: 'var(--t1)' }} title="Gravar relatório de avanço físico">
                    💾 Gravar Report
                  </button>
                  <button className="ao-btn ao-btn-sm" onClick={() => { loadReportHistory(); setShowReportHistory(true); setShowReportMenu(false); }} style={{ width: '100%', textAlign: 'left', borderRadius: '0 0 8px 8px', border: 'none', background: 'transparent', padding: '8px 12px', color: 'var(--t1)', borderTop: '0.5px solid var(--bd)' }} title="Visualizar histórico de relatórios">
                    📈 Histórico Reports
                  </button>
                </div>
              )}
            </div>
            <button className="ao-btn ao-btn-sm" onClick={handleExport}>CSV</button>
            <button className="ao-btn ao-btn-sm" onClick={() => { setImportStep(1); setImportFile(null); setImportPreview([]); setImportErrors([]); setShowImport(true); }}>↑ Importar</button>
            <div style={{ width: 1, height: 18, background: 'var(--bd)', margin: '0 2px' }} />
            <button
              className="ao-btn ao-btn-sm"
              onClick={undo}
              disabled={past.length === 0 || historyProcessing}
              title={past.length > 0 ? `Desfazer: ${past[past.length - 1]?.description} (Ctrl+Z)` : 'Nada para desfazer'}
              style={{ opacity: past.length > 0 && !historyProcessing ? 1 : 0.4, padding: '4px 8px' }}
            >
              <Undo2 style={{ width: 12, height: 12 }} />
            </button>
            <button
              className="ao-btn ao-btn-sm"
              onClick={redo}
              disabled={future.length === 0 || historyProcessing}
              title={future.length > 0 ? `Refazer: ${future[0]?.description} (Ctrl+Y)` : 'Nada para refazer'}
              style={{ opacity: future.length > 0 && !historyProcessing ? 1 : 0.4, padding: '4px 8px' }}
            >
              <Redo2 style={{ width: 12, height: 12 }} />
            </button>
            <div style={{ width: 1, height: 18, background: 'var(--bd)', margin: '0 2px' }} />
            <button
              className="ao-btn ao-btn-sm"
              style={{ background: '#1A56A0', color: '#fff', border: 'none' }}
              onClick={openNew}
            >
              + Nova atividade
            </button>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--t2)', marginBottom: 4, flexWrap: 'wrap', flexShrink: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 5, background: 'rgba(55,138,221,.3)', borderRadius: 2, display: 'inline-block' }} />Planejado
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 5, background: '#3B6D11', borderRadius: 2, display: 'inline-block' }} />No prazo
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 5, background: '#D97706', borderRadius: 2, display: 'inline-block' }} />Leve atraso
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 5, background: '#E24B4A', borderRadius: 2, display: 'inline-block' }} />Crítico
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 1, height: 12, background: '#E24B4A', display: 'inline-block' }} />Hoje
          </span>
          <span style={{ color: 'var(--t3)', fontStyle: 'italic' }}>· Duplo clique ou F2 para editar · Passe o mouse para ver ações</span>
        </div>

        {/* Physical Progress Metrics */}
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--t1)', marginBottom: 4, padding: '8px 12px', background: 'var(--bg2)', borderRadius: 8, alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>📊 % Real do Empreendimento:</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#10b981' }}>{enterpriseProgress.toFixed(1)}%</span>
          </div>
          {metrics && (
            <>
              {metrics.lastReportDate && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--t2)' }}>
                  <span>Último Report: {new Date(metrics.lastReportDate).toLocaleDateString('pt-BR')}</span>
                </div>
              )}
              {metrics.lastReportNumber > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--t2)' }}>
                  <span>Report #{metrics.lastReportNumber}</span>
                </div>
              )}
              {metrics.activeBaselineVersion > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--t2)' }}>
                  <span>Baseline v{metrics.activeBaselineVersion}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Gantt wrap */}
        <div style={{ display: 'flex', border: '1px solid var(--bd)', borderRadius: 12, overflow: 'hidden', flex: 1, minHeight: 0 }}>

          {/* ── Left panel: Multi-column ── */}
          <div style={{ width: finalLeftWidth, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--s0)', height: '100%' }}>
            {/* Header row */}
            <div style={{ height: HDR_H, background: 'var(--s1)', borderBottom: '0.5px solid var(--bd)', display: 'flex', flexShrink: 0, position: 'sticky', top: 0, zIndex: 1 }}>
              {visibleColDefs.map((col, colIdx) => {
                const hasFilter = colFilters[col.key]?.length > 0;
                const isFiltered = sortConfig?.key === col.key || hasFilter;

                return (
                <div
                  key={col.key}
                  style={{
                    width: effectiveWidth(col),
                    flexShrink: 0,
                    padding: '0 8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11,
                    fontWeight: 500,
                    color: 'var(--t2)',
                    borderRight: colIdx < visibleColDefs.length - 1 ? '0.5px solid var(--bd)' : 'none',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    position: 'relative',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{col.label}</span>
                  <button
                    ref={(el) => {
                      if (el) colRefsMap.current.set(col.key, el);
                      else colRefsMap.current.delete(col.key);
                    }}
                    onClick={() => setFilterDropdownCol(filterDropdownCol === col.key ? null : col.key)}
                    title="Filtrar coluna"
                    style={{
                      background: isFiltered ? '#1A56A0' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 11,
                      padding: '2px 4px',
                      color: isFiltered ? '#fff' : 'var(--t3)',
                      borderRadius: 3,
                      flexShrink: 0,
                    }}
                  >
                    ⊕
                  </button>
                  {filterDropdownCol === col.key && (
                    <ColFilterDropdown
                      colKey={col.key}
                      label={col.label}
                      allValues={colUniqueValues[col.key] ?? []}
                      selected={colFilters[col.key] ?? []}
                      sortDir={sortConfig?.key === col.key ? sortConfig.dir : null}
                      onSortChange={(dir) => setSortConfig(dir ? { key: col.key, dir } : null)}
                      onFilterChange={(vals) => setColFilters(prev => ({ ...prev, [col.key]: vals }))}
                      onClose={() => setFilterDropdownCol(null)}
                      triggerRef={colRefsMap.current.get(col.key)}
                    />
                  )}
                  {colIdx < visibleColDefs.length - 1 && (
                    <div
                      onMouseDown={(e) => startResize(e, col.key)}
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        width: 6,
                        height: '100%',
                        cursor: 'col-resize',
                        zIndex: 2,
                        userSelect: 'none',
                      }}
                    />
                  )}
                </div>
                );
              })}
            </div>

            {/* Rows */}
            <div ref={leftRef} onScroll={onLeftScroll} onWheel={onTableWheel} style={{ overflowY: 'hidden', overflowX: 'hidden', flex: 1 }}>
              {loading
                ? Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} style={{ height: ROW_H, borderBottom: '0.5px solid var(--bd)', display: 'flex' }}>
                      {visibleColDefs.map((col, colIdx) => (
                        <div key={col.key} style={{ width: effectiveWidth(col), flexShrink: 0, borderRight: colIdx < visibleColDefs.length - 1 ? '0.5px solid var(--bd)' : 'none', display: 'flex', alignItems: 'center', padding: '0 8px' }}>
                          <div style={{ height: 8, background: 'var(--s2)', borderRadius: 4, width: '60%' }} />
                        </div>
                      ))}
                    </div>
                  ))
                : visibleTasks.map((task) => {
                    const lvStyle = levelStyle(task.level, task.hasChildren);
                    const isExpanded = expanded.has(task.id) || !!search;
                    const isHov = hoveredRow === task.id;
                    const isSelected = selectedTaskId === task.id;

                    function handleRowKeyDown(e: React.KeyboardEvent) {
                      if (inlineEdit) return; // keyboard is captured by cell input
                      const rowIdx = visibleTasks.findIndex(t => t.id === task.id);

                      switch (e.key) {
                        case 'ArrowDown': {
                          e.preventDefault();
                          const next = visibleTasks[rowIdx + 1];
                          if (next) {
                            setSelectedTaskId(next.id);
                            setTimeout(() => scrollToRow(rowIdx + 1), 0);
                          }
                          break;
                        }
                        case 'ArrowUp': {
                          e.preventDefault();
                          const prev = visibleTasks[rowIdx - 1];
                          if (prev) {
                            setSelectedTaskId(prev.id);
                            setTimeout(() => scrollToRow(rowIdx - 1), 0);
                          }
                          break;
                        }
                        case 'ArrowRight': {
                          e.preventDefault();
                          const nextIdx = Math.min(selectedColIdx + 1, visibleColDefs.length - 1);
                          setSelectedColIdx(nextIdx);
                          break;
                        }
                        case 'ArrowLeft': {
                          e.preventDefault();
                          setSelectedColIdx(Math.max(0, selectedColIdx - 1));
                          break;
                        }
                        case 'Enter': {
                          e.preventDefault();
                          const colKey = visibleColDefs[selectedColIdx]?.key;
                          if (colKey) {
                            afterCommitRef.current = 'enter';
                            startInlineEdit(task, colKey);
                          }
                          break;
                        }
                        case 'F2': {
                          e.preventDefault();
                          const colKey = visibleColDefs[selectedColIdx]?.key ?? 'name';
                          startInlineEdit(task, colKey);
                          break;
                        }
                        case 'Escape': {
                          e.preventDefault();
                          cancelInlineEdit();
                          break;
                        }
                        case 'c':
                        case 'C': {
                          if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
                            e.preventDefault();
                            const colKey = visibleColDefs[selectedColIdx]?.key;
                            if (colKey) {
                              const value = getCellRawValue(task, colKey);
                              setClipboard({ colKey, value });
                              addToast({ type: 'success', title: `Copiado: ${value}` });
                            }
                          }
                          break;
                        }
                        case 'v':
                        case 'V': {
                          if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
                            e.preventDefault();
                            if (clipboard) {
                              const colKey = visibleColDefs[selectedColIdx]?.key;
                              if (colKey && colKey === clipboard.colKey && ['name','code','duration','startDate','endDate','progress','weight','responsible'].includes(colKey)) {
                                afterCommitRef.current = 'blur';
                                setInlineEdit({ taskId: task.id, colKey, value: clipboard.value });
                                setTimeout(() => commitInlineEdit(), 0);
                              }
                            }
                          }
                          break;
                        }
                      }
                    }

                    return (
                      <div
                        key={task.id}
                        data-task-id={task.id}
                        tabIndex={0}
                        onMouseEnter={() => setHoveredRow(task.id)}
                        onMouseLeave={() => setHoveredRow(null)}
                        onClick={() => setSelectedTaskId(task.id)}
                        onKeyDown={handleRowKeyDown}
                        style={{
                          height: ROW_H,
                          display: 'flex',
                          borderBottom: '0.5px solid var(--bd)',
                          background: isHov ? 'var(--s1)' : (lvStyle.background as string ?? ''),
                          userSelect: 'none',
                          outline: isSelected ? '1px solid #1A56A0' : 'none',
                          outlineOffset: '-1px',
                        }}
                      >
                        {visibleColDefs.map((col, colIdx) => {
                          const isNameCol = col.key === 'name';
                          // Tarefas pai: datas/duração são calculadas das filhas (não editáveis)
                          const isParentLockedCol = task.hasChildren && ['startDate', 'endDate', 'duration'].includes(col.key);
                          const isEditable = ['name', 'duration', 'startDate', 'endDate', 'progress', 'weight', 'responsible', 'predecessors'].includes(col.key) && !isParentLockedCol;
                          const isEditing = inlineEdit?.taskId === task.id && inlineEdit?.colKey === col.key;
                          const isCellSelected = isSelected && colIdx === selectedColIdx;

                          function handleCellKeyDown(e: React.KeyboardEvent) {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              afterCommitRef.current = 'enter';
                              commitInlineEdit();
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              cancelInlineEdit();
                            } else if (e.key === 'Tab') {
                              e.preventDefault();
                              afterCommitRef.current = 'tab';
                              const editableCols = ['name', 'code', 'duration', 'startDate', 'endDate', 'progress', 'weight', 'responsible'];
                              const currentIdx = editableCols.indexOf(col.key);
                              if (e.shiftKey) {
                                const prevIdx = currentIdx <= 0 ? editableCols.length - 1 : currentIdx - 1;
                                setTimeout(() => startInlineEdit(task, editableCols[prevIdx]), 0);
                              } else {
                                const nextIdx = currentIdx >= editableCols.length - 1 ? 0 : currentIdx + 1;
                                setTimeout(() => startInlineEdit(task, editableCols[nextIdx]), 0);
                              }
                            }
                          }

                          return (
                            <div
                              key={col.key}
                              onDoubleClick={isEditable ? (e) => startInlineEdit(task, col.key, e) : undefined}
                              title={isParentLockedCol ? 'Calculado automaticamente a partir das tarefas filhas' : (isEditable ? 'Duplo clique para editar' : '')}
                              style={{
                                width: effectiveWidth(col),
                                flexShrink: 0,
                                padding: isEditing ? '0 4px' : '0 8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: isNameCol && !isEditing ? 4 : 0,
                                borderRight: colIdx < visibleColDefs.length - 1 ? '0.5px solid var(--bd)' : 'none',
                                cursor: isParentLockedCol ? 'not-allowed' : (isEditable ? 'text' : 'default'),
                                overflow: 'hidden',
                                backgroundColor: isEditing ? '#fff' : undefined,
                                border: isEditing ? '2px solid #1A56A0' : (isCellSelected ? '1.5px solid #1A56A0' : undefined),
                                borderRadius: isEditing || isCellSelected ? 4 : 0,
                                fontStyle: isParentLockedCol ? 'italic' : undefined,
                                color: isParentLockedCol ? 'var(--t3)' : undefined,
                                ...(isNameCol && !isEditing ? lvStyle : { fontSize: 11 }),
                              }}
                            >
                              {isEditing && (
                                <input
                                  ref={inlineInputRef}
                                  type={col.key === 'duration' || col.key === 'progress' || col.key === 'weight' ? 'number' : col.key === 'startDate' || col.key === 'endDate' ? 'date' : 'text'}
                                  min={col.key === 'duration' ? 1 : col.key === 'progress' || col.key === 'weight' ? 0 : undefined}
                                  max={col.key === 'progress' ? 100 : undefined}
                                  step={col.key === 'weight' ? 0.01 : undefined}
                                  value={inlineEdit.value}
                                  onChange={(e) => setInlineEdit(prev => prev ? { ...prev, value: e.target.value } : null)}
                                  onKeyDown={handleCellKeyDown}
                                  onBlur={commitInlineEdit}
                                  style={{
                                    border: 'none',
                                    outline: 'none',
                                    width: '100%',
                                    height: '100%',
                                    padding: '4px 6px',
                                    fontSize: 11,
                                    backgroundColor: 'transparent',
                                    color: 'var(--t1)',
                                    fontFamily: col.key === 'code' ? 'var(--mono)' : 'inherit',
                                  }}
                                />
                              )}
                              {!isEditing && <>
                                {col.key === 'code' && (
                                  <span style={{ fontFamily: 'var(--mono)', fontSize: 9, opacity: 0.55, whiteSpace: 'nowrap' }}>
                                    {task.code}
                                  </span>
                                )}
                                {col.key === 'name' && (
                                  <>
                                    {task.hasChildren ? (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); toggleExpand(task.id); }}
                                        style={{ width: 16, height: 16, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--t2)', fontSize: 10, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, transition: 'transform .15s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                                      >▶</button>
                                    ) : (
                                      <span style={{ width: 16, flexShrink: 0 }} />
                                    )}
                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: task.level * 16 }} title={task.name}>
                                      {task.name}
                                    </span>
                                    {isHov && (
                                      <div style={{ display: 'flex', gap: 2, flexShrink: 0, marginLeft: 'auto' }}>
                                        <button title="Adicionar subitem" onClick={(e) => openNewChild(task, e)} style={{ width: 18, height: 18, border: '1px solid var(--bd)', borderRadius: 4, background: 'var(--s0)', cursor: 'pointer', color: 'var(--t2)', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}>+</button>
                                        <button title="Editar" onClick={(e) => openEdit(task, e)} style={{ width: 18, height: 18, border: '1px solid var(--bd)', borderRadius: 4, background: 'var(--s0)', cursor: 'pointer', color: 'var(--t2)', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}>✎</button>
                                        <button title="Excluir" onClick={(e) => openDelete(task, e)} style={{ width: 18, height: 18, border: '1px solid var(--bd)', borderRadius: 4, background: 'var(--s0)', cursor: 'pointer', color: '#B91C1C', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}>×</button>
                                      </div>
                                    )}
                                  </>
                                )}
                                {col.key === 'startDate' && (
                                  <span style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                                    {fmtDate(task.startDate)}
                                  </span>
                                )}
                                {col.key === 'endDate' && (
                                  <span style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                                    {fmtDate(task.endDate)}
                                  </span>
                                )}
                                {col.key === 'duration' && (
                                  <span style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                                    {task.durationDays ?? '—'}
                                  </span>
                                )}
                                {col.key === 'progress' && (
                                  <span className={badgeClass(task.actualProgress, task.plannedProgress)} style={{ fontSize: 9, justifyContent: 'center', marginLeft: 'auto' }}>
                                    {task.actualProgress}%
                                  </span>
                                )}
                                {col.key === 'predecessors' && (
                                  <span style={{ fontSize: 11, fontFamily: 'var(--mono)', whiteSpace: 'nowrap', color: task.predecessorDeps?.length ? 'var(--t1)' : 'var(--t3)' }}>
                                    {formatDepsAsText(task, tasks) || '—'}
                                  </span>
                                )}
                                {col.key === 'successors' && (
                                  <span style={{ fontSize: 11, fontFamily: 'var(--mono)', whiteSpace: 'nowrap', color: task.successorDeps?.length ? 'var(--t1)' : 'var(--t3)' }}>
                                    {formatSuccessorsText(task, tasks) || '—'}
                                  </span>
                                )}
                                {col.key === 'rowId' && (
                                  <span style={{ fontSize: 10, color: 'var(--t3)', fontFamily: 'var(--mono)' }}>
                                    {task.rowId}
                                  </span>
                                )}
                                {col.key === 'weight' && (
                                  <span style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                                    {task.weight ?? '—'}
                                  </span>
                                )}
                                {col.key === 'responsible' && (
                                  <span style={{ fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {task.responsible ?? '—'}
                                  </span>
                                )}
                                {col.key === 'critical' && (
                                  <span style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                                    {task.isCriticalPath ? 'Sim' : 'Não'}
                                  </span>
                                )}
                              </>}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
            </div>
          </div>

          {/* Splitter */}
          <div
            onMouseDown={startSplitterResize}
            style={{
              width: 6,
              flexShrink: 0,
              cursor: 'col-resize',
              background: '0.5px solid var(--bd)',
              borderLeft: '0.5px solid var(--bd)',
              borderRight: '0.5px solid var(--bd)',
              userSelect: 'none',
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--s1)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
          />

          {/* ── Right Gantt panel ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }} onWheel={onGanttWheel}>

            {/* Header with upper and lower rows */}
            <div
              ref={hdrRef}
              style={{ height: HDR_H, flexShrink: 0, overflow: 'hidden', background: 'var(--s1)', borderBottom: '0.5px solid var(--bd)', position: 'relative', display: 'flex', flexDirection: 'column' }}
            >
              {/* Upper header */}
              <div style={{ flex: 1, position: 'relative', borderBottom: '0.5px solid var(--bd)' }}>
                <div style={{ position: 'relative', width: totalWidth, height: '100%' }}>
                  {generateHeaderCells(timeScale, minDate, maxDate, pxPerDay).upper.map((cell, i) => (
                    <div key={i} style={{ position: 'absolute', left: cell.left, top: 0, width: cell.width, height: '100%', borderLeft: '0.5px solid var(--bd)', padding: '0 4px', fontSize: 10, color: 'var(--t2)', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', fontWeight: 500 }}>
                      {cell.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Lower header */}
              <div style={{ flex: 1, position: 'relative' }}>
                <div style={{ position: 'relative', width: totalWidth, height: '100%' }}>
                  {generateHeaderCells(timeScale, minDate, maxDate, pxPerDay).lower.map((cell, i) => (
                    <div key={i} style={{ position: 'absolute', left: cell.left, top: 0, width: cell.width, height: '100%', borderLeft: '0.5px solid var(--bd)', padding: '0 4px', fontSize: 9, color: 'var(--t2)', display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap' }}>
                      {cell.label}
                    </div>
                  ))}
                  <div style={{ position: 'absolute', left: todayLeft, top: 0, width: 1, background: '#E24B4A', height: '100%', zIndex: 2 }} />
                </div>
              </div>
            </div>

            {/* Scrollable bar body */}
            <div ref={rightRef} onScroll={onRightScroll} style={{ flex: 1, overflow: 'auto', background: 'var(--s0)' }}>
              <div style={{ position: 'relative', width: totalWidth, height: visibleTasks.length * ROW_H }}>
                <div style={{ position: 'absolute', left: todayLeft, top: 0, bottom: 0, width: 1, background: 'rgba(226,75,74,.25)', zIndex: 1, pointerEvents: 'none' }} />

                {!loading && visibleTasks.map((task, rowIdx) => {
                  const left = barLeft(task);
                  const width = barWidth(task);
                  const barH = task.level <= 1 ? 12 : 8;
                  const barTop = Math.round((ROW_H - barH) / 2);
                  const actualW = Math.max(2, Math.round((task.actualProgress / 100) * width));
                  const color = barColor(task.actualProgress, task.plannedProgress);
                  const top = rowIdx * ROW_H;
                  const bg = hoveredRow === task.id ? 'var(--s1)' : rowBg(task.level);

                  return (
                    <div
                      key={task.id}
                      style={{ position: 'absolute', top, left: 0, width: totalWidth, height: ROW_H, background: bg, borderBottom: '0.5px solid var(--bd)' }}
                    >
                      {/* Planned bar */}
                      <div style={{ position: 'absolute', left, width, height: barH, top: barTop, background: 'rgba(55,138,221,.35)', borderRadius: 3 }} />
                      {/* Actual bar */}
                      <div style={{ position: 'absolute', left, width: actualW, height: barH, top: barTop, background: color, borderRadius: 3, opacity: task.level <= 1 ? 1 : 0.85 }} />
                      {task.level <= 2 && actualW > 20 && (
                        <span style={{ position: 'absolute', left: left + actualW + 3, top: barTop - 1, fontSize: 9, color, whiteSpace: 'nowrap' }}>
                          {task.actualProgress}%
                        </span>
                      )}
                      {/* Tooltip on bar hover */}
                      <div
                        style={{ position: 'absolute', left, width, height: ROW_H, top: 0, cursor: 'pointer', zIndex: 2 }}
                        title={`${task.code} — ${task.name}\nInício: ${task.startDate.slice(0, 10)}\nFim: ${task.endDate.slice(0, 10)}\nDuração: ${task.durationDays ?? '—'} dias\nPlanejado: ${task.plannedProgress}% | Realizado: ${task.actualProgress}%`}
                      />
                    </div>
                  );
                })}

                {/* Dependency arrows */}
                <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible', zIndex: 0 }}>
                  <defs>
                    <marker id="depArrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                      <path d="M0,0 L0,6 L6,3 z" fill="#94a3b8" />
                    </marker>
                  </defs>
                  {visibleTasks.flatMap((task, rowIdx) =>
                    (task.predecessorDeps ?? []).map(dep => {
                      const predTask = visibleTasks.find(t => t.id === dep.predecessorId);
                      if (!predTask) return null;
                      const predRowIdx = visibleTasks.indexOf(predTask);
                      const y1 = predRowIdx * ROW_H + ROW_H / 2;
                      const y2 = rowIdx * ROW_H + ROW_H / 2;
                      let x1: number, x2: number;
                      switch (dep.type) {
                        case 'FS': x1 = barLeft(predTask) + barWidth(predTask); x2 = barLeft(task); break;
                        case 'SS': x1 = barLeft(predTask); x2 = barLeft(task); break;
                        case 'FF': x1 = barLeft(predTask) + barWidth(predTask); x2 = barLeft(task) + barWidth(task); break;
                        case 'SF': x1 = barLeft(predTask); x2 = barLeft(task) + barWidth(task); break;
                        default: x1 = barLeft(predTask) + barWidth(predTask); x2 = barLeft(task);
                      }
                      const midX = x1 + 8;
                      const pathD = `M${x1},${y1} L${midX},${y1} L${midX},${y2} L${x2},${y2}`;
                      return (
                        <path key={dep.id} d={pathD} fill="none" stroke="#94a3b8" strokeWidth={1.5}
                          strokeDasharray={dep.lagDays !== 0 ? '4,2' : undefined}
                          markerEnd="url(#depArrow)" />
                      );
                    }).filter(Boolean)
                  )}
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal create/edit */}
      <TaskModal
        open={modalOpen}
        editingTask={editingTask}
        parentTask={parentTask}
        allTasks={tasks}
        projectId={projectId!}
        addToast={addToast as any}
        onClose={() => setModalOpen(false)}
        onSaved={loadData}
      />

      {/* Import modal */}
      <ImportModal
        open={showImport}
        step={importStep}
        file={importFile}
        preview={importPreview}
        importing={importing}
        projectId={projectId!}
        onClose={() => setShowImport(false)}
        setStep={setImportStep}
        setFile={setImportFile}
        setPreview={setImportPreview}
        setImporting={setImporting}
        addToast={addToast as any}
        onImportSuccess={loadData}
      />

      {/* Delete confirmation */}
      <DeleteConfirm
        task={deleteTarget}
        allTasks={tasks}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Advanced Filters Panel */}
      {showAdvFilters && (
        <AdvancedFiltersPanel
          filters={advFilters}
          allResponsibles={uniqueResponsibles}
          onChange={setAdvFilters}
          onClose={() => setShowAdvFilters(false)}
        />
      )}

      {/* Baseline Confirmation Modal */}
      {showBaselineConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg1)', border: '1px solid var(--bd)', borderRadius: 12, padding: 24, maxWidth: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <h2 style={{ margin: '0 0 16px 0', color: 'var(--t1)' }}>Gravar Linha de Base</h2>
            <p style={{ margin: '0 0 16px 0', color: 'var(--t2)', fontSize: 14 }}>
              Você está prestes a gravar uma snapshot completa do cronograma atual. Essa será utilizada como referência para monitoramento e comparação.
            </p>
            <div style={{ margin: '0 0 16px 0' }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 12, color: 'var(--t2)' }}>
                Descrição (opcional):
              </label>
              <input
                type="text"
                value={baselineDescription}
                onChange={(e) => setBaselineDescription(e.target.value)}
                placeholder="ex: Baseline após aprovação de escopo"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--bd)', borderRadius: 6, background: 'var(--bg2)', color: 'var(--t1)', fontSize: 12, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                className="ao-btn ao-btn-sm"
                onClick={() => { setShowBaselineConfirm(false); setBaselineDescription(''); }}
                disabled={savingBaseline}
              >
                Cancelar
              </button>
              <button
                className="ao-btn ao-btn-sm"
                style={{ background: '#7c3aed', color: '#fff', border: 'none' }}
                onClick={saveBaseline}
                disabled={savingBaseline}
              >
                {savingBaseline ? '⏳ Gravando...' : '💾 Gravar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Baseline History Modal */}
      {showBaselineHistory && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg1)', border: '1px solid var(--bd)', borderRadius: 12, padding: 24, maxWidth: 900, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <h2 style={{ margin: '0 0 20px 0', color: 'var(--t1)' }}>Histórico de Linhas de Base</h2>
            {baselines.length === 0 ? (
              <p style={{ color: 'var(--t3)', fontSize: 13 }}>Nenhuma linha de base gravada ainda.</p>
            ) : (
              <div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--bd)' }}>
                      <th style={{ padding: 8, textAlign: 'left', color: 'var(--t2)' }}>Versão</th>
                      <th style={{ padding: 8, textAlign: 'left', color: 'var(--t2)' }}>Data/Hora</th>
                      <th style={{ padding: 8, textAlign: 'left', color: 'var(--t2)' }}>Usuário</th>
                      <th style={{ padding: 8, textAlign: 'left', color: 'var(--t2)' }}>Itens</th>
                      <th style={{ padding: 8, textAlign: 'left', color: 'var(--t2)' }}>Descrição</th>
                      <th style={{ padding: 8, textAlign: 'center', color: 'var(--t2)' }}>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {baselines.map((b) => (
                      <tr key={b.id} style={{ borderBottom: '0.5px solid var(--bd)' }}>
                        <td style={{ padding: 8, color: 'var(--t1)', fontWeight: 500 }}>Baseline {String(b.version).padStart(2, '0')}</td>
                        <td style={{ padding: 8, color: 'var(--t2)' }}>{new Date(b.createdAt).toLocaleString('pt-BR')}</td>
                        <td style={{ padding: 8, color: 'var(--t2)' }}>{b.user.fullName || b.user.email}</td>
                        <td style={{ padding: 8, color: 'var(--t2)' }}>{b.itemCount}</td>
                        <td style={{ padding: 8, color: 'var(--t2)', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.description || '—'}</td>
                        <td style={{ padding: 8, textAlign: 'center' }}>
                          <button
                            style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}
                            onClick={() => loadBaselineComparison(b)}
                          >
                            Comparar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {baselineComparison && (
                  <div style={{ marginTop: 24, padding: 16, background: 'var(--bg2)', borderRadius: 8 }}>
                    <h3 style={{ margin: '0 0 12px 0', color: 'var(--t1)', fontSize: 13 }}>
                      Comparação: {selectedBaseline.version === 1 ? 'Inicial' : `Versão ${selectedBaseline.version}`} vs Atual
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
                      <div style={{ padding: 12, background: 'var(--bg1)', borderRadius: 6, borderLeft: '3px solid #3b82f6' }}>
                        <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 4 }}>Tarefas Alteradas</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)' }}>{baselineComparison.summary.itemsChanged}</div>
                      </div>
                      <div style={{ padding: 12, background: 'var(--bg1)', borderRadius: 6, borderLeft: '3px solid #ef4444' }}>
                        <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 4 }}>Datas Alteradas</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)' }}>{baselineComparison.summary.datesChanged}</div>
                      </div>
                      <div style={{ padding: 12, background: 'var(--bg1)', borderRadius: 6, borderLeft: '3px solid #f59e0b' }}>
                        <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 4 }}>Durações Alteradas</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)' }}>{baselineComparison.summary.durationChanged}</div>
                      </div>
                      <div style={{ padding: 12, background: 'var(--bg1)', borderRadius: 6, borderLeft: '3px solid #10b981' }}>
                        <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 4 }}>Progresso Alterado</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)' }}>{baselineComparison.summary.progressChanged}</div>
                      </div>
                    </div>

                    {baselineComparison.changes.length > 0 && (
                      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                        <h4 style={{ margin: '0 0 8px 0', color: 'var(--t2)', fontSize: 12 }}>Detalhes das Alterações:</h4>
                        {baselineComparison.changes.slice(0, 10).map((change: any, idx: number) => (
                          <div key={idx} style={{ padding: 8, marginBottom: 8, background: 'var(--bg1)', borderRadius: 4, fontSize: 11, borderLeft: `3px solid ${change.changeType === 'NEW_ITEM' ? '#10b981' : change.changeType === 'DELETED_ITEM' ? '#ef4444' : '#f59e0b'}` }}>
                            <div style={{ fontWeight: 600, color: 'var(--t1)' }}>{change.code} - {change.name}</div>
                            <div style={{ color: 'var(--t3)', marginTop: 4 }}>
                              {change.changeType === 'NEW_ITEM' && '✚ Nova tarefa'}
                              {change.changeType === 'DELETED_ITEM' && '✕ Tarefa removida'}
                              {change.changeType === 'MODIFIED' && `Alterado: ${change.changes.join(', ')}`}
                            </div>
                          </div>
                        ))}
                        {baselineComparison.changes.length > 10 && (
                          <p style={{ color: 'var(--t3)', fontSize: 11, margin: '8px 0 0 0' }}>... e mais {baselineComparison.changes.length - 10} alterações</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="ao-btn ao-btn-sm"
                onClick={() => { setShowBaselineHistory(false); setBaselineComparison(null); setSelectedBaseline(null); }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Report Modal */}
      {showSaveReportConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg1)', border: '1px solid var(--bd)', borderRadius: 12, padding: 24, maxWidth: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <h2 style={{ margin: '0 0 16px 0', color: 'var(--t1)' }}>Gravar Relatório de Avanço Físico</h2>
            <p style={{ margin: '0 0 16px 0', color: 'var(--t2)', fontSize: 14 }}>
              Você está prestes a gravar uma snapshot do avanço físico atual. Esse relatório será comparado com a linha de base para análise de desempenho.
            </p>
            <div style={{ margin: '0 0 16px 0' }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 12, color: 'var(--t2)' }}>
                Descrição (opcional):
              </label>
              <input
                type="text"
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                placeholder="ex: Avanço após conclusão da fundação"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--bd)', borderRadius: 6, background: 'var(--bg2)', color: 'var(--t1)', fontSize: 12, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                className="ao-btn ao-btn-sm"
                onClick={() => { setShowSaveReportConfirm(false); setReportDescription(''); }}
                disabled={savingReport}
              >
                Cancelar
              </button>
              <button
                className="ao-btn ao-btn-sm"
                style={{ background: '#ec4899', color: '#fff', border: 'none' }}
                onClick={saveReport}
                disabled={savingReport}
              >
                {savingReport ? '⏳ Gravando...' : '📊 Gravar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report History Modal */}
      {showReportHistory && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg1)', border: '1px solid var(--bd)', borderRadius: 12, padding: 24, maxWidth: 900, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <h2 style={{ margin: '0 0 20px 0', color: 'var(--t1)' }}>Histórico de Relatórios de Avanço Físico</h2>
            {reports.length === 0 ? (
              <p style={{ color: 'var(--t3)', fontSize: 13 }}>Nenhum relatório gravado ainda.</p>
            ) : (
              <div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--bd)' }}>
                      <th style={{ padding: 8, textAlign: 'left', color: 'var(--t2)' }}>Report #</th>
                      <th style={{ padding: 8, textAlign: 'left', color: 'var(--t2)' }}>Data/Hora</th>
                      <th style={{ padding: 8, textAlign: 'left', color: 'var(--t2)' }}>Usuário</th>
                      <th style={{ padding: 8, textAlign: 'left', color: 'var(--t2)' }}>Avanço %</th>
                      <th style={{ padding: 8, textAlign: 'left', color: 'var(--t2)' }}>Descrição</th>
                      <th style={{ padding: 8, textAlign: 'center', color: 'var(--t2)' }}>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((r) => (
                      <tr key={r.id} style={{ borderBottom: '0.5px solid var(--bd)' }}>
                        <td style={{ padding: 8, color: 'var(--t1)', fontWeight: 500 }}>Report #{String(r.reportNumber).padStart(3, '0')}</td>
                        <td style={{ padding: 8, color: 'var(--t2)' }}>{new Date(r.createdAt).toLocaleString('pt-BR')}</td>
                        <td style={{ padding: 8, color: 'var(--t2)' }}>{r.user.fullName || r.user.email}</td>
                        <td style={{ padding: 8, color: 'var(--t1)', fontWeight: 600 }}>{r.physicalProgress.toFixed(1)}%</td>
                        <td style={{ padding: 8, color: 'var(--t2)', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.description || '—'}</td>
                        <td style={{ padding: 8, textAlign: 'center' }}>
                          <button
                            style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}
                            onClick={() => loadReportComparison(r)}
                          >
                            Comparar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {selectedReport && (
                  <div style={{ marginTop: 24, padding: 16, background: 'var(--bg2)', borderRadius: 8 }}>
                    <h3 style={{ margin: '0 0 12px 0', color: 'var(--t1)', fontSize: 13 }}>
                      Report #{selectedReport.reportNumber} vs Baseline v{selectedReport.baselineVersion}
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
                      <div style={{ padding: 12, background: 'var(--bg1)', borderRadius: 6, borderLeft: '3px solid #3b82f6' }}>
                        <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 4 }}>No Prazo</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)' }}>{selectedReport.summary.onSchedule}</div>
                      </div>
                      <div style={{ padding: 12, background: 'var(--bg1)', borderRadius: 6, borderLeft: '3px solid #ef4444' }}>
                        <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 4 }}>Atrasadas</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)' }}>{selectedReport.summary.delayed}</div>
                      </div>
                      <div style={{ padding: 12, background: 'var(--bg1)', borderRadius: 6, borderLeft: '3px solid #10b981' }}>
                        <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 4 }}>Adiantadas</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)' }}>{selectedReport.summary.advanced}</div>
                      </div>
                      <div style={{ padding: 12, background: 'var(--bg1)', borderRadius: 6, borderLeft: '3px solid #f59e0b' }}>
                        <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 4 }}>Avanço Acima</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)' }}>{selectedReport.summary.progressAbove}</div>
                      </div>
                      <div style={{ padding: 12, background: 'var(--bg1)', borderRadius: 6, borderLeft: '3px solid #a855f7' }}>
                        <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 4 }}>Avanço Abaixo</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)' }}>{selectedReport.summary.progressBelow}</div>
                      </div>
                    </div>

                    {selectedReport.changes.length > 0 && (
                      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                        <h4 style={{ margin: '0 0 8px 0', color: 'var(--t2)', fontSize: 12 }}>Detalhes das Tarefas:</h4>
                        {selectedReport.changes.slice(0, 10).map((change, idx: number) => (
                          <div key={idx} style={{ padding: 8, marginBottom: 8, background: 'var(--bg1)', borderRadius: 4, fontSize: 11, borderLeft: `3px solid ${change.status === 'onSchedule' ? '#3b82f6' : change.status === 'delayed' ? '#ef4444' : '#10b981'}` }}>
                            <div style={{ fontWeight: 600, color: 'var(--t1)' }}>{change.code} - {change.name}</div>
                            <div style={{ color: 'var(--t3)', marginTop: 4 }}>
                              Status: <span style={{ fontWeight: 500, color: 'var(--t1)' }}>
                                {change.status === 'onSchedule' && 'No prazo'}
                                {change.status === 'delayed' && `Atrasado ${change.deviation.days} dia(s)`}
                                {change.status === 'advanced' && `Adiantado ${Math.abs(change.deviation.days)} dia(s)`}
                              </span>
                              <br />
                              Progresso: <span style={{ fontWeight: 500, color: 'var(--t1)' }}>
                                Planejado {change.baseline.progress.toFixed(1)}% → Real {change.report.progress.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        ))}
                        {selectedReport.changes.length > 10 && (
                          <p style={{ color: 'var(--t3)', fontSize: 11, margin: '8px 0 0 0' }}>... e mais {selectedReport.changes.length - 10} tarefas</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="ao-btn ao-btn-sm"
                onClick={() => { setShowReportHistory(false); setSelectedReport(null); }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
