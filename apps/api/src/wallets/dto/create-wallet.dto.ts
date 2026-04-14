import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  IsNumber,
  Min,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WalletType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateWalletDto {
  @ApiProperty({
    description: 'Nome da carteira',
    example: 'Carteira Pessoal',
    maxLength: 150,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiProperty({
    description: 'Tipo da carteira',
    enum: WalletType,
    example: WalletType.personal,
  })
  @IsEnum(WalletType)
  type: WalletType;

  @ApiPropertyOptional({
    description: 'Código da moeda (ISO 4217)',
    example: 'BRL',
    default: 'BRL',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  // FIX H4: enforce ISO 4217 format — 3 to 10 uppercase letters only
  @Matches(/^[A-Z]{3,10}$/, { message: 'currencyCode must be 3–10 uppercase letters (e.g. BRL, USD)' })
  currencyCode?: string;

  @ApiPropertyOptional({
    description: 'Saldo inicial da carteira',
    example: 1000.0,
    default: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  initialBalance?: number;

  @ApiPropertyOptional({
    description: 'Descrição opcional da carteira',
    example: 'Carteira para despesas pessoais do dia a dia',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
