import { IsUUID, IsOptional, IsInt, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDependencyDto {
  @ApiProperty({ description: 'ID da atividade predecessora' })
  @IsUUID()
  predecessorId: string;

  @ApiPropertyOptional({ description: 'Dias de folga (lag)', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  lagDays?: number;

  @ApiPropertyOptional({
    description: 'Tipo: FS (Term-Início), SS (Início-Início), FF (Term-Term), SF (Início-Term)',
    default: 'FS',
    enum: ['FS', 'SS', 'FF', 'SF'],
  })
  @IsOptional()
  @IsString()
  type?: string;
}
