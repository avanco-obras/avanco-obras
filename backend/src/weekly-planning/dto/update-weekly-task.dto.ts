import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from './create-weekly-task.dto';

export class UpdateWeeklyTaskDto {
  @ApiPropertyOptional({ description: 'Task description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Location / area where the task is executed' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'UUID of the user the task is assigned to' })
  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @ApiPropertyOptional({ enum: TaskStatus, description: 'Task completion status' })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ description: 'Reason for non-completion' })
  @IsOptional()
  @IsString()
  nonCompletionCause?: string;
}
