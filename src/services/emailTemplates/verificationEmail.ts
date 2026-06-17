const THEME_COLOR = '#6dcb81';
const THEME_COLOR_DARK = '#57b870';
const APP_NAME = 'VectorVerify';
const COPYRIGHT = 'Copyright © 2026 VectorCam - All Rights Reserved.';

export function buildVerificationEmailContent(
  verificationLink: string,
  expiresInLabel = '24 hours'
): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = `Verify your ${APP_NAME} email address`;
  const text = [
    APP_NAME,
    '',
    'Verify your email address',
    '',
    `Thanks for signing up. Please confirm your email address to finish setting up your ${APP_NAME} account:`,
    verificationLink,
    '',
    `This link expires in ${expiresInLabel}. If you did not create a ${APP_NAME} account, you can safely ignore this email.`,
    '',
    `— The ${APP_NAME} Team`,
    '',
    COPYRIGHT,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f3f5f7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,${THEME_COLOR} 0%,${THEME_COLOR_DARK} 100%);padding:28px 32px;">
              <p style="margin:0;font-size:22px;font-weight:700;letter-spacing:0.3px;color:#ffffff;">${APP_NAME}</p>
              <p style="margin:8px 0 0;font-size:14px;color:#f0fdf4;">Verify your account email</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 32px 28px;">
              <h1 style="margin:0 0 12px;font-size:24px;line-height:1.3;font-weight:700;color:#111827;">Verify your email address</h1>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#4b5563;">
                Thanks for joining ${APP_NAME}. Confirm your email address to finish setting up your account and get started.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 28px;">
                <tr>
                  <td align="center" style="border-radius:8px;background-color:${THEME_COLOR};">
                    <a href="${verificationLink}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                      Verify email address
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#6b7280;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin:0 0 28px;padding:12px 14px;background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;line-height:1.5;word-break:break-all;color:#374151;">
                <a href="${verificationLink}" style="color:${THEME_COLOR};text-decoration:none;">${verificationLink}</a>
              </p>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#9ca3af;">
                This link expires in ${expiresInLabel}. If you did not create a ${APP_NAME} account, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid #f3f4f6;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;text-align:center;">
                ${COPYRIGHT}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}
