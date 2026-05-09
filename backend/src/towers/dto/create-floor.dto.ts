import { IsString, IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFloorDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsInt() level: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) order?: number;
}
