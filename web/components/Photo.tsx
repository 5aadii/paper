"use client";
// News photo: fades in when loaded, removes itself (and its frame) if the URL is broken.
// Never substitutes an unrelated image.
import { useEffect, useRef, useState } from "react";

export default function Photo({
  src,
  className = "",
  ratio = "aspect-[3/2]",
  eager = false,
  credit,
}: {
  src: string | null | undefined;
  className?: string;
  ratio?: string;
  eager?: boolean;
  credit?: string | null;
}) {
  const [state, setState] = useState<"loading" | "ok" | "failed">("loading");
  const ref = useRef<HTMLImageElement>(null);
  // Images can finish (or fail) before React hydrates, so their events never reach us: check on mount.
  useEffect(() => {
    const img = ref.current;
    if (img?.complete) setState(img.naturalWidth > 0 ? "ok" : "failed");
  }, [src]);
  if (!src || state === "failed") return null;
  return (
    <figure className={className}>
      <div className={`photo ${ratio} w-full`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={ref}
          src={src}
          alt=""
          loading={eager ? "eager" : "lazy"}
          referrerPolicy="no-referrer"
          data-loaded={state === "ok"}
          onLoad={() => setState("ok")}
          onError={() => setState("failed")}
          className="h-full w-full object-cover"
        />
      </div>
      {credit && (
        <figcaption className="mt-1 text-right font-label text-[11px] tracking-wide text-muted">{credit}</figcaption>
      )}
    </figure>
  );
}
