import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomInt } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { EmailProducerService } from '../email/email-producer.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { OTP_RATE_LIMIT_PREFIX } from './auth.constants';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { SessionResponseDto, AuthUserDto } from './dto/auth-response.dto';

// Lua script: INCR + EXPIRE only on first request (atomic — no race condition)
const RATE_LIMIT_LUA = `
  local current = redis.call('INCR', KEYS[1])
  if current == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return current
`;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailProducer: EmailProducerService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private generateOtp(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  private sessionTtlMs(): number {
    const days = this.config.get<number>('app.auth.sessionTtlDays') ?? 30;
    return days * 24 * 60 * 60 * 1000;
  }

  private otpTtlMinutes(): number {
    return this.config.get<number>('app.auth.otpTtlMinutes') ?? 10;
  }

  private otpTtlMs(): number {
    return this.otpTtlMinutes() * 60 * 1000;
  }

  private otpMaxAttempts(): number {
    return this.config.get<number>('app.auth.otpMaxAttempts') ?? 3;
  }

  private rateLimitMax(): number {
    return this.config.get<number>('app.auth.otpRateLimitMax') ?? 3;
  }

  private rateLimitWindowSeconds(): number {
    const minutes =
      this.config.get<number>('app.auth.otpRateLimitWindowMinutes') ?? 10;
    return minutes * 60;
  }

  // FIX C2: email hashed in Redis key — PII never stored in plain text
  private getRateLimitKey(email: string): string {
    return `${OTP_RATE_LIMIT_PREFIX}${this.sha256(email)}`;
  }

  // ---------------------------------------------------------------------------
  // Rate limiting (Redis — atomic Lua script)
  // FIX C1: single round-trip, no INCR+EXPIRE race condition
  // ---------------------------------------------------------------------------

  private async checkAndIncrementRateLimit(email: string): Promise<void> {
    const key = this.getRateLimitKey(email);
    const max = this.rateLimitMax();
    const windowSeconds = this.rateLimitWindowSeconds();

    const current = (await this.redis.eval(
      RATE_LIMIT_LUA,
      1,
      key,
      String(windowSeconds),
    )) as number;

    if (current > max) {
      this.logger.warn('OTP rate limit exceeded');
      throw new ForbiddenException(
        'Too many OTP requests. Please wait before requesting a new code.',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // POST /auth/request-otp
  // ---------------------------------------------------------------------------

  async requestOtp(dto: RequestOtpDto): Promise<{ message: string }> {
    const email = dto.email.toLowerCase().trim();

    // 1. Rate limit check (atomic, email hashed in key)
    await this.checkAndIncrementRateLimit(email);

    // 2. Upsert user (create if not exists)
    const user = await this.prisma.user.upsert({
      where: { email },
      create: { email, status: 'active' },
      update: {},
    });

    if (user.status === 'blocked') {
      throw new ForbiddenException('Account is blocked.');
    }

    // FIX C3: invalidate any previous active OTPs for this email
    await this.prisma.userOtp.updateMany({
      where: {
        email,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });

    // 3. Generate OTP and store hash
    const otp = this.generateOtp();
    const tokenHash = this.sha256(otp);
    const expiresAt = new Date(Date.now() + this.otpTtlMs());

    await this.prisma.userOtp.create({
      data: {
        userId: user.id,
        email,
        tokenHash,
        expiresAt,
      },
    });

    // 4. Enqueue OTP email — OTP value never logged
    await this.emailProducer.publishOtpEmail({
      to: email,
      otp,
      expiresInMinutes: this.otpTtlMinutes(),
    });

    return { message: 'If this email is valid, a code will be sent.' };
  }

  // ---------------------------------------------------------------------------
  // POST /auth/verify-otp
  // ---------------------------------------------------------------------------

  async verifyOtp(
    dto: VerifyOtpDto,
    meta: { ip?: string; userAgent?: string } = {},
  ): Promise<SessionResponseDto> {
    const email = dto.email.toLowerCase().trim();
    const tokenHash = this.sha256(dto.token);

    // 1. Find most recent unused, non-expired OTP for this email+hash
    const otpRecord = await this.prisma.userOtp.findFirst({
      where: {
        email,
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      // Track failed attempt on any active OTP for this email
      await this.prisma.userOtp.updateMany({
        where: {
          email,
          usedAt: null,
          expiresAt: { gt: new Date() },
          attempts: { lt: this.otpMaxAttempts() },
        },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Invalid or expired code.');
    }

    // 2. Check attempt limit before consuming the token
    if (otpRecord.attempts >= this.otpMaxAttempts()) {
      throw new UnauthorizedException('Code has exceeded maximum attempts.');
    }

    // 3. Mark token as used
    await this.prisma.userOtp.update({
      where: { id: otpRecord.id },
      data: { usedAt: new Date(), attempts: { increment: 1 } },
    });

    // 4. Load and validate user
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: otpRecord.userId! },
    });

    if (user.status === 'blocked') {
      throw new ForbiddenException('Account is blocked.');
    }

    // 5. Create session — store SHA-256 hash, return raw UUID
    const rawToken = uuidv4();
    const sessionHash = this.sha256(rawToken);
    const expiresAt = new Date(Date.now() + this.sessionTtlMs());

    // FIX A2: persist IP and User-Agent for audit trail
    await this.prisma.authSession.create({
      data: {
        userId: user.id,
        tokenHash: sessionHash,
        expiresAt,
        lastSeenAt: new Date(),
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
      },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Session token never logged
    return {
      sessionToken: rawToken,
      expiresAt,
      user: { id: user.id, email: user.email, status: user.status },
    };
  }

  // ---------------------------------------------------------------------------
  // GET /auth/me
  // ---------------------------------------------------------------------------

  async getMe(userId: string): Promise<AuthUserDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    return {
      id: user.id,
      email: user.email,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }

  // ---------------------------------------------------------------------------
  // POST /auth/logout
  // ---------------------------------------------------------------------------

  async logout(
    rawToken: string,
    userId: string,
  ): Promise<{ message: string }> {
    const tokenHash = this.sha256(rawToken);

    // FIX A3: scope delete to the authenticated user — prevents deleting other sessions
    await this.prisma.authSession.deleteMany({
      where: { tokenHash, userId },
    });

    return { message: 'Logged out successfully.' };
  }

  // ---------------------------------------------------------------------------
  // Session validation (used by SessionGuard)
  // FIX S1: sliding window — renew expiresAt on each valid request
  // ---------------------------------------------------------------------------

  async validateSession(
    rawToken: string,
  ): Promise<{ userId: string } | null> {
    const tokenHash = this.sha256(rawToken);

    const session = await this.prisma.authSession.findFirst({
      where: { tokenHash, expiresAt: { gt: new Date() } },
    });

    if (!session) return null;

    // Slide the expiry window — "30 days of inactivity" semantics
    const newExpiresAt = new Date(Date.now() + this.sessionTtlMs());

    this.prisma.authSession
      .update({
        where: { id: session.id },
        data: { lastSeenAt: new Date(), expiresAt: newExpiresAt },
      })
      .catch(() => {
        // Non-critical — do not throw
      });

    return { userId: session.userId };
  }
}
