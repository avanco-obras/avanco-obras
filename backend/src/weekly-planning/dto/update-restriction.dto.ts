import { IsDate, IsEnum, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RestrictionStatus } from './create-restriction.dto';

export class UpdateRestrictionDto {
  @ApiPropertyOptional({ description: 'Description of the restriction' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Person responsible for resolving the restriction' })
  @IsOptional()
  @IsString()
  responsible?: string;

  @ApiPropertyOptional({ description: 'Due date for the restriction (ISO string)', example: '2025-06-01' })
  @IsOptional()
  @IsString()
  dueDate?: string;

  @ApiPropertyOptional({ enum: RestrictionStatus, description: 'Restriction status' })
  @IsOptional()
  @IsEnum(RestrictionStatus)
  status?: RestrictionStatus;

  @ApiPropertyOptional({ description: 'Timestamp when the restriction was resolved' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  resolvedAt?: Date;
}
