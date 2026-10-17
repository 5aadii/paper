// Landing page (SPEC Section 8.3).
import Link from "next/link";

const COLUMNS = [
  ["Tell us what you care about", "A one-minute onboarding: name your paper, tap the topics you follow, add anything specific."],
  ["We edit your paper every morning", "Stories gathered from across the web, chosen and summarised by an AI editor, laid out like a real front page."],
  ["It learns what you actually read", "Which headlines you open, how long you really read, what you like or skip — your paper adjusts every day."],
];

export default function Landing() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-12 md:py-20">
      <div className="border-t border-rule pt-1">
        <div className="border-t-[3px] border-rule-strong" />
      </div>
      <p className="mt-6 text-center font-label text-xs uppercase tracking-widest text-muted">
        Vol. 1 · A personal newspaper
      </p>
      <h1 className="mt-3 text-center font-masthead text-5xl font-bold leading-[1.05] md:text-8xl">
        The Morning Edition
      </h1>
      <p className="mx-auto mt-6 max-w-2xl text-center font-body text-xl italic leading-relaxed text-muted">
        Your news, gathered from across the web and edited into one paper every morning, just for you.
      </p>
      <div className="mx-auto mt-10 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/signup"
          className="btn btn-primary text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Start my paper
        </Link>
        <Link
          href="/login"
          className="btn btn-glass text-center"
        >
          Log in
        </Link>
      </div>
      <div className="mt-14 border-t border-rule">
        <div className="grid md:grid-cols-3">
          {COLUMNS.map(([title, body], i) => (
            <section
              key={title}
              className={`py-6 md:px-6 ${i > 0 ? "border-t border-rule md:border-l md:border-t-0" : ""}`}
            >
              <h2 className="font-headline text-2xl font-bold leading-tight">{title}</h2>
              <p className="mt-2 font-body text-[17px] leading-relaxed text-muted">{body}</p>
            </section>
          ))}
        </div>
      </div>
      <div className="border-t-[3px] border-rule-strong" />
    </main>
  );
}
