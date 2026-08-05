import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateWeeklyRestrictionDto {
  @ApiProperty({ description: 'Descrição da restrição', example: 'Falta de porcelanato 60×60' })
  @IsString()
  @MaxLength(500)
  description: string;

  @ApiProperty({ description: 'Responsável pela remoção', example: 'Suprimentos — R. Teixeira' })
  @IsString()
  @MaxLength(150)
  responsible: string;

  @ApiPropertyOptional({ description: 'ID do tipo de restrição (parametrizável em Configurações)' })
  @IsOptional()
  @IsString()
  typeId?: string;

  @ApiPropertyOptional({ description: 'Data prevista para remoção' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Impacta a programação (S/N)', default: true })
  @IsOptional()
  @IsBoolean()
  impactsProgram?: boolean;

  @ApiPropertyOptional({ description: 'IDs das atividades vinculadas (N:N)', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  activityIds?: string[];
}
