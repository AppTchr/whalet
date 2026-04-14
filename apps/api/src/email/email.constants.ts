export const RABBITMQ_EXCHANGE = 'ledger.emails';
export const RABBITMQ_QUEUE = 'ledger.emails.transactional';
export const RABBITMQ_ROUTING_KEY_OTP = 'email.otp';
export const RABBITMQ_DLQ = 'ledger.emails.deadletter';
export const RABBITMQ_DLX = 'ledger.emails.deadletter.exchange';

export const RETRY_DELAYS_MS = [1000, 5000, 30000];
export const MAX_RETRY_ATTEMPTS = 3;
