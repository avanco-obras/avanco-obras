import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class CreateWeeklyProgramDto {
  @ApiPropertyOptional({
    description: 'Data de referência — a programação é criada para a semana que contém essa data (default: hoje)',
    example: '2026-07-16',
  })
  @IsOptional()
  @IsDateString()
  referenceDate?: string;
}
