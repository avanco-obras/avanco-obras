import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateMeasurementDto } from './dto/create-measurement.dto';
import { BatchMeasurementDto } from './dto/batch-measurement.dto';

export interface FloorSummary {
  towerId: string;
  towerName: string;
  floorId: string;
  floorName: string;
  avgProgress: number;
}

export interface UnitBuildingData {
  id: string;
  name: string;
  activityProgress: { activityTypeId: string; activityTypeName: string; avgProgress: number }[];
  progressPercent: number;
}

export interface FloorBuildingData {
  id: string;
  name: string;
  level: number;
  units: UnitBuildingData[];
  averageProgress: number;
}

export interface TowerBuildingData {
  id: string;
  name: string;
  floors: FloorBuildingData[];
}

export interface BuildingDataResponse {
  towers: TowerBuildingData[];
}

@Injectable()
export class MeasurementsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByUnit(unitId: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true },
    });
    if (!unit) {
      throw new NotFoundException(`Unidade com ID "${unitId}" não encontrada`);
    }

    return this.prisma.measurement.findMany({
      where: { unitId },
      include: {
        activityType: true,
        measuredBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  async create(unitId: string, measuredById: string, dto: CreateMeasurementDto) {
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true },
    });
    if (!unit) {
      throw new NotFoundException(`Unidade com ID "${unitId}" não encontrada`);
    }

    const activityType = await this.prisma.activityType.findUnique({
      where: { id: dto.activityTypeId },
      select: { id: true, measurementMethod: true, defaultQuantity: true },
    });
    if (!activityType) {
      throw new NotFoundException(`Tipo de atividade com ID "${dto.activityTypeId}" não encontrado`);
    }

    let percentComplete = dto.percentComplete ?? 0;

    if (
      activityType.measurementMethod === 'METRIC' ||
      activityType.measurementMethod === 'COUNT'
    ) {
      const executedQty = dto.executedQty;
      const totalQty =
        dto.totalQty ?? (Number(activityType.defaultQuantity) || undefined);

      if (executedQty !== undefined && totalQty !== undefined && totalQty > 0) {
        percentComplete = Math.min(100, (executedQty / totalQty) * 100);
      }
    }

    return this.prisma.measurement.create({
      data: {
        unitId,
        measuredById,
        activityTypeId: dto.activityTypeId,
        percentComplete,
        executedQty: dto.executedQty ?? null,
        totalQty: dto.totalQty ?? null,
        notes: dto.notes ?? null,
        photoUrl: dto.photoUrl ?? null,
      },
      include: {
        activityType: true,
        measuredBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
  }

  async update(id: string, dto: Partial<CreateMeasurementDto>) {
    const measurement = await this.prisma.measurement.findUnique({
      where: { id },
      include: {
        activityType: { select: { measurementMethod: true, defaultQuantity: true } },
      },
    });
    if (!measurement) {
      throw new NotFoundException(`Medição com ID "${id}" não encontrada`);
    }

    let percentComplete = dto.percentComplete;

    const method = measurement.activityType.measurementMethod;
    if (method === 'METRIC' || method === 'COUNT') {
      const executedQty = dto.executedQty ?? (measurement.executedQty !== null ? Number(measurement.executedQty) : undefined);
      const totalQty =
        dto.totalQty ??
        (measurement.totalQty !== null
          ? Number(measurement.totalQty)
          : Number(measurement.activityType.defaultQuantity) || undefined);

      if (executedQty !== undefined && totalQty !== undefined && totalQty > 0) {
        percentComplete = Math.min(100, (executedQty / totalQty) * 100);
      }
    }

    return this.prisma.measurement.update({
      where: { id },
      data: {
        ...(dto.activityTypeId !== undefined && { activityTypeId: dto.activityTypeId }),
        ...(percentComplete !== undefined && { percentComplete }),
        ...(dto.executedQty !== undefined && { executedQty: dto.executedQty }),
        ...(dto.totalQty !== undefined && { totalQty: dto.totalQty }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.photoUrl !== undefined && { photoUrl: dto.photoUrl }),
      },
      include: {
        activityType: true,
        measuredBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
  }

  async batchCreate(unitId: string, measuredById: string, dto: BatchMeasurementDto) {
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true },
    });
    if (!unit) {
      throw new NotFoundException(`Unidade com ID "${unitId}" não encontrada`);
    }

    const activityTypeIds = [...new Set(dto.measurements.map((m) => m.activityTypeId))];
    const activityTypes = await this.prisma.activityType.findMany({
      where: { id: { in: activityTypeIds } },
      select: { id: true, measurementMethod: true, defaultQuantity: true },
    });

    const activityTypeMap = new Map(activityTypes.map((at) => [at.id, at]));

    const results = await this.prisma.$transaction(
      dto.measurements.map((item) => {
        const activityType = activityTypeMap.get(item.activityTypeId);
        let percentComplete = item.percentComplete ?? 0;

        if (
          activityType &&
          (activityType.measurementMethod === 'METRIC' ||
            activityType.measurementMethod === 'COUNT')
        ) {
          const executedQty = item.executedQty;
          const totalQty =
            item.totalQty ??
            (Number(activityType.defaultQuantity) || undefined);

          if (executedQty !== undefined && totalQty !== undefined && totalQty > 0) {
            percentComplete = Math.min(100, (executedQty / totalQty) * 100);
          }
        }

        return this.prisma.measurement.create({
          data: {
            unitId,
            measuredById,
            activityTypeId: item.activityTypeId,
            percentComplete,
            executedQty: item.executedQty ?? null,
            totalQty: item.totalQty ?? null,
            notes: item.notes ?? null,
            photoUrl: item.photoUrl ?? null,
          },
          include: {
            activityType: true,
          },
        });
      }),
    );

    return results;
  }

  async getSummary(projectId: string): Promise<FloorSummary[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
    }

    const towers = await this.prisma.tower.findMany({
      where: { projectId },
      select: {
        id: true,
        name: true,
        floors: {
          select: {
            id: true,
            name: true,
            units: {
              select: {
                id: true,
                measurements: {
                  select: { percentComplete: true },
                  orderBy: { date: 'desc' },
                  take: 1,
                },
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    });

    const summary: FloorSummary[] = [];

    for (const tower of towers) {
      for (const floor of tower.floors) {
        const unitProgresses = floor.units
          .map((u) => {
            const latest = u.measurements[0];
            return latest ? Number(latest.percentComplete) : null;
          })
          .filter((p): p is number => p !== null);

        const avgProgress =
          unitProgresses.length > 0
            ? unitProgresses.reduce((a, b) => a + b, 0) / unitProgresses.length
            : 0;

        summary.push({
          towerId: tower.id,
          towerName: tower.name,
          floorId: floor.id,
          floorName: floor.name,
          avgProgress: Math.round(avgProgress * 100) / 100,
        });
      }
    }

    return summary;
  }

  async getBuildingData(projectId: string): Promise<BuildingDataResponse> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
    }

    const towers = await this.prisma.tower.findMany({
      where: { projectId },
      select: {
        id: true,
        name: true,
        floors: {
          select: {
            id: true,
            name: true,
            level: true,
            units: {
              select: {
                id: true,
                name: true,
                measurements: {
                  select: {
                    percentComplete: true,
                    activityTypeId: true,
                    activityType: { select: { id: true, name: true } },
                    date: true,
                  },
                  orderBy: { date: 'desc' },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    });

    const towerData = towers.map((tower): TowerBuildingData => ({
      id: tower.id,
      name: tower.name,
      floors: tower.floors.map((floor): FloorBuildingData => {
        const units = floor.units.map((unit): UnitBuildingData => {
          const latestByActivity = new Map<string, { name: string; percentComplete: number }>();

          for (const m of unit.measurements) {
            if (!latestByActivity.has(m.activityTypeId)) {
              latestByActivity.set(m.activityTypeId, {
                name: m.activityType.name,
                percentComplete: Number(m.percentComplete),
              });
            }
          }

          const activityProgress = Array.from(latestByActivity.entries()).map(
            ([activityTypeId, data]) => ({
              activityTypeId,
              activityTypeName: data.name,
              avgProgress: Math.round(data.percentComplete * 100) / 100,
            }),
          );

          const values = activityProgress.map((a) => a.avgProgress);
          const progressPercent =
            values.length > 0
              ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100
              : 0;

          return {
            id: unit.id,
            name: unit.name,
            activityProgress,
            progressPercent,
          };
        });

        const unitProgresses = units.map((u) => u.progressPercent);
        const averageProgress =
          unitProgresses.length > 0
            ? Math.round((unitProgresses.reduce((a, b) => a + b, 0) / unitProgresses.length) * 100) / 100
            : 0;

        return {
          id: floor.id,
          name: floor.name,
          level: floor.level,
          units,
          averageProgress,
        };
      }),
    }));

    return { towers: towerData };
  }
}