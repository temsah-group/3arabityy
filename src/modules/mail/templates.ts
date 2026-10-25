import { t, type Lang } from '../../common/i18n.js';
import type { OtpPurpose } from '../auth/otp.model.js';
import type { Mail } from './mailer.js';

/** The `cid:` the HTML points at; the mailer attaches the logo under it. */
export const LOGO_CID = 'logo@3rbyty';

const NAVY = '#14213D';
const ORANGE = '#F77F00';

/** The code email: plain text, and HTML with the app's logo on top. */
export function codeEmail(
  lang: Lang,
  to: string,
  purpose: OtpPurpose,
  code: string,
  minutes: number,
): Mail {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const align = lang === 'ar' ? 'right' : 'left';
  const name = t(lang, 'mail.appName');
  const html = `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F3F4F6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${dir}" style="max-width:480px;background:#FFFFFF;border-radius:16px;overflow:hidden;font-family:Tahoma,Arial,sans-serif;">
<tr><td align="center" style="background:${NAVY};padding:28px 16px 20px;">
<img src="cid:${LOGO_CID}" width="72" height="72" alt="${name}" style="display:block;border:0;border-radius:16px;">
<div style="color:#FFFFFF;font-size:20px;font-weight:bold;margin-top:12px;">${name}</div>
</td></tr>
<tr><td style="padding:28px 24px 8px;color:${NAVY};font-size:15px;line-height:1.7;text-align:${align};">
${t(lang, `mail.codeIntro.${purpose}`)}
</td></tr>
<tr><td align="center" style="padding:12px 24px;">
<div dir="ltr" style="display:inline-block;background:#FFF4E6;border:2px dashed ${ORANGE};border-radius:12px;padding:14px 28px;font-size:32px;font-weight:bold;letter-spacing:8px;color:${NAVY};font-family:'Courier New',monospace;">${code}</div>
</td></tr>
<tr><td style="padding:8px 24px 28px;color:#6B7280;font-size:13px;line-height:1.7;text-align:${align};">
${t(lang, 'mail.codeValid', [minutes])}<br>${t(lang, 'mail.codeIgnore')}
</td></tr>
<tr><td align="center" style="border-top:1px solid #E5E7EB;padding:16px;color:#9CA3AF;font-size:12px;">
${t(lang, 'mail.footer')}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  return {
    to,
    subject: t(lang, `mail.otpSubject.${purpose}`),
    text: t(lang, 'mail.otpBody', [code, minutes]),
    html,
  };
}
