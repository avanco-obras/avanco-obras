import {
  IsString,
  IsOptional,
  IsDateString,
  IsNumber,
  IsBoolean,
  IsInt,
  Min,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateScheduleItemDto {
  @ApiPropertyOptional({ description: 'Parent schedule item ID (UUID)' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ description: 'Activity type ID (UUID)' })
  @IsOptional()
  @IsUUID()
  activityTypeId?: string;

  @ApiProperty({ description: 'WBS code (e.g. 1.1.2)' })
  @IsString()
  code: string;

  @ApiProperty({ description: 'Activity name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Hierarchy level (0 = root)' })
  @IsInt()
  level: number;

  @ApiProperty({ description: 'Planned start date (ISO string)' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'Planned end date (ISO string)' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ description: 'Duration in working days' })
  @IsInt()
  durationDays: number;

  @ApiPropertyOptional({ description: 'Planned progress percentage (0-100)' })
  @IsOptional()
  @IsNumber()
  plannedProgress?: number;

  @ApiPropertyOptional({ description: 'Actual progress percentage (0-100)' })
  @IsOptional()
  @IsNumber()
  actualProgress?: number;

  @ApiPropertyOptional({ description: 'Relative weight for progress calculation' })
  @IsOptional()
  @IsNumber()
  weight?: number;

  @ApiPropertyOptional({ description: 'Whether item is on the critical path' })
  @IsOptional()
  @IsBoolean()
  isCriticalPath?: boolean;

  @ApiPropertyOptional({ description: 'Display order within siblings' })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
