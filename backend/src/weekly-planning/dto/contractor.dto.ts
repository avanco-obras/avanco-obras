import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateContractorDto {
  @ApiProperty({ description: 'Nome da empreiteira', example: 'Construtora Alfa' })
  @IsString()
  @MaxLength(150)
  name: string;
}

export class UpdateContractorDto extends PartialType(CreateContractorDto) {
  @ApiPropertyOptional({ description: 'Ativa/inativa' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
