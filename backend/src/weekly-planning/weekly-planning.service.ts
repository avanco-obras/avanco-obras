import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import {
  Prisma,
  WeeklyProgram,
  WeeklyActivityOrigin,
  WeeklyActivityStatus,
  WeeklyProgramStatus,
  WeeklySnapshotKind,
} from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import {
  addDays,
  CARRYOVER_STATUSES,
  computeIndicators,
  deriveLocationFromPath,
  reconcileStatusPercent,
  suggestStatusFromPercent,
  weekWindow,
  WeeklyIndicators,
} from './week-utils';
import { CreateWeeklyProgramDto } from './dto/create-weekly-program.dto';
import { CreateWeeklyActivityDto } from './dto/create-weekly-activity.dto';
import { UpdateWeeklyActivityDto } from './dto/update-weekly-activity.dto';
import { CreateWeeklyRestrictionDto } from './dto/create-weekly-restriction.dto';
import { UpdateWeeklyRestrictionDto } from './dto/update-weekly-restriction.dto';
import { CreateContractorDto, UpdateContractorDto } from './dto/contractor.dto';
import { CreateRestrictionTypeDto, UpdateRestrictionTypeDto } from './dto/restriction-type.dto';

type Tx = Prisma.TransactionClient;

const ACTIVITY_INCLUDE = {
  contractor: { select: { id: true, name: true, isActive: true } },
  restrictionLinks: { select: { restrictionId: true } },
} satisfies Prisma.WeeklyActivityInclude;

const RESTRICTION_INCLUDE = {
  type: { select: { id: true, name: true } },
  activityLinks: { select: { activityId: true } },
} satisfies Prisma.WeeklyRestrictionInclude;

@Injectable()
export class WeeklyPlanningService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Programações ──────────────────────────────────────────────────────────

  async list(projectId: string) {
    await this.assertProject(projectId);
    return this.prisma.weeklyProgram.findMany({
      where: { projectId },
      orderBy: [{ startDate: 'asc' }],
      include: { _count: { select: { activities: true, restrictions: true } } },
    });
  }

  async create(projectId: string, dto: CreateWeeklyProgramDto) {
    const project = await this.assertProject(projectId);
    const reference = dto.referenceDate ? new Date(dto.referenceDate) : new Date();
    const win = weekWindow(reference, project.weekStartDay);

    const existing = await this.prisma.weeklyProgram.findUnique({
      where: {
        projectId_year_weekNumber: {
          projectId,
          year: win.year,
          weekNumber: win.weekNumber,
        },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        `Já existe programação para a semana ${win.weekNumber}/${win.year} neste projeto`,
      );
    }

    return this.prisma.weeklyProgram.create({
      data: {
        projectId,
        weekNumber: win.weekNumber,
        year: win.year,
        startDate: win.startDate,
        endDate: win.endDate,
        meetingDate: win.meetingDate,
      },
      include: { _count: { select: { activities: true, restrictions: true } } },
    });
  }

  async get(id: string) {
    const program = await this.prisma.weeklyProgram.findUnique({
      where: { id },
      include: {
        activities: { include: ACTIVITY_INCLUDE, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] },
        restrictions: { include: RESTRICTION_INCLUDE, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!program) {
      throw new NotFoundException(`Programação com ID "${id}" não encontrada`);
    }
    return program;
  }

  /**
   * Atualizar Programação: importa folhas do cronograma que intersectam a
   * semana + reprogramadas da semana anterior FECHADA. Não duplica
   * (scheduleItemId / carryoverFromId) e preserva manuais e edições.
   */
  async refresh(id: string) {
    const program = await this.getEditable(id);

    const result = await this.prisma.$transaction(async (tx) => {
      const imported = await this.importScheduleItems(tx, program);

      // Semana anterior fechada → carryover automático
      const previous = await tx.weeklyProgram.findFirst({
        where: {
          projectId: program.projectId,
          startDate: addDays(program.startDate, -7),
          status: WeeklyProgramStatus.FECHADA,
        },
        select: { id: true },
      });
      const carried = previous ? await this.carryoverActivities(tx, previous.id, program.id) : 0;

      return { imported, carried };
    });

    return { ...result, program: await this.get(id) };
  }

  async publish(id: string, userId: string) {
    const program = await this.get(id);
    if (program.status !== WeeklyProgramStatus.RASCUNHO) {
      throw new ConflictException('Só é possível publicar uma programação em rascunho');
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.weeklyProgram.update({
        where: { id },
        data: { status: WeeklyProgramStatus.PUBLICADA, publishedAt: new Date() },
      });
      await this.createSnapshot(tx, id, WeeklySnapshotKind.PUBLICACAO, userId);
      return updated;
    });
  }

  /**
   * Publicar Fechamento (transacional): grava indicadores, snapshot
   * FECHAMENTO, FECHADA e cria a próxima semana com import + reprogramadas.
   */
  async close(id: string, userId: string) {
    const program = await this.get(id);
    if (program.status !== WeeklyProgramStatus.PUBLICADA) {
      throw new ConflictException('Só é possível fechar uma programação publicada');
    }
    const project = await this.assertProject(program.projectId);

    return this.prisma.$transaction(async (tx) => {
      const indicators = await this.computeProgramIndicators(tx, id);

      await tx.weeklyProgram.update({
        where: { id },
        data: {
          status: WeeklyProgramStatus.FECHADA,
          closedAt: new Date(),
          indicators: indicators as unknown as Prisma.InputJsonValue,
        },
      });
      await this.createSnapshot(tx, id, WeeklySnapshotKind.FECHAMENTO, userId);

      // Próxima semana (cria se não existir) + import + reprogramadas
      const nextWin = weekWindow(addDays(program.endDate, 1), project.weekStartDay);
      let next = await tx.weeklyProgram.findUnique({
        where: {
          projectId_year_weekNumber: {
            projectId: program.projectId,
            year: nextWin.year,
            weekNumber: nextWin.weekNumber,
          },
        },
      });
      if (!next) {
        next = await tx.weeklyProgram.create({
          data: {
            projectId: program.projectId,
            weekNumber: nextWin.weekNumber,
            year: nextWin.year,
            startDate: nextWin.startDate,
            endDate: nextWin.endDate,
            meetingDate: nextWin.meetingDate,
          },
        });
      }
      await this.importScheduleItems(tx, next);
      await this.carryoverActivities(tx, id, next.id);

      return { closed: { id, indicators }, nextProgramId: next.id };
    });
  }

  async report(id: string, userId: string) {
    await this.get(id);
    return this.createSnapshot(this.prisma, id, WeeklySnapshotKind.REPORT, userId);
  }

  async listSnapshots(programId: string) {
    await this.get(programId);
    return this.prisma.weeklySnapshot.findMany({
      where: { programId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        kind: true,
        createdAt: true,
        createdBy: { select: { id: true, fullName: true } },
      },
    });
  }

  async getSnapshot(id: string) {
    const snapshot = await this.prisma.weeklySnapshot.findUnique({
      where: { id },
      include: { createdBy: { select: { id: true, fullName: true } } },
    });
    if (!snapshot) {
      throw new NotFoundException(`Snapshot com ID "${id}" não encontrado`);
    }
    return snapshot;
  }

  async indicators(id: string): Promise<WeeklyIndicators> {
    await this.get(id);
    return this.computeProgramIndicators(this.prisma, id);
  }

  /** Histórico de PPC (últimas 12 semanas) para gráficos/dashboard. */
  async ppcHistory(projectId: string) {
    await this.assertProject(projectId);
    const programs = await this.prisma.weeklyProgram.findMany({
      where: { projectId },
      orderBy: { startDate: 'desc' },
      take: 12,
      include: { activities: { select: { status: true } } },
    });
    return programs
      .map((p) => {
        const stored = (p.indicators as { ppc?: number } | null)?.ppc;
        const ppc =
          stored ??
          computeIndicators(
            p.activities.map((a) => ({ status: a.status })),
            [],
          ).ppc;
        return { weekNumber: p.weekNumber, year: p.year, status: p.status, ppcTarget: 80, ppcActual: ppc };
      })
      .reverse();
  }

  // ── Atividades ────────────────────────────────────────────────────────────

  async addActivity(programId: string, dto: CreateWeeklyActivityDto) {
    const program = await this.getEditable(programId);
    await this.assertContractor(program.projectId, dto.contractorId);

    const { status, percentExecuted } = reconcileStatusPercent(
      dto.status ?? WeeklyActivityStatus.PROGRAMADA,
      dto.percentExecuted ?? 0,
    );
    const maxOrder = await this.prisma.weeklyActivity.aggregate({
      where: { programId },
      _max: { order: true },
    });

    return this.prisma.weeklyActivity.create({
      data: {
        programId,
        origin: WeeklyActivityOrigin.MANUAL,
        activityName: dto.activityName,
        local: dto.local ?? '',
        torre: dto.torre ?? '',
        pavimento: dto.pavimento ?? '',
        contractorId: dto.contractorId ?? null,
        responsible: dto.responsible ?? null,
        status,
        percentExecuted,
        order: (maxOrder._max.order ?? -1) + 1,
      },
      include: ACTIVITY_INCLUDE,
    });
  }

  async updateActivity(activityId: string, dto: UpdateWeeklyActivityDto) {
    const activity = await this.prisma.weeklyActivity.findUnique({
      where: { id: activityId },
      include: { program: { select: { id: true, projectId: true, status: true } } },
    });
    if (!activity) {
      throw new NotFoundException(`Atividade com ID "${activityId}" não encontrada`);
    }
    this.assertNotClosed(activity.program.status);
    await this.assertContractor(activity.program.projectId, dto.contractorId ?? undefined);

    // Regras Status ↔ %: status explícito manda; % sozinho sugere status
    let statusPercent: { status: WeeklyActivityStatus; percentExecuted: number } | null = null;
    if (dto.status !== undefined) {
      statusPercent = reconcileStatusPercent(dto.status, dto.percentExecuted ?? activity.percentExecuted);
    } else if (dto.percentExecuted !== undefined) {
      const suggested = suggestStatusFromPercent(activity.status, dto.percentExecuted);
      statusPercent = reconcileStatusPercent(suggested, dto.percentExecuted);
    }

    return this.prisma.weeklyActivity.update({
      where: { id: activityId },
      data: {
        ...(dto.activityName !== undefined && { activityName: dto.activityName }),
        ...(dto.local !== undefined && { local: dto.local }),
        ...(dto.torre !== undefined && { torre: dto.torre }),
        ...(dto.pavimento !== undefined && { pavimento: dto.pavimento }),
        ...(dto.contractorId !== undefined && { contractorId: dto.contractorId || null }),
        ...(dto.responsible !== undefined && { responsible: dto.responsible }),
        ...(dto.order !== undefined && { order: dto.order }),
        ...(statusPercent ?? {}),
      },
      include: ACTIVITY_INCLUDE,
    });
  }

  async removeActivity(activityId: string) {
    const activity = await this.prisma.weeklyActivity.findUnique({
      where: { id: activityId },
      include: { program: { select: { status: true } } },
    });
    if (!activity) {
      throw new NotFoundException(`Atividade com ID "${activityId}" não encontrada`);
    }
    this.assertNotClosed(activity.program.status);
    await this.prisma.weeklyActivity.delete({ where: { id: activityId } });
    return { deleted: true };
  }

  // ── Restrições ────────────────────────────────────────────────────────────

  async addRestriction(programId: string, dto: CreateWeeklyRestrictionDto) {
    const program = await this.getEditable(programId);
    await this.assertRestrictionType(program.projectId, dto.typeId);
    await this.assertActivitiesInProgram(programId, dto.activityIds);

    return this.prisma.weeklyRestriction.create({
      data: {
        programId,
        typeId: dto.typeId ?? null,
        description: dto.description,
        responsible: dto.responsible,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        impactsProgram: dto.impactsProgram ?? true,
        activityLinks: {
          create: (dto.activityIds ?? []).map((activityId) => ({ activityId })),
        },
      },
      include: RESTRICTION_INCLUDE,
    });
  }

  async updateRestriction(restrictionId: string, dto: UpdateWeeklyRestrictionDto) {
    const restriction = await this.prisma.weeklyRestriction.findUnique({
      where: { id: restrictionId },
      include: { program: { select: { id: true, projectId: true, status: true } } },
    });
    if (!restriction) {
      throw new NotFoundException(`Restrição com ID "${restrictionId}" não encontrada`);
    }
    this.assertNotClosed(restriction.program.status);
    await this.assertRestrictionType(restriction.program.projectId, dto.typeId ?? undefined);
    await this.assertActivitiesInProgram(restriction.program.id, dto.activityIds);

    const isBeingResolved = dto.status === 'RESOLVIDA' && restriction.status !== 'RESOLVIDA';

    return this.prisma.weeklyRestriction.update({
      where: { id: restrictionId },
      data: {
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.responsible !== undefined && { responsible: dto.responsible }),
        ...(dto.typeId !== undefined && { typeId: dto.typeId || null }),
        ...(dto.dueDate !== undefined && { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }),
        ...(dto.impactsProgram !== undefined && { impactsProgram: dto.impactsProgram }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.resolvedAt !== undefined
          ? { resolvedAt: new Date(dto.resolvedAt) }
          : isBeingResolved
            ? { resolvedAt: new Date() }
            : {}),
        ...(dto.activityIds !== undefined && {
          activityLinks: {
            deleteMany: {},
            create: dto.activityIds.map((activityId) => ({ activityId })),
          },
        }),
      },
      include: RESTRICTION_INCLUDE,
    });
  }

  async removeRestriction(restrictionId: string) {
    const restriction = await this.prisma.weeklyRestriction.findUnique({
      where: { id: restrictionId },
      include: { program: { select: { status: true } } },
    });
    if (!restriction) {
      throw new NotFoundException(`Restrição com ID "${restrictionId}" não encontrada`);
    }
    this.assertNotClosed(restriction.program.status);
    await this.prisma.weeklyRestriction.delete({ where: { id: restrictionId } });
    return { deleted: true };
  }

  // ── Empreiteiras ──────────────────────────────────────────────────────────

  async listContractors(projectId: string) {
    await this.assertProject(projectId);
    return this.prisma.contractor.findMany({
      where: { projectId },
      orderBy: { name: 'asc' },
    });
  }

  async createContractor(projectId: string, dto: CreateContractorDto) {
    await this.assertProject(projectId);
    const existing = await this.prisma.contractor.findUnique({
      where: { projectId_name: { projectId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException(`Empreiteira "${dto.name}" já cadastrada neste projeto`);
    }
    return this.prisma.contractor.create({ data: { projectId, name: dto.name } });
  }

  async updateContractor(id: string, dto: UpdateContractorDto) {
    const contractor = await this.prisma.contractor.findUnique({ where: { id } });
    if (!contractor) {
      throw new NotFoundException(`Empreiteira com ID "${id}" não encontrada`);
    }
    return this.prisma.contractor.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async removeContractor(id: string) {
    const contractor = await this.prisma.contractor.findUnique({ where: { id } });
    if (!contractor) {
      throw new NotFoundException(`Empreiteira com ID "${id}" não encontrada`);
    }
    await this.prisma.contractor.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Tipos de restrição ────────────────────────────────────────────────────

  async listRestrictionTypes(projectId: string) {
    await this.assertProject(projectId);
    return this.prisma.restrictionType.findMany({
      where: { projectId },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
  }

  async createRestrictionType(projectId: string, dto: CreateRestrictionTypeDto) {
    await this.assertProject(projectId);
    const existing = await this.prisma.restrictionType.findUnique({
      where: { projectId_name: { projectId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException(`Tipo de restrição "${dto.name}" já cadastrado neste projeto`);
    }
    return this.prisma.restrictionType.create({
      data: { projectId, name: dto.name, order: dto.order ?? 0 },
    });
  }

  async updateRestrictionType(id: string, dto: UpdateRestrictionTypeDto) {
    const type = await this.prisma.restrictionType.findUnique({ where: { id } });
    if (!type) {
      throw new NotFoundException(`Tipo de restrição com ID "${id}" não encontrado`);
    }
    return this.prisma.restrictionType.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.order !== undefined && { order: dto.order }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async removeRestrictionType(id: string) {
    const type = await this.prisma.restrictionType.findUnique({ where: { id } });
    if (!type) {
      throw new NotFoundException(`Tipo de restrição com ID "${id}" não encontrado`);
    }
    await this.prisma.restrictionType.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async assertProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, weekStartDay: true },
    });
    if (!project) {
      throw new NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
    }
    return project;
  }

  private assertNotClosed(status: WeeklyProgramStatus) {
    if (status === WeeklyProgramStatus.FECHADA) {
      throw new ConflictException('Programação fechada não pode ser alterada');
    }
  }

  private async getEditable(id: string): Promise<WeeklyProgram> {
    const program = await this.prisma.weeklyProgram.findUnique({ where: { id } });
    if (!program) {
      throw new NotFoundException(`Programação com ID "${id}" não encontrada`);
    }
    this.assertNotClosed(program.status);
    return program;
  }

  private async assertContractor(projectId: string, contractorId?: string | null) {
    if (!contractorId) return;
    const contractor = await this.prisma.contractor.findFirst({
      where: { id: contractorId, projectId },
      select: { id: true },
    });
    if (!contractor) {
      throw new BadRequestException('Empreiteira inválida para este projeto');
    }
  }

  private async assertRestrictionType(projectId: string, typeId?: string | null) {
    if (!typeId) return;
    const type = await this.prisma.restrictionType.findFirst({
      where: { id: typeId, projectId },
      select: { id: true },
    });
    if (!type) {
      throw new BadRequestException('Tipo de restrição inválido para este projeto');
    }
  }

  private async assertActivitiesInProgram(programId: string, activityIds?: string[]) {
    if (!activityIds?.length) return;
    const count = await this.prisma.weeklyActivity.count({
      where: { id: { in: activityIds }, programId },
    });
    if (count !== new Set(activityIds).size) {
      throw new BadRequestException('Há atividades vinculadas que não pertencem a esta programação');
    }
  }

  /** Importa folhas do cronograma que intersectam a semana (dedupe por scheduleItemId). */
  private async importScheduleItems(tx: Tx, program: WeeklyProgram): Promise<number> {
    const leaves = await tx.scheduleItem.findMany({
      where: {
        projectId: program.projectId,
        children: { none: {} },
        startDate: { lte: program.endDate },
        endDate: { gte: program.startDate },
      },
      select: { id: true, name: true, responsible: true, order: true, parentId: true },
      orderBy: { order: 'asc' },
    });
    if (leaves.length === 0) return 0;

    const existingIds = new Set(
      (
        await tx.weeklyActivity.findMany({
          where: { programId: program.id, scheduleItemId: { not: null } },
          select: { scheduleItemId: true },
        })
      ).map((a) => a.scheduleItemId),
    );
    const toImport = leaves.filter((item) => !existingIds.has(item.id));
    if (toImport.length === 0) return 0;

    // Mapa id→{name,parentId} do projeto para montar o caminho EAP sem N consultas
    const allItems = await tx.scheduleItem.findMany({
      where: { projectId: program.projectId },
      select: { id: true, name: true, parentId: true },
    });
    const byId = new Map(allItems.map((i) => [i.id, i]));
    const ancestorNames = (parentId: string | null): string[] => {
      const names: string[] = [];
      let cursor = parentId ? byId.get(parentId) : undefined;
      while (cursor) {
        names.unshift(cursor.name);
        cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
      }
      return names;
    };

    const maxOrder = await tx.weeklyActivity.aggregate({
      where: { programId: program.id },
      _max: { order: true },
    });
    let order = (maxOrder._max.order ?? -1) + 1;

    await tx.weeklyActivity.createMany({
      data: toImport.map((item) => {
        const location = deriveLocationFromPath(ancestorNames(item.parentId));
        return {
          programId: program.id,
          scheduleItemId: item.id,
          origin: WeeklyActivityOrigin.CRONOGRAMA,
          activityName: item.name,
          local: location.local,
          torre: location.torre,
          pavimento: location.pavimento,
          responsible: item.responsible ?? null,
          status: WeeklyActivityStatus.PROGRAMADA,
          percentExecuted: 0,
          order: order++,
        };
      }),
    });
    return toImport.length;
  }

  /**
   * Copia atividades não concluídas da semana `sourceId` para `targetId`
   * como REPROGRAMADA (dedupe por carryoverFromId).
   */
  private async carryoverActivities(tx: Tx, sourceId: string, targetId: string): Promise<number> {
    const candidates = await tx.weeklyActivity.findMany({
      where: { programId: sourceId, status: { in: CARRYOVER_STATUSES } },
      orderBy: [{ order: 'asc' }],
    });
    if (candidates.length === 0) return 0;

    const alreadyCarried = new Set(
      (
        await tx.weeklyActivity.findMany({
          where: { programId: targetId, carryoverFromId: { not: null } },
          select: { carryoverFromId: true },
        })
      ).map((a) => a.carryoverFromId),
    );
    const toCarry = candidates.filter((a) => !alreadyCarried.has(a.id));
    if (toCarry.length === 0) return 0;

    const maxOrder = await tx.weeklyActivity.aggregate({
      where: { programId: targetId },
      _max: { order: true },
    });
    let order = (maxOrder._max.order ?? -1) + 1;

    await tx.weeklyActivity.createMany({
      data: toCarry.map((src) => ({
        programId: targetId,
        scheduleItemId: src.scheduleItemId,
        origin: WeeklyActivityOrigin.REPROGRAMADA,
        activityName: src.activityName,
        local: src.local,
        torre: src.torre,
        pavimento: src.pavimento,
        contractorId: src.contractorId,
        responsible: src.responsible,
        status: WeeklyActivityStatus.REPROGRAMADA,
        percentExecuted: 0,
        carryoverFromId: src.id,
        order: order++,
      })),
    });
    return toCarry.length;
  }

  private async computeProgramIndicators(tx: Tx | PrismaService, programId: string): Promise<WeeklyIndicators> {
    const [activities, restrictions] = await Promise.all([
      tx.weeklyActivity.findMany({
        where: { programId },
        include: { contractor: { select: { id: true, name: true } } },
      }),
      tx.weeklyRestriction.findMany({
        where: { programId },
        include: { type: { select: { name: true } } },
      }),
    ]);
    return computeIndicators(
      activities.map((a) => ({
        status: a.status,
        contractorId: a.contractorId,
        contractorName: a.contractor?.name ?? null,
        responsible: a.responsible,
      })),
      restrictions.map((r) => ({ typeName: r.type?.name ?? null, status: r.status })),
    );
  }

  /** Snapshot imutável: foto completa da semana + indicadores no momento. */
  private async createSnapshot(
    tx: Tx | PrismaService,
    programId: string,
    kind: WeeklySnapshotKind,
    userId: string,
  ) {
    const [program, indicators] = await Promise.all([
      tx.weeklyProgram.findUnique({
        where: { id: programId },
        include: {
          activities: { include: ACTIVITY_INCLUDE, orderBy: [{ order: 'asc' }] },
          restrictions: { include: RESTRICTION_INCLUDE, orderBy: { createdAt: 'asc' } },
        },
      }),
      this.computeProgramIndicators(tx, programId),
    ]);

    return tx.weeklySnapshot.create({
      data: {
        programId,
        kind,
        createdById: userId,
        payload: JSON.parse(
          JSON.stringify({ program, indicators }),
        ) as Prisma.InputJsonValue,
      },
      include: { createdBy: { select: { id: true, fullName: true } } },
    });
  }
}
