"use client";
// Story page: the full article, read on our own site (SPEC Section 8.7, extended).
import { ArrowUpRight, ThumbsDown, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { logEvent } from "@/lib/events";
import { shortDate, timeAgo, type Edition, type EditionItem, type StoryBody } from "@/lib/edition";
import { photo } from "@/lib/img";
import { useReadTimer } from "@/lib/useReadTimer";
import MoreStories from "./MoreStories";
import ReadAloud from "./ReadAloud";
import ReaderPrefs from "./ReaderPrefs";
import { openAssistant } from "./ChatWidget";

export type RelatedStory = { id: string; date: string; headline: string; source: string; published_at: string | null };

function readingMinutes(words: number): number {
  return Math.max(1, Math.round(words / 230));
}

/** A thin bar under the top nav showing how far through the story the reader is. */
function ProgressBar() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      setPct(max > 0 ? Math.min(100, (el.scrollTop / max) * 100) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  return (
    <div className="no-print fixed inset-x-0 top-0 z-50 h-[3px] bg-transparent" aria-hidden>
      <div className="h-full bg-accent transition-[width] duration-100" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function StoryView({
  edition,
  item,
  story,
  sectionName,
  readItemIds,
  from,
  related,
}: {
  edition: Edition;
  item: EditionItem;
  story: StoryBody;
  sectionName: string;
  readItemIds: string[];
  from: "today" | "explore" | "paper";
  related: RelatedStory[];
}) {
  const router = useRouter();
  const [vote, setVote] = useState<"like" | "dislike" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [photoOk, setPhotoOk] = useState(true);
  const base = { editionId: edition.edition_id, itemId: item.item_id, topic: item.topic, sourceName: item.source_name };
  const frontHref = from === "explore" ? "/explore" : from === "today" ? "/today" : `/paper/${edition.edition_date}`;
  const backLabel = from === "explore" ? "‹ Explore" : "‹ Front page";

  useReadTimer(base);

  const paragraphs = useMemo(
    () => (story.body ? story.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean) : []),
    [story.body],
  );
  const hasBody = paragraphs.length > 0;
  const words = story.word_count ?? (story.body ? story.body.split(/\s+/).length : 0);

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
  const img = photo(item.image_url);
  const published = item.published_at
    ? new Date(item.published_at).toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;
  const listenParts = [item.headline, item.dek, ...(hasBody ? paragraphs : [item.summary])].filter(Boolean) as string[];

  return (
    <main className="w-full flex-1 pb-20">
      <ProgressBar />
      <div className="glass no-print sticky top-0 z-30 !rounded-none !border-x-0 !border-t-0 md:static">
      <div className="mx-auto flex max-w-[1080px] items-center justify-between gap-3 px-4 py-2 font-label text-xs md:px-6">
        <Link href={frontHref} className="font-semibold uppercase tracking-widest hover:text-accent">{backLabel}</Link>
        <span className="hidden truncate text-muted sm:block">
          {edition.paper_name} · {shortDate(edition.edition_date)}
        </span>
        <ReaderPrefs />
      </div>
      </div>

      <article className="mx-auto mt-8 max-w-[1080px] px-4 md:mt-12 md:px-6">
        <header className="mx-auto max-w-[720px]">
          <p className="font-label text-xs font-bold uppercase tracking-[0.14em] text-accent">{kicker}</p>
          <h1 className="mt-3 font-headline text-[34px] font-semibold leading-[1.1] tracking-[-0.01em] md:text-[46px]">
            {item.headline}
          </h1>
          {item.dek && <p className="mt-4 font-body text-xl leading-snug text-muted md:text-[22px]">{item.dek}</p>}
        </header>

        {img && photoOk && (
          <figure className="mx-auto mt-8 max-w-[1000px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img}
              alt={item.headline}
              className="photo-fade max-h-[620px] w-full bg-wash object-cover"
              onError={() => setPhotoOk(false)}
              // A photo can fail before the page becomes interactive; catch that case too.
              ref={(el) => {
                if (el && el.complete && el.naturalWidth === 0) setPhotoOk(false);
              }}
            />
            <figcaption className="mt-2 font-label text-xs text-muted">
              Photo: {item.source_name || "the publisher"}
            </figcaption>
          </figure>
        )}

        <div className="mx-auto mt-8 max-w-[720px]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-4">
            <div className="font-label text-sm">
              <p className="font-semibold">
                {story.author ? `By ${story.author}` : item.source_name}
                {story.author && item.source_name ? <span className="font-normal text-muted"> · {item.source_name}</span> : null}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {published && <time dateTime={item.published_at ?? undefined}>{published}</time>}
                {item.published_at && ` · ${timeAgo(item.published_at)}`}
                {hasBody && words > 0 && ` · ${readingMinutes(words)} min read`}
              </p>
            </div>
            <ReadAloud parts={listenParts} />
          </div>

          {item.key_points.length > 0 && (
            <aside className="glass-card mt-6 px-5 py-4" aria-label="Key facts">
              <h2 className="font-label text-xs font-bold uppercase tracking-[0.14em]">The essentials</h2>
              <ul className="mt-2 space-y-1.5">
                {item.key_points.map((p) => (
                  <li key={p} className="flex gap-3 font-body text-[17px] leading-snug">
                    <span className="text-accent" aria-hidden>■</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </aside>
          )}

          <section className="story-body mt-8" aria-label="Story">
            {hasBody ? (
              paragraphs.map((p, i) => (
                <p key={i} className={i === 0 ? "dropcap" : undefined}>
                  {p}
                </p>
              ))
            ) : item.summary || item.dek ? (
              <>
                <p className="dropcap">{item.summary || item.dek}</p>
                <p className="mt-4 font-label text-sm text-muted">
                  {item.source_name || "The publisher"} doesn&rsquo;t allow its full text to be shown here, so this is a summary.
                  The complete story is at the original source below.
                </p>
              </>
            ) : (
              <p className="italic text-muted">
                The publisher&rsquo;s feed only included this headline. The full story is at the original source below.
              </p>
            )}
          </section>

          {item.why_this && (
            <aside className="mt-10 border-l-4 border-accent pl-4">
              <h2 className="font-label text-xs font-bold uppercase tracking-[0.14em]">Why you&rsquo;re seeing this</h2>
              <p className="mt-1 font-body text-[17px] leading-snug">{item.why_this}</p>
            </aside>
          )}

          {item.url && (
            <p className="mt-8 font-label text-sm text-muted">
              {hasBody ? "Originally published by " : "Read the full story at "}
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => logEvent({ ...base, type: "click_through" })}
                className="inline-flex items-center gap-1 font-semibold text-accent underline-offset-2 hover:underline"
              >
                {item.source_name || "the publisher"} <ArrowUpRight size={14} aria-hidden />
              </a>
            </p>
          )}

          <div className="no-print mt-8 flex flex-wrap items-center gap-2 border-t border-rule pt-5">
            <span className="mr-2 font-body italic text-muted">Was this worth your time?</span>
            <button
              type="button"
              onClick={() => rate("like")}
              aria-pressed={vote === "like"}
              className="btn btn-glass btn-sm"
            >
              <ThumbsUp size={13} aria-hidden /> More like this
            </button>
            <button
              type="button"
              onClick={() => rate("dislike")}
              aria-pressed={vote === "dislike"}
              className="btn btn-glass btn-sm"
            >
              <ThumbsDown size={13} aria-hidden /> Less like this
            </button>
            <button type="button" onClick={notForMe} className="btn btn-sm text-muted hover:text-accent">
              Not for me
            </button>
            <button
              type="button"
              onClick={() => openAssistant(`What happened: ${item.headline}`)}
              className="btn btn-primary btn-sm ml-auto"
            >
              Ask about this story
            </button>
          </div>

          <MoreStories date={edition.edition_date} sectionName={sectionName} next={nextInSection} more={more} onOpen={openOther} />

          {related.length > 0 && (
            <nav className="mt-10 border-t border-rule pt-4" aria-label="Related stories">
              <h2 className="font-label text-xs font-bold uppercase tracking-[0.14em]">Related, from earlier editions</h2>
              <ul className="mt-2 divide-y divide-rule">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link href={`/paper/${r.date}/story/${r.id}`} className="group block py-3">
                      <span className="font-headline text-lg font-semibold leading-snug group-hover:underline">{r.headline}</span>
                      <span className="mt-0.5 block font-label text-xs text-muted">
                        {r.source} · {shortDate(r.date)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      </article>

      {toast && (
        <div role="status" className="glass-strong sheet-in fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-2.5 font-label text-[13px] font-semibold md:bottom-8">
          {toast}
        </div>
      )}
    </main>
  );
}
