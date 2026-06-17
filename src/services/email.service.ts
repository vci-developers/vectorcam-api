import nodemailer from 'nodemailer';
import { config } from '../config/environment';

export function isSmtpConfigured(): boolean {
  return Boolean(
    config.smtp.host &&
    config.smtp.user &&
    config.smtp.pass
  );
}

function createTransport() {
  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  if (!isSmtpConfigured()) {
    throw new Error('SMTP is not configured');
  }

  const transport = createTransport();
  await transport.sendMail({
    from: config.smtp.from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });
}
