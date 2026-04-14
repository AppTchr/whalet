import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WalletMemberRole, WalletMemberStatus } from '@prisma/client';

export class MemberResponseDto {
  @ApiProperty({ example: 'b1c2d3e4-f5a6-7890-bcde-f12345678901' })
  id: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  walletId: string;

  @ApiPropertyOptional({ example: 'user-uuid-here' })
  userId: string | null;

  @ApiProperty({ enum: WalletMemberRole, example: WalletMemberRole.editor })
  role: WalletMemberRole;

  // FIX H2: normalize status externally — never expose 'active' vs 'invited'
  // difference tied to whether the email is registered (user enumeration oracle)
  // external consumers see 'pending' for invited, 'active' for active members
  @ApiProperty({ enum: ['active', 'pending', 'revoked'], example: 'active' })
  status: 'active' | 'pending' | 'revoked';

  // FIX M5 + H2: invitedEmail only shown to owners (filtered in service layer)
  @ApiPropertyOptional({ example: 'colaborador@exemplo.com' })
  invitedEmail: string | null;

  @ApiPropertyOptional({ example: 'inviter-uuid-here' })
  invitedByUserId: string | null;

  @ApiPropertyOptional({ example: '2024-01-15T10:00:00.000Z' })
  invitedAt: Date | null;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z' })
  updatedAt: Date;
}

export class MemberListResponseDto {
  @ApiProperty({ type: [MemberResponseDto] })
  members: MemberResponseDto[];

  @ApiProperty({ example: 2 })
  total: number;
}
