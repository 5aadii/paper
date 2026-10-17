export default function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="fixed inset-x-0 top-0 z-20 h-1 bg-ink/10" aria-hidden>
      <div className="h-full bg-accent transition-all duration-300" style={{ width: `${((step + 1) / total) * 100}%` }} />
    </div>
  );
}
