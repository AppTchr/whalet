import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { OtpEmailPayload } from './email.types';

@Injectable()
export class ResendService {
  private readonly logger = new Logger(ResendService.name);
  private readonly resend: Resend;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('app.email.resendApiKey');
    this.from = this.config.get<string>('app.email.from') ?? 'noreply@ledger.local';
    this.resend = new Resend(apiKey);
  }

  async sendOtpEmail(payload: OtpEmailPayload): Promise<void> {
    // OTP is never logged — only recipient and TTL
    this.logger.log(
      `Sending OTP email to ${payload.to} (expires in ${payload.expiresInMinutes}min)`,
    );

    await this.resend.emails.send({
      from: this.from,
      to: payload.to,
      subject: 'Your Ledger login code',
      html: this.buildOtpEmailHtml(payload),
    });
  }

  private buildOtpEmailHtml(payload: OtpEmailPayload): string {
    return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Your Ledger login code</title>
  </head>
  <body style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
    <h2 style="color: #1a1a1a;">Your login code</h2>
    <p style="color: #444; font-size: 16px;">
      Use the code below to sign in to Ledger.
      This code expires in <strong>${payload.expiresInMinutes} minutes</strong>.
    </p>
    <div style="
      background: #f5f5f5;
      border-radius: 8px;
      padding: 24px;
      text-align: center;
      margin: 24px 0;
    ">
      <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1a1a1a;">
        ${payload.otp}
      </span>
    </div>
    <p style="color: #888; font-size: 14px;">
      If you did not request this code, you can safely ignore this email.
    </p>
  </body>
</html>
    `.trim();
  }
}
