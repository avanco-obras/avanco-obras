import type { FlowBar, FlowRow, FlowlineModel } from './flowline-model';
import { DAY_MS, formatScheduleBR } from './types';

/**
 * Engine de renderização da Linha de Balanço.
 *
 * Um único <canvas> DPR-aware com:
 *  - cabeçalho de tempo (mês / semana ISO / dia da semana / nº do dia);
 *  - fundo (colunas de fim de semana + grade) cacheado em offscreen canvas,
 *    invalidado apenas em zoom/pan-x/resize;
 *  - virtualização vertical: só as linhas visíveis são desenhadas;
 *  - repaint via requestAnimationFrame com dirty-flag;
 *  - hit-testing por varredura das linhas visíveis;
 *  - interação: hover, clique, drag para mover, drag nas bordas para
 *    redimensionar, Ctrl+scroll para zoom ancorado no cursor.
 *
 * Tooltip/popover/menus são DOM — a engine só emite callbacks com posições.
 */

// ── Constantes visuais ─────────────────────────────────────────────────────────
const HEADER_H = 64;
const GROUP_ROW_H = 26;
const LANE_H = 22;
const ROW_PAD = 6;
const BAR_H = 14;
const BASELINE_H = 4;
const EDGE_PX = 6;
const MIN_PX_PER_DAY = 0.4;
const MAX_PX_PER_DAY = 90;
const SB_SIZE = 10;        // espessura das scrollbars (overlay)
const SB_MIN_THUMB = 28;   // tamanho mínimo do thumb
const X_PAD_DAYS = 3;      // respiro (dias) em cada lado do range de dados

const COLORS = {
  headerBg: '#ffffff',
  headerText: '#475569',
  headerSubText: '#94a3b8',
  weekBandBg: '#f8fafc',
  gridLine: '#f1f5f9',
  rowLine: '#f1f5f9',
  groupRowBg: '#f1f5f9',
  sat: 'rgba(148,163,184,0.14)',
  sun: 'rgba(148,163,184,0.24)',
  today: '#ef4444',
  dep: '#64748b',
  pending: '#2563eb',
  selection: '#1d4ed8',
  barShadow: 'rgba(0,0,0,0.12)',
  ghost: 'rgba(37,99,235,0.35)',
  text: '#1f2937',
  sbTrack: 'rgba(148,163,184,0.16)',
  sbThumb: 'rgba(100,116,139,0.5)',
  sbThumbActive: 'rgba(71,85,105,0.75)',
  overflowHint: 'rgba(15,23,42,0.07)',
};

const WEEKDAY_LETTER = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']; // getDay(): 0=Dom

export interface DisplayOptions {
  showWeekYear: boolean;
  showWeekday: boolean;
  showDayNum: boolean;
  highlightWeekend: boolean;
  showBaseline: boolean;
  showDeps: boolean;
}

export const DEFAULT_DISPLAY: DisplayOptions = {
  showWeekYear: true,
  showWeekday: true,
  showDayNum: true,
  highlightWeekend: true,
  showBaseline: true,
  showDeps: false,
};

export interface BaselineRange { start: number; end: number }

export interface BarHit {
  bar: FlowBar;
  rowId: string;
  x: number; y: number; w: number; h: number;
  edge: 'start' | 'end' | null;
}

export interface DragResult {
  taskId: string;
  kind: 'move' | 'resize-start' | 'resize-end';
  newStart: number;
  newEnd: number;
}

export interface RowLayoutEntry { row: FlowRow; y: number; height: number }

/** Layout vertical das linhas — compartilhado com a árvore DOM da página. */
export function computeRowLayout(model: FlowlineModel): { entries: RowLayoutEntry[]; totalHeight: number } {
  const entries: RowLayoutEntry[] = [];
  let y = 0;
  for (const row of model.rows) {
    const height = row.kind === 'group' ? GROUP_ROW_H : row.laneCount * LANE_H + ROW_PAD * 2;
    entries.push({ row, y, height });
    y += height;
  }
  return { entries, totalHeight: y };
}

/** Semana ISO 8601. */
export function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
}

interface Callbacks {
  onBarHover?: (hit: BarHit | null, clientX: number, clientY: number) => void;
  onBarClick?: (hit: BarHit, clientX: number, clientY: number) => void;
  onBarDrag?: (result: DragResult) => void;
  onViewportChange?: (scrollY: number) => void;
  onBackgroundClick?: () => void;
}

export class LobCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement; // cache do fundo (colunas de tempo)
  private bgDirty = true;
  private dirty = false; // "frame já agendado" — começa falso p/ o 1º invalidate agendar o render
  private raf = 0;
  private ro: ResizeObserver;
  private destroyed = false;

  private model: FlowlineModel = { rows: [], minDate: Date.now(), maxDate: Date.now(), groups: [] };
  private layout: { entries: RowLayoutEntry[]; totalHeight: number } = { entries: [], totalHeight: 0 };
  private barPos = new Map<string, { rowIdx: number; laneY: number }>(); // taskId → posição vertical estática
  private baselines = new Map<string, BaselineRange>();
  private options: DisplayOptions = { ...DEFAULT_DISPLAY };
  private selectedId: string | null = null;

  // viewport
  private pxPerDay = 6;
  private originMs = Date.now(); // instante em x=0
  private scrollY = 0;
  private width = 0;
  private height = 0;
  private dpr = 1;

  // interação
  private hover: BarHit | null = null;
  private drag: {
    hit: BarHit;
    startClientX: number;
    startClientY: number;
    origStart: number;
    origEnd: number;
    kind: 'move' | 'resize-start' | 'resize-end';
    moved: boolean;
    curStart: number;
    curEnd: number;
  } | null = null;
  private panning: { startClientX: number; startClientY: number; origOrigin: number; origScrollY: number; moved: boolean } | null = null;
  private sbDrag: { axis: 'x' | 'y'; startClient: number; startScrollY: number; startOriginMs: number } | null = null;

  private cb: Callbacks;

  constructor(canvas: HTMLCanvasElement, callbacks: Callbacks = {}) {
    this.canvas = canvas;
    this.cb = callbacks;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D não suportado');
    this.ctx = ctx;
    this.bg = document.createElement('canvas');

    this.ro = new ResizeObserver(() => this.handleResize());
    this.ro.observe(canvas.parentElement ?? canvas);
    this.handleResize();

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.style.touchAction = 'none';
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    this.canvas.removeEventListener('wheel', this.onWheel);
  }

  // ── API pública ──────────────────────────────────────────────────────────────

  setModel(model: FlowlineModel, opts: { keepViewport?: boolean } = {}): void {
    const first = this.layout.entries.length === 0;
    this.model = model;
    this.layout = computeRowLayout(model);
    this.barPos.clear();
    this.layout.entries.forEach((entry, rowIdx) => {
      if (entry.row.kind !== 'flow') return;
      for (const bar of entry.row.bars) {
        this.barPos.set(bar.taskId, { rowIdx, laneY: ROW_PAD + bar.subLane * LANE_H + (LANE_H - BAR_H) / 2 });
      }
    });
    if (first && !opts.keepViewport) this.fit();
    this.clampScroll();
    this.clampX();
    this.invalidate();
  }

  setBaselines(map: Map<string, BaselineRange>): void {
    this.baselines = map;
    this.invalidate();
  }

  setOptions(options: Partial<DisplayOptions>): void {
    this.options = { ...this.options, ...options };
    this.bgDirty = true;
    this.invalidate();
  }

  getOptions(): DisplayOptions { return { ...this.options }; }

  setSelected(taskId: string | null): void {
    this.selectedId = taskId;
    this.invalidate();
  }

  setPxPerDay(v: number, anchorClientX?: number): void {
    const px = Math.min(MAX_PX_PER_DAY, Math.max(MIN_PX_PER_DAY, v));
    const rect = this.canvas.getBoundingClientRect();
    const ax = anchorClientX != null ? anchorClientX - rect.left : this.width / 2;
    const tAtAnchor = this.originMs + (ax / this.pxPerDay) * DAY_MS;
    this.pxPerDay = px;
    this.originMs = tAtAnchor - (ax / this.pxPerDay) * DAY_MS;
    this.clampX();
    this.bgDirty = true;
    this.invalidate();
  }

  getPxPerDay(): number { return this.pxPerDay; }

  zoomIn(): void { this.setPxPerDay(this.pxPerDay * 1.3); }
  zoomOut(): void { this.setPxPerDay(this.pxPerDay / 1.3); }

  /** Ajusta o zoom para caber todo o período na largura atual. */
  fit(): void {
    const spanDays = Math.max(1, (this.model.maxDate - this.model.minDate) / DAY_MS + 1);
    const pad = 3; // dias de respiro em cada lado
    this.pxPerDay = Math.min(MAX_PX_PER_DAY, Math.max(MIN_PX_PER_DAY, this.width / (spanDays + pad * 2)));
    this.originMs = this.model.minDate - pad * DAY_MS;
    this.scrollY = 0;
    this.bgDirty = true;
    this.invalidate();
  }

  setScrollY(y: number): void {
    this.scrollY = y;
    this.clampScroll();
    this.invalidate();
    this.cb.onViewportChange?.(this.scrollY);
  }

  getScrollY(): number { return this.scrollY; }
  getTotalHeight(): number { return this.layout.totalHeight; }
  getViewportBodyHeight(): number { return Math.max(0, this.height - HEADER_H); }

  /** Posição x (CSS px) de um instante. */
  xOf(t: number): number { return ((t - this.originMs) / DAY_MS) * this.pxPerDay; }
  /** Instante correspondente a um x (CSS px). */
  tOf(x: number): number { return this.originMs + (x / this.pxPerDay) * DAY_MS; }

  /**
   * Largura (CSS px) de um intervalo início→término INCLUSIVO: a barra cobre
   * também a coluna do dia de término, exatamente como o Gantt do Cronograma
   * (`daysBetween(start, end) + 1`).
   */
  private spanPx(start: number, end: number): number {
    return Math.max(2, ((end - start) / DAY_MS + 1) * this.pxPerDay);
  }

  /** Retângulo (CSS px, coords do canvas) de uma barra — para posicionar popover DOM. */
  barRect(taskId: string): { x: number; y: number; w: number; h: number } | null {
    const pos = this.barPos.get(taskId);
    if (!pos) return null;
    const entry = this.layout.entries[pos.rowIdx];
    const bar = entry.row.bars.find((b) => b.taskId === taskId);
    if (!bar) return null;
    return {
      x: this.xOf(bar.start),
      y: HEADER_H + entry.y - this.scrollY + pos.laneY,
      w: this.spanPx(bar.start, bar.end),
      h: BAR_H,
    };
  }

  // ── Loop de render ───────────────────────────────────────────────────────────

  private invalidate(): void {
    if (this.dirty || this.destroyed) return;
    this.dirty = true;
    this.raf = requestAnimationFrame(() => {
      this.dirty = false;
      this.render();
    });
  }

  private handleResize(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    this.width = Math.max(50, rect.width);
    this.height = Math.max(50, rect.height);
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.bgDirty = true;
    this.invalidate();
  }

  private clampScroll(): void {
    const maxScroll = Math.max(0, this.layout.totalHeight - this.getViewportBodyHeight());
    this.scrollY = Math.min(maxScroll, Math.max(0, this.scrollY));
  }

  // ── Range horizontal + scrollbars ────────────────────────────────────────────

  private contentStartMs(): number { return this.model.minDate - X_PAD_DAYS * DAY_MS; }
  private contentEndMs(): number { return this.model.maxDate + X_PAD_DAYS * DAY_MS; }
  private viewSpanMs(): number { return (this.width / this.pxPerDay) * DAY_MS; }

  /** Limita o pan horizontal à janela de dados (evita "se perder" fora do cronograma). */
  private clampX(): void {
    const viewMs = this.viewSpanMs();
    const start = this.contentStartMs();
    const end = this.contentEndMs();
    if (end - start <= viewMs) this.originMs = start;
    else this.originMs = Math.min(end - viewMs, Math.max(start, this.originMs));
  }

  private hasVOverflow(): boolean {
    return this.layout.totalHeight > this.getViewportBodyHeight();
  }

  private hasHOverflow(): boolean {
    return this.contentEndMs() - this.contentStartMs() > this.viewSpanMs();
  }

  private vScrollbarGeom(): { trackX: number; trackY: number; trackH: number; thumbY: number; thumbH: number } | null {
    if (!this.hasVOverflow()) return null;
    const trackX = this.width - SB_SIZE;
    const trackY = HEADER_H;
    const trackH = this.height - HEADER_H - (this.hasHOverflow() ? SB_SIZE : 0);
    const bodyH = this.getViewportBodyHeight();
    const thumbH = Math.max(SB_MIN_THUMB, trackH * (bodyH / this.layout.totalHeight));
    const maxScroll = this.layout.totalHeight - bodyH;
    const thumbY = trackY + (maxScroll > 0 ? (this.scrollY / maxScroll) * (trackH - thumbH) : 0);
    return { trackX, trackY, trackH, thumbY, thumbH };
  }

  private hScrollbarGeom(): { trackX: number; trackY: number; trackW: number; thumbX: number; thumbW: number } | null {
    if (!this.hasHOverflow()) return null;
    const trackY = this.height - SB_SIZE;
    const trackX = 0;
    const trackW = this.width - (this.hasVOverflow() ? SB_SIZE : 0);
    const spanMs = this.contentEndMs() - this.contentStartMs();
    const viewMs = this.viewSpanMs();
    const thumbW = Math.max(SB_MIN_THUMB, trackW * (viewMs / spanMs));
    const maxOffMs = spanMs - viewMs;
    const frac = maxOffMs > 0 ? (this.originMs - this.contentStartMs()) / maxOffMs : 0;
    const thumbX = trackX + Math.min(1, Math.max(0, frac)) * (trackW - thumbW);
    return { trackX, trackY, trackW, thumbX, thumbW };
  }

  private setOriginMs(ms: number): void {
    this.originMs = ms;
    this.clampX();
    this.bgDirty = true;
    this.invalidate();
  }

  // ── Fundo (colunas de tempo) ─────────────────────────────────────────────────

  private renderBackground(): void {
    this.bg.width = this.canvas.width;
    this.bg.height = this.canvas.height;
    const ctx = this.bg.getContext('2d')!;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    const dayW = this.pxPerDay;
    const showDays = dayW >= 3;
    const t0 = this.tOf(0);
    const firstDay = new Date(t0);
    firstDay.setHours(0, 0, 0, 0);

    if (showDays) {
      for (let t = firstDay.getTime(); ; t += DAY_MS) {
        const x = this.xOf(t);
        if (x > this.width) break;
        if (x + dayW < 0) continue;
        const dow = new Date(t).getDay();
        if (this.options.highlightWeekend && (dow === 0 || dow === 6)) {
          ctx.fillStyle = dow === 0 ? COLORS.sun : COLORS.sat;
          ctx.fillRect(x, HEADER_H, dayW, this.height - HEADER_H);
        }
        if (dayW >= 6) {
          ctx.strokeStyle = COLORS.gridLine;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(Math.round(x) + 0.5, HEADER_H);
          ctx.lineTo(Math.round(x) + 0.5, this.height);
          ctx.stroke();
        }
      }
    } else {
      // Grade semanal quando os dias somem
      const monday = new Date(firstDay);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      for (let t = monday.getTime(); ; t += 7 * DAY_MS) {
        const x = this.xOf(t);
        if (x > this.width) break;
        if (x < 0) continue;
        ctx.strokeStyle = COLORS.gridLine;
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, HEADER_H);
        ctx.lineTo(Math.round(x) + 0.5, this.height);
        ctx.stroke();
      }
    }
    this.bgDirty = false;
  }

  // ── Cabeçalho de tempo ───────────────────────────────────────────────────────

  private renderHeader(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = COLORS.headerBg;
    ctx.fillRect(0, 0, this.width, HEADER_H);

    const dayW = this.pxPerDay;
    const t0 = this.tOf(0);
    const tEnd = this.tOf(this.width);

    // Faixas do cabeçalho (alturas dinâmicas conforme opções/zoom)
    const showDayRow = dayW >= 14 && (this.options.showWeekday || this.options.showDayNum);
    const showWeekRow = this.options.showWeekYear && dayW >= 1.2;
    const monthY = 4;
    const weekY = 20;
    const dayY = showWeekRow ? 36 : 22;

    // Meses
    ctx.textBaseline = 'top';
    const mCursor = new Date(t0);
    mCursor.setDate(1); mCursor.setHours(0, 0, 0, 0);
    ctx.font = '700 10px system-ui, sans-serif';
    while (mCursor.getTime() < tEnd) {
      const next = new Date(mCursor.getFullYear(), mCursor.getMonth() + 1, 1);
      const x = Math.max(4, this.xOf(mCursor.getTime()) + 4);
      const label = `${mCursor.toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase()} ${mCursor.getFullYear()}`;
      ctx.fillStyle = COLORS.headerText;
      if (this.xOf(next.getTime()) > 40) ctx.fillText(label, x, monthY);
      // separador de mês
      const mx = this.xOf(mCursor.getTime());
      if (mx >= 0 && mx <= this.width) {
        ctx.strokeStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(Math.round(mx) + 0.5, 0);
        ctx.lineTo(Math.round(mx) + 0.5, HEADER_H);
        ctx.stroke();
      }
      mCursor.setMonth(mCursor.getMonth() + 1);
    }

    // Semanas do ano (S36, S37…)
    if (showWeekRow) {
      const monday = new Date(t0);
      monday.setHours(0, 0, 0, 0);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      ctx.font = '700 8.5px system-ui, sans-serif';
      for (let t = monday.getTime(); t < tEnd; t += 7 * DAY_MS) {
        const x = this.xOf(t);
        const w = 7 * dayW;
        if (x + w < 0) continue;
        ctx.fillStyle = COLORS.weekBandBg;
        ctx.fillRect(x, weekY - 2, w - 1, 13);
        if (w > 22) {
          ctx.fillStyle = COLORS.headerSubText;
          const label = `S${isoWeek(new Date(t))}`;
          const tw = ctx.measureText(label).width;
          ctx.fillText(label, x + (w - tw) / 2, weekY);
        }
      }
    }

    // Dia da semana + número do dia
    if (showDayRow) {
      const d = new Date(t0);
      d.setHours(0, 0, 0, 0);
      for (let t = d.getTime(); t < tEnd + DAY_MS; t += DAY_MS) {
        const x = this.xOf(t);
        if (x + dayW < 0) continue;
        if (x > this.width) break;
        const date = new Date(t);
        const dow = date.getDay();
        if (this.options.highlightWeekend && (dow === 0 || dow === 6)) {
          ctx.fillStyle = dow === 0 ? COLORS.sun : COLORS.sat;
          ctx.fillRect(x, dayY - 2, dayW, HEADER_H - dayY + 2);
        }
        const cx = x + dayW / 2;
        if (this.options.showWeekday) {
          ctx.font = '700 7.5px system-ui, sans-serif';
          ctx.fillStyle = COLORS.headerSubText;
          const l = WEEKDAY_LETTER[dow];
          ctx.fillText(l, cx - ctx.measureText(l).width / 2, dayY);
        }
        if (this.options.showDayNum) {
          ctx.font = '700 8.5px system-ui, sans-serif';
          ctx.fillStyle = COLORS.headerText;
          const n = String(date.getDate());
          ctx.fillText(n, cx - ctx.measureText(n).width / 2, dayY + (this.options.showWeekday ? 10 : 2));
        }
      }
    }

    // linha inferior do cabeçalho
    ctx.strokeStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(0, HEADER_H - 0.5);
    ctx.lineTo(this.width, HEADER_H - 0.5);
    ctx.stroke();
  }

  // ── Corpo ────────────────────────────────────────────────────────────────────

  private visibleRange(): { startIdx: number; endIdx: number } {
    const entries = this.layout.entries;
    const top = this.scrollY;
    const bottom = this.scrollY + this.getViewportBodyHeight();
    // busca binária pela primeira linha visível
    let lo = 0, hi = entries.length - 1, startIdx = entries.length;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (entries[mid].y + entries[mid].height > top) { startIdx = mid; hi = mid - 1; }
      else lo = mid + 1;
    }
    let endIdx = startIdx;
    while (endIdx < entries.length && entries[endIdx].y < bottom) endIdx++;
    return { startIdx, endIdx };
  }

  private drawBar(ctx: CanvasRenderingContext2D, bar: FlowBar, y: number, ghost = false): void {
    const x = this.xOf(bar.start);
    const w = this.spanPx(bar.start, bar.end);
    if (x + w < 0 || x > this.width) return;

    const r = Math.min(4, w / 2);
    ctx.save();
    if (ghost) ctx.globalAlpha = 0.45;

    // corpo (tom claro) + sombra sutil
    ctx.beginPath();
    ctx.roundRect(x, y, w, BAR_H, r);
    ctx.shadowColor = COLORS.barShadow;
    ctx.shadowBlur = 2;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = bar.color.light;
    ctx.fill();
    ctx.shadowColor = 'transparent';

    // executado (tom escuro)
    if (bar.progress > 0) {
      const pw = (Math.min(100, bar.progress) / 100) * w;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, w, BAR_H, r);
      ctx.clip();
      ctx.fillStyle = bar.color.dark;
      ctx.fillRect(x, y, pw, BAR_H);
      ctx.restore();
    }

    // nome dentro da barra (compactado); some quando não há espaço
    if (w >= 24) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x + 1, y, w - 2, BAR_H, r);
      ctx.clip();
      ctx.font = '700 8.5px system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      const progW = (Math.min(100, bar.progress) / 100) * w;
      // contraste: branco sobre o tom escuro; tom escuro sobre a parte clara
      ctx.fillStyle = progW > 24 ? '#ffffff' : bar.color.dark;
      let label = bar.name;
      const maxW = w - 10;
      if (ctx.measureText(label).width > maxW) {
        while (label.length > 1 && ctx.measureText(`${label}…`).width > maxW) label = label.slice(0, -1);
        label = `${label}…`;
      }
      ctx.fillText(label, x + 5, y + BAR_H / 2 + 0.5);
      ctx.restore();
    }

    // baseline (barra fina abaixo)
    if (this.options.showBaseline) {
      const bl = this.baselines.get(bar.taskId);
      if (bl) {
        const bx = this.xOf(bl.start);
        const bw = this.spanPx(bl.start, bl.end);
        ctx.globalAlpha = ghost ? 0.3 : 0.55;
        ctx.fillStyle = bar.color.dark;
        ctx.beginPath();
        ctx.roundRect(bx, y + BAR_H + 2, bw, BASELINE_H, 2);
        ctx.fill();
        ctx.globalAlpha = ghost ? 0.45 : 1;
      }
    }

    // pendente: borda + ponto azul
    if (bar.pending && !ghost) {
      ctx.strokeStyle = COLORS.pending;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x - 1, y - 1, w + 2, BAR_H + 2, r + 1);
      ctx.stroke();
      ctx.fillStyle = COLORS.pending;
      ctx.beginPath();
      ctx.arc(x + w - 1, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // seleção
    if (this.selectedId === bar.taskId && !ghost) {
      ctx.strokeStyle = COLORS.selection;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.roundRect(x - 2.5, y - 2.5, w + 5, BAR_H + 5, r + 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  private drawDeps(ctx: CanvasRenderingContext2D, startIdx: number, endIdx: number): void {
    if (!this.options.showDeps) return;
    ctx.save();
    ctx.strokeStyle = COLORS.dep;
    ctx.fillStyle = COLORS.dep;
    ctx.lineWidth = 1.3;

    const drawn = new Set<string>();
    for (let i = startIdx; i < endIdx; i++) {
      const entry = this.layout.entries[i];
      if (entry.row.kind !== 'flow') continue;
      for (const bar of entry.row.bars) {
        // Desenha vínculos onde esta barra é o LADO visível (pred ou succ)
        const task = bar;
        const succDeps = this.depsOf(task.taskId);
        for (const d of succDeps) {
          const key = `${d.predecessorId}->${d.successorId}`;
          if (drawn.has(key)) continue;
          drawn.add(key);
          const predRect = this.barRect(d.predecessorId);
          const succRect = this.barRect(d.successorId);
          if (!predRect || !succRect) continue;
          const x1 = predRect.x + predRect.w;
          const y1 = predRect.y + BAR_H / 2;
          const x2 = succRect.x;
          const y2 = succRect.y + BAR_H / 2;
          if (Math.max(y1, y2) < HEADER_H - 40 || Math.min(y1, y2) > this.height + 40) continue;
          const cxo = Math.max(14, Math.min(40, (x2 - x1) / 2));
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.bezierCurveTo(x1 + cxo, y1, x2 - cxo, y2, x2 - 4, y2);
          ctx.stroke();
          // seta
          ctx.beginPath();
          ctx.moveTo(x2 - 4, y2 - 3.4);
          ctx.lineTo(x2 + 1, y2);
          ctx.lineTo(x2 - 4, y2 + 3.4);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  /** deps onde o taskId participa (lado sucessor OU predecessor) — via modelo. */
  private depIndex: Map<string, { predecessorId: string; successorId: string }[]> | null = null;
  setDependencies(deps: { predecessorId: string; successorId: string }[]): void {
    this.depIndex = new Map();
    for (const d of deps) {
      const arr = this.depIndex.get(d.predecessorId);
      if (arr) arr.push(d); else this.depIndex.set(d.predecessorId, [d]);
      const arr2 = this.depIndex.get(d.successorId);
      if (arr2) arr2.push(d); else this.depIndex.set(d.successorId, [d]);
    }
    this.invalidate();
  }
  private depsOf(taskId: string): { predecessorId: string; successorId: string }[] {
    return this.depIndex?.get(taskId) ?? [];
  }

  private render(): void {
    if (this.destroyed) return;
    if (this.bgDirty) this.renderBackground();

    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    // fundo cacheado
    ctx.drawImage(this.bg, 0, 0, this.width, this.height);

    const { startIdx, endIdx } = this.visibleRange();

    // linhas (bandas de grupo + separadores) — só as visíveis
    for (let i = startIdx; i < endIdx; i++) {
      const entry = this.layout.entries[i];
      const y = HEADER_H + entry.y - this.scrollY;
      if (entry.row.kind === 'group') {
        ctx.fillStyle = COLORS.groupRowBg;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(0, y, this.width, entry.height);
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = COLORS.rowLine;
      ctx.beginPath();
      ctx.moveTo(0, Math.round(y + entry.height) + 0.5);
      ctx.lineTo(this.width, Math.round(y + entry.height) + 0.5);
      ctx.stroke();
    }

    // barras
    for (let i = startIdx; i < endIdx; i++) {
      const entry = this.layout.entries[i];
      if (entry.row.kind !== 'flow') continue;
      const rowY = HEADER_H + entry.y - this.scrollY;
      for (const bar of entry.row.bars) {
        // durante o drag, a barra original vira ghost — a prévia é desenhada depois
        const isDragged = this.drag?.hit.bar.taskId === bar.taskId && this.drag.moved;
        if (isDragged) continue;
        const laneY = rowY + ROW_PAD + bar.subLane * LANE_H + (LANE_H - BAR_H) / 2;
        this.drawBar(ctx, bar, laneY);
      }
    }

    // dependências
    this.drawDeps(ctx, startIdx, endIdx);

    // prévia do drag
    if (this.drag?.moved) {
      const { hit, curStart, curEnd } = this.drag;
      const rect = this.barRect(hit.bar.taskId);
      if (rect) {
        // fantasma na posição original
        this.drawBar(ctx, hit.bar, rect.y, true);
        // prévia na nova posição
        const preview: FlowBar = { ...hit.bar, start: curStart, end: curEnd };
        this.drawBar(ctx, preview, rect.y);
        // guias verticais + etiqueta de datas
        const gx1 = this.xOf(curStart);
        const gx2 = gx1 + this.spanPx(curStart, curEnd); // término inclusivo
        ctx.save();
        ctx.strokeStyle = COLORS.pending;
        ctx.setLineDash([3, 3]);
        for (const gx of [gx1, gx2]) {
          ctx.beginPath();
          ctx.moveTo(Math.round(gx) + 0.5, HEADER_H);
          ctx.lineTo(Math.round(gx) + 0.5, this.height);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        const fmt = (t: number) => formatScheduleBR(t).slice(0, 5); // dd/mm
        const label = `${fmt(curStart)} → ${fmt(curEnd)}`;
        ctx.font = '700 10px system-ui, sans-serif';
        const tw = ctx.measureText(label).width;
        const lx = Math.min(this.width - tw - 12, Math.max(4, gx1));
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.roundRect(lx, rect.y - 22, tw + 10, 16, 4);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, lx + 5, rect.y - 14);
        ctx.restore();
      }
    }

    // cabeçalho por cima do corpo
    this.renderHeader(ctx);

    // linha "hoje" (atravessa cabeçalho e corpo)
    const todayX = this.xOf(new Date().setHours(0, 0, 0, 0));
    if (todayX >= 0 && todayX <= this.width) {
      ctx.save();
      ctx.strokeStyle = COLORS.today;
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(todayX, 14);
      ctx.lineTo(todayX, this.height);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.font = '700 8px system-ui, sans-serif';
      ctx.fillStyle = COLORS.today;
      ctx.fillText('hoje', todayX + 4, 16);
      ctx.restore();
    }

    // indicadores de conteúdo fora da área visível + scrollbars
    this.drawOverflowHints(ctx);
    this.drawScrollbars(ctx);
  }

  /** Fades sutis nas bordas quando há conteúdo além da área visível. */
  private drawOverflowHints(ctx: CanvasRenderingContext2D): void {
    const bodyTop = HEADER_H;
    const F = 14;
    const fade = (x0: number, x1: number) => {
      const g = ctx.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, COLORS.overflowHint);
      g.addColorStop(1, 'rgba(15,23,42,0)');
      ctx.fillStyle = g;
      ctx.fillRect(Math.min(x0, x1), bodyTop, F, this.height - bodyTop);
    };
    if (this.tOf(0) > this.contentStartMs() + DAY_MS / 24) fade(0, F);
    if (this.tOf(this.width) < this.contentEndMs() - DAY_MS / 24) fade(this.width, this.width - F);
    const maxScroll = this.layout.totalHeight - this.getViewportBodyHeight();
    if (this.scrollY > 1) {
      const g = ctx.createLinearGradient(0, bodyTop, 0, bodyTop + 10);
      g.addColorStop(0, COLORS.overflowHint);
      g.addColorStop(1, 'rgba(15,23,42,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, bodyTop, this.width, 10);
    }
    if (this.scrollY < maxScroll - 1) {
      const g = ctx.createLinearGradient(0, this.height, 0, this.height - 10);
      g.addColorStop(0, COLORS.overflowHint);
      g.addColorStop(1, 'rgba(15,23,42,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, this.height - 10, this.width, 10);
    }
  }

  /** Scrollbars overlay (visíveis apenas quando há conteúdo excedente). */
  private drawScrollbars(ctx: CanvasRenderingContext2D): void {
    const v = this.vScrollbarGeom();
    const h = this.hScrollbarGeom();
    ctx.save();
    if (v) {
      ctx.fillStyle = COLORS.sbTrack;
      ctx.fillRect(v.trackX, v.trackY, SB_SIZE, v.trackH);
      ctx.fillStyle = this.sbDrag?.axis === 'y' ? COLORS.sbThumbActive : COLORS.sbThumb;
      ctx.beginPath();
      ctx.roundRect(v.trackX + 2, v.thumbY + 2, SB_SIZE - 4, Math.max(8, v.thumbH - 4), 3);
      ctx.fill();
    }
    if (h) {
      ctx.fillStyle = COLORS.sbTrack;
      ctx.fillRect(h.trackX, h.trackY, h.trackW, SB_SIZE);
      ctx.fillStyle = this.sbDrag?.axis === 'x' ? COLORS.sbThumbActive : COLORS.sbThumb;
      ctx.beginPath();
      ctx.roundRect(h.thumbX + 2, h.trackY + 2, Math.max(8, h.thumbW - 4), SB_SIZE - 4, 3);
      ctx.fill();
    }
    ctx.restore();
  }

  // ── Hit-testing ──────────────────────────────────────────────────────────────

  hitTest(clientX: number, clientY: number): BarHit | null {
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (y < HEADER_H) return null;
    // zonas das scrollbars não são barras
    if (this.hasVOverflow() && x >= this.width - SB_SIZE) return null;
    if (this.hasHOverflow() && y >= this.height - SB_SIZE) return null;

    const bodyY = y - HEADER_H + this.scrollY;
    const { startIdx, endIdx } = this.visibleRange();
    for (let i = startIdx; i < endIdx; i++) {
      const entry = this.layout.entries[i];
      if (entry.row.kind !== 'flow') continue;
      if (bodyY < entry.y || bodyY > entry.y + entry.height) continue;
      for (const bar of entry.row.bars) {
        const laneTop = entry.y + ROW_PAD + bar.subLane * LANE_H + (LANE_H - BAR_H) / 2;
        if (bodyY < laneTop - 2 || bodyY > laneTop + BAR_H + 2) continue;
        const bx = this.xOf(bar.start);
        const bw = this.spanPx(bar.start, bar.end);
        if (x < bx - 2 || x > bx + bw + 2) continue;
        let edge: BarHit['edge'] = null;
        if (bw > EDGE_PX * 3) {
          if (x <= bx + EDGE_PX) edge = 'start';
          else if (x >= bx + bw - EDGE_PX) edge = 'end';
        }
        return {
          bar,
          rowId: entry.row.id,
          x: bx,
          y: HEADER_H + entry.y - this.scrollY + ROW_PAD + bar.subLane * LANE_H + (LANE_H - BAR_H) / 2,
          w: bw,
          h: BAR_H,
          edge,
        };
      }
    }
    return null;
  }

  // ── Interações ───────────────────────────────────────────────────────────────

  /**
   * Alinha um instante à meia-noite LOCAL — mesma âncora das datas do modelo
   * (ver parseScheduleDate), para a barra encostar exatamente na coluna do dia.
   */
  private snapDay(t: number): number {
    const d = new Date(t + DAY_MS / 2); // arredonda para o dia mais próximo
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    this.canvas.setPointerCapture(e.pointerId);

    // scrollbars primeiro (thumb arrastável; clique na trilha = salto)
    const rect = this.canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const v = this.vScrollbarGeom();
    if (v && px >= v.trackX && py >= v.trackY && py <= v.trackY + v.trackH) {
      if (py < v.thumbY || py > v.thumbY + v.thumbH) {
        const maxScroll = Math.max(0, this.layout.totalHeight - this.getViewportBodyHeight());
        const frac = (py - v.trackY - v.thumbH / 2) / Math.max(1, v.trackH - v.thumbH);
        this.setScrollY(frac * maxScroll);
      }
      this.sbDrag = { axis: 'y', startClient: e.clientY, startScrollY: this.scrollY, startOriginMs: this.originMs };
      this.invalidate();
      return;
    }
    const h = this.hScrollbarGeom();
    if (h && py >= h.trackY && px >= h.trackX && px <= h.trackX + h.trackW) {
      if (px < h.thumbX || px > h.thumbX + h.thumbW) {
        const maxOffMs = this.contentEndMs() - this.contentStartMs() - this.viewSpanMs();
        const frac = (px - h.trackX - h.thumbW / 2) / Math.max(1, h.trackW - h.thumbW);
        this.setOriginMs(this.contentStartMs() + frac * maxOffMs);
      }
      this.sbDrag = { axis: 'x', startClient: e.clientX, startScrollY: this.scrollY, startOriginMs: this.originMs };
      this.invalidate();
      return;
    }

    const hit = this.hitTest(e.clientX, e.clientY);
    if (hit) {
      const kind = hit.edge === 'start' ? 'resize-start' : hit.edge === 'end' ? 'resize-end' : 'move';
      this.drag = {
        hit,
        startClientX: e.clientX,
        startClientY: e.clientY,
        origStart: hit.bar.start,
        origEnd: hit.bar.end,
        kind,
        moved: false,
        curStart: hit.bar.start,
        curEnd: hit.bar.end,
      };
    } else {
      this.panning = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        origOrigin: this.originMs,
        origScrollY: this.scrollY,
        moved: false,
      };
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.sbDrag) {
      if (this.sbDrag.axis === 'y') {
        const v = this.vScrollbarGeom();
        if (v) {
          const maxScroll = Math.max(0, this.layout.totalHeight - this.getViewportBodyHeight());
          const scale = maxScroll / Math.max(1, v.trackH - v.thumbH);
          this.setScrollY(this.sbDrag.startScrollY + (e.clientY - this.sbDrag.startClient) * scale);
        }
      } else {
        const h = this.hScrollbarGeom();
        if (h) {
          const maxOffMs = this.contentEndMs() - this.contentStartMs() - this.viewSpanMs();
          const msPerPx = maxOffMs / Math.max(1, h.trackW - h.thumbW);
          this.setOriginMs(this.sbDrag.startOriginMs + (e.clientX - this.sbDrag.startClient) * msPerPx);
        }
      }
      return;
    }

    if (this.drag) {
      const dxPx = e.clientX - this.drag.startClientX;
      const dxMs = (dxPx / this.pxPerDay) * DAY_MS;
      if (!this.drag.moved && Math.abs(dxPx) < 3) return;
      this.drag.moved = true;

      const { kind, origStart, origEnd } = this.drag;
      if (kind === 'move') {
        this.drag.curStart = this.snapDay(origStart + dxMs);
        this.drag.curEnd = this.drag.curStart + (origEnd - origStart);
      } else if (kind === 'resize-start') {
        // término inclusivo: início pode chegar ao próprio dia do término (1 dia)
        this.drag.curStart = Math.min(this.snapDay(origStart + dxMs), origEnd);
        this.drag.curEnd = origEnd;
      } else {
        this.drag.curStart = origStart;
        this.drag.curEnd = Math.max(this.snapDay(origEnd + dxMs), origStart);
      }
      this.invalidate();
      return;
    }

    if (this.panning) {
      const dx = e.clientX - this.panning.startClientX;
      const dy = e.clientY - this.panning.startClientY;
      if (!this.panning.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      this.panning.moved = true;
      this.originMs = this.panning.origOrigin - (dx / this.pxPerDay) * DAY_MS;
      this.clampX();
      this.scrollY = this.panning.origScrollY - dy;
      this.clampScroll();
      this.bgDirty = true;
      this.invalidate();
      this.cb.onViewportChange?.(this.scrollY);
      return;
    }

    // hover
    const hit = this.hitTest(e.clientX, e.clientY);
    const changed = hit?.bar.taskId !== this.hover?.bar.taskId || hit?.edge !== this.hover?.edge;
    this.hover = hit;
    this.canvas.style.cursor = hit ? (hit.edge ? 'ew-resize' : 'grab') : 'default';
    if (changed || hit) this.cb.onBarHover?.(hit, e.clientX, e.clientY);
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (this.sbDrag) {
      this.sbDrag = null;
      this.invalidate();
      return;
    }
    if (this.drag) {
      const d = this.drag;
      this.drag = null;
      if (d.moved && (d.curStart !== d.origStart || d.curEnd !== d.origEnd)) {
        this.cb.onBarDrag?.({
          taskId: d.hit.bar.taskId,
          kind: d.kind,
          newStart: d.curStart,
          newEnd: d.curEnd,
        });
      } else if (!d.moved) {
        this.cb.onBarClick?.(d.hit, e.clientX, e.clientY);
      }
      this.invalidate();
      return;
    }
    if (this.panning) {
      const wasClick = !this.panning.moved;
      this.panning = null;
      if (wasClick) this.cb.onBackgroundClick?.();
    }
  };

  private onPointerLeave = (): void => {
    this.hover = null;
    this.cb.onBarHover?.(null, 0, 0);
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      this.setPxPerDay(this.pxPerDay * factor, e.clientX);
    } else if (e.shiftKey) {
      this.setOriginMs(this.originMs + ((e.deltaY || e.deltaX) / this.pxPerDay) * DAY_MS * 0.8);
    } else {
      // trackpads emitem deltaX para navegação horizontal nativa
      if (e.deltaX) {
        this.originMs += (e.deltaX / this.pxPerDay) * DAY_MS;
        this.clampX();
        this.bgDirty = true;
      }
      if (e.deltaY) {
        this.scrollY += e.deltaY;
        this.clampScroll();
      }
      this.invalidate();
      this.cb.onViewportChange?.(this.scrollY);
    }
  };
}

export { HEADER_H, GROUP_ROW_H, LANE_H, ROW_PAD };
