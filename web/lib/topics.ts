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

export type Topic = { slug: string; label: string; icon: LucideIcon };

export const TOPICS: Topic[] = [
  { slug: "world", label: "World", icon: Globe },
  { slug: "pakistan", label: "Pakistan", icon: Flag },
  { slug: "business", label: "Business & Markets", icon: BriefcaseBusiness },
  { slug: "technology", label: "Technology", icon: Cpu },
  { slug: "ai", label: "Artificial Intelligence", icon: Bot },
  { slug: "startups", label: "Startups", icon: Rocket },
  { slug: "programming", label: "Programming & Dev", icon: Code },
  { slug: "science", label: "Science", icon: FlaskConical },
  { slug: "space", label: "Space", icon: Orbit },
  { slug: "health", label: "Health", icon: HeartPulse },
  { slug: "climate", label: "Climate & Environment", icon: Leaf },
  { slug: "cricket", label: "Cricket", icon: Trophy },
  { slug: "football", label: "Football", icon: Volleyball },
  { slug: "entertainment", label: "Film, TV & Culture", icon: Clapperboard },
  { slug: "gaming", label: "Gaming", icon: Gamepad2 },
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
