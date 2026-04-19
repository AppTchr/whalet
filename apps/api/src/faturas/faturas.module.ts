import { Module } from '@nestjs/common';
import { FaturasController } from './faturas.controller';
import { FaturasService } from './faturas.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletsModule } from '../wallets/wallets.module';

@Module({
  imports: [PrismaModule, WalletsModule],
  controllers: [FaturasController],
  providers: [FaturasService],
})
export class FaturasModule {}
