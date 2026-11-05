import { signOutAction } from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/session";

// In the header of every page after login: whose data this is, and the way
// out. "Sign out" ends the login on this device only
export async function UserBar() {
  const user = await requireUser();

  return (
    <div className="flex min-w-0 items-center gap-2 lg:gap-3">
      {/* Cut with an ellipsis on a narrow screen; the full address on hover */}
      <span
        title={user.email}
        className="min-w-0 truncate text-14 text-ink-muted lg:text-15"
      >
        {user.email}
      </span>
      <form action={signOutAction} className="shrink-0">
        <Button type="submit" variant="ghost" className="h-11 px-3 text-15">
          Выйти
        </Button>
      </form>
    </div>
  );
}
