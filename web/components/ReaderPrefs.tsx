"use client";
// Reading preferences: theme (light / sepia / dark) and story text size. Saved in this browser only.
import { Minus, Moon, Plus, Sun, Coffee } from "lucide-react";
import { useSyncExternalStore } from "react";

type Theme = "light" | "sepia" | "dark";
const SIZES = ["s", "m", "l", "xl"] as const;
type Size = (typeof SIZES)[number];

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

// The current prefs live on <html data-theme / data-text>; components subscribe to changes.
const listeners = new Set<() => void>();
function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const readTheme = () => (document.documentElement.dataset.theme as Theme) || "light";
const readSize = () => (document.documentElement.dataset.text as Size) || "m";

export function useReaderPrefs() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light" as Theme);
  const size = useSyncExternalStore(subscribe, readSize, () => "m" as Size);

  function setTheme(t: Theme) {
    document.documentElement.dataset.theme = t;
    save("me-theme", t);
    listeners.forEach((fn) => fn());
  }
  function setSize(s: Size) {
    document.documentElement.dataset.text = s;
    save("me-text", s);
    listeners.forEach((fn) => fn());
  }
  return { theme, setTheme, size, setSize };
}

const THEMES: { id: Theme; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "sepia", label: "Sepia", icon: Coffee },
  { id: "dark", label: "Dark", icon: Moon },
];

/** Compact glass controls used on the story page: A− A+ and the three themes. */
export default function ReaderPrefs() {
  const { theme, setTheme, size, setSize } = useReaderPrefs();
  const i = SIZES.indexOf(size);
  return (
    <div className="flex items-center gap-2 font-label text-xs" role="group" aria-label="Reading preferences">
      <div className="segmented">
        <button type="button" onClick={() => setSize(SIZES[i - 1])} disabled={i <= 0} aria-label="Smaller text">
          <span className="text-[12px] font-semibold">A</span>
          <Minus size={11} aria-hidden />
        </button>
        <button type="button" onClick={() => setSize(SIZES[i + 1])} disabled={i >= SIZES.length - 1} aria-label="Larger text">
          <span className="text-[15px] font-semibold">A</span>
          <Plus size={11} aria-hidden />
        </button>
      </div>
      <div className="segmented">
        {THEMES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTheme(id)}
            aria-pressed={theme === id}
            aria-label={`${label} theme`}
            title={`${label} theme`}
          >
            <Icon size={14} aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}

/** One-button theme switcher for the top bar: cycles light → sepia → dark. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useReaderPrefs();
  const next: Theme = theme === "light" ? "sepia" : theme === "sepia" ? "dark" : "light";
  const Icon = theme === "dark" ? Moon : theme === "sepia" ? Coffee : Sun;
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={`inline-flex h-9 w-9 items-center justify-center text-ink transition-transform active:scale-95 ${className}`}
    >
      <Icon size={16} aria-hidden />
    </button>
  );
}
