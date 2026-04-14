import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SessionGuard, AuthenticatedRequest } from '../auth/guards/session.guard';
import { WalletMemberGuard } from './guards/wallet-member.guard';
import { RequireWalletRole } from './decorators/wallet-role.decorator';
import { ActiveMember, ActiveMemberPayload } from './decorators/active-member.decorator';
import { WalletsService } from './wallets.service';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { UpdateWalletDto } from './dto/update-wallet.dto';
import { ArchiveWalletDto } from './dto/archive-wallet.dto';
import {
  WalletDetailDto,
  WalletListResponseDto,
  ArchiveWalletResponseDto,
} from './dto/wallet-response.dto';

@ApiTags('wallets')
@ApiBearerAuth('session-token')
@UseGuards(SessionGuard)
@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Criar nova carteira' })
  @ApiResponse({ status: 201, description: 'Carteira criada.', type: WalletDetailDto })
  @ApiResponse({ status: 401, description: 'Não autenticado.' })
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateWalletDto,
  ): Promise<WalletDetailDto> {
    return this.walletsService.create(req.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar carteiras do usuário autenticado' })
  @ApiQuery({
    name: 'includeArchived',
    required: false,
    type: Boolean,
    description: 'Incluir carteiras arquivadas (default: false)',
  })
  @ApiResponse({ status: 200, description: 'Lista de carteiras.', type: WalletListResponseDto })
  @ApiResponse({ status: 401, description: 'Não autenticado.' })
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query('includeArchived') includeArchived?: string,
  ): Promise<WalletListResponseDto> {
    const include = includeArchived === 'true';
    return this.walletsService.findAll(req.userId, include);
  }

  @Get(':walletId')
  @UseGuards(WalletMemberGuard)
  @ApiOperation({ summary: 'Obter detalhes de uma carteira' })
  @ApiResponse({ status: 200, description: 'Detalhes da carteira.', type: WalletDetailDto })
  @ApiResponse({ status: 401, description: 'Não autenticado.' })
  @ApiResponse({ status: 403, description: 'Sem acesso à carteira.' })
  @ApiResponse({ status: 404, description: 'Carteira não encontrada.' })
  async findOne(
    @Param('walletId') walletId: string,
    @ActiveMember() member: ActiveMemberPayload,
  ): Promise<WalletDetailDto> {
    return this.walletsService.findOne(walletId, member.role);
  }

  @Patch(':walletId')
  @UseGuards(WalletMemberGuard)
  @RequireWalletRole('owner')
  @ApiOperation({ summary: 'Atualizar carteira (somente owner)' })
  @ApiResponse({ status: 200, description: 'Carteira atualizada.', type: WalletDetailDto })
  @ApiResponse({ status: 401, description: 'Não autenticado.' })
  @ApiResponse({ status: 403, description: 'Sem permissão de owner.' })
  @ApiResponse({ status: 404, description: 'Carteira não encontrada.' })
  async update(
    @Param('walletId') walletId: string,
    @ActiveMember() member: ActiveMemberPayload,
    @Body() dto: UpdateWalletDto,
  ): Promise<WalletDetailDto> {
    // FIX H3: pass actual caller role instead of hardcoding 'owner'
    return this.walletsService.update(walletId, dto, member.role);
  }

  @Post(':walletId/archive')
  @UseGuards(WalletMemberGuard)
  @RequireWalletRole('owner')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Arquivar carteira (somente owner, requer confirm: true)' })
  @ApiResponse({ status: 200, description: 'Carteira arquivada.', type: ArchiveWalletResponseDto })
  @ApiResponse({ status: 400, description: 'Confirmação não fornecida.' })
  @ApiResponse({ status: 401, description: 'Não autenticado.' })
  @ApiResponse({ status: 403, description: 'Sem permissão de owner.' })
  async archive(
    @Param('walletId') walletId: string,
    @Body() dto: ArchiveWalletDto,
  ): Promise<ArchiveWalletResponseDto> {
    return this.walletsService.archive(walletId, dto.confirm);
  }

  @Post(':walletId/unarchive')
  @UseGuards(WalletMemberGuard)
  @RequireWalletRole('owner')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desarquivar carteira (somente owner)' })
  @ApiResponse({ status: 200, description: 'Carteira desarquivada.', type: ArchiveWalletResponseDto })
  @ApiResponse({ status: 401, description: 'Não autenticado.' })
  @ApiResponse({ status: 403, description: 'Sem permissão de owner.' })
  async unarchive(
    @Param('walletId') walletId: string,
  ): Promise<ArchiveWalletResponseDto> {
    return this.walletsService.unarchive(walletId);
  }
}
