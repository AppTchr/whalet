import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { EmailModule } from './email/email.module';
import { WalletsModule } from './wallets/wallets.module';
import { BalanceModule } from './balance/balance.module';
import { CategoriesModule } from './categories/categories.module';
import { BankAccountsModule } from './bank-accounts/bank-accounts.module';
import { TransactionsModule } from './transactions/transactions.module';
import { RecurringTransactionsModule } from './recurring-transactions/recurring-transactions.module';
import { CardsModule } from './cards/cards.module';
import { FaturasModule } from './faturas/faturas.module';
import { BudgetsModule } from './budgets/budgets.module';
import appConfig from './config/app.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      // Local dev: .env at monorepo root. Production (EasyPanel): env vars injected, file not needed
      envFilePath: ['../../.env', '../../.env.local'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),
    EventEmitterModule.forRoot(),
    PrismaModule,
    RedisModule,
    EmailModule,
    AuthModule,
    WalletsModule,
    BalanceModule,
    CategoriesModule,
    BankAccountsModule,
    TransactionsModule,
    RecurringTransactionsModule,
    CardsModule,
    FaturasModule,
    BudgetsModule,
  ],
})
export class AppModule {}
