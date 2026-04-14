import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { SessionResponseDto, AuthUserDto } from './dto/auth-response.dto';
import { SessionGuard, AuthenticatedRequest } from './guards/session.guard';
import { SESSION_BEARER_PREFIX } from './auth.constants';
import { Request } from 'express';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Solicitar código OTP',
    description:
      'Envia um código OTP de 6 dígitos para o email informado. ' +
      'Se o email não existir, uma conta é criada automaticamente. ' +
      'A resposta é sempre a mesma independente do email existir (anti-enumeração).',
  })
  @ApiBody({ type: RequestOtpDto })
  @ApiResponse({
    status: 200,
    description: 'OTP enfileirado para envio por email.',
    schema: { example: { message: 'If this email is valid, a code will be sent.' } },
  })
  @ApiResponse({ status: 403, description: 'Conta bloqueada ou rate limit atingido.' })
  async requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validar OTP e iniciar sessão',
    description:
      'Valida o código OTP recebido por email. ' +
      'Em caso de sucesso, retorna um session token válido por 30 dias. ' +
      'O OTP expira em 10 minutos e só pode ser usado uma vez.',
  })
  @ApiBody({ type: VerifyOtpDto })
  @ApiResponse({
    status: 200,
    description: 'OTP válido. Sessão criada.',
    type: SessionResponseDto,
  })
  @ApiResponse({ status: 401, description: 'OTP inválido, expirado ou esgotado.' })
  @ApiResponse({ status: 403, description: 'Conta bloqueada.' })
  async verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: Request) {
    // FIX A2: capture IP and User-Agent for session audit trail
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress ??
      undefined;
    const userAgent = req.headers['user-agent'] ?? undefined;

    return this.authService.verifyOtp(dto, { ip, userAgent });
  }

  @Get('me')
  @UseGuards(SessionGuard)
  @ApiBearerAuth('session-token')
  @ApiOperation({
    summary: 'Dados do usuário autenticado',
    description: 'Retorna os dados do usuário dono da sessão ativa.',
  })
  @ApiResponse({ status: 200, description: 'Usuário autenticado.', type: AuthUserDto })
  @ApiResponse({ status: 401, description: 'Session token ausente, inválido ou expirado.' })
  async me(@Req() req: AuthenticatedRequest) {
    return this.authService.getMe(req.userId);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard)
  @ApiBearerAuth('session-token')
  @ApiOperation({
    summary: 'Encerrar sessão',
    description: 'Invalida o session token imediatamente.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sessão encerrada.',
    schema: { example: { message: 'Logged out successfully.' } },
  })
  @ApiResponse({ status: 401, description: 'Session token ausente ou inválido.' })
  async logout(@Req() req: AuthenticatedRequest) {
    const authHeader = req.headers['authorization'] ?? '';
    const rawToken = authHeader.startsWith(SESSION_BEARER_PREFIX)
      ? authHeader.slice(SESSION_BEARER_PREFIX.length).trim()
      : '';

    // FIX A3: scope logout to the authenticated user's session only
    return this.authService.logout(rawToken, req.userId);
  }
}
