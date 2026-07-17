import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WeeklyActivityStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min, MaxLength } from 'class-validator';

export class CreateWeeklyActivityDto {
  @ApiProperty({ description: 'Nome da atividade', example: 'Revestimento de piso — apto 501' })
  @IsString()
  @MaxLength(300)
  activityName: string;

  @ApiPropertyOptional({ description: 'Local' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  local?: string;

  @ApiPropertyOptional({ description: 'Torre' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  torre?: string;

  @ApiPropertyOptional({ description: 'Pavimento' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  pavimento?: string;

  @ApiPropertyOptional({ description: 'ID da empreiteira' })
  @IsOptional()
  @IsString()
  contractorId?: string;

  @ApiPropertyOptional({ description: 'Responsável' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  responsible?: string;

  @ApiPropertyOptional({ enum: WeeklyActivityStatus, default: WeeklyActivityStatus.PROGRAMADA })
  @IsOptional()
  @IsEnum(WeeklyActivityStatus)
  status?: WeeklyActivityStatus;

  @ApiPropertyOptional({ description: '% executado (0–100)', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  percentExecuted?: number;
}
