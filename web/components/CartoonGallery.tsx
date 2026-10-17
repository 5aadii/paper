"use client";
// Grid of cartoons with a filter by newspaper and a full-size viewer.
import { ArrowUpRight, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { photo } from "@/lib/img";

export type Cartoon = {
  paper: string;
  series: string;
  title: string;
  url: string;
  image_url: string;
  published_at: string | null;
};

function fmt(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function CartoonGallery({ cartoons }: { cartoons: Cartoon[] }) {
  const papers = useMemo(() => [...new Set(cartoons.map((c) => c.paper))], [cartoons]);
  const [paper, setPaper] = useState<string | null>(null);
  const [view, setView] = useState<Cartoon | null>(null);
  const shown = paper ? cartoons.filter((c) => c.paper === paper) : cartoons;

  useEffect(() => {
    if (!view) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setView(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view]);

  return (
    <>
      <div className="-mx-4 mt-6 overflow-x-auto px-4 pb-1">
        <div className="segmented">
          <button type="button" aria-pressed={paper === null} onClick={() => setPaper(null)} className="font-label text-[13px] font-medium">
            All papers
          </button>
          {papers.map((p) => (
            <button key={p} type="button" aria-pressed={paper === p} onClick={() => setPaper(p)} className="whitespace-nowrap font-label text-[13px] font-medium">
              {p}
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-6 columns-1 gap-5 sm:columns-2 lg:columns-3">
        {shown.map((c) => (
          <li key={c.url + c.image_url} className="mb-5 break-inside-avoid">
            <figure className="glass-card overflow-hidden">
              <button type="button" onClick={() => setView(c)} className="block w-full bg-white" aria-label={`View “${c.title}” full size`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo(c.image_url) ?? undefined} alt={c.title} loading="lazy" className="w-full object-contain" />
              </button>
              <figcaption className="px-4 py-3">
                <p className="font-label text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
                  {c.paper} · {c.series}
                  {fmt(c.published_at) && <span className="text-muted"> · {fmt(c.published_at)}</span>}
                </p>
                <p className="mt-1 font-headline text-[17px] font-semibold leading-snug">{c.title}</p>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>

      {view && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={view.title}
          onClick={() => setView(null)}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4 backdrop-blur-xl"
        >
          <figure onClick={(e) => e.stopPropagation()} className="glass-strong sheet-in flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-[1.75rem]">
            <div className="flex min-h-0 flex-1 items-center justify-center bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo(view.image_url) ?? undefined} alt={view.title} className="max-h-[75dvh] w-auto object-contain" />
            </div>
            <figcaption className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-label text-xs font-semibold text-accent">{view.paper}</p>
                <p className="truncate font-headline text-lg font-semibold">{view.title}</p>
              </div>
              <a href={view.url} target="_blank" rel="noopener noreferrer" className="btn btn-glass btn-sm">
                {view.paper} <ArrowUpRight size={13} aria-hidden />
              </a>
              <button type="button" onClick={() => setView(null)} aria-label="Close" className="btn btn-glass !p-2">
                <X size={16} aria-hidden />
              </button>
            </figcaption>
          </figure>
        </div>
      )}
    </>
  );
}
