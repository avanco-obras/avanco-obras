import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateWeeklyPlanDto } from './dto/create-weekly-plan.dto';
import { CreateWeeklyTaskDto } from './dto/create-weekly-task.dto';
import { UpdateWeeklyTaskDto } from './dto/update-weekly-task.dto';
import { CreateRestrictionDto } from './dto/create-restriction.dto';
import { UpdateRestrictionDto } from './dto/update-restriction.dto';

export interface PPCPoint {
  weekNumber: number;
  year: number;
  ppcTarget: number;
  ppcActual: number;
}

@Injectable()
export class WeeklyPlanningService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
    }

    return this.prisma.weeklyPlan.findMany({
      where: { projectId },
      orderBy: [{ year: 'desc' }, { weekNumber: 'desc' }],
    });
  }

  async create(projectId: string, dto: CreateWeeklyPlanDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
    }

    const existing = await this.prisma.weeklyPlan.findUnique({
      where: {
        projectId_year_weekNumber: {
          projectId,
          year: dto.year,
          weekNumber: dto.weekNumber,
        },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        `Já existe um plano semanal para a semana ${dto.weekNumber} de ${dto.year} neste projeto`,
      );
    }

    return this.prisma.weeklyPlan.create({
      data: {
        projectId,
        weekNumber: dto.weekNumber,
        year: dto.year,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        ppcTarget: dto.ppcTarget ?? 80,
        notes: dto.notes ?? null,
      },
    });
  }

  async findOne(id: string) {
    const plan = await this.prisma.weeklyPlan.findUnique({
      where: { id },
      include: {
        tasks: {
          include: {
            assignedTo: {
              select: { id: true, fullName: true, email: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        restrictions: {
          orderBy: { dueDate: 'asc' },
        },
      },
    });
    if (!plan) {
      throw new NotFoundException(`Plano semanal com ID "${id}" não encontrado`);
    }
    return plan;
  }

  async addTask(planId: string, dto: CreateWeeklyTaskDto) {
    const plan = await this.prisma.weeklyPlan.findUnique({
      where: { id: planId },
      select: { id: true },
    });
    if (!plan) {
      throw new NotFoundException(`Plano semanal com ID "${planId}" não encontrado`);
    }

    return this.prisma.weeklyTask.create({
      data: {
        weeklyPlanId: planId,
        description: dto.description,
        location: dto.location,
        assignedToId: dto.assignedToId ?? null,
        status: dto.status ?? 'NOT_COMPLETED',
        nonCompletionCause: dto.nonCompletionCause ?? null,
      },
      include: {
        assignedTo: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
  }

  async updateTask(taskId: string, dto: UpdateWeeklyTaskDto) {
    const task = await this.prisma.weeklyTask.findUnique({
      where: { id: taskId },
      select: { id: true },
    });
    if (!task) {
      throw new NotFoundException(`Tarefa com ID "${taskId}" não encontrada`);
    }

    return this.prisma.weeklyTask.update({
      where: { id: taskId },
      data: {
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.assignedToId !== undefined && { assignedToId: dto.assignedToId }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.nonCompletionCause !== undefined && { nonCompletionCause: dto.nonCompletionCause }),
      },
      include: {
        assignedTo: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
  }

  async addRestriction(planId: string, dto: CreateRestrictionDto) {
    const plan = await this.prisma.weeklyPlan.findUnique({
      where: { id: planId },
      select: { id: true },
    });
    if (!plan) {
      throw new NotFoundException(`Plano semanal com ID "${planId}" não encontrado`);
    }

    return this.prisma.restriction.create({
      data: {
        weeklyPlanId: planId,
        description: dto.description,
        responsible: dto.responsible,
        dueDate: new Date(dto.dueDate),
        status: dto.status ?? 'PENDING',
      },
    });
  }

  async updateRestriction(restrictionId: string, dto: UpdateRestrictionDto) {
    const restriction = await this.prisma.restriction.findUnique({
      where: { id: restrictionId },
      select: { id: true, status: true },
    });
    if (!restriction) {
      throw new NotFoundException(`Restrição com ID "${restrictionId}" não encontrada`);
    }

    const isBeingReleased =
      dto.status === 'RELEASED' && restriction.status !== 'RELEASED';

    return this.prisma.restriction.update({
      where: { id: restrictionId },
      data: {
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.responsible !== undefined && { responsible: dto.responsible }),
        ...(dto.dueDate !== undefined && { dueDate: new Date(dto.dueDate) }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.resolvedAt !== undefined
          ? { resolvedAt: dto.resolvedAt }
          : isBeingReleased
          ? { resolvedAt: new Date() }
          : {}),
      },
    });
  }

  async getPPCHistory(projectId: string): Promise<PPCPoint[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
    }

    const plans = await this.prisma.weeklyPlan.findMany({
      where: { projectId },
      orderBy: [{ year: 'desc' }, { weekNumber: 'desc' }],
      take: 12,
      include: {
        tasks: {
          select: { status: true },
        },
      },
    });

    return plans.map((plan): PPCPoint => {
      const tasks = plan.tasks;
      let ppcActual = 0;

      if (tasks.length > 0) {
        const totalScore = tasks.reduce((sum, task) => {
          if (task.status === 'COMPLETED') return sum + 1;
          if (task.status === 'PARTIALLY') return sum + 0.5;
          return sum; // NOT_COMPLETED = 0
        }, 0);
        ppcActual = Math.round((totalScore / tasks.length) * 10000) / 100;
      }

      return {
        weekNumber: plan.weekNumber,
        year: plan.year,
        ppcTarget: Number(plan.ppcTarget),
        ppcActual,
      };
    });
  }

  async generateFromSchedule(planId: string) {
    const plan = await this.prisma.weeklyPlan.findUnique({
      where: { id: planId },
      select: {
        id: true,
        projectId: true,
        startDate: true,
        endDate: true,
      },
    });
    if (!plan) {
      throw new NotFoundException(`Plano semanal com ID "${planId}" não encontrado`);
    }

    // Find schedule items whose date range overlaps the plan's period
    const scheduleItems = await this.prisma.scheduleItem.findMany({
      where: {
        projectId: plan.projectId,
        startDate: { lte: plan.endDate },
        endDate: { gte: plan.startDate },
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
      orderBy: { order: 'asc' },
    });

    if (scheduleItems.length === 0) {
      return [];
    }

    const createdTasks = await this.prisma.$transaction(
      scheduleItems.map((item) =>
        this.prisma.weeklyTask.create({
          data: {
            weeklyPlanId: planId,
            description: item.name,
            location: item.code,
            status: 'NOT_COMPLETED',
          },
        }),
      ),
    );

    return createdTasks;
  }
}
