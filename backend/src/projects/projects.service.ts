import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddMemberDto } from './dto/add-member.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    const where =
      user?.role === UserRole.ADMIN
        ? {}
        : { members: { some: { userId } } };

    return this.prisma.project.findMany({
      where,
      include: {
        _count: { select: { towers: true, members: true } },
        members: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateProjectDto, userId: string) {
    const project = await this.prisma.project.create({
      data: {
        name: dto.name,
        company: dto.company,
        address: dto.address,
        status: dto.status ?? 'PLANNING',
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        estimatedCost: dto.estimatedCost !== undefined ? dto.estimatedCost : null,
        currency: dto.currency ?? 'BRL',
        totalArea: dto.totalArea !== undefined ? dto.totalArea : null,
        workdaysPerWeek: dto.workdaysPerWeek ?? 5,
        hoursPerDay: dto.hoursPerDay ?? 8,
        timezone: dto.timezone ?? 'America/Sao_Paulo',
        progressCriteria: dto.progressCriteria ?? 'COST',
        members: {
          create: {
            userId,
            role: UserRole.ADMIN,
          },
        },
        scheduleItems: {
          create: {
            code: '1',
            name: dto.name,
            level: 0,
            startDate: new Date(dto.startDate),
            endDate: new Date(dto.endDate),
            durationDays: Math.max(
              1,
              Math.ceil(
                (new Date(dto.endDate).getTime() -
                  new Date(dto.startDate).getTime()) /
                  86_400_000,
              ),
            ),
            order: 0,
          },
        },
      },
      include: {
        _count: { select: { towers: true, members: true } },
        members: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    return project;
  }

  /**
   * Garante que o projeto tenha uma raiz de EAP (level 0, code "1"). Idempotente.
   * Usado para retrofit de projetos existentes que ainda não têm raiz.
   */
  async ensureRoot(projectId: string): Promise<void> {
    const root = await this.prisma.scheduleItem.findFirst({
      where: { projectId, parentId: null, level: 0 },
      select: { id: true },
    });
    if (root) return;
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true, startDate: true, endDate: true },
    });
    if (!project) return;
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

  async findOne(id: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        _count: { select: { towers: true, scheduleItems: true, members: true } },
        members: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
                avatarUrl: true,
                phone: true,
                crea: true,
              },
            },
          },
        },
        towers: {
          include: {
            _count: { select: { floors: true } },
          },
          orderBy: { order: 'asc' },
        },
        scheduleItems: {
          where: { parentId: null },
          select: {
            id: true,
            code: true,
            name: true,
            plannedProgress: true,
            physicalProgress: true,
            startDate: true,
            endDate: true,
            isCriticalPath: true,
          },
          orderBy: { order: 'asc' },
          take: 10,
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Projeto com ID "${id}" não encontrado`);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    const isMember = project.members.some((m) => m.userId === userId);
    if (!isMember && user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Você não tem acesso a este projeto');
    }

    return project;
  }

  async update(id: string, dto: UpdateProjectDto, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { members: true },
    });
    if (!project) {
      throw new NotFoundException(`Projeto com ID "${id}" não encontrado`);
    }

    const member = project.members.find((m) => m.userId === userId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const isGlobalAdmin = user?.role === UserRole.ADMIN;
    const isProjectAdmin = member?.role === UserRole.ADMIN;
    const isProjectEngineer = member?.role === UserRole.ENGINEER;

    if (!isGlobalAdmin && !isProjectAdmin && !isProjectEngineer) {
      throw new ForbiddenException(
        'Você precisa ser ADMIN ou ENGINEER no projeto para editá-lo',
      );
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.company !== undefined && { company: dto.company }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
        ...(dto.estimatedCost !== undefined && { estimatedCost: dto.estimatedCost }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.totalArea !== undefined && { totalArea: dto.totalArea }),
        ...(dto.workdaysPerWeek !== undefined && { workdaysPerWeek: dto.workdaysPerWeek }),
        ...(dto.hoursPerDay !== undefined && { hoursPerDay: dto.hoursPerDay }),
        ...(dto.timezone !== undefined && { timezone: dto.timezone }),
        ...(dto.progressCriteria !== undefined && { progressCriteria: dto.progressCriteria }),
      },
      include: {
        _count: { select: { towers: true, members: true } },
        members: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    // Sincroniza nome da raiz da EAP com o nome do projeto.
    if (dto.name !== undefined) {
      await this.prisma.scheduleItem.updateMany({
        where: { projectId: id, parentId: null, level: 0 },
        data: { name: dto.name },
      });
    }

    return updated;
  }

  async remove(id: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { members: true },
    });
    if (!project) {
      throw new NotFoundException(`Projeto com ID "${id}" não encontrado`);
    }

    const member = project.members.find((m) => m.userId === userId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const isGlobalAdmin = user?.role === UserRole.ADMIN;
    const isProjectAdmin = member?.role === UserRole.ADMIN;

    if (!isGlobalAdmin && !isProjectAdmin) {
      throw new ForbiddenException(
        'Somente um ADMIN pode excluir este projeto',
      );
    }

    await this.prisma.project.delete({ where: { id } });
    return { message: 'Projeto excluído com sucesso' };
  }

  async addMember(id: string, dto: AddMemberDto, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { members: true },
    });
    if (!project) {
      throw new NotFoundException(`Projeto com ID "${id}" não encontrado`);
    }

    const requestingMember = project.members.find((m) => m.userId === userId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const isGlobalAdmin = user?.role === UserRole.ADMIN;
    const isProjectAdmin = requestingMember?.role === UserRole.ADMIN;

    if (!isGlobalAdmin && !isProjectAdmin) {
      throw new ForbiddenException(
        'Somente um ADMIN pode adicionar membros ao projeto',
      );
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (!targetUser) {
      throw new NotFoundException(`Usuário com e-mail "${dto.email}" não encontrado`);
    }

    const existingMember = project.members.find((m) => m.userId === targetUser.id);
    if (existingMember) {
      return this.prisma.projectMember.update({
        where: { id: existingMember.id },
        data: { role: dto.role },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
              avatarUrl: true,
            },
          },
        },
      });
    }

    return this.prisma.projectMember.create({
      data: {
        projectId: id,
        userId: targetUser.id,
        role: dto.role,
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            avatarUrl: true,
          },
        },
      },
    });
  }
}
