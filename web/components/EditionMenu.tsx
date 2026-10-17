"use client";
// The small controls in the masthead line: Download PDF + ⋯ menu (SPEC Section 8.6).
import { Download, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function EditionMenu({ editionId, canRegenerate }: { editionId: string; canRegenerate: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  async function regenerate() {
    setBusy(true);
    await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force: true }),
    }).catch(() => null);
    setOpen(false);
    setBusy(false);
    router.push("/today");
    router.refresh();
  }

  async function logout() {
    await createClient().auth.signOut();
    router.replace("/");
    router.refresh();
  }

  const item = "block w-full px-4 py-2 text-left hover:bg-ink hover:text-paper";
  return (
    <span className="relative flex items-center gap-2" ref={ref}>
      <a
        href={`/api/pdf/${editionId}`}
        className="hidden items-center gap-1 border border-ink px-2 py-0.5 hover:bg-ink hover:text-paper sm:inline-flex"
      >
        <Download size={12} aria-hidden /> PDF
      </a>
      <button
        type="button"
        aria-label="More options"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="border border-ink px-1.5 py-0.5 hover:bg-ink hover:text-paper"
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-48 border border-ink bg-paper py-1 normal-case tracking-normal shadow-[3px_3px_0_0_#1a1a1a]">
          <Link className={item} href="/archive">Archive</Link>
          <Link className={item} href="/interests">Your interests</Link>
          {canRegenerate && (
            <button type="button" className={item} onClick={regenerate} disabled={busy}>
              {busy ? "Starting the press…" : "Regenerate today’s paper"}
            </button>
          )}
          <button type="button" className={item} onClick={logout}>Log out</button>
        </div>
      )}
    </span>
  );
}
