import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

export interface KPIs {
  overallProgress: number;
  plannedProgress: number;
  spi: number;
  ppcCurrent: number | null;
  ppcForecast: number | null;
  totalActivities: number;
  completedActivities: number;
  delayedActivities: number;
  pendingRestrictions: number;
}

export interface DelayedItem {
  id: string;
  code: string;
  name: string;
  plannedProgress: number;
  physicalProgress: number;
  gap: number;
  endDate: string;
  daysOverdue: number | null;
}

export interface SPIPoint {
  month: string;
  planned: number;
  actual: number;
  spi: number;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
    }
    return project;
  }

  async getKPIs(projectId: string): Promise<KPIs> {
    const project = await this.ensureProject(projectId);

    const items = await this.prisma.scheduleItem.findMany({
      where: { projectId },
      select: {
        plannedProgress: true,
        physicalProgress: true,
        weight: true,
        endDate: true,
        _count: { select: { children: true } },
      },
    });

    // Use leaf items for weighted progress calculations
    const leafItems = items.filter((i) => i._count.children === 0);
    const totalWeight = leafItems.reduce((sum, i) => sum + Number(i.weight), 0);

    let overallProgress = 0;
    let plannedProgress = 0;

    if (totalWeight > 0) {
      overallProgress = leafItems.reduce(
        (sum, i) => sum + (Number(i.physicalProgress) * Number(i.weight)) / totalWeight,
        0,
      );
      plannedProgress = leafItems.reduce(
        (sum, i) => sum + (Number(i.plannedProgress) * Number(i.weight)) / totalWeight,
        0,
      );
    }

    const spi = plannedProgress > 0 ? overallProgress / plannedProgress : 1;

    const now = new Date();

    const totalActivities = items.length;
    const completedActivities = items.filter(
      (i) => Number(i.physicalProgress) === 100,
    ).length;
    const delayedActivities = items.filter(
      (i) =>
        Number(i.physicalProgress) < Number(i.plannedProgress) &&
        i.endDate < now,
    ).length;

    const pendingRestrictions = await this.prisma.restriction.count({
      where: {
        weeklyPlan: { projectId },
        status: { in: ['PENDING', 'IN_ANALYSIS'] },
      },
    });

    const mostRecentPlan = await this.prisma.weeklyPlan.findFirst({
      where: { projectId },
      orderBy: [{ year: 'desc' }, { weekNumber: 'desc' }],
      select: { ppcActual: true, ppcForecast: true },
    });

    const ppcCurrent = mostRecentPlan?.ppcActual != null
      ? Number(mostRecentPlan.ppcActual)
      : null;
    const ppcForecast = mostRecentPlan?.ppcForecast != null
      ? Number(mostRecentPlan.ppcForecast)
      : null;

    return {
      overallProgress: Math.round(overallProgress * 100) / 100,
      plannedProgress: Math.round(plannedProgress * 100) / 100,
      spi: Math.round(spi * 1000) / 1000,
      ppcCurrent,
      ppcForecast,
      totalActivities,
      completedActivities,
      delayedActivities,
      pendingRestrictions,
    };
  }

  async getDelays(projectId: string): Promise<DelayedItem[]> {
    await this.ensureProject(projectId);

    const items = await this.prisma.scheduleItem.findMany({
      where: { projectId },
      select: {
        id: true,
        code: true,
        name: true,
        plannedProgress: true,
        physicalProgress: true,
        endDate: true,
      },
    });

    const now = new Date();

    const delayed = items
      .map((i) => {
        const planned = Number(i.plannedProgress);
        const actual = Number(i.physicalProgress);
        const gap = planned - actual;
        const isPast = i.endDate < now;
        const daysOverdue = isPast
          ? Math.floor((now.getTime() - i.endDate.getTime()) / (1000 * 60 * 60 * 24))
          : null;
        return {
          id: i.id,
          code: i.code,
          name: i.name,
          plannedProgress: planned,
          physicalProgress: actual,
          gap,
          endDate: i.endDate.toISOString(),
          daysOverdue,
        };
      })
      .filter((i) => i.gap > 0)
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 10);

    return delayed;
  }

  async getPendingRestrictions(projectId: string) {
    await this.ensureProject(projectId);

    return this.prisma.restriction.findMany({
      where: {
        weeklyPlan: { projectId },
        status: { in: ['PENDING', 'IN_ANALYSIS'] },
      },
      include: {
        weeklyPlan: true,
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async getSPIHistory(projectId: string): Promise<SPIPoint[]> {
    const project = await this.ensureProject(projectId);

    const items = await this.prisma.scheduleItem.findMany({
      where: { projectId },
      select: {
        startDate: true,
        endDate: true,
        plannedProgress: true,
        physicalProgress: true,
        weight: true,
        _count: { select: { children: true } },
      },
    });

    const leafItems = items.filter((i) => i._count.children === 0);

    if (leafItems.length === 0) {
      return [];
    }

    const totalWeight = leafItems.reduce((sum, i) => sum + Number(i.weight), 0);
    if (totalWeight === 0) {
      return [];
    }

    const now = new Date();
    const startCursor = new Date(
      project.startDate.getFullYear(),
      project.startDate.getMonth(),
      1,
    );
    const endMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthLabels = [
      'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
    ];

    const points: SPIPoint[] = [];
    let cumulativePlanned = 0;
    let cumulativeActual = 0;

    const cursor = new Date(startCursor);

    while (cursor <= endMonth) {
      const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);

      let plannedDelta = 0;
      let actualDelta = 0;

      for (const item of leafItems) {
        const itemStart = item.startDate;
        const itemEnd = item.endDate;
        const itemWeightFraction = Number(item.weight) / totalWeight;

        const overlapStart = new Date(Math.max(itemStart.getTime(), monthStart.getTime()));
        const overlapEnd = new Date(Math.min(itemEnd.getTime(), monthEnd.getTime()));

        if (overlapStart > overlapEnd) {
          continue;
        }

        const totalDuration = itemEnd.getTime() - itemStart.getTime();
        if (totalDuration <= 0) {
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

      const spi = cumulativePlanned > 0 ? cumulativeActual / cumulativePlanned : 1;

      const year2d = String(cursor.getFullYear()).slice(-2);
      const month = `${monthLabels[cursor.getMonth()]}/${year2d}`;

      points.push({
        month,
        planned: Math.round(cumulativePlanned * 100) / 100,
        actual: Math.round(cumulativeActual * 100) / 100,
        spi: Math.round(spi * 1000) / 1000,
      });

      cursor.setMonth(cursor.getMonth() + 1);
    }

    return points;
  }
}
