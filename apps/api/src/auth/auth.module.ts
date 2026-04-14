import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionGuard } from './guards/session.guard';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  controllers: [AuthController],
  providers: [AuthService, SessionGuard],
  exports: [AuthService, SessionGuard],
})
export class AuthModule {}
