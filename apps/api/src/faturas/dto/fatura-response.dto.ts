import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type FaturaStatus = 'open' | 'closed' | 'overdue' | 'paid';

export class FaturaInstallmentDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  purchaseId: string;

  @ApiProperty()
  purchaseDescription: string;

  @ApiProperty()
  installmentNumber: number;

  @ApiProperty()
  totalInstallments: number;

  @ApiProperty()
  amountCents: number;

  @ApiProperty()
  dueDate: Date;

  @ApiProperty({ enum: ['pending', 'paid', 'canceled'] })
  status: string;

  @ApiPropertyOptional({ nullable: true })
  categoryId: string | null;
}

export class FaturaResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  cardId: string;

  @ApiProperty()
  walletId: string;

  @ApiProperty()
  referenceMonth: string;

  @ApiProperty()
  closingDate: Date;

  @ApiProperty()
  dueDate: Date;

  @ApiProperty({ enum: ['open', 'closed', 'overdue', 'paid'] })
  status: FaturaStatus;

  @ApiProperty()
  totalCents: number;

  @ApiPropertyOptional({ nullable: true })
  paidAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  invoicePaymentTxId: string | null;

  @ApiPropertyOptional({ type: [FaturaInstallmentDto] })
  installments?: FaturaInstallmentDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class FaturaListResponseDto {
  @ApiProperty({ type: [FaturaResponseDto] })
  faturas: FaturaResponseDto[];

  @ApiProperty()
  total: number;
}

export class FaturaPayResponseDto {
  @ApiProperty()
  faturaId: string;

  @ApiProperty()
  transactionId: string;

  @ApiProperty()
  amountCents: number;

  @ApiProperty()
  bankAccountId: string;

  @ApiProperty()
  paidAt: Date;
}
