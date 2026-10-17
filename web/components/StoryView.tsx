"use client";
// Story page body + actions (SPEC Section 8.7).
import { ArrowUpRight, ThumbsDown, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { logEvent } from "@/lib/events";
import { shortDate, timeAgo, type Edition, type EditionItem } from "@/lib/edition";
import { useReadTimer } from "@/lib/useReadTimer";
import MoreStories from "./MoreStories";

export default function StoryView({
  edition,
  item,
  sectionName,
  readItemIds,
}: {
  edition: Edition;
  item: EditionItem;
  sectionName: string;
  readItemIds: string[];
}) {
  const router = useRouter();
  const [vote, setVote] = useState<"like" | "dislike" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const base = { editionId: edition.edition_id, itemId: item.item_id, topic: item.topic, sourceName: item.source_name };
  const frontHref = `/paper/${edition.edition_date}`;

  useReadTimer(base);

  const all = useMemo(
    () => edition.sections.flatMap((s) => s.items.map((it) => ({ item: it, section: s.name }))),
    [edition.sections],
  );
  const sectionItems = all.filter((x) => x.section === sectionName);
  const idx = sectionItems.findIndex((x) => x.item.item_id === item.item_id);
  const nextInSection = sectionItems[idx + 1] ?? null;
  const read = new Set(readItemIds);
  const more = all
    .filter((x) => x.item.item_id !== item.item_id && x.item.item_id !== nextInSection?.item.item_id && !read.has(x.item.item_id))
    .slice(0, 3);
  const nextAny = nextInSection ?? more[0] ?? null;

  function showToast(t: string) {
    setToast(t);
    window.setTimeout(() => setToast(null), 2200);
  }
  function rate(v: "like" | "dislike") {
    if (vote === v) return;
    setVote(v);
    logEvent({ ...base, type: v });
    showToast(v === "like" ? "Got it — more like this" : "Got it — less like this");
  }
  function notForMe() {
    logEvent({ ...base, type: "skip" });
    showToast("We’ll show you less of this");
    window.setTimeout(() => router.push(frontHref), 900);
  }
  function openOther(it: EditionItem) {
    logEvent({ editionId: edition.edition_id, itemId: it.item_id, topic: it.topic, sourceName: it.source_name, type: "open" });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft") router.push(frontHref);
      if (e.key === "ArrowRight" && nextAny) {
        openOther(nextAny.item);
        router.push(`/paper/${edition.edition_date}/story/${nextAny.item.item_id}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextAny, frontHref]);

  const kicker = item.is_explore ? "Explore" : sectionName;

  return (
    <main className="mx-auto w-full max-w-[680px] flex-1 px-4 pb-20 pt-5">
      <div className="flex items-center justify-between gap-3 border-b border-rule pb-2 font-label text-[11px] uppercase tracking-widest">
        <Link href={frontHref} className="hover:text-accent">‹ Back to the front page</Link>
        <span className="truncate text-muted">
          {edition.paper_name} · {shortDate(edition.edition_date)}
        </span>
      </div>

      <article className="mt-8">
        <p className="font-label text-[11px] font-semibold uppercase tracking-widest text-accent">{kicker}</p>
        <h1 className="mt-2 font-headline text-4xl font-bold leading-[1.1] md:text-5xl">{item.headline}</h1>
        {item.dek && <p className="mt-3 font-body text-xl italic text-ink/85">{item.dek}</p>}
        <p className="mt-4 font-label text-[11px] uppercase tracking-widest text-muted">
          {item.source_name}
          {item.published_at && ` · ${timeAgo(item.published_at)}`}
        </p>
        {item.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image_url}
            alt=""
            referrerPolicy="no-referrer"
            className="mt-6 max-h-[420px] w-full object-cover"
            onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
          />
        )}
        <p className="mt-6 font-body text-[19px] leading-[1.6] md:text-[20px]">{item.summary || item.dek}</p>
        <p className="mt-3 font-body text-sm italic text-muted">
          Summary based on the publisher&rsquo;s preview. Read the full story for everything.
        </p>

        {item.key_points.length > 0 && (
          <section className="mt-8">
            <h2 className="font-label text-[11px] font-bold uppercase tracking-widest">Key points</h2>
            <ul className="mt-2 space-y-1.5">
              {item.key_points.map((p) => (
                <li key={p} className="flex gap-3 font-body text-[17px] leading-snug">
                  <span className="text-accent">•</span>
                  {p}
                </li>
              ))}
            </ul>
          </section>
        )}

        {item.why_this && (
          <aside className="mt-8 border border-ink px-4 py-3">
            <h2 className="font-label text-[11px] font-bold uppercase tracking-widest">Why you&rsquo;re seeing this</h2>
            <p className="mt-1 font-body text-[16px]">{item.why_this}</p>
          </aside>
        )}

        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => logEvent({ ...base, type: "click_through" })}
            className="mt-8 inline-flex items-center gap-2 bg-accent px-5 py-3 font-label text-xs font-semibold uppercase tracking-widest text-paper hover:opacity-90"
          >
            Read the full story at {item.source_name || "the source"} <ArrowUpRight size={14} aria-hidden />
          </a>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-rule pt-4">
          <span className="mr-2 font-body italic text-muted">Was this worth your time?</span>
          <button
            type="button"
            onClick={() => rate("like")}
            aria-pressed={vote === "like"}
            className={`inline-flex items-center gap-1.5 border px-3 py-1.5 font-label text-[11px] uppercase tracking-widest ${
              vote === "like" ? "border-accent bg-accent text-paper" : "border-ink hover:bg-ink hover:text-paper"
            }`}
          >
            <ThumbsUp size={13} aria-hidden /> More like this
          </button>
          <button
            type="button"
            onClick={() => rate("dislike")}
            aria-pressed={vote === "dislike"}
            className={`inline-flex items-center gap-1.5 border px-3 py-1.5 font-label text-[11px] uppercase tracking-widest ${
              vote === "dislike" ? "border-ink bg-ink text-paper" : "border-ink hover:bg-ink hover:text-paper"
            }`}
          >
            <ThumbsDown size={13} aria-hidden /> Less like this
          </button>
          <button type="button" onClick={notForMe} className="px-3 py-1.5 font-label text-[11px] uppercase tracking-widest text-muted hover:text-accent">
            Not for me
          </button>
        </div>
      </article>

      <MoreStories
        date={edition.edition_date}
        sectionName={sectionName}
        next={nextInSection}
        more={more}
        onOpen={openOther}
      />

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 bg-ink px-4 py-2 font-label text-xs uppercase tracking-widest text-paper">
          {toast}
        </div>
      )}
    </main>
  );
}
