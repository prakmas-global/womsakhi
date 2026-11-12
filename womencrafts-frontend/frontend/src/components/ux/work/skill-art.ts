import { artFor, topicArt } from "@/components/ux/media/art";

/**
 * Pictures for kinds of work and their skills, shared by staff's "Work
 * categories & skills", "Find people to hire", "My work profile" and anywhere
 * else a category or skill shows, so it looks the same on every screen.
 *
 * The picture staff set always wins; then the category's; then the library
 * picture the name points to.
 *
 * Kinds of work whose names carry no keyword the shared picker knows — picked
 * by hand so every tile shows the work itself.
 */
const CATEGORY_ART: Record<string, string> = {
  farming_animals: "/ux/art/scene-woman-planting-sapling.webp",
  home_services: "/ux/art/circle-sharing-help.webp",
  care_work: "/ux/art/scene-two-women-support.webp",
  arts_performance: "/ux/art/course-confident-microphone.webp",
  events_hospitality: "/ux/art/circle-rooftop-evening.webp",
  retail_sales: "/ux/art/scene-woman-shop-owner.webp",
  community_finance: "/ux/art/scene-women-group-circle.webp",
};

interface CategoryLike { key: string; name: string; image?: string; skills?: { name: string }[] }
interface SkillLike { key: string; name: string; image?: string }

/**
 * A category's picture. Its own name is read before its skills' names: one
 * skill such as "Jams and fruit preserves" must not turn Food & cooking into a
 * farm picture.
 */
export const categoryArt = (c: CategoryLike) =>
  c.image || CATEGORY_ART[c.key] || topicArt(c.name)
  || artFor([c.name, (c.skills ?? []).map((s) => s.name).join(" ")], "service", undefined, c.key);

/**
 * One skill's picture: its own, else its category's, else what its own name
 * points to, else its category's hand-picked one, else its category's words.
 * Pass the category when you have it; a profile skill (`category` /
 * `category_name`) carries enough on its own.
 */
export function skillArt(s: SkillLike & { category?: string; category_name?: string }, cat?: CategoryLike | null) {
  const catKey = cat?.key ?? s.category ?? "";
  return s.image || cat?.image || topicArt(s.name) || CATEGORY_ART[catKey]
    || artFor([s.name, cat?.name ?? s.category_name], "service", undefined, s.key);
}
