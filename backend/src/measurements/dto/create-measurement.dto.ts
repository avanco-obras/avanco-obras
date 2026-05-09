import { IsUUID, IsNumber, IsOptional, Min, Max, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMeasurementDto {
  @ApiProperty({ description: 'Activity type ID (UUID)' })
  @IsUUID()
  activityTypeId: string;

  @ApiPropertyOptional({ description: 'Percent complete (0-100). Required for PERCENT method.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentComplete?: number;

  @ApiPropertyOptional({ description: 'Executed quantity (METRIC or COUNT methods)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  executedQty?: number;

  @ApiPropertyOptional({ description: 'Total quantity (METRIC or COUNT methods). Falls back to activityType.defaultQuantity.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalQty?: number;

  @ApiPropertyOptional({ description: 'Optional observation notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'URL of attached photo evidence' })
  @IsOptional()
  @IsString()
  photoUrl?: string;
}
