"use client";
// IN BRIEF rail — one-line headlines (SPEC Section 8.6).
import Link from "next/link";
import type { EditionItem } from "@/lib/edition";

export default function BriefsColumn({
  items,
  hrefFor,
  onOpen,
  readIds,
}: {
  items: EditionItem[];
  hrefFor: (item: EditionItem) => string;
  onOpen: (item: EditionItem) => void;
  readIds: Set<string>;
}) {
  if (!items.length) return null;
  return (
    <section id="sec-briefs" className="scroll-mt-4">
      <h3 className="border-t-[3px] border-rule pt-2 font-label text-[11px] font-bold uppercase tracking-widest">In Brief</h3>
      <ul className="mt-2 divide-y divide-ink/20">
        {items.map((it) => (
          <li key={it.item_id} className="py-2">
            <Link
              href={hrefFor(it)}
              onClick={() => onOpen(it)}
              className="group block font-headline text-[15px] font-bold leading-snug"
            >
              <span className="group-hover:underline group-hover:decoration-accent">· {it.headline}</span>
              {readIds.has(it.item_id) && (
                <span className="ml-2 border border-muted/60 px-1 align-middle font-label text-[9px] font-normal uppercase tracking-widest text-muted">
                  Read
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
