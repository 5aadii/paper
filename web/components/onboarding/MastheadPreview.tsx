import { longDate, todayIn } from "@/lib/edition";

export default function MastheadPreview({ paperName, readerName }: { paperName: string; readerName: string }) {
  const name = paperName.trim() || "The Morning Edition";
  return (
    <div className="mt-8 bg-paper px-4 py-5 shadow-[0_0_0_1px_rgba(26,26,26,0.15)]" aria-label="Masthead preview">
      <div className="border-t border-rule" />
      <p
        className="py-3 text-center font-masthead font-bold leading-none transition-all"
        style={{ fontSize: `clamp(1.6rem, ${Math.max(2.2, 7 - name.length * 0.12)}vw, 3.4rem)` }}
      >
        {name}
      </p>
      <div className="border-t-[3px] border-rule-strong" />
      <div className="mt-[3px] border-t border-rule" />
      <div className="flex justify-between gap-2 py-1.5 font-label text-xs uppercase tracking-widest text-muted">
        <span>Vol. 1 · No. 1</span>
        <span className="hidden sm:inline">{longDate(todayIn())}</span>
        <span>Prepared for {readerName.trim() || "you"}</span>
      </div>
      <div className="border-t border-rule" />
    </div>
  );
}
