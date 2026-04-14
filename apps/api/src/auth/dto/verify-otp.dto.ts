import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({
    example: 'usuario@exemplo.com',
    description: 'Email do usuário.',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: '482931',
    description: 'Código OTP de 6 dígitos recebido por email.',
    minLength: 6,
    maxLength: 6,
    pattern: '^\\d{6}$',
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'token must be exactly 6 digits' })
  token: string;
}
