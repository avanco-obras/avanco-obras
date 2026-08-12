import { PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';
import { CreateWeeklyActivityDto } from './create-weekly-activity.dto';

export class UpdateWeeklyActivityDto extends PartialType(CreateWeeklyActivityDto) {
  @ApiPropertyOptional({ description: 'Ordem na tabela' })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
