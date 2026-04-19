import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InstallmentSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  installmentNumber: number;

  @ApiProperty()
  amountCents: number;

  @ApiProperty()
  faturaId: string;

  @ApiProperty()
  faturaClosingDate: Date;

  @ApiProperty()
  dueDate: Date;

  @ApiProperty({ enum: ['pending', 'paid', 'canceled'] })
  status: string;
}

export class PurchaseResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  cardId: string;

  @ApiProperty()
  walletId: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  totalAmountCents: number;

  @ApiProperty()
  installmentCount: number;

  @ApiProperty()
  purchaseDate: Date;

  @ApiPropertyOptional({ nullable: true })
  categoryId: string | null;

  @ApiPropertyOptional({ nullable: true })
  notes: string | null;

  @ApiProperty({ enum: ['active', 'canceled'] })
  status: string;

  @ApiPropertyOptional({ nullable: true })
  canceledAt: Date | null;

  @ApiProperty({ type: [InstallmentSummaryDto] })
  installments: InstallmentSummaryDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PurchaseListResponseDto {
  @ApiProperty({ type: [PurchaseResponseDto] })
  purchases: PurchaseResponseDto[];

  @ApiProperty()
  total: number;
}
