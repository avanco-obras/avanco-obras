import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { WeeklyRestrictionStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { CreateWeeklyRestrictionDto } from './create-weekly-restriction.dto';

export class UpdateWeeklyRestrictionDto extends PartialType(CreateWeeklyRestrictionDto) {
  @ApiPropertyOptional({ enum: WeeklyRestrictionStatus })
  @IsOptional()
  @IsEnum(WeeklyRestrictionStatus)
  status?: WeeklyRestrictionStatus;

  @ApiPropertyOptional({ description: 'Data de resolução (setada automaticamente ao marcar RESOLVIDA)' })
  @IsOptional()
  @IsDateString()
  resolvedAt?: string;
}
