import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateRestrictionTypeDto {
  @ApiProperty({ description: 'Nome do tipo de restrição', example: 'Material' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Ordem de exibição' })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class UpdateRestrictionTypeDto extends PartialType(CreateRestrictionTypeDto) {
  @ApiPropertyOptional({ description: 'Ativo/inativo' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
