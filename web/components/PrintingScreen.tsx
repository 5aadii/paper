"use client";
// Shown while an edition is generating: masthead, a little press animation and live progress (SPEC Section 8.5).
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Masthead from "./Masthead";

type Status = "none" | "generating" | "ready" | "failed" | "warming";

export default function PrintingScreen({
  paperName,
  readerName,
  date,
  editionNumber,
  initialStatus,
  initialProgress,
}: {
  paperName: string;
  readerName: string;
  date: string;
  editionNumber: number | string;
  initialStatus: "none" | "generating" | "failed";
  initialProgress: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(initialStatus);
  const [progress, setProgress] = useState(initialProgress || "Warming up the press");
  const started = useRef(false);

  const generate = useCallback(async (force: boolean) => {
    setStatus("generating");
    setProgress("Warming up the press");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      if (!res.ok) setStatus("warming");
    } catch {
      setStatus("warming");
    }
  }, []);

  useEffect(() => {
    if (initialStatus === "none" && !started.current) {
      started.current = true;
      void generate(false);
    }
  }, [initialStatus, generate]);

  useEffect(() => {
    if (status !== "generating" && status !== "none") return;
    const supabase = createClient();
    const t = window.setInterval(async () => {
      const { data } = await supabase
        .from("editions")
        .select("status, progress")
        .eq("edition_date", date)
        .maybeSingle();
      if (!data) return;
      if (data.progress) setProgress(data.progress);
      if (data.status === "ready") {
        window.clearInterval(t);
        setStatus("ready");
        router.refresh();
      } else if (data.status === "failed") {
        setStatus("failed");
      }
    }, 2000);
    return () => window.clearInterval(t);
  }, [status, date, router]);

  const steps = ["Reading your interests", "Collecting today's stories", "The editor is choosing", "Setting the type"];
  const current = Math.max(0, steps.indexOf(progress));

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 pt-6">
      <Masthead paperName={paperName} editionNumber={editionNumber} date={date} readerName={readerName} compact />
      <section className="mx-auto mt-14 max-w-xl text-center" aria-live="polite">
        {status === "failed" || status === "warming" ? (
          <>
            <h2 className="font-headline text-4xl font-bold">
              {status === "failed" ? "The press jammed. Let’s try again." : "The printing press is warming up — try again in a minute."}
            </h2>
            <button
              type="button"
              onClick={() => generate(status === "failed")}
              className="btn btn-primary mt-8"
            >
              Try again
            </button>
          </>
        ) : (
          <>
            <div className="press mx-auto w-64 space-y-2" aria-hidden>
              {[90, 70, 100, 55, 85, 65].map((w, i) => (
                <div key={i} className="press-line h-2 bg-ink" style={{ width: `${w}%`, animationDelay: `${i * 0.35}s` }} />
              ))}
            </div>
            <h2 className="mt-10 font-headline text-4xl font-bold">Printing your paper…</h2>
            <p className="mt-3 font-body text-xl italic text-muted">{progress}</p>
            <ol className="mt-8 flex justify-center gap-2" aria-hidden>
              {steps.map((s, i) => (
                <li key={s} className={`h-1.5 w-10 ${i <= current ? "bg-accent" : "bg-ink/15"}`} />
              ))}
            </ol>
            <p className="mt-8 font-label text-xs uppercase tracking-widest text-muted">
              Gathering stories from dozens of sources · usually 20–60 seconds
            </p>
          </>
        )}
      </section>
      <style>{`
        .press-line { transform-origin: left; animation: ink 2.1s ease-in-out infinite; opacity: .15; }
        @keyframes ink { 0% { transform: scaleX(0); opacity: .15 } 40% { transform: scaleX(1); opacity: .85 } 100% { transform: scaleX(1); opacity: .15 } }
      `}</style>
    </main>
  );
}
