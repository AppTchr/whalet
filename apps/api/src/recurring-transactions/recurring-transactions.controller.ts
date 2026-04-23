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
import { RecurringTransactionsService } from './recurring-transactions.service';
import { CreateRecurringTransactionDto } from './dto/create-recurring-transaction.dto';
import { UpdateRecurringTransactionDto } from './dto/update-recurring-transaction.dto';
import {
  RecurringTransactionListResponseDto,
  RecurringTransactionResponseDto,
} from './dto/recurring-transaction-response.dto';

@ApiTags('recurring-transactions')
@ApiBearerAuth('session-token')
@UseGuards(SessionGuard, WalletMemberGuard)
@Controller('wallets/:walletId/recurring-transactions')
export class RecurringTransactionsController {
  constructor(private readonly service: RecurringTransactionsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Listar templates de transações recorrentes' })
  @ApiResponse({ status: 200, type: RecurringTransactionListResponseDto })
  async findAll(
    @Param('walletId') walletId: string,
  ): Promise<RecurringTransactionListResponseDto> {
    return this.service.findAll(walletId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Buscar template recorrente com próximas ocorrências' })
  @ApiResponse({ status: 200, type: RecurringTransactionResponseDto })
  async findOne(
    @Param('walletId') walletId: string,
    @Param('id') id: string,
  ): Promise<RecurringTransactionResponseDto> {
    return this.service.findOne(walletId, id);
  }

  @Post()
  @RequireWalletRole('editor')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Criar template recorrente + gerar ocorrências' })
  @ApiResponse({ status: 201, type: RecurringTransactionResponseDto })
  @ApiResponse({ status: 422, description: 'Regra de negócio violada.' })
  async create(
    @Param('walletId') walletId: string,
    @Body() dto: CreateRecurringTransactionDto,
  ): Promise<RecurringTransactionResponseDto> {
    return this.service.create(walletId, dto);
  }

  @Patch(':id')
  @RequireWalletRole('editor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Atualizar template e regenerar ocorrências pendentes' })
  @ApiResponse({ status: 200, type: RecurringTransactionResponseDto })
  @ApiResponse({ status: 404, description: 'Template não encontrado.' })
  @ApiResponse({ status: 422, description: 'Regra de negócio violada.' })
  async update(
    @Param('walletId') walletId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRecurringTransactionDto,
  ): Promise<RecurringTransactionResponseDto> {
    return this.service.update(walletId, id, dto);
  }

  @Delete(':id')
  @RequireWalletRole('owner')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancelar template recorrente e suas ocorrências pendentes' })
  @ApiResponse({ status: 204, description: 'Template removido.' })
  @ApiResponse({ status: 404, description: 'Template não encontrado.' })
  async remove(
    @Param('walletId') walletId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.service.softDelete(walletId, id);
  }
}
