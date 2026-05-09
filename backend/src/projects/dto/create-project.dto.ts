import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsDateString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectStatus } from '@prisma/client';
import { Transform } from 'class-transformer';

export class CreateProjectDto {
  @ApiProperty({ description: 'Project name' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ description: 'Company responsible for the project' })
  @IsString()
  @MinLength(2)
  company: string;

  @ApiProperty({ description: 'Project address' })
  @IsString()
  @MinLength(5)
  address: string;

  @ApiPropertyOptional({ enum: ProjectStatus, default: ProjectStatus.PLANNING })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiProperty({ description: 'Project start date (ISO 8601)', example: '2024-01-15' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'Project end date (ISO 8601)', example: '2025-12-31' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ description: 'Estimated total cost', type: Number })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  estimatedCost?: number;

  @ApiPropertyOptional({ description: 'Currency code', default: 'BRL', example: 'BRL' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ description: 'Total project area in m²', type: Number })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalArea?: number;

  @ApiPropertyOptional({ description: 'Working days per week', default: 5, minimum: 1, maximum: 7 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  workdaysPerWeek?: number;

  @ApiPropertyOptional({ description: 'Working hours per day', default: 8, minimum: 1, maximum: 24 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  hoursPerDay?: number;

  @ApiPropertyOptional({ description: 'IANA timezone', default: 'America/Sao_Paulo', example: 'America/Sao_Paulo' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Progress calculation criteria',
    enum: ['COST', 'QUANTITY', 'HYBRID'],
    default: 'COST',
  })
  @IsOptional()
  @IsString()
  progressCriteria?: string;
}
