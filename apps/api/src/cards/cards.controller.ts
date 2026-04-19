import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CardsService } from './cards.service';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { SessionGuard } from '../auth/guards/session.guard';
import { WalletMemberGuard } from '../wallets/guards/wallet-member.guard';
import { RequireWalletRole } from '../wallets/decorators/wallet-role.decorator';

@ApiTags('cards')
@UseGuards(SessionGuard, WalletMemberGuard)
@Controller('wallets/:walletId/cards')
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Get()
  @RequireWalletRole('viewer')
  @ApiOperation({ summary: 'Listar cartões da carteira' })
  @ApiQuery({ name: 'includeArchived', required: false, type: Boolean })
  findAll(
    @Param('walletId') walletId: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.cardsService.findAll(walletId, includeArchived === 'true');
  }

  @Get(':cardId')
  @RequireWalletRole('viewer')
  @ApiOperation({ summary: 'Buscar cartão por ID' })
  findOne(
    @Param('walletId') walletId: string,
    @Param('cardId') cardId: string,
  ) {
    return this.cardsService.findOne(walletId, cardId);
  }

  @Post()
  @RequireWalletRole('editor')
  @ApiOperation({ summary: 'Criar cartão de crédito' })
  create(
    @Param('walletId') walletId: string,
    @Body() dto: CreateCardDto,
  ) {
    return this.cardsService.create(walletId, dto);
  }

  @Patch(':cardId')
  @RequireWalletRole('editor')
  @ApiOperation({ summary: 'Atualizar cartão' })
  update(
    @Param('walletId') walletId: string,
    @Param('cardId') cardId: string,
    @Body() dto: UpdateCardDto,
  ) {
    return this.cardsService.update(walletId, cardId, dto);
  }

  @Delete(':cardId')
  @RequireWalletRole('owner')
  @ApiOperation({ summary: 'Arquivar cartão' })
  archive(
    @Param('walletId') walletId: string,
    @Param('cardId') cardId: string,
  ) {
    return this.cardsService.archive(walletId, cardId);
  }
}
