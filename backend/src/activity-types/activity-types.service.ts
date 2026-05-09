import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateActivityTypeDto } from './dto/create-activity-type.dto';
import { UpdateActivityTypeDto } from './dto/update-activity-type.dto';

@Injectable()
export class ActivityTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
    }

    return this.prisma.activityType.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });
  }

  async create(projectId: string, dto: CreateActivityTypeDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
    }

    const existing = await this.prisma.activityType.findUnique({
      where: { projectId_name: { projectId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException(
        `Tipo de atividade com nome "${dto.name}" já existe neste projeto`,
      );
    }

    let order = dto.order;
    if (order === undefined) {
      const last = await this.prisma.activityType.findFirst({
        where: { projectId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      order = last ? last.order + 1 : 0;
    }

    return this.prisma.activityType.create({
      data: {
        projectId,
        name: dto.name,
        measurementMethod: dto.measurementMethod ?? 'PERCENT',
        unit: dto.unit ?? '%',
        defaultQuantity: dto.defaultQuantity ?? 0,
        weight: dto.weight ?? 1,
        order,
      },
    });
  }

  async update(id: string, dto: UpdateActivityTypeDto) {
    const activityType = await this.prisma.activityType.findUnique({
      where: { id },
    });
    if (!activityType) {
      throw new NotFoundException(`Tipo de atividade com ID "${id}" não encontrado`);
    }

    if (dto.name && dto.name !== activityType.name) {
      const existing = await this.prisma.activityType.findUnique({
        where: {
          projectId_name: {
            projectId: activityType.projectId,
            name: dto.name,
          },
        },
      });
      if (existing) {
        throw new ConflictException(
          `Tipo de atividade com nome "${dto.name}" já existe neste projeto`,
        );
      }
    }

    return this.prisma.activityType.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.measurementMethod !== undefined && { measurementMethod: dto.measurementMethod }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.defaultQuantity !== undefined && { defaultQuantity: dto.defaultQuantity }),
        ...(dto.weight !== undefined && { weight: dto.weight }),
        ...(dto.order !== undefined && { order: dto.order }),
      },
    });
  }

  async remove(id: string) {
    const activityType = await this.prisma.activityType.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!activityType) {
      throw new NotFoundException(`Tipo de atividade com ID "${id}" não encontrado`);
    }

    await this.prisma.activityType.delete({ where: { id } });
    return { message: 'Tipo de atividade excluído com sucesso' };
  }
}
