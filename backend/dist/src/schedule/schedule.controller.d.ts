import { ScheduleService } from './schedule.service';
import { CreateScheduleItemDto } from './dto/create-schedule-item.dto';
import { UpdateScheduleItemDto } from './dto/update-schedule-item.dto';
import { CreateDependencyDto } from './dto/create-dependency.dto';
export declare class ScheduleController {
    private readonly scheduleService;
    constructor(scheduleService: ScheduleService);
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
    addDependency(successorId: string, dto: CreateDependencyDto): Promise<{
        successor: {
            id: string;
            name: string;
            code: string;
        };
        predecessor: {
            id: string;
            name: string;
            code: string;
        };
    } & {
        id: string;
        type: string;
        lagDays: number;
        predecessorId: string;
        successorId: string;
    }>;
    removeDependency(depId: string): Promise<{
        message: string;
    }>;
    getItemDependencies(itemId: string): Promise<({
        successor: {
            id: string;
            name: string;
            code: string;
        };
        predecessor: {
            id: string;
            name: string;
            code: string;
        };
    } & {
        id: string;
        type: string;
        lagDays: number;
        predecessorId: string;
        successorId: string;
    })[]>;
    remove(id: string): Promise<{
        message: string;
    }>;
    getGanttData(projectId: string): Promise<import("./schedule.service").GanttRow[]>;
    getCurvaS(projectId: string): Promise<import("./schedule.service").CurvaSPoint[]>;
}
