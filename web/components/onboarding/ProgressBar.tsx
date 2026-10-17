const NAMES = ["Masthead", "Topics", "Specifics", "Style"];

export default function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <>
      <div className="fixed inset-x-0 top-0 z-20 h-1 bg-ink/10" aria-hidden>
        <div className="h-full bg-accent transition-all duration-300" style={{ width: `${((step + 1) / total) * 100}%` }} />
      </div>
      <ol className="flex gap-1 font-label text-xs uppercase tracking-widest" aria-label="Progress">
        {NAMES.slice(0, total).map((n, i) => (
          <li key={n} aria-current={i === step ? "step" : undefined} className="flex-1">
            <span className={`block border-t-2 pt-1.5 ${i <= step ? "border-accent" : "border-ink/20"} ${i === step ? "font-bold text-ink" : "text-muted"}`}>
              {i + 1}. {n}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}
