"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PasswordForm from "./PasswordForm";

type Prefs = {
  displayName: string;
  paperName: string;
  readingStyle: "quick" | "balanced" | "deep";
  region: "pakistan" | "global" | "both";
};

const label = "block font-label text-xs uppercase tracking-widest text-muted";
const input = "mt-1 w-full border-b border-ink bg-transparent py-2 font-body text-lg outline-none focus:border-accent";
const btn = "bg-accent px-5 py-2.5 font-label text-xs font-semibold uppercase tracking-widest text-paper disabled:opacity-50";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t-[3px] border-rule-strong pt-3">
      <h2 className="font-label text-xs font-bold uppercase tracking-widest">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function SettingsPanel({
  userId,
  email,
  emailConfirmed,
  providers,
  joined,
  initial,
}: {
  userId: string;
  email: string;
  emailConfirmed: boolean;
  providers: string[];
  joined: string;
  initial: Prefs;
}) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [saved, setSaved] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const usesPassword = providers.includes("email");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!p.displayName.trim() || !p.paperName.trim()) return setSaved({ ok: false, text: "Names can’t be empty." });
    setBusy(true);
    const { error } = await createClient()
      .from("profiles")
      .update({
        display_name: p.displayName.trim().slice(0, 40),
        paper_name: p.paperName.trim().slice(0, 48),
        reading_style: p.readingStyle,
        region: p.region,
      })
      .eq("id", userId);
    setBusy(false);
    setSaved(error ? { ok: false, text: "Could not save. Please try again." } : { ok: true, text: "Saved. Changes apply to your next edition." });
    if (!error) router.refresh();
  }

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await createClient().auth.updateUser(
      { email: newEmail },
      { emailRedirectTo: `${window.location.origin}/auth/callback?next=/settings` },
    );
    setEmailMsg(
      error
        ? { ok: false, text: error.message }
        : { ok: true, text: `Check ${newEmail} (and possibly ${email}) for a confirmation link. Your email changes once confirmed.` },
    );
  }

  async function logout() {
    await createClient().auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-10 px-4 pb-20 pt-8">
      <header>
        <h1 className="font-headline text-4xl font-semibold md:text-5xl">Settings</h1>
        <p className="mt-2 font-body text-lg italic text-muted">Your paper, your account.</p>
      </header>

      <Section title="Your paper">
        <form onSubmit={save} className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <label className={label}>
              Your name
              <input className={input} value={p.displayName} maxLength={40} onChange={(e) => setP({ ...p, displayName: e.target.value })} />
            </label>
            <label className={label}>
              Paper name
              <input className={input} value={p.paperName} maxLength={48} onChange={(e) => setP({ ...p, paperName: e.target.value })} />
            </label>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <label className={label}>
              Reading style
              <select className={input} value={p.readingStyle} onChange={(e) => setP({ ...p, readingStyle: e.target.value as Prefs["readingStyle"] })}>
                <option value="quick">Quick — 8 stories</option>
                <option value="balanced">Balanced — 11 stories</option>
                <option value="deep">Deep — 14 stories</option>
              </select>
            </label>
            <label className={label}>
              Region
              <select className={input} value={p.region} onChange={(e) => setP({ ...p, region: e.target.value as Prefs["region"] })}>
                <option value="pakistan">Pakistan first</option>
                <option value="global">Global</option>
                <option value="both">Both</option>
              </select>
            </label>
          </div>
          {saved && <p className={`font-body text-sm ${saved.ok ? "text-green-800" : "text-accent"}`}>{saved.text}</p>}
          <button type="submit" disabled={busy} className={btn}>{busy ? "Saving…" : "Save changes"}</button>
        </form>
        <p className="mt-5 font-body">
          Topics and phrases live on <Link href="/interests" className="text-accent underline">My Interests</Link>.
        </p>
      </Section>

      <Section title="Account">
        <dl className="grid gap-4 md:grid-cols-3">
          <div>
            <dt className={label}>Email</dt>
            <dd className="font-body text-lg">{email}</dd>
            <dd className="font-label text-xs uppercase tracking-widest text-muted">{emailConfirmed ? "Verified" : "Not verified"}</dd>
          </div>
          <div>
            <dt className={label}>Sign-in method</dt>
            <dd className="font-body text-lg capitalize">{providers.join(", ")}</dd>
          </div>
          <div>
            <dt className={label}>Reader since</dt>
            <dd className="font-body text-lg">{new Date(joined).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</dd>
          </div>
        </dl>
        {usesPassword && (
          <form onSubmit={changeEmail} className="mt-6 flex flex-col gap-3 md:flex-row md:items-end">
            <label className={`${label} flex-1`}>
              Change email
              <input className={input} type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="new@email.com" required />
            </label>
            <button type="submit" className={btn}>Send confirmation</button>
          </form>
        )}
        {emailMsg && <p className={`mt-2 font-body text-sm ${emailMsg.ok ? "text-green-800" : "text-accent"}`}>{emailMsg.text}</p>}
      </Section>

      <Section title="Password">
        {usesPassword ? (
          <>
            <PasswordForm />
            <p className="mt-4 font-body text-sm text-muted">
              Forgot it? <Link href="/forgot" className="text-accent underline">Send a reset link</Link>.
            </p>
          </>
        ) : (
          <p className="font-body text-muted">You sign in with Google, so there is no password to change here.</p>
        )}
      </Section>

      <Section title="Sign out">
        <button type="button" onClick={logout} className="btn btn-glass">
          Log out
        </button>
      </Section>
    </main>
  );
}
