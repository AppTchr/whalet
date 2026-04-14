export interface OtpEmailPayload {
  to: string;
  otp: string;
  expiresInMinutes: number;
}

export interface EmailMessage<T = unknown> {
  routingKey: string;
  payload: T;
  attempt?: number;
}
