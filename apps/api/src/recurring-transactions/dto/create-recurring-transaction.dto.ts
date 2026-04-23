import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
export type RecurringTransactionType = 'income' | 'expense';

export enum RecurrenceFrequency {
  daily    = 'daily',
  weekly   = 'weekly',
  biweekly = 'biweekly',
  monthly  = 'monthly',
}

export class CreateRecurringTransactionDto {
  @ApiProperty({ enum: ['income', 'expense'], description: 'Tipo da transação recorrente' })
  @IsEnum(['income', 'expense'] as const, { message: 'type must be income or expense' })
  type: RecurringTransactionType;

  @ApiProperty({ enum: RecurrenceFrequency, description: 'Frequência da recorrência' })
  @IsEnum(RecurrenceFrequency)
  frequency: RecurrenceFrequency;

  @ApiProperty({ description: 'Descrição', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description: string;

  @ApiProperty({ description: 'Valor por ocorrência (positivo)', example: 1200.00 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999999999.99)
  @Type(() => Number)
  amount: number;

  @ApiProperty({ description: 'Data de início das ocorrências (ISO 8601)', example: '2026-05-01' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ description: 'Data de término (opcional, ISO 8601)', example: '2027-04-30' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Número máximo de ocorrências (opcional)', minimum: 1, maximum: 60 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  @Type(() => Number)
  maxOccurrences?: number;

  @ApiPropertyOptional({ description: 'UUID da categoria', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'UUID da conta bancária', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  bankAccountId?: string;

  @ApiPropertyOptional({ description: 'Notas adicionais', maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
