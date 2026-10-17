"use client";
// Set a new password for the signed-in reader via Supabase updateUser (never stored by us).
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function PasswordForm({ onDone }: { onDone?: () => void }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setMsg({ ok: false, text: "Use at least 8 characters." });
    if (pw !== pw2) return setMsg({ ok: false, text: "The two passwords don’t match." });
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      const m = error.message.toLowerCase();
      setMsg({
        ok: false,
        text: m.includes("reauthentication") || m.includes("recent")
          ? "For security, please log out, log back in, and try again."
          : m.includes("same") ? "Choose a password different from your current one." : error.message,
      });
      return;
    }
    setPw("");
    setPw2("");
    setMsg({ ok: true, text: "Password updated." });
    onDone?.();
  }

  const input = "mt-1 w-full border-b border-ink bg-transparent py-2 font-body text-lg outline-none focus:border-accent";
  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block font-label text-xs uppercase tracking-widest text-muted">
        New password
        <input className={input} type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" required />
      </label>
      <label className="block font-label text-xs uppercase tracking-widest text-muted">
        Repeat new password
        <input className={input} type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" required />
      </label>
      {msg && <p className={`font-body text-sm ${msg.ok ? "text-green-800" : "text-accent"}`}>{msg.text}</p>}
      <button type="submit" disabled={busy} className="btn btn-primary disabled:opacity-50">
        {busy ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}
