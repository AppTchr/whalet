import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionStatus, TransactionType } from '@prisma/client';

export class TransactionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  walletId: string;

  @ApiProperty({ enum: TransactionType })
  type: TransactionType;

  @ApiProperty({ enum: TransactionStatus })
  status: TransactionStatus;

  @ApiProperty({ description: 'Valor absoluto da transação' })
  amount: number;

  @ApiProperty({ description: 'Sinal contábil: -1, 0 ou 1', enum: [-1, 0, 1] })
  sign: number;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiPropertyOptional({ nullable: true })
  notes: string | null;

  @ApiProperty()
  dueDate: Date;

  @ApiPropertyOptional({ nullable: true })
  paidAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  categoryId: string | null;

  @ApiPropertyOptional({ nullable: true })
  bankAccountId: string | null;

  @ApiPropertyOptional({ nullable: true })
  transferGroupId: string | null;

  @ApiPropertyOptional({ nullable: true })
  recurrenceId: string | null;

  @ApiPropertyOptional({ nullable: true })
  recurrenceIndex: number | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class TransactionListResponseDto {
  @ApiProperty({ type: [TransactionResponseDto] })
  transactions: TransactionResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
