import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TaskStatus {
  COMPLETED = 'COMPLETED',
  NOT_COMPLETED = 'NOT_COMPLETED',
  PARTIALLY = 'PARTIALLY',
}

export class CreateWeeklyTaskDto {
  @ApiProperty({ description: 'Task description' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Location / area where the task is executed' })
  @IsString()
  location: string;

  @ApiPropertyOptional({ description: 'UUID of the user the task is assigned to' })
  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @ApiPropertyOptional({ enum: TaskStatus, description: 'Task completion status' })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ description: 'Reason for non-completion (when status is NOT_COMPLETED or PARTIALLY)' })
  @IsOptional()
  @IsString()
  nonCompletionCause?: string;
}
