"use client";
// Friendly error page for anything that breaks while rendering.
import Link from "next/link";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center px-4 py-24 text-center">
      <p className="font-label text-xs font-bold uppercase tracking-[0.14em] text-accent">Stop the press</p>
      <h1 className="mt-3 font-headline text-4xl font-semibold">Something went wrong printing this page.</h1>
      <p className="mt-4 font-body text-lg text-muted">It&rsquo;s probably temporary. Try again, or head back to today&rsquo;s paper.</p>
      <div className="mt-8 flex gap-3">
        <button type="button" onClick={reset} className="btn btn-primary">
          Try again
        </button>
        <Link href="/today" className="btn btn-glass">
          Today&rsquo;s paper
        </Link>
      </div>
    </main>
  );
}
