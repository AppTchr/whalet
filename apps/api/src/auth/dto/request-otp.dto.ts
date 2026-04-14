import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestOtpDto {
  @ApiProperty({
    example: 'usuario@exemplo.com',
    description: 'Email do usuário. Uma conta é criada automaticamente se não existir.',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
