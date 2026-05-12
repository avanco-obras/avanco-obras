import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
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
}
