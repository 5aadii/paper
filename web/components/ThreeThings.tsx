// THREE THINGS TO REMEMBER TODAY (SPEC Sections 8.6, 9).
import Link from "next/link";

export default function ThreeThings({
  things,
  hrefFor,
}: {
  things: { text: string; item_id: string }[];
  hrefFor: (itemId: string) => string;
}) {
  if (!things.length) return null;
  return (
    <section>
      <h3 className="border-t-[3px] border-rule pt-2 font-label text-[11px] font-bold uppercase tracking-widest">
        Three things to remember today
      </h3>
      <ol className="mt-2 space-y-2">
        {things.slice(0, 3).map((t, i) => (
          <li key={t.item_id + i} className="flex gap-2 font-body text-[16px] leading-snug">
            <span className="font-headline text-2xl font-black leading-none text-accent">{i + 1}</span>
            <Link href={hrefFor(t.item_id)} className="hover:underline hover:decoration-accent">
              {t.text}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
