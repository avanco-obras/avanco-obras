import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class PhysicalProgressService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate physical progress for a parent task based on children
   */
  calculateParentProgress(parentTask: any, children: any[]): number {
    if (children.length === 0) return 0;

    const totalWeight = children.reduce((sum, child) => sum + Number(child.weight || 1), 0);
    if (totalWeight === 0) return 0;

    const weightedSum = children.reduce((sum, child) => {
      const progress = Number(child.actualProgress || 0);
      const weight = Number(child.weight || 1);
      return sum + progress * weight;
    }, 0);

    return Math.round((weightedSum / totalWeight) * 100) / 100;
  }

  /**
   * Calculate overall project physical progress
   */
  calculateProjectProgress(allTasks: any[]): number {
    if (allTasks.length === 0) return 0;

    // Consider only leaf tasks (tasks without children) for the calculation
    const leafTasks = allTasks.filter(task => {
      const hasChildren = allTasks.some(t => t.parentId === task.id);
      return !hasChildren;
    });

    if (leafTasks.length === 0) {
      // If no leaf tasks, use all tasks
      return this.calculateWeightedProgress(allTasks);
    }

    return this.calculateWeightedProgress(leafTasks);
  }

  /**
   * Calculate weighted progress from a list of tasks
   */
  private calculateWeightedProgress(tasks: any[]): number {
    if (tasks.length === 0) return 0;

    const totalWeight = tasks.reduce((sum, task) => sum + Number(task.weight || 1), 0);
    if (totalWeight === 0) return 0;

    const weightedSum = tasks.reduce((sum, task) => {
      const progress = Number(task.actualProgress || 0);
      const weight = Number(task.weight || 1);
      return sum + progress * weight;
    }, 0);

    return Math.round((weightedSum / totalWeight) * 100) / 100;
  }

  /**
   * Recalculate all parent tasks' progress
   */
  async recalculateParentTasks(projectId: string): Promise<void> {
    const allTasks = await this.prisma.scheduleItem.findMany({
      where: { projectId },
    });

    // Group tasks by parent
    const parentGroups = new Map<string, any[]>();
    const parentTasks = new Set<string>();

    allTasks.forEach((task) => {
      if (task.parentId) {
        parentTasks.add(task.parentId);
        if (!parentGroups.has(task.parentId)) {
          parentGroups.set(task.parentId, []);
        }
        parentGroups.get(task.parentId)!.push(task);
      }
    });

    // Update parent tasks recursively (from leaf to root)
    for (const parentId of parentTasks) {
      await this.updateParentProgress(parentId, allTasks);
    }
  }

  /**
   * Update parent task progress and recursively update its parent
   */
  private async updateParentProgress(
    parentId: string,
    allTasks: any[],
  ): Promise<void> {
    const parent = allTasks.find((t) => t.id === parentId);
    if (!parent) return;

    const children = allTasks.filter((t) => t.parentId === parentId);
    const newProgress = this.calculateParentProgress(parent, children);

    // Update only if changed
    if (Number(parent.actualProgress) !== newProgress) {
      await this.prisma.scheduleItem.update({
        where: { id: parentId },
        data: { actualProgress: newProgress },
      });
    }

    // Recursively update parent's parent
    if (parent.parentId) {
      await this.updateParentProgress(parent.parentId, allTasks);
    }
  }

  /**
   * Create a project report
   */
  async createReport(
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

    // Get active baseline (optional - comparison will be null if not found)
    const activeBaseline = await this.prisma.projectBaseline.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
      select: { id: true },
    });

    // Get all schedule items
    const scheduleItems = await this.prisma.scheduleItem.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });

    // Recalculate parent tasks before creating report
    await this.recalculateParentTasks(projectId);

    // Fetch updated items after recalculation
    const updatedItems = await this.prisma.scheduleItem.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });

    // Calculate overall physical progress
    const physicalProgress = this.calculateProjectProgress(updatedItems);

    // Update root task (ID "1") with the calculated progress
    const rootTask = updatedItems.find(t => t.id === '1' || (t.code === '1' && !t.parentId));
    if (rootTask && Number(rootTask.actualProgress) !== physicalProgress) {
      await this.prisma.scheduleItem.update({
        where: { id: rootTask.id },
        data: { actualProgress: physicalProgress },
      });
    }

    // Get next report number
    const lastReport = await this.prisma.projectReport.findFirst({
      where: { projectId },
      orderBy: { reportNumber: 'desc' },
      select: { reportNumber: true },
    });
    const nextReportNumber = (lastReport?.reportNumber ?? 0) + 1;

    // Create report
    const report = await this.prisma.projectReport.create({
      data: {
        projectId,
        baselineId: activeBaseline?.id,
        reportNumber: nextReportNumber,
        userId,
        physicalProgress,
        scheduleSnapshot: updatedItems,
        description,
      },
      include: {
        user: {
          select: { id: true, email: true, username: true, fullName: true },
        },
        baseline: {
          select: { id: true, version: true },
        },
      },
    });

    return {
      id: report.id,
      projectId: report.projectId,
      reportNumber: report.reportNumber,
      createdAt: report.createdAt.toISOString(),
      user: report.user,
      physicalProgress: Number(report.physicalProgress),
      baselineVersion: report.baseline?.version || 0,
      description: report.description,
    };
  }

  /**
   * Get report history
   */
  async getReportHistory(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
    }

    const reports = await this.prisma.projectReport.findMany({
      where: { projectId },
      include: {
        user: {
          select: { id: true, email: true, username: true, fullName: true },
        },
        baseline: {
          select: { id: true, version: true },
        },
      },
      orderBy: { reportNumber: 'desc' },
    });

    return reports.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      reportNumber: r.reportNumber,
      createdAt: r.createdAt.toISOString(),
      user: r.user,
      physicalProgress: Number(r.physicalProgress),
      baselineVersion: r.baseline?.version || 0,
      description: r.description,
      itemCount: Array.isArray(r.scheduleSnapshot)
        ? (r.scheduleSnapshot as unknown[]).length
        : 0,
    }));
  }

  /**
   * Get specific report with comparison to baseline
   */
  async getReportWithComparison(projectId: string, reportId: string) {
    const report = await this.prisma.projectReport.findUnique({
      where: { id: reportId },
      include: {
        baseline: {
          select: { id: true, version: true, scheduleSnapshot: true },
        },
        user: {
          select: { id: true, email: true, username: true, fullName: true },
        },
      },
    });

    if (!report || report.projectId !== projectId) {
      throw new NotFoundException('Report não encontrado');
    }

    const reportSchedule = report.scheduleSnapshot as any[];
    const baselineSchedule = report.baseline ? (report.baseline.scheduleSnapshot as any[]) : [];

    // Build comparison
    const comparison = {
      reportNumber: report.reportNumber,
      reportDate: report.createdAt,
      physicalProgress: report.physicalProgress,
      baselineVersion: report.baseline?.version || 0,
      summary: {
        onSchedule: 0,
        delayed: 0,
        advanced: 0,
        progressAbove: 0,
        progressBelow: 0,
      },
      changes: [] as any[],
    };

    // Compare each item (if baseline exists)
    if (report.baseline) {
      for (const reportItem of reportSchedule) {
        const baselineItem = baselineSchedule.find((b) => b.id === reportItem.id);
        if (!baselineItem) continue;

      const reportEnd = new Date(reportItem.endDate).getTime();
      const baselineEnd = new Date(baselineItem.endDate).getTime();
      const now = new Date().getTime();

      const reportProgress = Number(reportItem.actualProgress || 0);
      const baselineProgress = Number(baselineItem.plannedProgress || 0);

      // Determine status
      let status = 'onSchedule';
      if (reportEnd > baselineEnd && now > reportEnd) {
        status = 'delayed';
        comparison.summary.delayed++;
      } else if (reportEnd < baselineEnd) {
        status = 'advanced';
        comparison.summary.advanced++;
      } else {
        comparison.summary.onSchedule++;
      }

      // Progress comparison
      if (reportProgress > baselineProgress) {
        comparison.summary.progressAbove++;
      } else if (reportProgress < baselineProgress) {
        comparison.summary.progressBelow++;
      }

      comparison.changes.push({
        itemId: reportItem.id,
        code: reportItem.code,
        name: reportItem.name,
        status,
        baseline: {
          endDate: baselineItem.endDate,
          progress: baselineProgress,
        },
        report: {
          endDate: reportItem.endDate,
          progress: reportProgress,
        },
        deviation: {
          days: Math.ceil((reportEnd - baselineEnd) / (1000 * 60 * 60 * 24)),
          progressDelta: reportProgress - baselineProgress,
        },
      });
      }
    }

    return {
      ...report,
      comparison,
    };
  }

  /**
   * Get current project metrics
   */
  async getProjectMetrics(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
    }

    const tasks = await this.prisma.scheduleItem.findMany({
      where: { projectId },
    });

    const physicalProgress = this.calculateProjectProgress(tasks);

    // Get latest report
    const latestReport = await this.prisma.projectReport.findFirst({
      where: { projectId },
      orderBy: { reportNumber: 'desc' },
      select: {
        createdAt: true,
        reportNumber: true,
        physicalProgress: true,
        baseline: { select: { version: true } },
      },
    });

    // Get active baseline
    const activeBaseline = await this.prisma.projectBaseline.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    return {
      physicalProgress,
      lastReportDate: latestReport?.createdAt || null,
      lastReportNumber: latestReport?.reportNumber || 0,
      activeBaselineVersion: activeBaseline?.version || 0,
      totalTasks: tasks.length,
      completedTasks: tasks.filter((t) => Number(t.actualProgress || 0) === 100)
        .length,
    };
  }
}
