"use client";
// An internal story link that records one `open` event when clicked (SPEC 5.3).
import Link from "next/link";
import { logEvent } from "@/lib/events";

export default function TrackedStoryLink({
  href,
  event,
  className,
  children,
}: {
  href: string;
  event: { editionId: string; itemId: string; topic: string | null; sourceName: string | null };
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={className} onClick={() => logEvent({ ...event, type: "open" })}>
      {children}
    </Link>
  );
}
