import jwt from 'jsonwebtoken';
import { config } from '../config/environment';
import { sendEmail } from './email.service';
import { buildPasswordResetEmailContent } from './emailTemplates/passwordResetEmail';

const PASSWORD_RESET_PURPOSE = 'password-reset';

interface PasswordResetTokenPayload {
  userId: number;
  email: string;
  purpose: typeof PASSWORD_RESET_PURPOSE;
}

export function createPasswordResetToken(userId: number, email: string): string {
  const payload: PasswordResetTokenPayload = {
    userId,
    email,
    purpose: PASSWORD_RESET_PURPOSE,
  };

  return jwt.sign(payload, config.passwordReset.secret, {
    expiresIn: config.passwordReset.expiresIn,
  } as jwt.SignOptions);
}

export function verifyPasswordResetToken(token: string): PasswordResetTokenPayload {
  const decoded = jwt.verify(token, config.passwordReset.secret) as PasswordResetTokenPayload;

  if (decoded.purpose !== PASSWORD_RESET_PURPOSE) {
    throw new Error('Invalid password reset token');
  }

  return decoded;
}

export function buildPasswordResetLink(token: string): string {
  const baseUrl = config.passwordReset.baseUrl || `${config.server.domain}/auth/reset-password`;
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}token=${encodeURIComponent(token)}`;
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const resetLink = buildPasswordResetLink(token);
  const { subject, text, html } = buildPasswordResetEmailContent(
    resetLink,
    config.passwordReset.expiresIn
  );

  await sendEmail({ to, subject, text, html });
}
