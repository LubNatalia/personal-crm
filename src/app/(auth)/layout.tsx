import type { ReactNode } from "react";
import { PageShell } from "@/components/page-shell";

// Login pages: the header has no email and no "Sign out"
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <PageShell>{children}</PageShell>;
}
