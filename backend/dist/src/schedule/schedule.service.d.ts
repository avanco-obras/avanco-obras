import { PrismaService } from '../common/prisma.service';
import { CreateScheduleItemDto } from './dto/create-schedule-item.dto';
import { UpdateScheduleItemDto } from './dto/update-schedule-item.dto';
export interface GanttRow {
    id: string;
    code: string;
    name: string;
    level: number;
    parentId?: string;
    startDate: string;
    endDate: string;
    durationDays: number;
    plannedProgress: number;
    actualProgress: number;
    isCriticalPath: boolean;
    hasChildren: boolean;
    order: number;
}
export interface CurvaSPoint {
    label: string;
    date: string;
    planned: number;
    actual: number;
}
export declare class ScheduleService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(projectId: string): Promise<({
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
        updatedAt: Date;
        name: string;
        startDate: Date;
        endDate: Date;
        projectId: string;
        weight: import("@prisma/client/runtime/library").Decimal;
        order: number;
        level: number;
        code: string;
        durationDays: number;
        plannedProgress: import("@prisma/client/runtime/library").Decimal;
        actualProgress: import("@prisma/client/runtime/library").Decimal;
        isCriticalPath: boolean;
        parentId: string | null;
        activityTypeId: string | null;
    })[]>;
    create(projectId: string, dto: CreateScheduleItemDto): Promise<{
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
        updatedAt: Date;
        name: string;
        startDate: Date;
        endDate: Date;
        projectId: string;
        weight: import("@prisma/client/runtime/library").Decimal;
        order: number;
        level: number;
        code: string;
        durationDays: number;
        plannedProgress: import("@prisma/client/runtime/library").Decimal;
        actualProgress: import("@prisma/client/runtime/library").Decimal;
        isCriticalPath: boolean;
        parentId: string | null;
        activityTypeId: string | null;
    }>;
    update(id: string, dto: UpdateScheduleItemDto): Promise<{
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
        updatedAt: Date;
        name: string;
        startDate: Date;
        endDate: Date;
        projectId: string;
        weight: import("@prisma/client/runtime/library").Decimal;
        order: number;
        level: number;
        code: string;
        durationDays: number;
        plannedProgress: import("@prisma/client/runtime/library").Decimal;
        actualProgress: import("@prisma/client/runtime/library").Decimal;
        isCriticalPath: boolean;
        parentId: string | null;
        activityTypeId: string | null;
    }>;
    remove(id: string): Promise<{
        message: string;
    }>;
    getGanttData(projectId: string): Promise<GanttRow[]>;
    getCurvaS(projectId: string): Promise<CurvaSPoint[]>;
}
