// Paper name, classic double rule and the VOL · NO · date · PREPARED FOR line (SPEC Section 8.6).
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
      <div className="border-t border-rule" />
      <div className="relative flex items-center justify-center py-3 md:py-4">
        {leftEar && (
          <div className="absolute left-0 top-1/2 hidden max-w-[150px] -translate-y-1/2 border border-ink px-2 py-1 text-center font-label text-[10px] uppercase leading-tight tracking-widest lg:block">
            {leftEar}
          </div>
        )}
        <h1
          className={`px-2 text-center font-headline font-black leading-none ${
            compact ? "text-3xl md:text-5xl" : "text-[36px] sm:text-5xl md:text-6xl lg:text-7xl"
          }`}
        >
          {paperName}
        </h1>
      </div>
      <div className="border-t-[3px] border-rule" />
      <div className="mt-[3px] border-t border-rule" />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-1.5 font-label text-[11px] uppercase tracking-widest">
        <span>Vol. 1 · No. {editionNumber}</span>
        <span className="order-3 w-full text-center sm:order-none sm:w-auto">{longDate(date)}</span>
        <span className="flex items-center gap-3">
          <span>Prepared for {readerName}</span>
          {controls}
        </span>
      </div>
      <div className="border-t border-rule" />
    </header>
  );
}
