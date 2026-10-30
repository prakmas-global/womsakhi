import { artFor } from "@/components/ux/media/art";
import { masterPicture, type MasterItem } from "@/lib/masters-api";

/**
 * Words and pictures shared by the Rent & borrow board and the item page.
 *
 * Categories are the staff-controlled `rental_categories` master
 * (app/core/masters.py); this is the seed, shown until the list loads and
 * kept if it cannot — a screen never goes blank.
 */
export const RENT_CATEGORIES: { label: string; icon: string }[] = [
  { label: "Sarees & lehengas", icon: "Shirt" }, { label: "Party & wedding wear", icon: "Sparkles" },
  { label: "Jewellery", icon: "Gem" }, { label: "Baby & kids", icon: "Baby" },
  { label: "Kitchen & big vessels", icon: "CookingPot" }, { label: "Event & decor", icon: "PartyPopper" },
  { label: "Sewing & craft machines", icon: "Scissors" }, { label: "Home appliances", icon: "Plug" },
  { label: "Tools", icon: "Wrench" }, { label: "Books & study", icon: "BookOpen" },
  { label: "Travel & luggage", icon: "Luggage" }, { label: "Something else", icon: "Package" },
];

export const RENT_CATEGORY_LABELS = RENT_CATEGORIES.map((c) => c.label);

const ICON_OF = new Map(RENT_CATEGORIES.map((c) => [c.label, c.icon]));

/** A category's icon: staff's, else the seed's, else a box. */
export const categoryIcon = (c: Pick<MasterItem, "label" | "extra">) =>
  (c.extra?.icon as string | undefined) || ICON_OF.get(c.label) || "Package";

/** A category's picture: staff's, else the library picture its name points to. */
export const categoryPicture = (c: Pick<MasterItem, "key" | "label" | "extra">) => masterPicture("rental_categories", c);

/** A listing with no photo of its own (there always is one) still gets a picture of what it is. */
export const itemArt = (title: string, category: string, seed: string) => artFor([title, category], "product", null, seed);

/** "Kukatpally · Hyderabad" */
export const place = (area: string, city: string) => [area, city].filter(Boolean).join(" · ");
