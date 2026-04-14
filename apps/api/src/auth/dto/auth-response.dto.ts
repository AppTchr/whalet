import { ApiProperty } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'usuario@exemplo.com' })
  email: string;

  @ApiProperty({ example: 'active', enum: ['active', 'inactive', 'blocked'] })
  status: string;

  @ApiProperty({ example: '2026-04-14T00:00:00.000Z', nullable: true })
  lastLoginAt: Date | null;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  createdAt: Date;
}

class SessionUserDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'usuario@exemplo.com' })
  email: string;

  @ApiProperty({ example: 'active', enum: ['active', 'inactive', 'blocked'] })
  status: string;
}

export class SessionResponseDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description:
      'Session token. Envie no header Authorization: Bearer <sessionToken> em todas as requisições autenticadas.',
  })
  sessionToken: string;

  @ApiProperty({ example: '2026-05-14T00:00:00.000Z' })
  expiresAt: Date;

  @ApiProperty({ type: SessionUserDto })
  user: SessionUserDto;
}
