import type { Metadata, Viewport } from "next";
import { Libre_Franklin, Newsreader, Source_Serif_4, UnifrakturCook } from "next/font/google";
import AppNav from "@/components/AppNav";
import ChatWidget from "@/components/ChatWidget";
import "./globals.css";

// Type system in the spirit of a classic broadsheet:
// Masthead: UnifrakturCook (blackletter). Headlines: Newsreader (designed for news, optical sizes).
// Body: Source Serif 4. Labels / UI: Libre Franklin (a Franklin Gothic revival).
const unifraktur = UnifrakturCook({
  variable: "--font-unifraktur",
  weight: "700",
  subsets: ["latin"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const franklin = Libre_Franklin({
  variable: "--font-franklin",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "The Morning Edition", template: "%s · The Morning Edition" },
  description:
    "Your news, gathered from across the web and edited into one paper every morning, just for you.",
  openGraph: {
    title: "The Morning Edition",
    description: "A personal morning newspaper, edited for you every day.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

// Applies the saved reading theme and text size before first paint, so there is no flash.
// The site opens in the light (white) theme unless the reader picked another one.
const PREFS_SCRIPT = `try{var t=localStorage.getItem("me-theme");if(t)document.documentElement.dataset.theme=t;var s=localStorage.getItem("me-text");if(s)document.documentElement.dataset.text=s;}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${unifraktur.variable} ${newsreader.variable} ${sourceSerif.variable} ${franklin.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFS_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col pb-44 md:pb-24">
        <AppNav />
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
