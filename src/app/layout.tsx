import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import Link from "next/link";
import { Logo } from "@/components/logo";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${manrope.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <header className="mx-auto flex h-16 w-full max-w-page items-center justify-center px-gutter pt-5 lg:h-22 lg:justify-start lg:px-gutter-lg lg:pt-6">
          <Link
            href="/"
            className="flex min-h-11 items-center rounded-field focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-accent"
          >
            <Logo />
          </Link>
        </header>
        <main className="mx-auto w-full max-w-page flex-1 px-gutter pt-6 pb-section lg:px-gutter-lg lg:pt-8 lg:pb-section-lg">
          {children}
        </main>
      </body>
    </html>
  );
}
