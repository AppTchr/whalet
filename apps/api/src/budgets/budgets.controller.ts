import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from '../auth/guards/session.guard';
import { WalletMemberGuard } from '../wallets/guards/wallet-member.guard';
import { RequireWalletRole } from '../wallets/decorators/wallet-role.decorator';
import { BudgetsService } from './budgets.service';
import { UpsertBudgetDto } from './dto/upsert-budget.dto';

@Controller('wallets/:walletId/budgets')
@UseGuards(SessionGuard, WalletMemberGuard)
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  findAll(@Param('walletId', ParseUUIDPipe) walletId: string) {
    return this.budgetsService.findAll(walletId);
  }

  @Put(':categoryId')
  @RequireWalletRole('editor')
  upsert(
    @Param('walletId', ParseUUIDPipe) walletId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() dto: UpsertBudgetDto,
  ) {
    return this.budgetsService.upsert(walletId, categoryId, dto);
  }

  @Delete(':categoryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireWalletRole('editor')
  delete(
    @Param('walletId', ParseUUIDPipe) walletId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.budgetsService.delete(walletId, categoryId);
  }
}
