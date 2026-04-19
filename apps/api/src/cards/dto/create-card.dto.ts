import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCardDto {
  @ApiProperty({ description: 'Nome do cartão', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiProperty({ description: 'Dia de fechamento da fatura (1-28)', minimum: 1, maximum: 28 })
  @IsInt()
  @Min(1)
  @Max(28)
  closingDay: number;

  @ApiProperty({ description: 'Dia de vencimento da fatura (1-28)', minimum: 1, maximum: 28 })
  @IsInt()
  @Min(1)
  @Max(28)
  dueDay: number;

  @ApiPropertyOptional({ description: 'Limite de crédito em centavos', nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  creditLimitCents?: number;
}
