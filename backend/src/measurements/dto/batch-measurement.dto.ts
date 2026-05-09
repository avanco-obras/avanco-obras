import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CreateMeasurementDto } from './create-measurement.dto';

export class BatchMeasurementDto {
  @ApiProperty({ type: [CreateMeasurementDto], description: 'Array of measurements to save in one request' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMeasurementDto)
  measurements: CreateMeasurementDto[];
}
