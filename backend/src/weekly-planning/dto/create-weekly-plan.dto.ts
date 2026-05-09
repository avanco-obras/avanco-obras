import { IsInt, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWeeklyPlanDto {
  @ApiProperty({ description: 'ISO week number (1–53)', example: 22 })
  @IsInt()
  @Min(1)
  @Max(53)
  weekNumber: number;

  @ApiProperty({ description: 'Calendar year', example: 2025 })
  @IsInt()
  @Min(2000)
  year: number;

  @ApiProperty({ description: 'Start date of the week (ISO string)', example: '2025-05-26' })
  @IsString()
  startDate: string;

  @ApiProperty({ description: 'End date of the week (ISO string)', example: '2025-06-01' })
  @IsString()
  endDate: string;

  @ApiPropertyOptional({ description: 'PPC target percentage (default 80)', example: 80, default: 80 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  ppcTarget?: number;

  @ApiPropertyOptional({ description: 'Optional notes for the weekly plan' })
  @IsOptional()
  @IsString()
  notes?: string;
}
