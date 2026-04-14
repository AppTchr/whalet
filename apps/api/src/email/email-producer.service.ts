import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AmqpConnectionManager,
  ChannelWrapper,
  connect,
} from 'amqp-connection-manager';
import { ConfirmChannel } from 'amqplib';
import { v4 as uuidv4 } from 'uuid';
import {
  RABBITMQ_EXCHANGE,
  RABBITMQ_QUEUE,
  RABBITMQ_ROUTING_KEY_OTP,
  RABBITMQ_DLQ,
  RABBITMQ_DLX,
} from './email.constants';
import { OtpEmailPayload } from './email.types';

@Injectable()
export class EmailProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailProducerService.name);
  private connection!: AmqpConnectionManager;
  private channelWrapper!: ChannelWrapper;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const url =
      this.config.get<string>('app.rabbitmq.url') ?? 'amqp://localhost';

    // FIX C4: amqp-connection-manager handles reconnection automatically
    this.connection = connect([url], {
      reconnectTimeInSeconds: 5,
    });

    this.connection.on('connect', () =>
      this.logger.log('RabbitMQ producer connected'),
    );
    this.connection.on('disconnect', ({ err }: { err?: Error }) =>
      this.logger.warn(`RabbitMQ producer disconnected: ${err?.message ?? 'unknown'}`),
    );

    // FIX C5: confirm: true enables publisher confirms — publish() returns Promise
    this.channelWrapper = this.connection.createChannel({
      confirm: true,
      setup: async (channel: ConfirmChannel) => {
        await channel.assertExchange(RABBITMQ_DLX, 'direct', { durable: true });
        await channel.assertQueue(RABBITMQ_DLQ, { durable: true });
        await channel.bindQueue(RABBITMQ_DLQ, RABBITMQ_DLX, RABBITMQ_DLQ);

        await channel.assertExchange(RABBITMQ_EXCHANGE, 'direct', { durable: true });
        await channel.assertQueue(RABBITMQ_QUEUE, {
          durable: true,
          arguments: {
            'x-dead-letter-exchange': RABBITMQ_DLX,
            'x-dead-letter-routing-key': RABBITMQ_DLQ,
          },
        });
        await channel.bindQueue(
          RABBITMQ_QUEUE,
          RABBITMQ_EXCHANGE,
          RABBITMQ_ROUTING_KEY_OTP,
        );
      },
    });

    await this.channelWrapper.waitForConnect();
    this.logger.log('RabbitMQ producer channel ready');
  }

  async onModuleDestroy() {
    await this.channelWrapper?.close();
    await this.connection?.close();
  }

  async publishOtpEmail(
    payload: OtpEmailPayload,
    otpTtlMinutes = 10,
  ): Promise<void> {
    const ttlMs = otpTtlMinutes * 60 * 1000;

    // FIX C5: await publish() — rejects if broker did not confirm
    // FIX A4: expiration = OTP TTL — broker discards stale messages automatically
    // A5: messageId enables consumer-side idempotency
    await this.channelWrapper.publish(
      RABBITMQ_EXCHANGE,
      RABBITMQ_ROUTING_KEY_OTP,
      Buffer.from(JSON.stringify(payload)),
      {
        persistent: true,
        contentType: 'application/json',
        expiration: String(ttlMs),
        messageId: uuidv4(),
      },
    );

    // OTP value never logged — only recipient
    this.logger.log(`OTP email queued for: ${payload.to}`);
  }
}
