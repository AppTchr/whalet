import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { WalletsModule } from '../wallets/wallets.module';
import { CategoriesModule } from '../categories/categories.module';
import { BankAccountsModule } from '../bank-accounts/bank-accounts.module';
import { TransactionsController } from './transactions.controller';
import { TransactionsService, RECURRING_SERVICE_TOKEN } from './transactions.service';
import { RecurringTransactionsModule } from '../recurring-transactions/recurring-transactions.module';
import { RecurringTransactionsService } from '../recurring-transactions/recurring-transactions.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    WalletsModule,
    CategoriesModule,
    BankAccountsModule,
    forwardRef(() => RecurringTransactionsModule),
  ],
  controllers: [TransactionsController],
  providers: [
    TransactionsService,
    {
      provide: RECURRING_SERVICE_TOKEN,
      useExisting: RecurringTransactionsService,
    },
  ],
  exports: [TransactionsService],
})
export class TransactionsModule {}
