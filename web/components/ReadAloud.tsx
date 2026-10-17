"use client";
// "Listen" button: reads text aloud with the browser's built-in speechSynthesis (SPEC Section 9.4).
import { Pause, Volume2 } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

const noop = () => () => {};

/** Long utterances get cut off in some browsers, so speak paragraph by paragraph. */
function chunks(parts: string[]): string[] {
  const out: string[] = [];
  for (const p of parts) {
    const t = p.trim();
    if (!t) continue;
    if (t.length <= 600) out.push(t);
    else out.push(...(t.match(/[^.!?]+[.!?]+["”’]?\s*|[^.!?]+$/g) ?? [t]).map((s) => s.trim()).filter(Boolean));
  }
  return out;
}

export default function ReadAloud({ parts, label = "Listen" }: { parts: string[]; label?: string }) {
  const supported = useSyncExternalStore(noop, () => "speechSynthesis" in window, () => false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  if (!supported) return null;

  function toggle() {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    synth.cancel();
    const voices = synth.getVoices();
    const voice = voices.find((v) => /en[-_](GB|US)/i.test(v.lang) && /natural|google|samantha|daniel/i.test(v.name))
      ?? voices.find((v) => v.lang.startsWith("en"));
    const list = chunks(parts);
    list.forEach((text, i) => {
      const u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      u.rate = 1;
      if (i === list.length - 1) u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      synth.speak(u);
    });
    setSpeaking(list.length > 0);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={speaking}
      className="btn btn-glass btn-sm"
    >
      {speaking ? <Pause size={14} aria-hidden /> : <Volume2 size={14} aria-hidden />}
      {speaking ? "Stop" : label}
    </button>
  );
}
