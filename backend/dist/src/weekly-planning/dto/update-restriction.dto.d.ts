import { RestrictionStatus } from './create-restriction.dto';
export declare class UpdateRestrictionDto {
    description?: string;
    responsible?: string;
    dueDate?: string;
    status?: RestrictionStatus;
    resolvedAt?: Date;
}
