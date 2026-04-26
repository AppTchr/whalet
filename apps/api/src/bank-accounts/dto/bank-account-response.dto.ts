import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BankAccountType } from '@prisma/client';

export class BankAccountResponseDto {
  @ApiProperty({ description: 'ID da conta bancária' })
  id: string;

  @ApiProperty({ description: 'ID da carteira' })
  walletId: string;

  @ApiProperty({ description: 'Nome da conta bancária' })
  name: string;

  @ApiProperty({ description: 'Tipo da conta bancária', enum: BankAccountType })
  type: BankAccountType;

  @ApiPropertyOptional({ description: 'Nome da instituição financeira', nullable: true })
  institution: string | null;

  @ApiPropertyOptional({
    description: 'Número da conta (presente somente em findOne)',
    nullable: true,
  })
  accountNumber: string | null | undefined;

  @ApiProperty({ description: 'Indica se a conta está arquivada' })
  isArchived: boolean;

  @ApiPropertyOptional({
    description:
      'Saldo confirmado em centavos: soma de transações pagas (sign × amount) na conta. Não inclui pendentes nem credit_card_purchase.',
  })
  balanceCents?: number;

  @ApiProperty({ description: 'Data de criação' })
  createdAt: Date;

  @ApiProperty({ description: 'Data de atualização' })
  updatedAt: Date;
}

export class BankAccountListResponseDto {
  @ApiProperty({ type: [BankAccountResponseDto] })
  bankAccounts: BankAccountResponseDto[];

  @ApiProperty({ description: 'Total de contas retornadas' })
  total: number;
}
