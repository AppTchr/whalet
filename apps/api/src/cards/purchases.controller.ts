import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { SessionGuard } from '../auth/guards/session.guard';
import { WalletMemberGuard } from '../wallets/guards/wallet-member.guard';
import { RequireWalletRole } from '../wallets/decorators/wallet-role.decorator';

@ApiTags('purchases')
@UseGuards(SessionGuard, WalletMemberGuard)
@Controller('wallets/:walletId/cards/:cardId/purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Get()
  @RequireWalletRole('viewer')
  @ApiOperation({ summary: 'Listar compras do cartão' })
  @ApiQuery({ name: 'faturaId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'canceled'] })
  findAll(
    @Param('walletId') walletId: string,
    @Param('cardId') cardId: string,
    @Query('faturaId') faturaId?: string,
    @Query('status') status?: string,
  ) {
    return this.purchasesService.findAll(walletId, cardId, faturaId, status);
  }

  @Get(':purchaseId')
  @RequireWalletRole('viewer')
  @ApiOperation({ summary: 'Buscar compra por ID' })
  findOne(
    @Param('walletId') walletId: string,
    @Param('cardId') cardId: string,
    @Param('purchaseId') purchaseId: string,
  ) {
    return this.purchasesService.findOne(walletId, cardId, purchaseId);
  }

  @Post()
  @RequireWalletRole('editor')
  @ApiOperation({ summary: 'Registrar compra no cartão com parcelamento' })
  create(
    @Param('walletId') walletId: string,
    @Param('cardId') cardId: string,
    @Body() dto: CreatePurchaseDto,
  ) {
    return this.purchasesService.create(walletId, cardId, dto);
  }

  @Delete(':purchaseId')
  @RequireWalletRole('editor')
  @ApiOperation({ summary: 'Cancelar compra (se não houver parcelas em fatura paga)' })
  cancel(
    @Param('walletId') walletId: string,
    @Param('cardId') cardId: string,
    @Param('purchaseId') purchaseId: string,
  ) {
    return this.purchasesService.cancel(walletId, cardId, purchaseId);
  }
}
