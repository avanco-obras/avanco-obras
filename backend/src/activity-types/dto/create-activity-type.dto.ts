import { IsString, IsEnum, IsOptional, IsNumber, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MeasurementMethod } from '@prisma/client';

export class CreateActivityTypeDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional({ enum: MeasurementMethod, default: MeasurementMethod.PERCENT })
  @IsOptional() @IsEnum(MeasurementMethod) measurementMethod?: MeasurementMethod;
  @ApiPropertyOptional({ default: '%' }) @IsOptional() @IsString() unit?: string;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() defaultQuantity?: number;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsNumber() weight?: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsInt() @Min(0) order?: number;
}
