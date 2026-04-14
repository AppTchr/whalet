import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AmqpConnectionManager,
  ChannelWrapper,
  connect,
} from 'amqp-connection-manager';
import { ConfirmChannel, ConsumeMessage } from 'amqplib';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import {
  RABBITMQ_EXCHANGE,
  RABBITMQ_QUEUE,
  RABBITMQ_ROUTING_KEY_OTP,
  RABBITMQ_DLQ,
  RABBITMQ_DLX,
  RETRY_DELAYS_MS,
  MAX_RETRY_ATTEMPTS,
} from './email.constants';
import { OtpEmailPayload } from './email.types';
import { ResendService } from './resend.service';

// FIX A5: idempotency key TTL — keep longer than max OTP TTL to prevent duplicate sends
const IDEMPOTENCY_TTL_SECONDS = 60 * 60; // 1 hour
const IDEMPOTENCY_KEY_PREFIX = 'email:sent:';

@Injectable()
export class EmailConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailConsumerService.name);
  private connection!: AmqpConnectionManager;
  private channelWrapper!: ChannelWrapper;

  constructor(
    private readonly config: ConfigService,
    private readonly resendService: ResendService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async onModuleInit() {
    const url =
      this.config.get<string>('app.rabbitmq.url') ?? 'amqp://localhost';

    // FIX C4: amqp-connection-manager handles reconnection automatically
    this.connection = connect([url], {
      reconnectTimeInSeconds: 5,
    });

    this.connection.on('connect', () =>
      this.logger.log('RabbitMQ consumer connected'),
    );
    this.connection.on('disconnect', ({ err }: { err?: Error }) =>
      this.logger.warn(
        `RabbitMQ consumer disconnected: ${err?.message ?? 'unknown'}`,
      ),
    );

    this.channelWrapper = this.connection.createChannel({
      setup: async (channel: ConfirmChannel) => {
        await channel.assertExchange(RABBITMQ_DLX, 'direct', { durable: true });
        await channel.assertQueue(RABBITMQ_DLQ, { durable: true });
        await channel.bindQueue(RABBITMQ_DLQ, RABBITMQ_DLX, RABBITMQ_DLQ);

        await channel.assertExchange(RABBITMQ_EXCHANGE, 'direct', {
          durable: true,
        });
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

        // Prefetch 1: process one message at a time
        await channel.prefetch(1);

        await channel.consume(RABBITMQ_QUEUE, (msg) => {
          if (msg) void this.handleMessage(msg);
        });
      },
    });

    await this.channelWrapper.waitForConnect();
    this.logger.log('RabbitMQ consumer channel ready');
  }

  async onModuleDestroy() {
    await this.channelWrapper?.close();
    await this.connection?.close();
  }

  private async handleMessage(msg: ConsumeMessage): Promise<void> {
    const headers = msg.properties.headers ?? {};
    const attempt: number = (headers['x-retry-attempt'] as number) ?? 0;
    const messageId: string | undefined = msg.properties.messageId;

    // FIX A5: idempotency check — skip if already sent
    if (messageId) {
      const idempotencyKey = `${IDEMPOTENCY_KEY_PREFIX}${messageId}`;
      const alreadySent = await this.redis.get(idempotencyKey);
      if (alreadySent) {
        this.logger.log(`Duplicate message skipped (messageId: ${messageId})`);
        this.channelWrapper.ack(msg);
        return;
      }
    }

    let payload: OtpEmailPayload;
    try {
      payload = JSON.parse(msg.content.toString()) as OtpEmailPayload;
    } catch {
      this.logger.error('Failed to parse email message — sending to DLQ');
      this.channelWrapper.nack(msg, false, false);
      return;
    }

    try {
      await this.resendService.sendOtpEmail(payload);

      // FIX A5: mark as sent before acking — prevents duplicate on crash between send and ack
      if (messageId) {
        const idempotencyKey = `${IDEMPOTENCY_KEY_PREFIX}${messageId}`;
        await this.redis.set(idempotencyKey, '1', 'EX', IDEMPOTENCY_TTL_SECONDS);
      }

      this.channelWrapper.ack(msg);
      this.logger.log(`OTP email sent to: ${payload.to}`);
    } catch {
      if (attempt < MAX_RETRY_ATTEMPTS - 1) {
        const delay =
          RETRY_DELAYS_MS[attempt] ??
          RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
        this.logger.warn(
          `Email send failed (attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS}). Retrying in ${delay}ms`,
        );

        this.channelWrapper.nack(msg, false, false);

        setTimeout(() => {
          void this.channelWrapper.publish(
            RABBITMQ_EXCHANGE,
            RABBITMQ_ROUTING_KEY_OTP,
            msg.content,
            {
              persistent: true,
              contentType: 'application/json',
              messageId,
              headers: { 'x-retry-attempt': attempt + 1 },
            },
          );
        }, delay);
      } else {
        this.logger.error(
          `Email send failed after ${MAX_RETRY_ATTEMPTS} attempts — moving to DLQ`,
        );
        this.channelWrapper.nack(msg, false, false);
      }
    }
  }
}
