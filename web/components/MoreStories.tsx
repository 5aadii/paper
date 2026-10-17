"use client";
// "Next in section" / "More from today's paper" (SPEC Section 8.7).
import Link from "next/link";
import type { EditionItem } from "@/lib/edition";

type Entry = { item: EditionItem; section: string };

export default function MoreStories({
  date,
  sectionName,
  next,
  more,
  onOpen,
}: {
  date: string;
  sectionName: string;
  next: Entry | null;
  more: Entry[];
  onOpen: (it: EditionItem) => void;
}) {
  if (!next && !more.length) return null;
  const href = (it: EditionItem) => `/paper/${date}/story/${it.item_id}`;
  const link = "group block py-2 font-headline text-lg font-bold leading-snug";
  return (
    <nav className="mt-12 grid gap-6 border-t-[3px] border-rule-strong pt-4 md:grid-cols-2" aria-label="More stories">
      {next && (
        <div>
          <h2 className="font-label text-xs font-bold uppercase tracking-widest">Next in {sectionName}</h2>
          <Link href={href(next.item)} onClick={() => onOpen(next.item)} className={link}>
            <span className="group-hover:underline group-hover:decoration-accent">{next.item.headline}</span> →
          </Link>
        </div>
      )}
      {more.length > 0 && (
        <div>
          <h2 className="font-label text-xs font-bold uppercase tracking-widest">More from today&rsquo;s paper</h2>
          <ul className="divide-y divide-rule">
            {more.map((m) => (
              <li key={m.item.item_id}>
                <Link href={href(m.item)} onClick={() => onOpen(m.item)} className={link}>
                  <span className="group-hover:underline group-hover:decoration-accent">{m.item.headline}</span> →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
}
