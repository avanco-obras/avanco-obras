import { TaskStatus } from './create-weekly-task.dto';
export declare class UpdateWeeklyTaskDto {
    description?: string;
    location?: string;
    assignedToId?: string;
    status?: TaskStatus;
    nonCompletionCause?: string;
}
