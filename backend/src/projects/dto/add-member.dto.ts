import { IsUUID, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class AddMemberDto {
  @ApiProperty() @IsUUID() userId: string;
  @ApiProperty({ enum: UserRole }) @IsEnum(UserRole) role: UserRole;
}
