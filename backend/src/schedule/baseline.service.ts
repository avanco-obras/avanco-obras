import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class BaselineService {
  constructor(private readonly prisma: PrismaService) {}

  async createBaseline(
    projectId: string,
    userId: string,
    description?: string,
  ) {
    // Verify project exists
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
    }

    // Get next version number
    const lastBaseline = await this.prisma.projectBaseline.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (lastBaseline?.version ?? 0) + 1;

    // Get all schedule items and dependencies
    const scheduleItems = await this.prisma.scheduleItem.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });

    const dependencies = await this.prisma.scheduleDependency.findMany({
      where: {
        OR: [
          { predecessor: { projectId } },
          { successor: { projectId } },
        ],
      },
    });

    // Create baseline record
    const baseline = await this.prisma.projectBaseline.create({
      data: {
        projectId,
        userId,
        version: nextVersion,
        description,
        scheduleSnapshot: scheduleItems,
        dependencySnapshot: dependencies,
      },
      include: {
        user: {
          select: { id: true, email: true, username: true, fullName: true },
        },
      },
    });

    return {
      id: baseline.id,
      projectId: baseline.projectId,
      version: baseline.version,
      createdAt: baseline.createdAt,
      user: baseline.user,
      description: baseline.description,
      itemCount: scheduleItems.length,
      dependencyCount: dependencies.length,
    };
  }

  async getBaselineHistory(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
    }

    const baselines = await this.prisma.projectBaseline.findMany({
      where: { projectId },
      include: {
        user: {
          select: { id: true, email: true, username: true, fullName: true },
        },
      },
      orderBy: { version: 'desc' },
    });

    return baselines.map((b) => ({
      id: b.id,
      projectId: b.projectId,
      version: b.version,
      createdAt: b.createdAt,
      user: b.user,
      description: b.description,
      itemCount: Array.isArray(b.scheduleSnapshot)
        ? (b.scheduleSnapshot as unknown[]).length
        : 0,
      dependencyCount: Array.isArray(b.dependencySnapshot)
        ? (b.dependencySnapshot as unknown[]).length
        : 0,
    }));
  }

  async getBaseline(projectId: string, baselineId: string) {
    const baseline = await this.prisma.projectBaseline.findUnique({
      where: { id: baselineId },
      include: {
        user: {
          select: { id: true, email: true, username: true, fullName: true },
        },
      },
    });

    if (!baseline || baseline.projectId !== projectId) {
      throw new NotFoundException(`Linha de Base não encontrada`);
    }

    return baseline;
  }

  async getCurrentComparison(projectId: string, baselineId: string) {
    const baseline = await this.getBaseline(projectId, baselineId);

    const currentItems = await this.prisma.scheduleItem.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });

    const baselineItems = baseline.scheduleSnapshot as any[];

    const comparison = {
      baselineVersion: baseline.version,
      baselineDate: baseline.createdAt,
      summary: {
        totalItems: currentItems.length,
        itemsChanged: 0,
        datesChanged: 0,
        durationChanged: 0,
        progressChanged: 0,
      },
      changes: [],
    };

    // Compare each item
    for (const current of currentItems) {
      const baselineItem = baselineItems.find((b) => b.id === current.id);
      if (!baselineItem) {
        comparison.changes.push({
          itemId: current.id,
          code: current.code,
          name: current.name,
          changeType: 'NEW_ITEM',
          baseline: null,
          current: {
            startDate: current.startDate,
            endDate: current.endDate,
            durationDays: current.durationDays,
            actualProgress: Number(current.actualProgress),
          },
        });
        comparison.summary.itemsChanged++;
        continue;
      }

      const changes = [];
      if (
        new Date(baselineItem.startDate).getTime() !==
        new Date(current.startDate).getTime()
      ) {
        changes.push('startDate');
        comparison.summary.datesChanged++;
      }
      if (
        new Date(baselineItem.endDate).getTime() !==
        new Date(current.endDate).getTime()
      ) {
        changes.push('endDate');
        comparison.summary.datesChanged++;
      }
      if (baselineItem.durationDays !== current.durationDays) {
        changes.push('durationDays');
        comparison.summary.durationChanged++;
      }
      if (
        Number(baselineItem.actualProgress) !==
        Number(current.actualProgress)
      ) {
        changes.push('actualProgress');
        comparison.summary.progressChanged++;
      }

      if (changes.length > 0) {
        comparison.changes.push({
          itemId: current.id,
          code: current.code,
          name: current.name,
          changeType: 'MODIFIED',
          changes,
          baseline: {
            startDate: baselineItem.startDate,
            endDate: baselineItem.endDate,
            durationDays: baselineItem.durationDays,
            actualProgress: Number(baselineItem.actualProgress),
          },
          current: {
            startDate: current.startDate,
            endDate: current.endDate,
            durationDays: current.durationDays,
            actualProgress: Number(current.actualProgress),
          },
        });
        comparison.summary.itemsChanged++;
      }
    }

    // Check for deleted items
    for (const baselineItem of baselineItems) {
      const currentItem = currentItems.find((c) => c.id === baselineItem.id);
      if (!currentItem) {
        comparison.changes.push({
          itemId: baselineItem.id,
          code: baselineItem.code,
          name: baselineItem.name,
          changeType: 'DELETED_ITEM',
          baseline: {
            startDate: baselineItem.startDate,
            endDate: baselineItem.endDate,
            durationDays: baselineItem.durationDays,
            actualProgress: Number(baselineItem.actualProgress),
          },
          current: null,
        });
        comparison.summary.itemsChanged++;
      }
    }

    return comparison;
  }

  async deleteBaseline(projectId: string, baselineId: string) {
    const baseline = await this.getBaseline(projectId, baselineId);

    // Prevent deletion of the latest baseline
    const latestBaseline = await this.prisma.projectBaseline.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
      select: { id: true },
    });

    if (latestBaseline?.id === baselineId) {
      throw new ForbiddenException(
        'Não é possível excluir a linha de base mais recente',
      );
    }

    await this.prisma.projectBaseline.delete({
      where: { id: baselineId },
    });

    return { message: 'Linha de Base excluída com sucesso' };
  }
}
