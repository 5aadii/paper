"use client";
// One clickable story on the front page — headline + dek + image are one link (SPEC Section 8.6).
import { X } from "lucide-react";
import Link from "next/link";
import { timeAgo, type EditionItem } from "@/lib/edition";

const SIZES = {
  lead: "text-[40px] leading-[1.05] md:text-[56px] lg:text-[64px]",
  feature: "text-[26px] leading-[1.1] md:text-[30px]",
  standard: "text-[19px] leading-[1.15] md:text-[20px]",
  brief: "text-[15px] leading-snug",
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
  const img = item.image_url && role !== "brief" ? item.image_url : null;
  const hideBroken = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget.closest("[data-photo]") as HTMLElement | null;
    (el ?? e.currentTarget).style.display = "none";
  };
  const photo = (cls: string) =>
    img ? (
      <figure data-photo className={cls}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img} alt="" loading={role === "lead" ? "eager" : "lazy"} referrerPolicy="no-referrer"
          onError={hideBroken} className="h-full w-full object-cover" />
      </figure>
    ) : null;
  const text = (
    <>
      <p className="font-label text-[11px] font-semibold uppercase tracking-widest text-accent">{section}</p>
      <h2
        className={`mt-1 font-headline font-bold decoration-accent decoration-1 underline-offset-4 group-hover:underline ${SIZES[role]}`}
      >
        {item.headline}
      </h2>
      {item.dek && (
        <p
          className={`mt-2 font-body italic text-ink/85 ${role === "lead" ? "text-xl md:text-2xl" : "text-[17px]"} ${
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
        <p className="mt-2 flex flex-wrap items-center gap-2 font-label text-[11px] uppercase tracking-widest text-muted">
          <span>{item.source_name}</span>
          {item.published_at && <span>· {timeAgo(item.published_at)}</span>}
          {read && <span className="border border-muted/60 px-1 text-[9px] leading-tight">Read</span>}
        </p>
      </div>
      {skipped ? (
        <p className="mt-1 font-label text-[11px] uppercase tracking-widest">
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
