import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import * as xlsx from 'xlsx';
import { Prisma } from '@prisma/client';
import { CreateScheduleItemDto } from './dto/create-schedule-item.dto';
import { UpdateScheduleItemDto } from './dto/update-schedule-item.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';

export interface GanttDep {
  id: string;
  predecessorId: string;
  successorId: string;
  lagDays: number;
  type: string;
}

export interface GanttRow {
  id: string;
  code: string;
  name: string;
  level: number;
  parentId?: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  plannedProgress: number;
  physicalProgress: number;
  isCriticalPath: boolean;
  hasChildren: boolean;
  order: number;
  weight: number;
  responsible?: string;
  predecessorDeps: GanttDep[];
  successorDeps: GanttDep[];
}

export interface CurvaSPoint {
  label: string;
  date: string;
  planned: number;
  actual: number;
}

@Injectable()
export class ScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async findAll(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
    }

    return this.prisma.scheduleItem.findMany({
      where: { projectId },
      include: {
        activityType: true,
      },
      orderBy: { order: 'asc' },
    });
  }

  async create(projectId: string, dto: CreateScheduleItemDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
    }

    if (dto.parentId) {
      const parent = await this.prisma.scheduleItem.findUnique({
        where: { id: dto.parentId },
        select: { id: true, projectId: true },
      });
      if (!parent || parent.projectId !== projectId) {
        throw new NotFoundException(
          `Item pai com ID "${dto.parentId}" não encontrado neste projeto`,
        );
      }
    }

    if (dto.activityTypeId) {
      const actType = await this.prisma.activityType.findUnique({
        where: { id: dto.activityTypeId },
        select: { id: true, projectId: true },
      });
      if (!actType || actType.projectId !== projectId) {
        throw new NotFoundException(
          `Tipo de atividade com ID "${dto.activityTypeId}" não encontrado neste projeto`,
        );
      }
    }

    let order = dto.order;
    if (order === undefined) {
      const last = await this.prisma.scheduleItem.findFirst({
        where: { projectId, parentId: dto.parentId ?? null },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      order = last ? last.order + 1 : 0;
    }

    const created = await this.prisma.scheduleItem.create({
      data: {
        projectId,
        parentId: dto.parentId ?? null,
        activityTypeId: dto.activityTypeId ?? null,
        code: dto.code,
        name: dto.name,
        level: dto.level,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        durationDays: dto.durationDays,
        plannedProgress: dto.plannedProgress ?? 0,
        physicalProgress: dto.physicalProgress ?? 0,
        weight: dto.weight ?? 1,
        isCriticalPath: dto.isCriticalPath ?? false,
        responsible: dto.responsible ?? null,
        order,
      },
      include: {
        activityType: true,
      },
    });
    this.realtime.emitScheduleChanged({ projectId, action: 'created', scheduleItemId: created.id });
    return created;
  }

  async update(id: string, dto: UpdateScheduleItemDto) {
    const item = await this.prisma.scheduleItem.findUnique({
      where: { id },
      select: { id: true, projectId: true, physicalProgress: true },
    });
    if (!item) {
      throw new NotFoundException(`Item de cronograma com ID "${id}" não encontrado`);
    }

    const updated = await this.prisma.scheduleItem.update({
      where: { id },
      data: {
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
        ...(dto.activityTypeId !== undefined && { activityTypeId: dto.activityTypeId }),
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.level !== undefined && { level: dto.level }),
        ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
        ...(dto.durationDays !== undefined && { durationDays: dto.durationDays }),
        ...(dto.plannedProgress !== undefined && { plannedProgress: dto.plannedProgress }),
        ...(dto.physicalProgress !== undefined && { physicalProgress: dto.physicalProgress }),
        ...(dto.weight !== undefined && { weight: dto.weight }),
        ...(dto.isCriticalPath !== undefined && { isCriticalPath: dto.isCriticalPath }),
        ...(dto.order !== undefined && { order: dto.order }),
        ...(dto.responsible !== undefined && { responsible: dto.responsible }),
      },
      include: {
        activityType: true,
      },
    });

    if (
      dto.physicalProgress !== undefined &&
      Math.abs(Number(item.physicalProgress) - Number(updated.physicalProgress)) > 0.01
    ) {
      this.realtime.emitScheduleUpdated({
        projectId: item.projectId,
        scheduleItemId: id,
        physicalProgress: Number(updated.physicalProgress),
      });
    }

    return updated;
  }

  async remove(id: string) {
    const item = await this.prisma.scheduleItem.findUnique({
      where: { id },
      select: { id: true, projectId: true },
    });
    if (!item) {
      throw new NotFoundException(`Item de cronograma com ID "${id}" não encontrado`);
    }

    // Prisma cascade handles children deletion (defined in schema onDelete: Cascade)
    await this.prisma.scheduleItem.delete({ where: { id } });
    this.realtime.emitScheduleChanged({ projectId: item.projectId, action: 'deleted', scheduleItemId: id });
    return { message: 'Item excluído com sucesso' };
  }

  async getGanttData(projectId: string): Promise<GanttRow[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, startDate: true, endDate: true },
    });
    if (!project) {
      throw new NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
    }

    // Garante raiz da EAP (retrofit para projetos sem raiz)
    const hasRoot = await this.prisma.scheduleItem.findFirst({
      where: { projectId, parentId: null, level: 0 },
      select: { id: true },
    });
    if (!hasRoot) {
      await this.prisma.scheduleItem.create({
        data: {
          projectId,
          code: '1',
          name: project.name,
          level: 0,
          startDate: project.startDate,
          endDate: project.endDate,
          durationDays: Math.max(
            1,
            Math.ceil(
              (project.endDate.getTime() - project.startDate.getTime()) /
                86_400_000,
            ),
          ),
          order: 0,
        },
      });
    }

    const items = await this.prisma.scheduleItem.findMany({
      where: { projectId },
      select: {
        id: true,
        code: true,
        name: true,
        level: true,
        parentId: true,
        startDate: true,
        endDate: true,
        durationDays: true,
        plannedProgress: true,
        physicalProgress: true,
        isCriticalPath: true,
        order: true,
        weight: true,
        responsible: true,
        _count: {
          select: { children: true },
        },
        predecessors: {
          select: { id: true, predecessorId: true, successorId: true, lagDays: true, type: true },
        },
        successors: {
          select: { id: true, predecessorId: true, successorId: true, lagDays: true, type: true },
        },
      },
      orderBy: { order: 'asc' },
    });

    return items.map((item): GanttRow => ({
      id: item.id,
      code: item.code,
      name: item.name,
      level: item.level,
      parentId: item.parentId ?? undefined,
      startDate: item.startDate.toISOString(),
      endDate: item.endDate.toISOString(),
      durationDays: item.durationDays,
      plannedProgress: Number(item.plannedProgress),
      physicalProgress: Number(item.physicalProgress),
      isCriticalPath: item.isCriticalPath,
      hasChildren: item._count.children > 0,
      order: item.order,
      weight: Number(item.weight),
      responsible: item.responsible ?? undefined,
      predecessorDeps: item.predecessors,
      successorDeps: item.successors,
    }));
  }

  async getCurvaS(projectId: string): Promise<CurvaSPoint[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
    }

    // Fetch all leaf schedule items (items with weight for calculation)
    const items = await this.prisma.scheduleItem.findMany({
      where: { projectId },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        plannedProgress: true,
        physicalProgress: true,
        weight: true,
        _count: { select: { children: true } },
      },
    });

    if (items.length === 0) {
      return [];
    }

    // Use only leaf items (no children) for progress calculation
    const leafItems = items.filter((i) => i._count.children === 0);

    if (leafItems.length === 0) {
      return [];
    }

    // Determine date range from all items
    const allDates = items.flatMap((i) => [i.startDate, i.endDate]);
    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));

    // Total weight
    const totalWeight = leafItems.reduce((sum, i) => sum + Number(i.weight), 0);
    if (totalWeight === 0) {
      return [];
    }

    // Build monthly points from minDate to maxDate
    const points: CurvaSPoint[] = [];

    // Start at the beginning of the first month
    const cursor = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    const endMonth = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);

    const monthLabels = [
      'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
    ];

    let cumulativePlanned = 0;
    let cumulativeActual = 0;

    while (cursor <= endMonth) {
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
      const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);

      // For each leaf item, compute the fraction of work falling in this month
      // We distribute work linearly across the item's duration
      let plannedDelta = 0;
      let actualDelta = 0;

      for (const item of leafItems) {
        const itemStart = item.startDate;
        const itemEnd = item.endDate;
        const itemWeightFraction = Number(item.weight) / totalWeight;

        // Overlap between item duration and this month
        const overlapStart = new Date(Math.max(itemStart.getTime(), monthStart.getTime()));
        const overlapEnd = new Date(Math.min(itemEnd.getTime(), monthEnd.getTime()));

        if (overlapStart > overlapEnd) {
          continue;
        }

        const totalDuration = itemEnd.getTime() - itemStart.getTime();
        if (totalDuration <= 0) {
          // Zero-duration item: count it in the month it falls on
          if (itemStart >= monthStart && itemStart <= monthEnd) {
            plannedDelta += itemWeightFraction * Number(item.plannedProgress);
            actualDelta += itemWeightFraction * Number(item.physicalProgress);
          }
          continue;
        }

        const overlapDuration = overlapEnd.getTime() - overlapStart.getTime();
        const fraction = overlapDuration / totalDuration;

        plannedDelta += itemWeightFraction * Number(item.plannedProgress) * fraction;
        actualDelta += itemWeightFraction * Number(item.physicalProgress) * fraction;
      }

      cumulativePlanned = Math.min(100, cumulativePlanned + plannedDelta);
      cumulativeActual = Math.min(100, cumulativeActual + actualDelta);

      const year2d = String(cursor.getFullYear()).slice(-2);
      const label = `${monthLabels[cursor.getMonth()]}/${year2d}`;
      const dateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-01`;

      points.push({
        label,
        date: dateStr,
        planned: Math.round(cumulativePlanned * 100) / 100,
        actual: Math.round(cumulativeActual * 100) / 100,
      });

      // Advance to next month
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return points;
  }

  async addDependency(successorId: string, predecessorId: string, lagDays = 0, type = 'FS') {
    if (successorId === predecessorId) {
      throw new ConflictException('Um item não pode depender de si mesmo');
    }
    const [successor, predecessor] = await Promise.all([
      this.prisma.scheduleItem.findUnique({ where: { id: successorId }, select: { id: true } }),
      this.prisma.scheduleItem.findUnique({ where: { id: predecessorId }, select: { id: true } }),
    ]);
    if (!successor) throw new NotFoundException(`Item ${successorId} não encontrado`);
    if (!predecessor) throw new NotFoundException(`Predecessora ${predecessorId} não encontrada`);

    return this.prisma.scheduleDependency.create({
      data: { predecessorId, successorId, lagDays, type },
      include: {
        predecessor: { select: { id: true, code: true, name: true } },
        successor: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async removeDependency(depId: string) {
    const dep = await this.prisma.scheduleDependency.findUnique({ where: { id: depId } });
    if (!dep) throw new NotFoundException(`Dependência ${depId} não encontrada`);
    await this.prisma.scheduleDependency.delete({ where: { id: depId } });
    return { message: 'Dependência removida com sucesso' };
  }

  async getItemDependencies(itemId: string) {
    const item = await this.prisma.scheduleItem.findUnique({ where: { id: itemId }, select: { id: true } });
    if (!item) throw new NotFoundException(`Item ${itemId} não encontrado`);

    return this.prisma.scheduleDependency.findMany({
      where: { OR: [{ predecessorId: itemId }, { successorId: itemId }] },
      include: {
        predecessor: { select: { id: true, code: true, name: true } },
        successor: { select: { id: true, code: true, name: true } },
      },
    });
  }

  private normalizeColumnName(name: string): string {
    return name.replace(/^﻿/, '').toLowerCase().trim();
  }

  private mapColumnName(normalized: string): string | null {
    const columnMap: Record<string, string> = {
      // ID (linha do cronograma — usado para vínculos de predecessora)
      'id': 'rowId',
      'nº': 'rowId',
      'no': 'rowId',
      'n°': 'rowId',
      '#': 'rowId',
      'task id': 'rowId',
      'unique id': 'rowId',
      // Código WBS
      'código wbs': 'code',
      'codigo wbs': 'code',
      'código': 'code',
      'codigo': 'code',
      'wbs': 'code',
      'eap': 'code',
      'code': 'code',
      // Atividade / Nome
      'atividade': 'name',
      'nome': 'name',
      'name': 'name',
      'tarefa': 'name',
      'task name': 'name',
      'activity': 'name',
      // Nível
      'nível': 'level',
      'nivel': 'level',
      'level': 'level',
      'outline level': 'level',
      // Duração
      'duração': 'durationDays',
      'duracao': 'durationDays',
      'duration': 'durationDays',
      'dur.': 'durationDays',
      'dias': 'durationDays',
      'days': 'durationDays',
      // Início
      'início': 'startDate',
      'inicio': 'startDate',
      'start': 'startDate',
      'data início': 'startDate',
      'data inicio': 'startDate',
      'start date': 'startDate',
      // Término
      'término': 'endDate',
      'termino': 'endDate',
      'fim': 'endDate',
      'finish': 'endDate',
      'end': 'endDate',
      'data término': 'endDate',
      'data termino': 'endDate',
      'finish date': 'endDate',
      // % Avanço Físico
      '% avanço físico': 'physicalProgress',
      '% avanco fisico': 'physicalProgress',
      'avanço físico': 'physicalProgress',
      'avanco fisico': 'physicalProgress',
      'physical progress': 'physicalProgress',
      '% real': 'physicalProgress',
      'prog. real': 'physicalProgress',
      'actual progress': 'physicalProgress',
      '% concluído': 'physicalProgress',
      '% concluido': 'physicalProgress',
      'progress': 'physicalProgress',
      // % Planejado (opcional)
      '% plan': 'plannedProgress',
      '% planejado': 'plannedProgress',
      'prog. plan': 'plannedProgress',
      'planned progress': 'plannedProgress',
      // Caminho Crítico (opcional, legado)
      'caminho crítico': 'isCriticalPath',
      'caminho critico': 'isCriticalPath',
      'critical': 'isCriticalPath',
      'critical path': 'isCriticalPath',
      // Peso
      'peso': 'weight',
      'weight': 'weight',
      // Responsável
      'responsável': 'responsible',
      'responsavel': 'responsible',
      'responsible': 'responsible',
      'resource': 'responsible',
      'resource names': 'responsible',
      // Predecessora
      'predecessora': 'predecessors',
      'predecessoras': 'predecessors',
      'predecessor': 'predecessors',
      'predecessors': 'predecessors',
      'predecessores': 'predecessors',
      'pred.': 'predecessors',
    };
    return columnMap[normalized] || null;
  }

  /**
   * Parse a predecessors cell into structured dependency refs.
   * Mirrors the cronograma UI parser (parsePredecessorText in Cronograma.tsx):
   *  - Separator: `;` (apenas, igual à UI)
   *  - Tipos PT-BR aceitos: TI (término-início, padrão), II (início-início),
   *    TT (término-término), IT (início-término)
   *  - Tipos EN também aceitos como sinônimos (FS/SS/FF/SF)
   *  - Lag opcional: +N ou -N dias
   *  - Default type quando omitido: TI (≡ FS no DB)
   *
   * O `ref` é opaco — pode ser ID de linha (inteiro) ou Código WBS como
   * fallback. A resolução para `scheduleItem.id` acontece após a criação.
   */
  private parsePredecessorsCell(raw: unknown): {
    deps: Array<{ ref: string; type: string; lagDays: number }>;
    invalidTokens: string[];
  } {
    if (raw === null || raw === undefined) return { deps: [], invalidTokens: [] };
    const text = String(raw).trim();
    if (!text) return { deps: [], invalidTokens: [] };

    // PT-BR (UI) → DB type
    const PT_TO_DB: Record<string, string> = {
      TI: 'FS', // término-início (padrão)
      II: 'SS', // início-início
      TT: 'FF', // término-término
      IT: 'SF', // início-término
    };
    const DB_TYPES = new Set(['FS', 'SS', 'FF', 'SF']);

    const deps: Array<{ ref: string; type: string; lagDays: number }> = [];
    const invalidTokens: string[] = [];
    for (const part of text.split(';').map((s) => s.trim()).filter(Boolean)) {
      const m = part.match(
        /^([0-9][0-9\.]*)(TI|II|TT|IT|FS|SS|FF|SF)?([+-]\d+)?$/i,
      );
      if (!m) {
        invalidTokens.push(part);
        continue;
      }
      const ref = m[1].replace(/\.+$/, '');
      const typeRaw = (m[2] ?? 'TI').toUpperCase();
      const type = PT_TO_DB[typeRaw] ?? typeRaw;
      if (!DB_TYPES.has(type)) {
        invalidTokens.push(part);
        continue;
      }
      const lagDays = m[3] ? Math.trunc(Number(m[3])) : 0;
      if (ref) deps.push({ ref, type, lagDays });
    }
    return { deps, invalidTokens };
  }

  /**
   * Parse a date from a spreadsheet cell. Accepts:
   *  - Date instance (XLSX cellDates)
   *  - Excel serial number (days since 1900-01-01)
   *  - "YYYY-MM-DD"
   *  - "DD/MM/YYYY" (Brazilian) — assumed when first part > 12 OR when ambiguous
   *  - "MM/DD/YYYY"
   * Throws when the value is empty or unparseable.
   */
  private parseCellDate(raw: unknown): Date {
    if (raw === undefined || raw === null || raw === '') {
      throw new Error('Data vazia');
    }
    if (raw instanceof Date) {
      if (isNaN(raw.getTime())) throw new Error('Data inválida');
      return raw;
    }
    if (typeof raw === 'number') {
      // Excel serial: days since 1899-12-30 (Lotus 1-2-3 bug compatibility)
      const ms = (raw - 25569) * 86400 * 1000;
      const d = new Date(ms);
      if (isNaN(d.getTime())) throw new Error('Data inválida');
      return d;
    }
    const s = String(raw).trim();
    // ISO: YYYY-MM-DD (optionally with time)
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/);
    if (m) {
      const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
      if (isNaN(d.getTime())) throw new Error('Data inválida');
      return d;
    }
    // DD/MM/YYYY or MM/DD/YYYY (also accept '-' or '.' separators)
    m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
    if (m) {
      let a = +m[1];
      let b = +m[2];
      let y = +m[3];
      if (y < 100) y += 2000;
      // Heuristic: if first part > 12, must be DD/MM. Otherwise default to DD/MM (pt-BR).
      let day: number;
      let month: number;
      if (a > 12) {
        day = a; month = b;
      } else if (b > 12) {
        day = b; month = a; // MM/DD/YYYY
      } else {
        day = a; month = b; // default pt-BR
      }
      const d = new Date(Date.UTC(y, month - 1, day));
      if (isNaN(d.getTime())) throw new Error('Data inválida');
      return d;
    }
    // Last resort: native parser
    const d = new Date(s);
    if (isNaN(d.getTime())) throw new Error('Data inválida');
    return d;
  }

  private deriveLevelFromCode(code: string): number {
    const parts = code.split('.').filter((p) => p.length > 0);
    return Math.max(0, parts.length - 1);
  }

  private deriveParentCode(code: string): string | null {
    const parts = code.split('.').filter((p) => p.length > 0);
    if (parts.length <= 1) return null;
    return parts.slice(0, -1).join('.');
  }

  async importBatch(
    projectId: string,
    buffer: Buffer,
    mimetype: string,
  ): Promise<{ imported: number; skipped: number; dependencies: number; errors: string[] }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
    }

    // Parse file. For CSV, xlsx defaults to CP1252 which mangles UTF-8 headers
    // ("Código" → "CÃ³digo") and auto-coerces strings like "1.2.2" into dates.
    // Detect CSV by mimetype / magic bytes (XLSX is a zip starting with PK) and
    // force UTF-8 + raw mode (we parse dates ourselves from string cells).
    let workbook: xlsx.WorkBook;
    const looksCsv =
      (mimetype && mimetype.includes('csv')) ||
      !(buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b);
    try {
      const readOpts: xlsx.ParsingOptions = looksCsv
        ? { type: 'buffer', raw: true, codepage: 65001 }
        : { type: 'buffer', cellDates: true };
      workbook = xlsx.read(buffer, readOpts);
    } catch (err) {
      throw new BadRequestException('Arquivo inválido ou corrompido');
    }

    if (workbook.SheetNames.length === 0) {
      throw new BadRequestException('Arquivo vazio');
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

    if (rows.length === 0) {
      throw new BadRequestException('Planilha vazia');
    }

    // Normalize and map column names
    const sampleRow = rows[0];
    const columnMap = new Map<string, string>();

    for (const colName of Object.keys(sampleRow)) {
      const normalized = this.normalizeColumnName(colName);
      const mapped = this.mapColumnName(normalized);
      if (mapped) {
        columnMap.set(colName, mapped);
      }
    }

    // Check mandatory columns
    const mappedFields = new Set(columnMap.values());
    const requiredFields = ['code', 'name', 'startDate', 'endDate'];
    const missingFields = requiredFields.filter((f) => !mappedFields.has(f));
    if (missingFields.length > 0) {
      throw new BadRequestException(
        `Colunas obrigatórias não encontradas: ${missingFields.join(', ')}`,
      );
    }

    const errors: string[] = [];
    const importedItems: Array<{
      rowId: string | null;
      code: string;
      name: string;
      level: number;
      parentCode: string | null;
      startDate: Date;
      endDate: Date;
      durationDays: number;
      plannedProgress: number;
      physicalProgress: number;
      isCriticalPath: boolean;
      weight: number;
      responsible: string | null;
      predecessors: Array<{ ref: string; type: string; lagDays: number }>;
    }> = [];

    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx];
      const mappedRow: Record<string, unknown> = {};

      for (const [colName, fieldName] of columnMap.entries()) {
        mappedRow[fieldName] = row[colName];
      }

      const code = String(mappedRow['code'] || '').trim();
      const name = String(mappedRow['name'] || '').trim();
      const startDateRaw = mappedRow['startDate'];
      const endDateRaw = mappedRow['endDate'];

      if (!code || !name) {
        errors.push(`Linha ${rowIdx + 2}: código ou nome vazio`);
        continue;
      }

      let startDate: Date;
      let endDate: Date;

      try {
        startDate = this.parseCellDate(startDateRaw);
        endDate = this.parseCellDate(endDateRaw);
      } catch (err) {
        errors.push(`Linha ${rowIdx + 2}: data inválida`);
        continue;
      }

      let durationDays = 0;
      if (mappedRow['durationDays']) {
        const dur = Number(mappedRow['durationDays']);
        if (!isNaN(dur)) {
          durationDays = Math.max(0, Math.floor(dur));
        }
      }

      if (durationDays === 0) {
        // Intervalo inclusivo: start == end → 1 dia. Mínimo de 1.
        const diffMs = endDate.getTime() - startDate.getTime();
        const calendarDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        durationDays = Math.max(1, calendarDays + 1);
      }

      const level = mappedRow['level']
        ? Number(mappedRow['level'])
        : this.deriveLevelFromCode(code);
      const plannedProgress = Math.max(
        0,
        Math.min(100, Number(mappedRow['plannedProgress'] || 0)),
      );
      const physicalProgress = Math.max(
        0,
        Math.min(100, Number(mappedRow['physicalProgress'] || 0)),
      );
      const weight = Math.max(0.01, Number(mappedRow['weight'] || 1));

      // Caminho Crítico: accept Y/N, S/N, Sim/Não, true/false, 1/0
      const criticalRaw = mappedRow['isCriticalPath'];
      let isCriticalPath = false;
      if (criticalRaw !== undefined && criticalRaw !== null && criticalRaw !== '') {
        const v = String(criticalRaw).trim().toLowerCase();
        isCriticalPath = ['y', 's', 'sim', 'yes', 'true', '1'].includes(v);
      }

      const responsibleRaw = mappedRow['responsible'];
      const responsible =
        responsibleRaw === undefined || responsibleRaw === null
          ? null
          : String(responsibleRaw).trim() || null;

      const { deps: predecessors, invalidTokens } = this.parsePredecessorsCell(
        mappedRow['predecessors'],
      );
      for (const tok of invalidTokens) {
        errors.push(`Linha ${rowIdx + 2}: predecessora com sintaxe inválida "${tok}"`);
      }

      const rowIdRaw = mappedRow['rowId'];
      const rowId =
        rowIdRaw === undefined || rowIdRaw === null || rowIdRaw === ''
          ? null
          : String(rowIdRaw).trim() || null;

      const parentCode = this.deriveParentCode(code);

      importedItems.push({
        rowId,
        code,
        name,
        level: Math.max(0, level),
        parentCode,
        startDate,
        endDate,
        durationDays,
        plannedProgress,
        physicalProgress,
        isCriticalPath,
        weight,
        responsible,
        predecessors,
      });
    }

    // Delete existing schedule items in transaction (cascades dependencies)
    await this.prisma.scheduleItem.deleteMany({ where: { projectId } });

    // Sort by level to ensure parents are created before children
    importedItems.sort((a, b) => a.level - b.level);

    // Create items in order, maintaining code → id and rowId → id mappings
    const codeToIdMap = new Map<string, string>();
    const rowIdToIdMap = new Map<string, string>();
    let createdCount = 0;

    for (const item of importedItems) {
      try {
        let parentId: string | null = null;

        if (item.parentCode) {
          parentId = codeToIdMap.get(item.parentCode) || null;
        }

        const created = await this.prisma.scheduleItem.create({
          data: {
            projectId,
            code: item.code,
            name: item.name,
            level: item.level,
            parentId,
            startDate: item.startDate,
            endDate: item.endDate,
            durationDays: item.durationDays,
            plannedProgress: new Prisma.Decimal(item.plannedProgress),
            physicalProgress: new Prisma.Decimal(item.physicalProgress),
            isCriticalPath: item.isCriticalPath,
            weight: new Prisma.Decimal(item.weight),
            order: createdCount,
            responsible: item.responsible,
          },
        });

        codeToIdMap.set(item.code, created.id);
        if (item.rowId) rowIdToIdMap.set(item.rowId, created.id);
        createdCount++;
      } catch (err) {
        errors.push(`Linha com código "${item.code}": falha ao criar (${String(err).slice(0, 50)})`);
      }
    }

    // Second pass: create dependencies. Refs are resolved ID-first
    // (rowId → scheduleItem.id), then WBS code as fallback.
    let depsCreated = 0;
    for (const item of importedItems) {
      if (!item.predecessors.length) continue;
      const successorId = codeToIdMap.get(item.code);
      if (!successorId) continue;

      for (const pred of item.predecessors) {
        const predecessorId =
          rowIdToIdMap.get(pred.ref) || codeToIdMap.get(pred.ref);
        if (!predecessorId) {
          errors.push(
            `"${item.code}": predecessora "${pred.ref}" não encontrada (verifique ID ou Código WBS)`,
          );
          continue;
        }
        if (predecessorId === successorId) {
          errors.push(`"${item.code}": predecessora aponta para si mesma — ignorada`);
          continue;
        }
        try {
          await this.prisma.scheduleDependency.create({
            data: {
              predecessorId,
              successorId,
              lagDays: pred.lagDays,
              type: pred.type,
            },
          });
          depsCreated++;
        } catch (err) {
          errors.push(
            `"${item.code}" ← "${pred.ref}": falha ao criar vínculo (${String(err).slice(0, 50)})`,
          );
        }
      }
    }

    // Derive Tower/Floor/Unit/ActivityType from the imported schedule so that
    // the Medição screen has spatial hierarchy + activity taxonomy to navigate.
    try {
      await this.deriveStructureFromSchedule(projectId);
    } catch (err) {
      errors.push(`Falha ao derivar estrutura física: ${(err as Error).message}`);
    }

    this.realtime.emitScheduleChanged({ projectId, action: 'imported' });

    return {
      imported: createdCount,
      skipped: importedItems.length - createdCount,
      dependencies: depsCreated,
      errors,
    };
  }

  // ── Structure derivation ────────────────────────────────────────────────────

  private static FLOOR_PATTERN =
    /\b(subsolo|t[ée]rreo|pavimento|pav\.?|andar|cobertura|mezanino|garagem)\b/i;

  /** Normaliza string para chave de comparação (lowercase + sem acentos + trim). */
  private normalizeKey(s: string): string {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private inferFloorLevel(name: string): number {
    const lower = this.normalizeKey(name);
    const sub = lower.match(/sub\s*(?:solo)?\s*(\d+)/);
    if (sub) return -parseInt(sub[1], 10);
    if (/\bsubsolo\b/.test(lower)) return -1;
    if (/\b(terreo|garagem)\b/.test(lower)) return 0;
    if (/\bcobertura\b/.test(lower)) return 99;
    if (/\bmezanino\b/.test(lower)) return 1;
    const pav = lower.match(/(\d+)\s*[ºo°]?\s*(?:pavimento|pav|andar)/);
    if (pav) return parseInt(pav[1], 10);
    return 0;
  }

  /**
   * Após um import (ou comando manual), varre os ScheduleItem do projeto e
   * cria automaticamente Tower (uma, derivada do item raiz), Floors (nomes que
   * batem com `subsolo/térreo/pavimento/cobertura/...`), uma Unit "Geral" por
   * Floor (para registrar medições) e ActivityTypes para os itens-folha.
   * Idempotente: não duplica torres/andares/atividades já existentes.
   */
  async deriveStructureFromSchedule(projectId: string) {
    const items = await this.prisma.scheduleItem.findMany({
      where: { projectId },
      select: { id: true, name: true, level: true, parentId: true, activityTypeId: true, order: true },
      orderBy: [{ level: 'asc' }, { order: 'asc' }],
    });
    if (items.length === 0) return { towers: 0, floors: 0, units: 0, activityTypes: 0 };

    let towersCreated = 0;
    let floorsCreated = 0;
    let unitsCreated = 0;
    let activitiesCreated = 0;

    // 1) Garantir pelo menos uma Tower
    let tower = await this.prisma.tower.findFirst({
      where: { projectId },
      orderBy: { order: 'asc' },
      select: { id: true, name: true },
    });
    if (!tower) {
      const root = items.find((i) => i.level === 0);
      const name = (root?.name ?? 'Edifício').slice(0, 80);
      const created = await this.prisma.tower.create({
        data: { projectId, name, order: 0 },
      });
      tower = { id: created.id, name: created.name };
      towersCreated++;
    }

    // 2) Floors a partir de itens de nível 1 que batem o padrão
    const floorItems = items.filter(
      (i) => i.level === 1 && ScheduleService.FLOOR_PATTERN.test(i.name),
    );
    const existingFloors = await this.prisma.floor.findMany({
      where: { towerId: tower.id },
      select: { id: true, name: true, level: true, order: true },
    });
    const floorByKey = new Map<string, { id: string; level: number }>();
    for (const f of existingFloors) floorByKey.set(this.normalizeKey(f.name), { id: f.id, level: f.level });

    let nextOrder = existingFloors.reduce((max, f) => Math.max(max, f.order), -1) + 1;
    // schedule item id → floor id (para Step 3 inferir floor de uma atividade)
    const scheduleItemToFloor = new Map<string, string>();

    for (const item of floorItems) {
      const key = this.normalizeKey(item.name);
      let entry = floorByKey.get(key);
      if (!entry) {
        const inferredLevel = this.inferFloorLevel(item.name);
        const f = await this.prisma.floor.create({
          data: {
            towerId: tower.id,
            name: item.name.slice(0, 80),
            level: inferredLevel,
            order: nextOrder++,
          },
        });
        entry = { id: f.id, level: f.level };
        floorByKey.set(key, entry);
        floorsCreated++;
      }
      scheduleItemToFloor.set(item.id, entry.id);

      // Garante 1 unidade "Geral" se o floor recém-criado/existente não tem unidades
      const unitCount = await this.prisma.unit.count({ where: { floorId: entry.id } });
      if (unitCount === 0) {
        await this.prisma.unit.create({
          data: { floorId: entry.id, name: 'Geral', area: null, order: 0 },
        });
        unitsCreated++;
      }
    }

    // 3) ActivityTypes a partir de itens-folha (sem filhos) em nível ≥ 2
    const childCountByParent = new Map<string, number>();
    for (const i of items) {
      if (i.parentId) childCountByParent.set(i.parentId, (childCountByParent.get(i.parentId) ?? 0) + 1);
    }
    const leafItems = items.filter(
      (i) => i.level >= 2 && (childCountByParent.get(i.id) ?? 0) === 0,
    );
    const existingTypes = await this.prisma.activityType.findMany({
      where: { projectId },
      select: { id: true, name: true, order: true },
    });
    const typeByKey = new Map<string, string>();
    for (const t of existingTypes) typeByKey.set(this.normalizeKey(t.name), t.id);
    let nextActOrder = existingTypes.reduce((m, t) => Math.max(m, t.order), -1) + 1;

    // Cria tipos únicos primeiro, depois faz backfill em lote
    for (const leaf of leafItems) {
      const key = this.normalizeKey(leaf.name);
      if (typeByKey.has(key)) continue;
      const created = await this.prisma.activityType.create({
        data: {
          projectId,
          name: leaf.name.slice(0, 120),
          measurementMethod: 'PERCENT',
          unit: '%',
          defaultQuantity: 100,
          weight: 1,
          order: nextActOrder++,
        },
      });
      typeByKey.set(key, created.id);
      activitiesCreated++;
    }
    // Backfill activityTypeId nos itens-folha que ainda não têm
    for (const leaf of leafItems) {
      if (leaf.activityTypeId) continue;
      const key = this.normalizeKey(leaf.name);
      const atId = typeByKey.get(key);
      if (!atId) continue;
      await this.prisma.scheduleItem.update({
        where: { id: leaf.id },
        data: { activityTypeId: atId },
      });
    }

    if (towersCreated + floorsCreated + unitsCreated + activitiesCreated > 0) {
      this.realtime.emitScheduleChanged({ projectId, action: 'imported' });
    }
    return { towers: towersCreated, floors: floorsCreated, units: unitsCreated, activityTypes: activitiesCreated };
  }
}
