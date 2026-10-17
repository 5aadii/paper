"use client";
// Shared email + password form for /login and /signup (SPEC Section 8.2).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name.trim() } },
        });
        if (error) throw error;
        if (!data.session) {
          setError("Account created. Please log in.");
          setBusy(false);
          return;
        }
        router.replace("/onboarding");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/today");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  const input =
    "mt-1 w-full border-b border-ink bg-transparent py-2 font-body text-lg outline-none focus:border-accent";
  const label = "block font-label text-[11px] uppercase tracking-widest text-muted";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16">
      <Link href="/" className="text-center font-headline text-3xl font-black">
        The Morning Edition
      </Link>
      <div className="mt-3 border-t-[3px] border-rule" />
      <h1 className="mt-8 font-headline text-4xl font-bold">
        {mode === "signup" ? "Start your paper" : "Welcome back"}
      </h1>
      <form onSubmit={submit} className="mt-6 space-y-5">
        {mode === "signup" && (
          <label className={label}>
            First name
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} autoComplete="given-name" />
          </label>
        )}
        <label className={label}>
          Email
          <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label className={label}>
          Password
          <input
            className={input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
        </label>
        {error && <p className="font-body text-sm text-accent">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-accent py-3 font-label text-xs font-semibold uppercase tracking-widest text-paper hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "One moment…" : mode === "signup" ? "Create my paper" : "Log in"}
        </button>
      </form>
      <p className="mt-6 text-center font-body text-muted">
        {mode === "signup" ? (
          <>
            Already have a paper? <Link className="text-accent underline" href="/login">Log in</Link>
          </>
        ) : (
          <>
            New here? <Link className="text-accent underline" href="/signup">Start your paper</Link>
          </>
        )}
      </p>
    </main>
  );
}
