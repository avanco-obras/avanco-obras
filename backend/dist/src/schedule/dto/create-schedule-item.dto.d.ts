export declare class CreateScheduleItemDto {
    parentId?: string;
    activityTypeId?: string;
    code: string;
    name: string;
    level: number;
    startDate: string;
    endDate: string;
    durationDays: number;
    plannedProgress?: number;
    actualProgress?: number;
    weight?: number;
    isCriticalPath?: boolean;
    order?: number;
    responsible?: string;
}
