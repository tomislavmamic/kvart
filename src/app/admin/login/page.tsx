import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isModerator } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Prijava moderatora" };

export default async function LoginPage() {
  if (await isModerator()) redirect("/admin");

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold">Prijava moderatora</h1>
      <div className="mt-6">
        <LoginForm />
      </div>
    </div>
  );
}
