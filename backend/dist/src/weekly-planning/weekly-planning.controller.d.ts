import { WeeklyPlanningService } from './weekly-planning.service';
import { CreateWeeklyPlanDto } from './dto/create-weekly-plan.dto';
import { CreateWeeklyTaskDto } from './dto/create-weekly-task.dto';
import { UpdateWeeklyTaskDto } from './dto/update-weekly-task.dto';
import { CreateRestrictionDto } from './dto/create-restriction.dto';
import { UpdateRestrictionDto } from './dto/update-restriction.dto';
export declare class WeeklyPlanningController {
    private readonly weeklyPlanningService;
    constructor(weeklyPlanningService: WeeklyPlanningService);
    findAll(projectId: string): Promise<{
        id: string;
        createdAt: Date;
        startDate: Date;
        endDate: Date;
        projectId: string;
        notes: string | null;
        weekNumber: number;
        year: number;
        ppcTarget: import("@prisma/client/runtime/library").Decimal;
        ppcActual: import("@prisma/client/runtime/library").Decimal | null;
        ppcForecast: import("@prisma/client/runtime/library").Decimal | null;
    }[]>;
    create(projectId: string, dto: CreateWeeklyPlanDto): Promise<{
        id: string;
        createdAt: Date;
        startDate: Date;
        endDate: Date;
        projectId: string;
        notes: string | null;
        weekNumber: number;
        year: number;
        ppcTarget: import("@prisma/client/runtime/library").Decimal;
        ppcActual: import("@prisma/client/runtime/library").Decimal | null;
        ppcForecast: import("@prisma/client/runtime/library").Decimal | null;
    }>;
    findOne(id: string): Promise<{
        tasks: ({
            assignedTo: {
                id: string;
                email: string;
                fullName: string;
            };
        } & {
            id: string;
            createdAt: Date;
            status: import(".prisma/client").$Enums.TaskStatus;
            nonCompletionCause: string | null;
            description: string;
            location: string;
            assignedToId: string | null;
            weeklyPlanId: string;
        })[];
        restrictions: {
            id: string;
            status: import(".prisma/client").$Enums.RestrictionStatus;
            description: string;
            responsible: string;
            dueDate: Date;
            resolvedAt: Date | null;
            weeklyPlanId: string;
        }[];
    } & {
        id: string;
        createdAt: Date;
        startDate: Date;
        endDate: Date;
        projectId: string;
        notes: string | null;
        weekNumber: number;
        year: number;
        ppcTarget: import("@prisma/client/runtime/library").Decimal;
        ppcActual: import("@prisma/client/runtime/library").Decimal | null;
        ppcForecast: import("@prisma/client/runtime/library").Decimal | null;
    }>;
    addTask(planId: string, dto: CreateWeeklyTaskDto): Promise<{
        assignedTo: {
            id: string;
            email: string;
            fullName: string;
        };
    } & {
        id: string;
        createdAt: Date;
        status: import(".prisma/client").$Enums.TaskStatus;
        nonCompletionCause: string | null;
        description: string;
        location: string;
        assignedToId: string | null;
        weeklyPlanId: string;
    }>;
    updateTask(taskId: string, dto: UpdateWeeklyTaskDto): Promise<{
        assignedTo: {
            id: string;
            email: string;
            fullName: string;
        };
    } & {
        id: string;
        createdAt: Date;
        status: import(".prisma/client").$Enums.TaskStatus;
        nonCompletionCause: string | null;
        description: string;
        location: string;
        assignedToId: string | null;
        weeklyPlanId: string;
    }>;
    addRestriction(planId: string, dto: CreateRestrictionDto): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.RestrictionStatus;
        description: string;
        responsible: string;
        dueDate: Date;
        resolvedAt: Date | null;
        weeklyPlanId: string;
    }>;
    updateRestriction(restrictionId: string, dto: UpdateRestrictionDto): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.RestrictionStatus;
        description: string;
        responsible: string;
        dueDate: Date;
        resolvedAt: Date | null;
        weeklyPlanId: string;
    }>;
    getPPCHistory(projectId: string): Promise<import("./weekly-planning.service").PPCPoint[]>;
    generateFromSchedule(planId: string): Promise<{
        id: string;
        createdAt: Date;
        status: import(".prisma/client").$Enums.TaskStatus;
        nonCompletionCause: string | null;
        description: string;
        location: string;
        assignedToId: string | null;
        weeklyPlanId: string;
    }[]>;
}
