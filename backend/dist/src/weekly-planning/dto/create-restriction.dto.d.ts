export declare enum RestrictionStatus {
    PENDING = "PENDING",
    IN_ANALYSIS = "IN_ANALYSIS",
    RELEASED = "RELEASED",
    EXPIRED = "EXPIRED"
}
export declare class CreateRestrictionDto {
    description: string;
    responsible: string;
    dueDate: string;
    status?: RestrictionStatus;
}
