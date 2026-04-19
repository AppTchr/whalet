import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePurchaseDto {
  @ApiProperty({ description: 'Descrição da compra', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description: string;

  @ApiProperty({ description: 'Valor total da compra em centavos', minimum: 1, maximum: 2147483647 })
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  totalAmountCents: number;

  @ApiProperty({ description: 'Número de parcelas (1-48)', minimum: 1, maximum: 48 })
  @IsInt()
  @Min(1)
  @Max(48)
  installmentCount: number;

  @ApiProperty({ description: 'Data da compra (ISO 8601)', example: '2025-01-15' })
  @IsDateString()
  purchaseDate: string;

  @ApiPropertyOptional({ description: 'Categoria UUID', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Notas', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
