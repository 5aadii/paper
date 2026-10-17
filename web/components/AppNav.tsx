"use client";
// App-wide navigation: a frosted-glass top bar on desktop, a floating glass tab bar on mobile.
// Hidden on the landing, auth and onboarding pages. "Ask" lives in the chat bubble (ChatWidget).
import { Archive, Compass, Gamepad2, Newspaper, PenTool, Settings, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ReaderPrefs";

const LINKS = [
  { href: "/today", label: "Today", icon: Newspaper, match: ["/today", "/paper"] },
  { href: "/explore", label: "Explore", icon: Compass, match: ["/explore"] },
  { href: "/games", label: "Games", icon: Gamepad2, match: ["/games"] },
  { href: "/cartoons", label: "Cartoons", icon: PenTool, match: ["/cartoons"] },
  // Archive and Interests are also in the edition menu, so the phone tab bar leaves them out.
  { href: "/archive", label: "Archive", icon: Archive, match: ["/archive"], desktopOnly: true },
  { href: "/interests", label: "Interests", icon: SlidersHorizontal, match: ["/interests"], desktopOnly: true },
  { href: "/settings", label: "Settings", icon: Settings, match: ["/settings"] },
];

export const NAV_HIDDEN = ["/", "/login", "/signup", "/onboarding", "/forgot", "/auth"];

export function isNavHidden(path: string): boolean {
  return NAV_HIDDEN.some((h) => (h === "/" ? path === "/" : path === h || path.startsWith(h + "/")));
}

export default function AppNav() {
  const path = usePathname() || "/";
  if (isNavHidden(path)) return null;
  const active = (m: string[]) => m.some((p) => path === p || path.startsWith(p + "/"));

  return (
    <>
      <nav aria-label="Main" className="glass sticky top-0 z-40 hidden !rounded-none !border-x-0 !border-t-0 md:block">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-2">
          <Link href="/today" className="font-masthead text-2xl leading-none">
            The Morning Edition
          </Link>
          <div className="flex items-center gap-2">
            <ul className="segmented">
              {LINKS.map(({ href, label, match, desktopOnly }) => (
                <li key={href} className="contents">
                  <Link
                    href={href}
                    aria-current={active(match) ? "page" : undefined}
                    className={`${desktopOnly ? "max-lg:hidden " : ""}inline-flex h-8 items-center rounded-full px-3.5 font-label text-[13px] font-medium transition-colors ${
                      active(match) ? "seg-active text-ink" : "text-ink/75 hover:text-ink"
                    }`}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
            <ThemeToggle className="btn-glass rounded-full border" />
          </div>
        </div>
      </nav>
      <nav
        aria-label="Main"
        className="glass-strong fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 rounded-[1.6rem] md:hidden"
      >
        <ul className="grid grid-cols-5 px-1 py-1">
          {LINKS.filter((l) => !l.desktopOnly).map(({ href, label, icon: Icon, match }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={active(match) ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 rounded-[1.2rem] py-1.5 font-label text-[11px] font-medium transition-colors ${
                  active(match) ? "seg-active text-accent" : "text-ink/80"
                }`}
              >
                <Icon size={20} strokeWidth={1.8} aria-hidden />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
