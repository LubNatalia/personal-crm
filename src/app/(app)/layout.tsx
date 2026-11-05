import { Suspense, type ReactNode } from "react";
import { PageShell } from "@/components/page-shell";
import { UserBar } from "@/components/user-bar";

// Pages after login: the header shows whose data this is. The user's email
// is read on request, so it waits in its own Suspense and the page frame
// does not wait for it
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <PageShell
      right={
        <Suspense fallback={null}>
          <UserBar />
        </Suspense>
      }
    >
      {children}
    </PageShell>
  );
}
