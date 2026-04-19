import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateCardDto {
  @ApiPropertyOptional({ description: 'Nome do cartão', maxLength: 150 })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ description: 'Dia de fechamento (1-28)', minimum: 1, maximum: 28 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  closingDay?: number;

  @ApiPropertyOptional({ description: 'Dia de vencimento (1-28)', minimum: 1, maximum: 28 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  dueDay?: number;

  @ApiPropertyOptional({ description: 'Limite de crédito em centavos. Envie null para remover o limite.', nullable: true })
  @IsOptional()
  @ValidateIf((o) => o.creditLimitCents !== null)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  creditLimitCents?: number | null;

  @ApiPropertyOptional({ description: 'Arquivar/desarquivar cartão' })
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}
