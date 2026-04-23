import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SessionGuard } from '../auth/guards/session.guard';
import { WalletMemberGuard } from '../wallets/guards/wallet-member.guard';
import { RequireWalletRole } from '../wallets/decorators/wallet-role.decorator';
import { ActiveMember, ActiveMemberPayload } from '../wallets/decorators/active-member.decorator';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { PayTransactionDto } from './dto/pay-transaction.dto';
import { ListTransactionsDto } from './dto/list-transactions.dto';
import {
  TransactionListResponseDto,
  TransactionResponseDto,
} from './dto/transaction-response.dto';

@ApiTags('transactions')
@ApiBearerAuth('session-token')
@UseGuards(SessionGuard, WalletMemberGuard)
@Controller('wallets/:walletId/transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Listar transações da carteira' })
  @ApiResponse({ status: 200, description: 'Lista paginada de transações.', type: TransactionListResponseDto })
  @ApiResponse({ status: 401, description: 'Não autenticado.' })
  @ApiResponse({ status: 403, description: 'Sem acesso à carteira.' })
  async findAll(
    @Param('walletId') walletId: string,
    @Query() query: ListTransactionsDto,
  ): Promise<TransactionListResponseDto> {
    return this.transactionsService.findAll(walletId, query);
  }

  @Get(':transactionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Buscar transação por ID' })
  @ApiResponse({ status: 200, description: 'Transação encontrada.', type: TransactionResponseDto })
  @ApiResponse({ status: 401, description: 'Não autenticado.' })
  @ApiResponse({ status: 403, description: 'Sem acesso à carteira.' })
  @ApiResponse({ status: 404, description: 'Transação não encontrada.' })
  async findOne(
    @Param('walletId') walletId: string,
    @Param('transactionId') transactionId: string,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.findOne(walletId, transactionId);
  }

  @Post()
  @RequireWalletRole('editor')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Criar transação na carteira (editor ou owner)' })
  @ApiResponse({ status: 201, description: 'Transação criada.', type: TransactionResponseDto })
  @ApiResponse({ status: 401, description: 'Não autenticado.' })
  @ApiResponse({ status: 403, description: 'Sem permissão de editor.' })
  @ApiResponse({ status: 422, description: 'Regra de negócio violada.' })
  async create(
    @Param('walletId') walletId: string,
    @Body() dto: CreateTransactionDto,
    @ActiveMember() member: ActiveMemberPayload,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.create(walletId, dto, member.userId);
  }

  @Patch(':transactionId')
  @RequireWalletRole('editor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Atualizar transação (editor ou owner)' })
  @ApiResponse({ status: 200, description: 'Transação atualizada.', type: TransactionResponseDto })
  @ApiResponse({ status: 401, description: 'Não autenticado.' })
  @ApiResponse({ status: 403, description: 'Sem permissão de editor.' })
  @ApiResponse({ status: 404, description: 'Transação não encontrada.' })
  @ApiResponse({ status: 422, description: 'Transação cancelada não pode ser atualizada.' })
  async update(
    @Param('walletId') walletId: string,
    @Param('transactionId') transactionId: string,
    @Body() dto: UpdateTransactionDto,
    @Query('applyToFollowing') applyToFollowing?: string,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.update(
      walletId,
      transactionId,
      dto,
      applyToFollowing === 'true',
    );
  }

  @Post(':transactionId/pay')
  @RequireWalletRole('editor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar transação como paga (editor ou owner)' })
  @ApiResponse({ status: 200, description: 'Transação marcada como paga.', type: TransactionResponseDto })
  @ApiResponse({ status: 401, description: 'Não autenticado.' })
  @ApiResponse({ status: 403, description: 'Sem permissão de editor.' })
  @ApiResponse({ status: 404, description: 'Transação não encontrada.' })
  @ApiResponse({ status: 422, description: 'Transação já paga ou cancelada.' })
  async pay(
    @Param('walletId') walletId: string,
    @Param('transactionId') transactionId: string,
    @Body() dto: PayTransactionDto,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.pay(walletId, transactionId, dto);
  }

  @Post(':transactionId/cancel')
  @RequireWalletRole('editor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar transação (editor ou owner)' })
  @ApiResponse({ status: 200, description: 'Transação cancelada.', type: TransactionResponseDto })
  @ApiResponse({ status: 401, description: 'Não autenticado.' })
  @ApiResponse({ status: 403, description: 'Sem permissão de editor.' })
  @ApiResponse({ status: 404, description: 'Transação não encontrada.' })
  @ApiResponse({ status: 422, description: 'Transação já cancelada.' })
  async cancel(
    @Param('walletId') walletId: string,
    @Param('transactionId') transactionId: string,
    @Query('applyToFollowing') applyToFollowing?: string,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.cancel(
      walletId,
      transactionId,
      applyToFollowing === 'true',
    );
  }

  @Delete(':transactionId')
  @RequireWalletRole('owner')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete de transação (somente owner)' })
  @ApiResponse({ status: 204, description: 'Transação removida (soft-delete).' })
  @ApiResponse({ status: 401, description: 'Não autenticado.' })
  @ApiResponse({ status: 403, description: 'Sem permissão de owner.' })
  @ApiResponse({ status: 404, description: 'Transação não encontrada.' })
  @ApiResponse({ status: 422, description: 'Transação já removida.' })
  async softDelete(
    @Param('walletId') walletId: string,
    @Param('transactionId') transactionId: string,
  ): Promise<void> {
    return this.transactionsService.softDelete(walletId, transactionId);
  }
}
