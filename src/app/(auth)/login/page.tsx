import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { Card, CardContent } from "@/components/ui/card";
import { getUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Вход — Личная CRM",
};

export default async function LoginPage() {
  // Already signed in: nothing to do here
  if (await getUser()) {
    redirect("/");
  }

  return (
    <div className="mx-auto grid w-full max-w-md gap-5 lg:gap-6">
      <h1 className="text-h2 font-extrabold">Вход</h1>
      <Card>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
