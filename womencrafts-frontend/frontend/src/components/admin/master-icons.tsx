import {
  AlertTriangle, Apple, Award, Baby, BadgeIndianRupee, BookOpen, Brain, Briefcase, Bug, CalendarDays, Dumbbell, Flag,
  Flower2, Globe, GraduationCap, Heart, HeartPulse, HelpCircle, Languages, LifeBuoy, Lightbulb, Megaphone, Palette,
  PlayCircle, Scale, Scissors, ShieldCheck, Sparkles, Star, Stethoscope, Store, Tag, TrendingUp, Users, Wallet,
} from "lucide-react";

/**
 * Icons staff can give a master item (stored as the lucide name in
 * `extra.icon`). Covers every icon the seeded lists use, plus a few spares.
 * An unknown name from the database still saves and shows as a tag.
 */
export const MASTER_ICONS: Record<string, React.ElementType> = {
  Briefcase, TrendingUp, BadgeIndianRupee, Heart, HeartPulse, Baby, Flower2, Apple, Brain, Dumbbell, Wallet, Store,
  Scissors, Scale, Lightbulb, Award, ShieldCheck, Bug, HelpCircle, GraduationCap, AlertTriangle, Star, Stethoscope,
  PlayCircle, Users, CalendarDays, Flag, LifeBuoy, Globe, BookOpen, Sparkles, Languages, Megaphone, Palette, Tag,
};

export const MASTER_ICON_NAMES = Object.keys(MASTER_ICONS);

export function MasterIcon({ name, className = "h-4 w-4" }: { name?: string; className?: string }) {
  const Icon = (name && MASTER_ICONS[name]) || Tag;
  return <Icon className={className} />;
}

/** Where a list's values are stored, in staff words ("events.category" → "Events"). */
const PLACES: Record<string, string> = {
  programs: "Courses", mentors: "Mentors", skill_swaps: "Skill swaps", opportunities: "Find work",
  events: "Events", circles: "Circles", feed_reports: "Post reports", safety_reports: "Safety reports",
  doctors: "Doctors", health_videos: "Health videos", feedback: "Feedback", support_tickets: "Support tickets",
};

export const placesOf = (usedIn: string[]) =>
  [...new Set(usedIn.map((u) => PLACES[u.split(".")[0]] ?? u.split(".")[0]))].join(", ");
