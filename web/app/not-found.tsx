// 404 in newspaper style.
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center px-4 py-24 text-center">
      <p className="font-label text-xs font-bold uppercase tracking-[0.14em] text-accent">Correction</p>
      <h1 className="mt-3 font-headline text-4xl font-semibold">We couldn&rsquo;t find that page.</h1>
      <p className="mt-4 font-body text-lg text-muted">
        The story may be from someone else&rsquo;s paper, or the link is out of date.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/today" className="btn btn-primary">
          Today&rsquo;s paper
        </Link>
        <Link href="/archive" className="btn btn-glass">
          The archive
        </Link>
      </div>
    </main>
  );
}
