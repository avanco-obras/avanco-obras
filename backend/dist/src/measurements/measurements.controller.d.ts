import { MeasurementsService } from './measurements.service';
import { CreateMeasurementDto } from './dto/create-measurement.dto';
import { BatchMeasurementDto } from './dto/batch-measurement.dto';
export declare class MeasurementsController {
    private readonly measurementsService;
    constructor(measurementsService: MeasurementsService);
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
    getSummary(projectId: string): Promise<import("./measurements.service").FloorSummary[]>;
    getBuildingData(projectId: string): Promise<import("./measurements.service").TowerBuildingData[]>;
}
