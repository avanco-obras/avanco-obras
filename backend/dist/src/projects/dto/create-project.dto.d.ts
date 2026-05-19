import { ProjectStatus } from '@prisma/client';
export declare class CreateProjectDto {
    name: string;
    company: string;
    address: string;
    status?: ProjectStatus;
    startDate: string;
    endDate: string;
    estimatedCost?: number;
    currency?: string;
    totalArea?: number;
    workdaysPerWeek?: number;
    hoursPerDay?: number;
    timezone?: string;
    progressCriteria?: string;
}
