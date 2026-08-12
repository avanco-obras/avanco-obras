import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

/** Reports gravados antes da restauração existir: só têm o cronograma. */
export const SNAPSHOT_VERSION_SCHEDULE_ONLY = 1;
/** Snapshot completo: cronograma + dependências + medições. */
export const SNAPSHOT_VERSION_FULL = 2;

@Injectable()
export class PhysicalProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /**
   * Calculate physical progress for a parent task based on children
   */
  calculateParentProgress(parentTask: any, children: any[]): number {
    if (children.length === 0) return 0;

    const totalWeight = children.reduce((sum, child) => sum + Number(child.weight || 1), 0);
    if (totalWeight === 0) return 0;

    const weightedSum = children.reduce((sum, child) => {
      const progress = Number(child.physicalProgress || 0);
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
      const progress = Number(task.physicalProgress || 0);
      const weight = Number(task.weight || 1);
      return sum + progress * weight;
    }, 0);

    return Math.round((weightedSum / totalWeight) * 100) / 100;
  }

  /**
   * Recalcula o avanço de todas as tarefas-pai do projeto.
   *
   * Percorre a hierarquia de baixo para cima (nível mais profundo primeiro),
   * atualizando os valores em memória à medida que avança. Isso importa: o
   * avanço de um avô depende do valor JÁ recalculado do pai, não do valor que
   * estava no banco quando a consulta rodou.
   */
  async recalculateParentTasks(projectId: string): Promise<void> {
    const allTasks = await this.prisma.scheduleItem.findMany({
      where: { projectId },
      select: {
        id: true,
        parentId: true,
        level: true,
        weight: true,
        physicalProgress: true,
      },
    });

    const childrenByParent = new Map<string, typeof allTasks>();
    for (const task of allTasks) {
      if (!task.parentId) continue;
      const siblings = childrenByParent.get(task.parentId);
      if (siblings) siblings.push(task);
      else childrenByParent.set(task.parentId, [task]);
    }

    // Só quem tem filhos é pai. Do nível mais profundo para a raiz.
    const parents = allTasks
      .filter((t) => childrenByParent.has(t.id))
      .sort((a, b) => b.level - a.level);

    const changed: Array<{ id: string; physicalProgress: number }> = [];

    for (const parent of parents) {
      const children = childrenByParent.get(parent.id)!;
      const newProgress = this.calculateParentProgress(parent, children);

      if (Number(parent.physicalProgress) !== newProgress) {
        changed.push({ id: parent.id, physicalProgress: newProgress });
        // Reflete em memória para que o pai deste nó use o valor novo.
        parent.physicalProgress = newProgress as unknown as typeof parent.physicalProgress;
      }
    }

    if (changed.length === 0) return;

    await this.prisma.$transaction(
      changed.map((c) =>
        this.prisma.scheduleItem.update({
          where: { id: c.id },
          data: { physicalProgress: c.physicalProgress },
        }),
      ),
    );
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
    if (rootTask && Number(rootTask.physicalProgress) !== physicalProgress) {
      await this.prisma.scheduleItem.update({
        where: { id: rootTask.id },
        data: { physicalProgress: physicalProgress },
      });
    }

    // Get next report number
    const lastReport = await this.prisma.projectReport.findFirst({
      where: { projectId },
      orderBy: { reportNumber: 'desc' },
      select: { reportNumber: true },
    });
    const nextReportNumber = (lastReport?.reportNumber ?? 0) + 1;

    // Snapshot completo (v2): além do cronograma, dependências e medições —
    // sem elas a restauração não consegue devolver o estado por inteiro.
    const { dependencies, measurements } = await this.captureRelatedState(projectId);

    // Create report
    const report = await this.prisma.projectReport.create({
      data: {
        projectId,
        baselineId: activeBaseline?.id,
        reportNumber: nextReportNumber,
        userId,
        physicalProgress,
        scheduleSnapshot: updatedItems,
        dependencySnapshot: dependencies,
        measurementSnapshot: measurements,
        snapshotVersion: SNAPSHOT_VERSION_FULL,
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
   * Dependências e medições do projeto, para compor o snapshot completo.
   *
   * Medições não têm vínculo com ScheduleItem — chegam por
   * Measurement → Unit → Floor → Tower → Project.
   */
  private async captureRelatedState(projectId: string) {
    const [dependencies, measurements] = await Promise.all([
      this.prisma.scheduleDependency.findMany({
        where: { predecessor: { projectId } },
      }),
      this.prisma.measurement.findMany({
        where: { unit: { floor: { tower: { projectId } } } },
      }),
    ]);
    return { dependencies, measurements };
  }

  /**
   * Restaura o projeto para o estado de um Report.
   *
   * Sobrescreve os dados atuais. Antes disso grava um Report de segurança do
   * estado corrente, para que a operação seja reversível.
   *
   * O cronograma é reconciliado por diff **preservando os IDs**, e não por
   * apagar-e-recriar: `weekly_activities.schedule_item_id` é ON DELETE SET
   * NULL, então apagar os itens desfaria os vínculos da Programação Semanal de
   * forma permanente — inclusive recriando com o mesmo ID, porque o SET NULL
   * já teria disparado. Só as atividades que realmente somem na versão
   * restaurada perdem o vínculo, que é o comportamento correto; a linha
   * semanal continua legível porque `activityName` é desnormalizado.
   *
   * Dependências e medições podem ser apagadas e recriadas: nenhuma outra
   * tabela as referencia.
   */
  async restoreReport(projectId: string, reportId: string, userId: string) {
    const report = await this.prisma.projectReport.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        projectId: true,
        reportNumber: true,
        snapshotVersion: true,
        scheduleSnapshot: true,
        dependencySnapshot: true,
        measurementSnapshot: true,
      },
    });
    if (!report || report.projectId !== projectId) {
      throw new NotFoundException(
        `Report com ID "${reportId}" não encontrado neste projeto`,
      );
    }

    const isFull = report.snapshotVersion >= SNAPSHOT_VERSION_FULL;

    // Rede de segurança: o estado atual vira um Report antes de ser
    // sobrescrito, para que a restauração possa ser desfeita.
    const safety = await this.createReport(
      projectId,
      userId,
      `Antes da restauração do Report #${report.reportNumber}`,
    );

    const snapshot = (report.scheduleSnapshot ?? []) as any[];

    await this.prisma.$transaction(async (tx) => {
      const current = await tx.scheduleItem.findMany({
        where: { projectId },
        select: { id: true, level: true },
      });
      const currentIds = new Set(current.map((c) => c.id));
      const snapshotIds = new Set(snapshot.map((s) => s.id));

      // 1. Atualiza o que existe nos dois lados — o ID sobrevive, e com ele os
      //    vínculos da Programação Semanal.
      for (const item of snapshot.filter((s) => currentIds.has(s.id))) {
        await tx.scheduleItem.update({
          where: { id: item.id },
          data: this.scheduleItemFields(item),
        });
      }

      // 2. Cria o que só existe no snapshot, dos níveis rasos para os fundos:
      //    um filho não pode ser inserido antes do pai existir.
      const toCreate = snapshot
        .filter((s) => !currentIds.has(s.id))
        .sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
      for (const item of toCreate) {
        await tx.scheduleItem.create({
          data: {
            id: item.id,
            projectId,
            parentId: item.parentId ?? null,
            ...this.scheduleItemFields(item),
          },
        });
      }

      // 3. Remove o que sobra, dos níveis fundos para os rasos. As dependências
      //    ligadas a esses itens somem por CASCADE, e os vínculos semanais
      //    correspondentes viram NULL — correto, essas atividades deixaram de
      //    existir na versão restaurada.
      const toDelete = current
        .filter((c) => !snapshotIds.has(c.id))
        .sort((a, b) => b.level - a.level);
      for (const row of toDelete) {
        await tx.scheduleItem.delete({ where: { id: row.id } });
      }

      // 4. Dependências e medições só existem em snapshots completos. Em
      //    reports v1 esses dados nunca foram gravados: mexer neles apagaria
      //    informação que o snapshot não sabe repor.
      if (!isFull) return;

      await tx.scheduleDependency.deleteMany({
        where: { predecessor: { projectId } },
      });
      const deps = (report.dependencySnapshot ?? []) as any[];
      if (deps.length > 0) {
        await tx.scheduleDependency.createMany({
          data: deps.map((d) => ({
            id: d.id,
            predecessorId: d.predecessorId,
            successorId: d.successorId,
            lagDays: d.lagDays ?? 0,
            type: d.type,
          })),
          skipDuplicates: true,
        });
      }

      await tx.measurement.deleteMany({
        where: { unit: { floor: { tower: { projectId } } } },
      });
      const measurements = (report.measurementSnapshot ?? []) as any[];
      if (measurements.length > 0) {
        await tx.measurement.createMany({
          data: measurements.map((m) => ({
            id: m.id,
            unitId: m.unitId,
            activityTypeId: m.activityTypeId,
            measuredById: m.measuredById,
            date: new Date(m.date),
            percentComplete: m.percentComplete,
            executedQty: m.executedQty,
            totalQty: m.totalQty,
            notes: m.notes,
            photoUrl: m.photoUrl,
          })),
          skipDuplicates: true,
        });
      }
    });

    // Depois de sobrescrever, o estado consolidado do projeto passa a ser o da
    // versão restaurada — e o indicador "% Avanço Físico" precisa refletir
    // isso. Como ele sempre mostra o ÚLTIMO Report, e o report de segurança
    // gravado acima carrega o avanço de antes da restauração, é preciso
    // fechar a operação com um Report novo. Sem ele o indicador continuaria
    // exibindo o percentual que acabou de ser descartado.
    // createReport já recalcula os pais, então não há chamada separada.
    const restored = await this.createReport(
      projectId,
      userId,
      `Restauração do Report #${report.reportNumber}`,
    );

    this.realtime.emitScheduleChanged({ projectId, action: 'restored', scheduleItemId: null });

    return {
      restoredFrom: report.reportNumber,
      safetyReportNumber: safety.reportNumber,
      restoredReportNumber: restored.reportNumber,
      physicalProgress: restored.physicalProgress,
      partial: !isFull,
      itemCount: snapshot.length,
    };
  }

  /** Campos do item copiados do snapshot, sem id/projectId/parentId. */
  private scheduleItemFields(item: any) {
    return {
      activityTypeId: item.activityTypeId ?? null,
      code: item.code,
      name: item.name,
      level: item.level,
      startDate: new Date(item.startDate),
      endDate: new Date(item.endDate),
      durationDays: item.durationDays,
      plannedProgress: item.plannedProgress ?? 0,
      physicalProgress: item.physicalProgress ?? 0,
      weight: item.weight ?? 1,
      isCriticalPath: item.isCriticalPath ?? false,
      order: item.order ?? 0,
      responsible: item.responsible ?? null,
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
      snapshotVersion: r.snapshotVersion,
      // v1 não gravou dependências nem medições: restaura só o cronograma.
      restoresFully: r.snapshotVersion >= SNAPSHOT_VERSION_FULL,
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

      const reportProgress = Number(reportItem.physicalProgress || 0);
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

    // Source of truth: último Report consolidado (não recalcula em tempo real).
    // Edições nas atividades NÃO devem alterar o indicador superior — só um novo
    // Report o atualiza.
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

    const physicalProgress = latestReport
      ? Number(latestReport.physicalProgress)
      : 0;

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
      completedTasks: tasks.filter((t) => Number(t.physicalProgress || 0) === 100)
        .length,
    };
  }
}
