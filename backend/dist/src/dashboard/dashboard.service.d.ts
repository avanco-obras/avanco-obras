import { PrismaService } from '../common/prisma.service';
export interface KPIs {
    overallProgress: number;
    plannedProgress: number;
    spi: number;
    ppcCurrent: number | null;
    ppcForecast: number | null;
    totalActivities: number;
    completedActivities: number;
    delayedActivities: number;
    pendingRestrictions: number;
}
export interface DelayedItem {
    id: string;
    code: string;
    name: string;
    plannedProgress: number;
    actualProgress: number;
    gap: number;
    endDate: string;
    daysOverdue: number | null;
}
export interface SPIPoint {
    month: string;
    planned: number;
    actual: number;
    spi: number;
}
export declare class DashboardService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private ensureProject;
    getKPIs(projectId: string): Promise<KPIs>;
    getDelays(projectId: string): Promise<DelayedItem[]>;
    getPendingRestrictions(projectId: string): Promise<({
        weeklyPlan: {
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
        };
    } & {
        id: string;
        status: import(".prisma/client").$Enums.RestrictionStatus;
        responsible: string;
        description: string;
        dueDate: Date;
        resolvedAt: Date | null;
        weeklyPlanId: string;
    })[]>;
    getSPIHistory(projectId: string): Promise<SPIPoint[]>;
}
