import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BatchChangeDto {
  @ApiProperty({ description: 'ID do item de cronograma (folha)' })
  @IsUUID()
  id: string;

  @ApiProperty({ description: 'Nova data de início (ISO)' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'Nova data de término (ISO)' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ description: 'Nova duração em dias', minimum: 1 })
  @IsInt()
  @Min(1)
  durationDays: number;
}

export class BatchUpdateDto {
  @ApiPropertyOptional({ description: 'Descrição da reprogramação' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: [BatchChangeDto], description: 'Alterações a aplicar atomicamente' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BatchChangeDto)
  changes: BatchChangeDto[];
}
