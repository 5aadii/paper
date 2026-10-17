// Paper name in blackletter, classic double rule and the VOL · NO · date · PREPARED FOR line (SPEC Section 8.6).
import { longDate } from "@/lib/edition";

export default function Masthead({
  paperName,
  editionNumber,
  date,
  readerName,
  leftEar,
  controls,
  compact = false,
}: {
  paperName: string;
  editionNumber: number | string;
  date: string;
  readerName: string;
  leftEar?: React.ReactNode;
  controls?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <header className="w-full">
      <div className="relative flex items-center justify-center pb-2 pt-4 md:pb-3 md:pt-6">
        {leftEar && (
          <div className="absolute left-0 top-1/2 hidden max-w-[160px] -translate-y-1/2 font-label text-xs leading-snug text-muted lg:block">
            {leftEar}
          </div>
        )}
        <h1
          className={`px-2 text-center font-masthead font-bold leading-none ${
            compact ? "text-4xl md:text-5xl" : "text-[40px] sm:text-6xl md:text-7xl lg:text-[84px]"
          }`}
        >
          {paperName}
        </h1>
        <div className="absolute right-0 top-1/2 hidden max-w-[180px] -translate-y-1/2 text-right font-label text-xs leading-snug text-muted lg:block">
          Today&rsquo;s paper
          <br />
          Prepared for {readerName}
        </div>
      </div>
      <div className="border-t border-rule-strong" />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 font-label text-xs font-semibold">
        <span className="uppercase tracking-wider">Vol. 1 · No. {editionNumber}</span>
        <span className="order-3 w-full text-center sm:order-none sm:w-auto">{longDate(date)}</span>
        <span className="flex items-center gap-3">
          <span className="lg:hidden">For {readerName}</span>
          {controls}
        </span>
      </div>
      <div className="border-t-[3px] border-double border-rule-strong pt-px" />
    </header>
  );
}
