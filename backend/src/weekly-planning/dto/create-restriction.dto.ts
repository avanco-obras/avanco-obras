import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum RestrictionStatus {
  PENDING = 'PENDING',
  IN_ANALYSIS = 'IN_ANALYSIS',
  RELEASED = 'RELEASED',
  EXPIRED = 'EXPIRED',
}

export class CreateRestrictionDto {
  @ApiProperty({ description: 'Description of the restriction' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Person responsible for resolving the restriction' })
  @IsString()
  responsible: string;

  @ApiProperty({ description: 'Due date for the restriction (ISO string)', example: '2025-06-01' })
  @IsString()
  dueDate: string;

  @ApiPropertyOptional({ enum: RestrictionStatus, description: 'Restriction status' })
  @IsOptional()
  @IsEnum(RestrictionStatus)
  status?: RestrictionStatus;
}
