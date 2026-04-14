import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },

  rabbitmq: {
    url: process.env.RABBITMQ_URL ?? 'amqp://ledger:ledger@localhost:5672',
  },

  auth: {
    sessionTtlDays: parseInt(process.env.SESSION_TTL_DAYS ?? '30', 10),
    otpTtlMinutes: parseInt(process.env.OTP_TTL_MINUTES ?? '10', 10),
    otpMaxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS ?? '3', 10),
    otpRateLimitMax: parseInt(process.env.OTP_RATE_LIMIT_MAX ?? '3', 10),
    otpRateLimitWindowMinutes: parseInt(
      process.env.OTP_RATE_LIMIT_WINDOW_MINUTES ?? '10',
      10,
    ),
  },

  email: {
    resendApiKey: process.env.RESEND_API_KEY ?? '',
    from: process.env.EMAIL_FROM ?? 'noreply@ledger.local',
  },
}));
