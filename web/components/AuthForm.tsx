"use client";
// Email + password sign-in for /login and /signup (SPEC Section 8.2).
// Email verification: when Supabase "Confirm email" is ON, sign-up returns no session; the reader
// then enters the 6-digit code from the email (or clicks the link, handled by /auth/callback).
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const RESEND_SECONDS = 60;

function friendly(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "That email and password don’t match. Try again or reset your password.";
  if (m.includes("already registered") || m.includes("already been registered")) return "An account with this email already exists. Log in instead.";
  if (m.includes("expired") || m.includes("invalid") && m.includes("token")) return "That code is invalid or has expired. Request a new one.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many emails sent recently. Please wait a few minutes and try again.";
  if (m.includes("password") && m.includes("characters")) return "Password must be at least 6 characters.";
  return msg;
}

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"form" | "verify">("form");
  const [error, setError] = useState<string | null>(params.get("error") ? "Sign-in was cancelled or failed. Please try again." : null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name.trim() },
            emailRedirectTo: `${origin}/auth/callback?next=/onboarding`,
          },
        });
        if (error) throw error;
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          throw new Error("already registered");
        }
        if (!data.session) {
          setStep("verify");
          setCooldown(RESEND_SECONDS);
          setInfo(`We sent a confirmation email to ${email}. Enter the 6-digit code, or click the link in the email.`);
          setBusy(false);
          return;
        }
        router.replace("/onboarding");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.toLowerCase().includes("not confirmed")) {
            setStep("verify");
            setInfo("Please verify your email first. Enter the code from your confirmation email, or send a new one.");
            setBusy(false);
            return;
          }
          throw error;
        }
        router.replace(params.get("next") || "/today");
      }
      router.refresh();
    } catch (err) {
      setError(friendly(err instanceof Error ? err.message : "Something went wrong. Please try again."));
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const token = code.replace(/\s/g, "");
    let { error } = await supabase.auth.verifyOtp({ email, token, type: "signup" });
    if (error) ({ error } = await supabase.auth.verifyOtp({ email, token, type: "email" }));
    if (error) {
      setError(friendly(error.message));
      setBusy(false);
      return;
    }
    setInfo("Email verified. Setting up your paper…");
    router.replace("/onboarding");
    router.refresh();
  }

  async function resend() {
    if (cooldown > 0 || !email) return;
    setError(null);
    const { error } = await createClient().auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${origin}/auth/callback?next=/onboarding` },
    });
    if (error) setError(friendly(error.message));
    else setInfo(`A new confirmation email is on its way to ${email}.`);
    setCooldown(RESEND_SECONDS);
  }

  const input = "mt-1 w-full border-b border-ink bg-transparent py-2 font-body text-lg outline-none focus:border-accent";
  const label = "block font-label text-xs uppercase tracking-widest text-muted";
  const primary =
    "w-full bg-accent py-3 font-label text-xs font-semibold uppercase tracking-widest text-paper hover:opacity-90 disabled:opacity-50";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16">
      <Link href="/" className="text-center font-masthead text-4xl font-bold">
        The Morning Edition
      </Link>
      <div className="mt-3 border-t-[3px] border-rule-strong" />
      <div className="mt-[3px] border-t border-rule" />

      {step === "verify" ? (
        <>
          <h1 className="mt-8 font-headline text-4xl font-bold">Check your email</h1>
          {info && <p className="mt-3 font-body text-lg text-muted">{info}</p>}
          <form onSubmit={verify} className="mt-6 space-y-5">
            {mode === "login" && (
              <label className={label}>
                Email
                <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
            )}
            <label className={label}>
              6-digit code
              <input
                className={`${input} text-center font-label text-3xl tracking-[0.5em]`}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 8))}
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                minLength={6}
                autoFocus
              />
            </label>
            {error && <p className="font-body text-sm text-accent">{error}</p>}
            <button type="submit" disabled={busy || code.length < 6} className={primary}>
              {busy ? "Checking…" : "Verify email"}
            </button>
          </form>
          <button
            type="button"
            onClick={resend}
            disabled={cooldown > 0}
            className="mt-4 font-label text-xs uppercase tracking-widest text-accent disabled:text-muted"
          >
            {cooldown > 0 ? `Resend email in ${cooldown}s` : "Resend email"}
          </button>
          <button type="button" onClick={() => { setStep("form"); setError(null); }} className="mt-2 font-label text-xs uppercase tracking-widest text-muted">
            ← Use a different email
          </button>
        </>
      ) : (
        <>
          <h1 className="mt-8 font-headline text-4xl font-bold">{mode === "signup" ? "Start your paper" : "Welcome back"}</h1>
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
            {info && <p className="font-body text-sm text-muted">{info}</p>}
            <button type="submit" disabled={busy} className={primary}>
              {busy ? "One moment…" : mode === "signup" ? "Create my paper" : "Log in"}
            </button>
          </form>
          {mode === "login" && (
            <Link href="/forgot" className="mt-4 text-center font-label text-xs uppercase tracking-widest text-muted hover:text-accent">
              Forgot password?
            </Link>
          )}
          <p className="mt-6 text-center font-body text-muted">
            {mode === "signup" ? (
              <>Already have a paper? <Link className="text-accent underline" href="/login">Log in</Link></>
            ) : (
              <>New here? <Link className="text-accent underline" href="/signup">Start your paper</Link></>
            )}
          </p>
        </>
      )}
    </main>
  );
}
