/**
 * Topic list for onboarding — mirrors engine/sources.py and the slugs in SPEC Section 5.1.
 */
import {
  Bot,
  BriefcaseBusiness,
  Clapperboard,
  Code,
  Cpu,
  FlaskConical,
  Flag,
  Gamepad2,
  Globe,
  HeartPulse,
  Leaf,
  Orbit,
  Rocket,
  Trophy,
  Volleyball,
  type LucideIcon,
} from "lucide-react";

export type Topic = { slug: string; label: string; icon: LucideIcon; blurb: string };

export const TOPICS: Topic[] = [
  { slug: "world", label: "World", icon: Globe, blurb: "Global politics, conflicts and diplomacy" },
  { slug: "pakistan", label: "Pakistan", icon: Flag, blurb: "National politics, economy and society" },
  { slug: "business", label: "Business & Markets", icon: BriefcaseBusiness, blurb: "Companies, markets and the economy" },
  { slug: "technology", label: "Technology", icon: Cpu, blurb: "Gadgets, platforms and the tech industry" },
  { slug: "ai", label: "Artificial Intelligence", icon: Bot, blurb: "Models, research and AI policy" },
  { slug: "startups", label: "Startups", icon: Rocket, blurb: "Founders, funding rounds and launches" },
  { slug: "programming", label: "Programming & Dev", icon: Code, blurb: "Languages, tools and developer culture" },
  { slug: "science", label: "Science", icon: FlaskConical, blurb: "Discoveries and research breakthroughs" },
  { slug: "space", label: "Space", icon: Orbit, blurb: "Missions, launches and astronomy" },
  { slug: "health", label: "Health", icon: HeartPulse, blurb: "Medicine, wellbeing and public health" },
  { slug: "climate", label: "Climate & Environment", icon: Leaf, blurb: "Weather, energy and the environment" },
  { slug: "cricket", label: "Cricket", icon: Trophy, blurb: "Tests, ODIs, T20s and the PSL" },
  { slug: "football", label: "Football", icon: Volleyball, blurb: "Leagues, transfers and match results" },
  { slug: "entertainment", label: "Film, TV & Culture", icon: Clapperboard, blurb: "Film, TV, music and the arts" },
  { slug: "gaming", label: "Gaming", icon: Gamepad2, blurb: "Games, consoles and esports" },
];

export const TOPIC_LABELS: Record<string, string> = Object.fromEntries(TOPICS.map((t) => [t.slug, t.label]));

export function topicLabel(slug: string | null | undefined): string {
  if (!slug) return "";
  if (slug.startsWith("custom:")) return slug.slice(7);
  return TOPIC_LABELS[slug] ?? slug;
}

/** Suggestion chips for step 3, based on the topics picked. */
export const SUGGESTIONS: Record<string, string[]> = {
  world: ["Middle East", "United Nations"],
  pakistan: ["Pakistan economy", "Islamabad"],
  business: ["Stock market", "Oil prices"],
  technology: ["Smartphones", "Apple"],
  ai: ["LLM agents", "OpenAI"],
  startups: ["Venture capital", "Pakistani startups"],
  programming: ["Python", "Open source"],
  science: ["Physics", "Neuroscience"],
  space: ["Mars", "SpaceX"],
  health: ["Nutrition", "Mental health"],
  climate: ["Floods", "Renewable energy"],
  cricket: ["Pakistan cricket team", "PSL"],
  football: ["Premier League", "Champions League"],
  entertainment: ["Pakistani dramas", "Netflix"],
  gaming: ["PlayStation", "Esports"],
};
