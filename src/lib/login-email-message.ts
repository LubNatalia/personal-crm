// The login email: the same everywhere, only the address and the link differ.
// The sender and the subject are in code, not in settings, on purpose: they
// are the same on a laptop, in tests and on the server

export const LOGIN_EMAIL_FROM = "Личная CRM <noreply@mail.crm.lyna.tech>";
export const LOGIN_EMAIL_SUBJECT = "Вход в Личную CRM";
// Matches the lifetime of the link set in auth.ts
export const LOGIN_LINK_MINUTES = 15;

// The exception to "colors only through design tokens": CSS variables don't
// work in email, so the values of tokens.css are copied here. A test checks
// that they stay equal
export const EMAIL_COLORS = {
  accent: "#5b3fd9",
  ink: "#1e1838",
  inkMuted: "#575073",
  background: "#eeebfa",
};

const VALIDITY = `Ссылка работает ${LOGIN_LINK_MINUTES} минут`;
const IGNORE = "Если вы не запрашивали вход - просто проигнорируйте письмо";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export type LoginEmail = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
};

export function buildLoginEmail(to: string, url: string): LoginEmail {
  const link = escapeHtml(url);
  const { accent, ink, inkMuted, background } = EMAIL_COLORS;

  // Tables and inline styles: the only layout that mail apps render alike
  const html = `<!doctype html>
<html lang="ru">
  <body style="margin:0;padding:24px;background:${background};font-family:Arial,Helvetica,sans-serif;color:${ink};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:100%;background:#ffffff;border-radius:16px;">
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:22px;color:${ink};">Вход в Личную CRM</h1>
                <p style="margin:0 0 24px;font-size:16px;line-height:1.5;color:${ink};">Нажмите кнопку, чтобы войти.</p>
                <p style="margin:0 0 24px;">
                  <a href="${link}" style="display:inline-block;padding:14px 28px;background:${accent};color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none;border-radius:12px;">Войти</a>
                </p>
                <p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:${inkMuted};">${VALIDITY}.</p>
                <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:${inkMuted};">${IGNORE}.</p>
                <p style="margin:0;font-size:12px;line-height:1.5;color:${inkMuted};word-break:break-all;">Кнопка не работает? Откройте ссылку: ${link}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

  const text = [
    "Вход в Личную CRM",
    "",
    "Войти:",
    url,
    "",
    `${VALIDITY}.`,
    `${IGNORE}.`,
    "",
  ].join("\n");

  return {
    from: LOGIN_EMAIL_FROM,
    to,
    subject: LOGIN_EMAIL_SUBJECT,
    html,
    text,
  };
}
