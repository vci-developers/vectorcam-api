import jwt from 'jsonwebtoken';
import { config } from '../config/environment';
import { sendEmail } from './email.service';
import { buildVerificationEmailContent } from './emailTemplates/verificationEmail';

const EMAIL_VERIFICATION_PURPOSE = 'email-verification';

interface EmailVerificationTokenPayload {
  userId: number;
  email: string;
  purpose: typeof EMAIL_VERIFICATION_PURPOSE;
}

export function createEmailVerificationToken(userId: number, email: string): string {
  const payload: EmailVerificationTokenPayload = {
    userId,
    email,
    purpose: EMAIL_VERIFICATION_PURPOSE,
  };

  return jwt.sign(payload, config.emailVerification.secret, {
    expiresIn: config.emailVerification.expiresIn,
  } as jwt.SignOptions);
}

export function verifyEmailVerificationToken(token: string): EmailVerificationTokenPayload {
  const decoded = jwt.verify(token, config.emailVerification.secret) as EmailVerificationTokenPayload;

  if (decoded.purpose !== EMAIL_VERIFICATION_PURPOSE) {
    throw new Error('Invalid verification token');
  }

  return decoded;
}

export function buildVerificationLink(token: string): string {
  const baseUrl = config.emailVerification.baseUrl || `${config.server.domain}/users/email/verify`;
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}token=${encodeURIComponent(token)}`;
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const verificationLink = buildVerificationLink(token);
  const { subject, text, html } = buildVerificationEmailContent(
    verificationLink,
    config.emailVerification.expiresIn
  );

  await sendEmail({ to, subject, text, html });
}
