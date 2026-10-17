// Shared top of every game page: back link to the hub, title and a one-line description.
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function GameHeader({ title, blurb }: { title: string; blurb: string }) {
  return (
    <header className="mb-6">
      <Link
        href="/games"
        className="inline-flex items-center gap-1.5 font-label text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft size={16} aria-hidden /> All games
      </Link>
      <h1 className="mt-3 font-headline text-[34px] font-semibold leading-tight tracking-tight text-ink md:text-[44px]">
        {title}
      </h1>
      <p className="mt-1 font-body text-[16px] text-muted">{blurb}</p>
    </header>
  );
}

export function GameLoading({ label = "Loading the puzzle…" }: { label?: string }) {
  return (
    <div className="glass-card rounded-3xl p-8 text-center font-label text-sm text-muted" role="status">
      {label}
    </div>
  );
}
