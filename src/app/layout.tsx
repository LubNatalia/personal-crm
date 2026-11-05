import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

// The landing's font. Self-hosted by Next.js: the browser makes no requests to Google
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Личная CRM",
  description: "Контакты людей, которых я знаю лично",
};

// The header and the page frame are in PageShell: they differ between the
// pages that need a login and the login pages
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${manrope.variable} h-full`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
