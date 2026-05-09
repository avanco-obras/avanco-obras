export declare enum TaskStatus {
    COMPLETED = "COMPLETED",
    NOT_COMPLETED = "NOT_COMPLETED",
    PARTIALLY = "PARTIALLY"
}
export declare class CreateWeeklyTaskDto {
    description: string;
    location: string;
    assignedToId?: string;
    status?: TaskStatus;
    nonCompletionCause?: string;
}
