import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CardResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  walletId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  closingDay: number;

  @ApiProperty()
  dueDay: number;

  @ApiPropertyOptional({ nullable: true })
  creditLimitCents: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'null quando não há limite definido' })
  availableCreditCents: number | null;

  @ApiProperty()
  isArchived: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class CardListResponseDto {
  @ApiProperty({ type: [CardResponseDto] })
  cards: CardResponseDto[];

  @ApiProperty()
  total: number;
}
