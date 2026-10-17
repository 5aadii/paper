"use client";
// One clickable story on the front page — headline + dek + image are one link (SPEC Section 8.6).
import { X } from "lucide-react";
import Link from "next/link";
import { timeAgo, type EditionItem } from "@/lib/edition";
import { photo as proxied } from "@/lib/img";

const SIZES = {
  lead: "text-[34px] leading-[1.08] tracking-[-0.01em] md:text-[44px] lg:text-[50px]",
  feature: "text-[24px] leading-[1.15] md:text-[26px]",
  standard: "text-[19px] leading-[1.2] md:text-[20px]",
  brief: "text-[16px] leading-snug",
};

export default function HeadlineBlock({
  item,
  section,
  href,
  read,
  skipped,
  onOpen,
  onSkip,
  onUndo,
  anchorId,
}: {
  item: EditionItem;
  section: string;
  href: string;
  read: boolean;
  skipped: boolean;
  onOpen: () => void;
  onSkip: () => void;
  onUndo: () => void;
  anchorId?: string;
}) {
  const role = item.layout_role;
  const img = role !== "brief" ? proxied(item.image_url) : null;
  const hideImg = (img: HTMLImageElement) => {
    const el = img.closest("[data-photo]") as HTMLElement | null;
    (el ?? img).style.display = "none";
  };
  const hideBroken = (e: React.SyntheticEvent<HTMLImageElement>) => hideImg(e.currentTarget);
  // A photo can fail before the page becomes interactive (onError never fires then); catch that too.
  const checkLoaded = (img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth === 0) hideImg(img);
  };
  const photo = (cls: string) =>
    img ? (
      <figure data-photo className={cls}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img} alt="" loading={role === "lead" ? "eager" : "lazy"} referrerPolicy="no-referrer"
          onError={hideBroken} ref={checkLoaded} className="photo-fade h-full w-full object-cover" />
      </figure>
    ) : null;
  const text = (
    <>
      <p className="font-label text-xs font-semibold uppercase tracking-[0.12em] text-muted">{section}</p>
      <h2
        className={`mt-1.5 font-headline font-semibold decoration-ink/40 decoration-1 underline-offset-4 group-hover:underline ${SIZES[role]}`}
      >
        {item.headline}
      </h2>
      {item.dek && (
        <p
          className={`mt-2 font-body leading-snug text-muted ${role === "lead" ? "text-lg md:text-xl" : "text-base"} ${
            role === "standard" ? "hidden md:block" : ""
          }`}
        >
          {item.dek}
        </p>
      )}
    </>
  );
  return (
    <article id={anchorId} className="group relative scroll-mt-4">
      <div className={`transition-opacity duration-300 ${skipped ? "opacity-30" : ""}`}>
        <Link
          href={href}
          onClick={onOpen}
          className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          {role === "lead" ? (
            // NYT-style lead: big photo first, headline under it.
            <>
              {photo("mb-4 aspect-[16/9] w-full overflow-hidden bg-ink/5")}
              {text}
            </>
          ) : role === "feature" ? (
            <>
              {photo("mb-3 aspect-[3/2] w-full overflow-hidden bg-ink/5")}
              {text}
            </>
          ) : (
            // Standard: text with a small square thumbnail on the right.
            <div className="flex gap-4">
              <div className="min-w-0 flex-1">{text}</div>
              {photo("h-20 w-20 shrink-0 overflow-hidden bg-ink/5 md:h-24 md:w-24")}
            </div>
          )}
        </Link>
        <p className="mt-2.5 flex flex-wrap items-center gap-2 font-label text-xs text-muted">
          {item.word_count ? <span>{Math.max(1, Math.round(item.word_count / 230))} min read ·</span> : null}
          <span>{item.source_name}</span>
          {item.published_at && <span>· {timeAgo(item.published_at)}</span>}
          {read && <span className="border border-muted/60 px-1 text-xs uppercase leading-tight tracking-wider">Read</span>}
        </p>
      </div>
      {skipped ? (
        <p className="mt-1 font-label text-xs uppercase tracking-widest">
          Skipped ·{" "}
          <button type="button" onClick={onUndo} className="text-accent underline">
            Undo
          </button>
        </p>
      ) : (
        <button
          type="button"
          onClick={onSkip}
          title="Not for me"
          aria-label={`Not for me: ${item.headline}`}
          className="absolute right-0 top-0 hidden h-6 w-6 items-center justify-center bg-paper text-muted opacity-0 transition-opacity hover:text-accent focus:opacity-100 group-hover:opacity-100 md:flex"
        >
          <X size={14} />
        </button>
      )}
    </article>
  );
}
