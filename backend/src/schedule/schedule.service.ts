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
  actualProgress: number;
  isCriticalPath: boolean;
  hasChildren: boolean;
  order: number;
  weight: number;
}

export interface CurvaSPoint {
  label: string;
  date: string;
  planned: number;
  actual: number;
}

@Injectable()
export class ScheduleService {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.scheduleItem.create({
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
        actualProgress: dto.actualProgress ?? 0,
        weight: dto.weight ?? 1,
        isCriticalPath: dto.isCriticalPath ?? false,
        order,
      },
      include: {
        activityType: true,
      },
    });
  }

  async update(id: string, dto: UpdateScheduleItemDto) {
    const item = await this.prisma.scheduleItem.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!item) {
      throw new NotFoundException(`Item de cronograma com ID "${id}" não encontrado`);
    }

    return this.prisma.scheduleItem.update({
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
        ...(dto.actualProgress !== undefined && { actualProgress: dto.actualProgress }),
        ...(dto.weight !== undefined && { weight: dto.weight }),
        ...(dto.isCriticalPath !== undefined && { isCriticalPath: dto.isCriticalPath }),
        ...(dto.order !== undefined && { order: dto.order }),
      },
      include: {
        activityType: true,
      },
    });
  }

  async remove(id: string) {
    const item = await this.prisma.scheduleItem.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!item) {
      throw new NotFoundException(`Item de cronograma com ID "${id}" não encontrado`);
    }

    // Prisma cascade handles children deletion (defined in schema onDelete: Cascade)
    await this.prisma.scheduleItem.delete({ where: { id } });
    return { message: 'Item excluído com sucesso' };
  }

  async getGanttData(projectId: string): Promise<GanttRow[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
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
        actualProgress: true,
        isCriticalPath: true,
        order: true,
        weight: true,
        _count: {
          select: { children: true },
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
      actualProgress: Number(item.actualProgress),
      isCriticalPath: item.isCriticalPath,
      hasChildren: item._count.children > 0,
      order: item.order,
      weight: Number(item.weight),
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
        actualProgress: true,
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
            actualDelta += itemWeightFraction * Number(item.actualProgress);
          }
          continue;
        }

        const overlapDuration = overlapEnd.getTime() - overlapStart.getTime();
        const fraction = overlapDuration / totalDuration;

        plannedDelta += itemWeightFraction * Number(item.plannedProgress) * fraction;
        actualDelta += itemWeightFraction * Number(item.actualProgress) * fraction;
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
    return name.toLowerCase().trim();
  }

  private mapColumnName(normalized: string): string | null {
    const columnMap: Record<string, string> = {
      'código': 'code',
      'wbs': 'code',
      'code': 'code',
      'nome': 'name',
      'name': 'name',
      'tarefa': 'name',
      'task name': 'name',
      'nível': 'level',
      'level': 'level',
      'outline level': 'level',
      'início': 'startDate',
      'start': 'startDate',
      'data início': 'startDate',
      'término': 'endDate',
      'fim': 'endDate',
      'finish': 'endDate',
      'end': 'endDate',
      'data término': 'endDate',
      'duração': 'durationDays',
      'duration': 'durationDays',
      'dur.': 'durationDays',
      '% plan': 'plannedProgress',
      'prog. plan': 'plannedProgress',
      'planned progress': 'plannedProgress',
      '% real': 'actualProgress',
      'prog. real': 'actualProgress',
      'actual progress': 'actualProgress',
      '% concluído': 'actualProgress',
      'caminho crítico': 'isCriticalPath',
      'critical': 'isCriticalPath',
      'peso': 'weight',
      'weight': 'weight',
    };
    return columnMap[normalized] || null;
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
  ): Promise<{ imported: number; skipped: number; errors: string[] }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
    }

    // Parse file
    let workbook: xlsx.WorkBook;
    try {
      workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });
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
      code: string;
      name: string;
      level: number;
      parentCode: string | null;
      startDate: Date;
      endDate: Date;
      durationDays: number;
      plannedProgress: number;
      actualProgress: number;
      isCriticalPath: boolean;
      weight: number;
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
        if (startDateRaw instanceof Date) {
          startDate = startDateRaw;
        } else if (typeof startDateRaw === 'string' || typeof startDateRaw === 'number') {
          startDate = new Date(startDateRaw);
        } else {
          throw new Error('Data inválida');
        }

        if (isNaN(startDate.getTime())) {
          throw new Error('Data inválida');
        }

        if (endDateRaw instanceof Date) {
          endDate = endDateRaw;
        } else if (typeof endDateRaw === 'string' || typeof endDateRaw === 'number') {
          endDate = new Date(endDateRaw);
        } else {
          throw new Error('Data inválida');
        }

        if (isNaN(endDate.getTime())) {
          throw new Error('Data inválida');
        }
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
        const diffMs = endDate.getTime() - startDate.getTime();
        durationDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      }

      const level = mappedRow['level']
        ? Number(mappedRow['level'])
        : this.deriveLevelFromCode(code);
      const plannedProgress = Math.max(
        0,
        Math.min(100, Number(mappedRow['plannedProgress'] || 0)),
      );
      const actualProgress = Math.max(
        0,
        Math.min(100, Number(mappedRow['actualProgress'] || 0)),
      );
      const weight = Math.max(0.01, Number(mappedRow['weight'] || 1));
      const isCriticalPath = Boolean(mappedRow['isCriticalPath']);

      const parentCode = this.deriveParentCode(code);

      importedItems.push({
        code,
        name,
        level: Math.max(0, level),
        parentCode,
        startDate,
        endDate,
        durationDays,
        plannedProgress,
        actualProgress,
        isCriticalPath,
        weight,
      });
    }

    // Delete existing schedule items in transaction
    await this.prisma.scheduleItem.deleteMany({ where: { projectId } });

    // Sort by level to ensure parents are created before children
    importedItems.sort((a, b) => a.level - b.level);

    // Create items in order, maintaining code → id mapping
    const codeToIdMap = new Map<string, string>();
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
            actualProgress: new Prisma.Decimal(item.actualProgress),
            isCriticalPath: item.isCriticalPath,
            weight: new Prisma.Decimal(item.weight),
            order: createdCount,
          },
        });

        codeToIdMap.set(item.code, created.id);
        createdCount++;
      } catch (err) {
        errors.push(`Linha com código "${item.code}": falha ao criar (${String(err).slice(0, 50)})`);
      }
    }

    return {
      imported: createdCount,
      skipped: importedItems.length - createdCount,
      errors,
    };
  }
}
