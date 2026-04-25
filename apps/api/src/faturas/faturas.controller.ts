import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FaturasService } from './faturas.service';
import { PayFaturaDto } from './dto/pay-fatura.dto';
import { UpdateFaturaCategoryDto } from './dto/update-fatura-category.dto';
import { SessionGuard } from '../auth/guards/session.guard';
import { WalletMemberGuard } from '../wallets/guards/wallet-member.guard';
import { RequireWalletRole } from '../wallets/decorators/wallet-role.decorator';

@ApiTags('faturas')
@UseGuards(SessionGuard, WalletMemberGuard)
@Controller('wallets/:walletId/cards/:cardId/faturas')
export class FaturasController {
  constructor(private readonly faturasService: FaturasService) {}

  @Get()
  @RequireWalletRole('viewer')
  @ApiOperation({ summary: 'Listar faturas do cartão' })
  @ApiQuery({ name: 'status', required: false, enum: ['open', 'closed', 'overdue', 'paid'] })
  findAll(
    @Param('walletId') walletId: string,
    @Param('cardId') cardId: string,
    @Query('status') status?: string,
  ) {
    return this.faturasService.findAll(walletId, cardId, status);
  }

  @Get(':faturaId')
  @RequireWalletRole('viewer')
  @ApiOperation({ summary: 'Buscar fatura com parcelas' })
  findOne(
    @Param('walletId') walletId: string,
    @Param('cardId') cardId: string,
    @Param('faturaId') faturaId: string,
  ) {
    return this.faturasService.findOne(walletId, cardId, faturaId);
  }

  @Post(':faturaId/pay')
  @RequireWalletRole('editor')
  @ApiOperation({ summary: 'Pagar fatura (cria transaction invoice_payment)' })
  pay(
    @Param('walletId') walletId: string,
    @Param('cardId') cardId: string,
    @Param('faturaId') faturaId: string,
    @Body() dto: PayFaturaDto,
  ) {
    return this.faturasService.pay(walletId, cardId, faturaId, dto);
  }

  @Post(':faturaId/unpay')
  @RequireWalletRole('editor')
  @ApiOperation({ summary: 'Desmarcar fatura como paga (reverte invoice_payment)' })
  unpay(
    @Param('walletId') walletId: string,
    @Param('cardId') cardId: string,
    @Param('faturaId') faturaId: string,
  ) {
    return this.faturasService.unpay(walletId, cardId, faturaId);
  }

  @Patch(':faturaId/category')
  @RequireWalletRole('editor')
  @ApiOperation({ summary: 'Atribuir ou remover categoria da fatura' })
  updateCategory(
    @Param('walletId') walletId: string,
    @Param('cardId') cardId: string,
    @Param('faturaId') faturaId: string,
    @Body() dto: UpdateFaturaCategoryDto,
  ) {
    return this.faturasService.updateCategory(walletId, cardId, faturaId, dto);
  }
}
