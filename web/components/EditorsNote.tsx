"use client";
// FROM THE EDITOR box. Collapses to two lines on mobile with "more" (SPEC Section 8.6).
import { useState } from "react";

export default function EditorsNote({ note }: { note: string }) {
  const [open, setOpen] = useState(false);
  if (!note) return null;
  return (
    <section className="bg-wash px-4 py-3">
      <h3 className="font-label text-xs font-bold uppercase tracking-widest">From the Editor</h3>
      <p className={`mt-1 font-body text-[16px] leading-relaxed ${open ? "" : "line-clamp-2 md:line-clamp-none"}`}>{note}</p>
      {!open && (
        <button type="button" onClick={() => setOpen(true)} className="font-label text-xs uppercase tracking-widest text-accent md:hidden">
          more
        </button>
      )}
    </section>
  );
}
