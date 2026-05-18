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
    activityProgress: {
        activityTypeId: string;
        activityTypeName: string;
        avgProgress: number;
    }[];
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
export declare class MeasurementsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findByUnit(unitId: string): Promise<({
        activityType: {
            id: string;
            name: string;
            projectId: string;
            measurementMethod: import(".prisma/client").$Enums.MeasurementMethod;
            unit: string;
            defaultQuantity: import("@prisma/client/runtime/library").Decimal;
            weight: import("@prisma/client/runtime/library").Decimal;
            order: number;
        };
        measuredBy: {
            id: string;
            email: string;
            fullName: string;
        };
    } & {
        id: string;
        createdAt: Date;
        activityTypeId: string;
        date: Date;
        percentComplete: import("@prisma/client/runtime/library").Decimal;
        executedQty: import("@prisma/client/runtime/library").Decimal | null;
        totalQty: import("@prisma/client/runtime/library").Decimal | null;
        notes: string | null;
        photoUrl: string | null;
        unitId: string;
        measuredById: string;
    })[]>;
    create(unitId: string, measuredById: string, dto: CreateMeasurementDto): Promise<{
        activityType: {
            id: string;
            name: string;
            projectId: string;
            measurementMethod: import(".prisma/client").$Enums.MeasurementMethod;
            unit: string;
            defaultQuantity: import("@prisma/client/runtime/library").Decimal;
            weight: import("@prisma/client/runtime/library").Decimal;
            order: number;
        };
        measuredBy: {
            id: string;
            email: string;
            fullName: string;
        };
    } & {
        id: string;
        createdAt: Date;
        activityTypeId: string;
        date: Date;
        percentComplete: import("@prisma/client/runtime/library").Decimal;
        executedQty: import("@prisma/client/runtime/library").Decimal | null;
        totalQty: import("@prisma/client/runtime/library").Decimal | null;
        notes: string | null;
        photoUrl: string | null;
        unitId: string;
        measuredById: string;
    }>;
    update(id: string, dto: Partial<CreateMeasurementDto>): Promise<{
        activityType: {
            id: string;
            name: string;
            projectId: string;
            measurementMethod: import(".prisma/client").$Enums.MeasurementMethod;
            unit: string;
            defaultQuantity: import("@prisma/client/runtime/library").Decimal;
            weight: import("@prisma/client/runtime/library").Decimal;
            order: number;
        };
        measuredBy: {
            id: string;
            email: string;
            fullName: string;
        };
    } & {
        id: string;
        createdAt: Date;
        activityTypeId: string;
        date: Date;
        percentComplete: import("@prisma/client/runtime/library").Decimal;
        executedQty: import("@prisma/client/runtime/library").Decimal | null;
        totalQty: import("@prisma/client/runtime/library").Decimal | null;
        notes: string | null;
        photoUrl: string | null;
        unitId: string;
        measuredById: string;
    }>;
    batchCreate(unitId: string, measuredById: string, dto: BatchMeasurementDto): Promise<({
        activityType: {
            id: string;
            name: string;
            projectId: string;
            measurementMethod: import(".prisma/client").$Enums.MeasurementMethod;
            unit: string;
            defaultQuantity: import("@prisma/client/runtime/library").Decimal;
            weight: import("@prisma/client/runtime/library").Decimal;
            order: number;
        };
    } & {
        id: string;
        createdAt: Date;
        activityTypeId: string;
        date: Date;
        percentComplete: import("@prisma/client/runtime/library").Decimal;
        executedQty: import("@prisma/client/runtime/library").Decimal | null;
        totalQty: import("@prisma/client/runtime/library").Decimal | null;
        notes: string | null;
        photoUrl: string | null;
        unitId: string;
        measuredById: string;
    })[]>;
    getSummary(projectId: string): Promise<FloorSummary[]>;
    getBuildingData(projectId: string): Promise<BuildingDataResponse>;
}
