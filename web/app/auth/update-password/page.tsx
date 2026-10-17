// Landing page for password-reset links: choose a new password.
import Link from "next/link";
import { redirect } from "next/navigation";
import PasswordForm from "@/components/PasswordForm";
import { createClient } from "@/lib/supabase/server";

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/forgot");
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16">
      <Link href="/" className="text-center font-masthead text-3xl font-bold">The Morning Edition</Link>
      <div className="mt-3 border-t-[3px] border-rule-strong" />
      <h1 className="mt-8 font-headline text-4xl font-bold">Choose a new password</h1>
      <p className="mt-2 font-body text-muted">For {user.email}</p>
      <div className="mt-6">
        <PasswordForm />
      </div>
      <Link href="/today" className="mt-8 font-label text-xs uppercase tracking-widest text-accent">Go to today’s paper →</Link>
    </main>
  );
}
