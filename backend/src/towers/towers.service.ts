import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateTowerDto } from './dto/create-tower.dto';
import { CreateFloorDto } from './dto/create-floor.dto';
import { CreateUnitDto } from './dto/create-unit.dto';

@Injectable()
export class TowersService {
  constructor(private readonly prisma: PrismaService) {}

  async listTowers(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
    }

    return this.prisma.tower.findMany({
      where: { projectId },
      include: {
        _count: { select: { floors: true } },
      },
      orderBy: { order: 'asc' },
    });
  }

  async createTower(projectId: string, dto: CreateTowerDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
    }

    let order = dto.order;
    if (order === undefined) {
      const lastTower = await this.prisma.tower.findFirst({
        where: { projectId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      order = lastTower ? lastTower.order + 1 : 0;
    }

    return this.prisma.tower.create({
      data: {
        projectId,
        name: dto.name,
        order,
      },
      include: {
        _count: { select: { floors: true } },
      },
    });
  }

  async listFloors(towerId: string) {
    const tower = await this.prisma.tower.findUnique({
      where: { id: towerId },
      select: { id: true },
    });
    if (!tower) {
      throw new NotFoundException(`Torre com ID "${towerId}" não encontrada`);
    }

    return this.prisma.floor.findMany({
      where: { towerId },
      include: {
        _count: { select: { units: true } },
      },
      orderBy: [{ order: 'asc' }, { level: 'asc' }],
    });
  }

  async createFloor(towerId: string, dto: CreateFloorDto) {
    const tower = await this.prisma.tower.findUnique({
      where: { id: towerId },
      select: { id: true },
    });
    if (!tower) {
      throw new NotFoundException(`Torre com ID "${towerId}" não encontrada`);
    }

    let order = dto.order;
    if (order === undefined) {
      const lastFloor = await this.prisma.floor.findFirst({
        where: { towerId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      order = lastFloor ? lastFloor.order + 1 : 0;
    }

    return this.prisma.floor.create({
      data: {
        towerId,
        name: dto.name,
        level: dto.level,
        order,
      },
      include: {
        _count: { select: { units: true } },
      },
    });
  }

  async listUnits(floorId: string) {
    const floor = await this.prisma.floor.findUnique({
      where: { id: floorId },
      select: { id: true },
    });
    if (!floor) {
      throw new NotFoundException(`Pavimento com ID "${floorId}" não encontrado`);
    }

    return this.prisma.unit.findMany({
      where: { floorId },
      orderBy: { order: 'asc' },
    });
  }

  async createUnit(floorId: string, dto: CreateUnitDto) {
    const floor = await this.prisma.floor.findUnique({
      where: { id: floorId },
      select: { id: true },
    });
    if (!floor) {
      throw new NotFoundException(`Pavimento com ID "${floorId}" não encontrado`);
    }

    let order = dto.order;
    if (order === undefined) {
      const lastUnit = await this.prisma.unit.findFirst({
        where: { floorId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      order = lastUnit ? lastUnit.order + 1 : 0;
    }

    return this.prisma.unit.create({
      data: {
        floorId,
        name: dto.name,
        area: dto.area !== undefined ? dto.area : null,
        order,
      },
    });
  }
}
