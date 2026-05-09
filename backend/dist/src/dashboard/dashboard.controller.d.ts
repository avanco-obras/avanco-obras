import { DashboardService } from './dashboard.service';
export declare class DashboardController {
    private readonly dashboardService;
    constructor(dashboardService: DashboardService);
    getKPIs(projectId: string): Promise<import("./dashboard.service").KPIs>;
    getDelays(projectId: string): Promise<import("./dashboard.service").DelayedItem[]>;
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
        description: string;
        responsible: string;
        dueDate: Date;
        resolvedAt: Date | null;
        weeklyPlanId: string;
    })[]>;
    getSPIHistory(projectId: string): Promise<import("./dashboard.service").SPIPoint[]>;
}
