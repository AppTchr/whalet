import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailProducerService } from './email-producer.service';
import { EmailConsumerService } from './email-consumer.service';
import { ResendService } from './resend.service';

@Module({
  imports: [ConfigModule],
  providers: [EmailProducerService, EmailConsumerService, ResendService],
  exports: [EmailProducerService],
})
export class EmailModule {}
