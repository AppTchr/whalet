import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecurrenceFrequency, RecurringTransactionType } from './create-recurring-transaction.dto';
import { TransactionResponseDto } from '../../transactions/dto/transaction-response.dto';

export class RecurringTransactionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  walletId: string;

  @ApiProperty({ enum: ['income', 'expense'] })
  type: RecurringTransactionType;

  @ApiProperty({ enum: RecurrenceFrequency })
  frequency: RecurrenceFrequency;

  @ApiProperty()
  description: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  startDate: Date;

  @ApiPropertyOptional({ nullable: true })
  endDate: Date | null;

  @ApiPropertyOptional({ nullable: true })
  maxOccurrences: number | null;

  @ApiPropertyOptional({ nullable: true })
  categoryId: string | null;

  @ApiPropertyOptional({ nullable: true })
  bankAccountId: string | null;

  @ApiPropertyOptional({ nullable: true })
  notes: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional({ nullable: true })
  lastGeneratedDate: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ type: [TransactionResponseDto] })
  upcomingOccurrences?: TransactionResponseDto[];
}

export class RecurringTransactionListResponseDto {
  @ApiProperty({ type: [RecurringTransactionResponseDto] })
  recurringTransactions: RecurringTransactionResponseDto[];

  @ApiProperty()
  total: number;
}
