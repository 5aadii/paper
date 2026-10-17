"use client";
// Request a password-reset email (Supabase resetPasswordForEmail).
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
    });
    setBusy(false);
    if (error) {
      setError(error.message.toLowerCase().includes("rate") ? "Too many emails sent recently. Please wait a few minutes." : error.message);
      return;
    }
    setSent(true);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16">
      <Link href="/" className="text-center font-masthead text-3xl font-bold">The Morning Edition</Link>
      <div className="mt-3 border-t-[3px] border-rule-strong" />
      <h1 className="mt-8 font-headline text-4xl font-bold">Reset your password</h1>
      {sent ? (
        <p className="mt-4 font-body text-lg">
          If an account exists for <b>{email}</b>, a reset link is on its way. Open it on this device to choose a new password.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-5">
          <label className="block font-label text-xs uppercase tracking-widest text-muted">
            Email
            <input
              className="mt-1 w-full border-b border-ink bg-transparent py-2 font-body text-lg outline-none focus:border-accent"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          {error && <p className="font-body text-sm text-accent">{error}</p>}
          <button type="submit" disabled={busy} className="btn btn-primary w-full disabled:opacity-50">
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
      <Link href="/login" className="mt-6 text-center font-label text-xs uppercase tracking-widest text-muted hover:text-accent">← Back to log in</Link>
    </main>
  );
}
