"use client";
// The broadsheet front page: headlines + deks only (SPEC Section 8.6).
import { Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { logEvent } from "@/lib/events";
import { sectionAnchor, type Edition, type EditionItem } from "@/lib/edition";
import BriefsColumn from "./BriefsColumn";
import EditionMenu from "./EditionMenu";
import EditorsNote from "./EditorsNote";
import HeadlineBlock from "./HeadlineBlock";
import Masthead from "./Masthead";
import ThreeThings from "./ThreeThings";

type Placed = { item: EditionItem; section: string; anchor?: string };

export default function FrontPage({
  edition,
  readItemIds,
  isToday,
}: {
  edition: Edition;
  readItemIds: string[];
  isToday: boolean;
}) {
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const readIds = useMemo(() => new Set(readItemIds), [readItemIds]);
  const scrollKey = `fp-scroll-${edition.edition_id}`;

  // Restore the front-page scroll position when returning from a story.
  useEffect(() => {
    try {
      const y = sessionStorage.getItem(scrollKey);
      if (y) window.scrollTo(0, parseInt(y, 10));
    } catch {
      /* storage unavailable */
    }
  }, [scrollKey]);

  const hrefFor = (it: EditionItem) => `/paper/${edition.edition_date}/story/${it.item_id}`;
  const sectionOf = new Map<string, string>();
  edition.sections.forEach((s) => s.items.forEach((it) => sectionOf.set(it.item_id, s.name)));

  function open(it: EditionItem) {
    try {
      sessionStorage.setItem(scrollKey, String(window.scrollY));
    } catch {
      /* ignore */
    }
    logEvent({ editionId: edition.edition_id, itemId: it.item_id, topic: it.topic, sourceName: it.source_name, type: "open" });
  }
  function skip(it: EditionItem) {
    setSkipped((s) => new Set(s).add(it.item_id));
    logEvent({ editionId: edition.edition_id, itemId: it.item_id, topic: it.topic, sourceName: it.source_name, type: "skip" });
  }
  function undo(it: EditionItem) {
    setSkipped((s) => {
      const n = new Set(s);
      n.delete(it.item_id);
      return n;
    });
  }

  // Lay out: lead, 3 columns of features/standards, briefs rail, explore strip.
  const { lead, columns, briefs, explore } = useMemo(() => {
    const seen = new Set<string>();
    const all: Placed[] = [];
    for (const s of edition.sections) {
      s.items.forEach((item) => {
        const anchor = seen.has(s.name) ? undefined : sectionAnchor(s.name);
        seen.add(s.name);
        all.push({ item, section: s.name, anchor });
      });
    }
    const lead = all.find((p) => p.item.layout_role === "lead") ?? all[0];
    const briefs = all.filter((p) => p.item.layout_role === "brief" && p !== lead);
    const explore = all.filter((p) => p.item.is_explore && p.item.layout_role !== "brief" && p !== lead);
    const middle = all.filter((p) => p !== lead && !briefs.includes(p) && !explore.includes(p));
    const feats = middle.filter((p) => p.item.layout_role === "feature");
    const stds = middle.filter((p) => p.item.layout_role !== "feature");
    const columns: Placed[][] = [[], [], []];
    feats.forEach((p, i) => columns[i % 2].push(p));
    // Features sit atop columns 1–2, so standards start in column 3, then round-robin.
    stds.forEach((p, i) => columns[(2 + i) % 3].push(p));
    return { lead, columns, briefs, explore };
  }, [edition.sections]);

  const block = (p: Placed) => (
    <HeadlineBlock
      key={p.item.item_id}
      item={p.item}
      section={p.item.is_explore ? "Explore" : p.section}
      href={hrefFor(p.item)}
      read={readIds.has(p.item.item_id)}
      skipped={skipped.has(p.item.item_id)}
      onOpen={() => open(p.item)}
      onSkip={() => skip(p.item)}
      onUndo={() => undo(p.item)}
      anchorId={p.anchor}
    />
  );

  const storyCount = edition.sections.reduce((n, s) => n + s.items.length, 0);
  const insideSections = edition.sections.map((s) => s.name);

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-24 pt-4 md:px-6 md:pb-10">
      <Masthead
        paperName={edition.paper_name}
        editionNumber={edition.edition_number}
        date={edition.edition_date}
        readerName={edition.reader_name}
        leftEar={`${storyCount} stories picked for you`}
        controls={<EditionMenu editionId={edition.edition_id} canRegenerate={isToday} />}
      />
      <nav
        aria-label="Sections"
        className="flex gap-4 overflow-x-auto whitespace-nowrap border-b border-rule py-2 font-label text-[11px] uppercase tracking-widest"
      >
        <span className="font-bold">Inside:</span>
        {insideSections.map((name, i) => (
          <a key={name + i} href={`#${name === "Briefs" ? "sec-briefs" : sectionAnchor(name)}`} className="hover:text-accent">
            {name}
          </a>
        ))}
      </nav>
      {edition.ai_status === "fallback" && (
        <p className="border-b border-rule py-1.5 text-center font-body text-sm italic text-muted">
          Today&rsquo;s edition was put together without the AI editor; summaries come straight from the sources.
        </p>
      )}

      {/* Lead + editor rail */}
      <div className="grid gap-6 border-b border-rule py-5 lg:grid-cols-12 lg:gap-0">
        <div className="lg:col-span-8 lg:pr-6">{lead && block(lead)}</div>
        <aside className="space-y-5 lg:col-span-4 lg:border-l lg:border-rule lg:pl-6">
          <EditorsNote note={edition.editors_note} />
          <ThreeThings things={edition.three_things} hrefFor={(id) => `/paper/${edition.edition_date}/story/${id}`} />
        </aside>
      </div>

      {/* Three story columns + briefs rail */}
      <div className="grid gap-0 border-b border-rule lg:grid-cols-12">
        <div className="grid md:grid-cols-3 lg:col-span-9">
          {columns.map((col, ci) => (
            <div
              key={ci}
              className={`divide-y divide-ink/30 md:px-5 ${ci === 0 ? "md:pl-0" : "md:border-l md:border-rule"} ${
                col.length ? "" : "hidden md:block"
              }`}
            >
              {col.map((p) => (
                <div key={p.item.item_id} className="py-5">
                  {block(p)}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="py-5 lg:col-span-3 lg:border-l lg:border-rule lg:pl-6">
          <BriefsColumn
            items={briefs.map((p) => p.item)}
            hrefFor={hrefFor}
            onOpen={open}
            readIds={readIds}
          />
        </div>
      </div>

      {explore.length > 0 && (
        <section id={sectionAnchor("Explore")} className="mt-6 scroll-mt-4 border border-dashed border-ink/60 p-4">
          <h3 className="font-label text-[11px] font-bold uppercase tracking-widest">Explore — something new</h3>
          <div className="mt-3 grid gap-6 md:grid-cols-2">{explore.map((p) => block({ ...p, anchor: undefined }))}</div>
        </section>
      )}

      <p className="mt-10 border-t-[3px] border-rule pt-3 text-center font-body italic text-muted">
        That&rsquo;s your paper for today. See you tomorrow morning.
      </p>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-paper p-3 sm:hidden">
        <a
          href={`/api/pdf/${edition.edition_id}`}
          className="flex items-center justify-center gap-2 bg-accent py-3 font-label text-xs font-semibold uppercase tracking-widest text-paper"
        >
          <Download size={14} aria-hidden /> Download PDF
        </a>
      </div>
    </main>
  );
}
