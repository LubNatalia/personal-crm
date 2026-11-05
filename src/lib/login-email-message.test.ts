import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildLoginEmail,
  EMAIL_COLORS,
  LOGIN_EMAIL_FROM,
  LOGIN_EMAIL_SUBJECT,
} from "./login-email-message";

const URL_WITH_QUERY =
  "https://app.lyna.tech/api/auth/magic-link/verify?token=abc123&callbackURL=%2F&errorCallbackURL=%2Flogin%2Fexpired";

describe("buildLoginEmail", () => {
  const message = buildLoginEmail("anna@example.com", URL_WITH_QUERY);

  it("comes from «Личная CRM» at the project's mail domain", () => {
    expect(LOGIN_EMAIL_FROM).toBe("Личная CRM <noreply@mail.crm.lyna.tech>");
    expect(message.from).toBe("Личная CRM <noreply@mail.crm.lyna.tech>");
  });

  it("goes to the address and has the subject «Вход в Личную CRM»", () => {
    expect(message.to).toBe("anna@example.com");
    expect(LOGIN_EMAIL_SUBJECT).toBe("Вход в Личную CRM");
    expect(message.subject).toBe("Вход в Личную CRM");
  });

  it("has a «Войти» button that leads to the link", () => {
    // In HTML the & of the address is written as &amp;
    expect(message.html).toMatch(
      /<a href="https:\/\/app\.lyna\.tech\/api\/auth\/magic-link\/verify\?token=abc123&amp;callbackURL=%2F&amp;errorCallbackURL=%2Flogin%2Fexpired"[^>]*>\s*Войти\s*<\/a>/,
    );
  });

  it("says the link works 15 minutes", () => {
    expect(message.html).toContain("Ссылка работает 15 минут");
    expect(message.text).toContain("Ссылка работает 15 минут");
  });

  it("tells to ignore the email if the login was not asked for", () => {
    const phrase = "Если вы не запрашивали вход - просто проигнорируйте письмо";
    expect(message.html).toContain(phrase);
    expect(message.text).toContain(phrase);
  });

  it("has a text version with the link as it is", () => {
    expect(message.text).toContain(URL_WITH_QUERY);
    expect(message.text).toContain("Войти");
    // Plain text: no markup
    expect(message.text).not.toContain("<");
  });

  it("shows the link in the HTML as text too, for mail apps without buttons", () => {
    const visible = message.html.replace(/<[^>]+>/g, " ");
    expect(visible).toContain(URL_WITH_QUERY.replaceAll("&", "&amp;"));
  });

  it("does not let an address or a link break the markup", () => {
    const evil = buildLoginEmail(
      "a@example.com",
      'https://x.test/"><script>alert(1)</script>',
    );

    expect(evil.html).not.toContain("<script>");
  });
});

describe("email colors", () => {
  // CSS variables don't work in email, so the colors are copied. They must
  // stay equal to the design tokens
  const tokens = fs.readFileSync(path.resolve("src/app/tokens.css"), "utf8");

  function token(name: string) {
    const match = tokens.match(
      new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`),
    );
    if (!match) throw new Error(`Token ${name} not found`);
    return match[1].toLowerCase();
  }

  it("match tokens.css", () => {
    expect(EMAIL_COLORS.accent.toLowerCase()).toBe(token("accent"));
    expect(EMAIL_COLORS.ink.toLowerCase()).toBe(token("ink"));
    expect(EMAIL_COLORS.inkMuted.toLowerCase()).toBe(token("ink-muted"));
    expect(EMAIL_COLORS.background.toLowerCase()).toBe(token("lavender-100"));
  });
});
