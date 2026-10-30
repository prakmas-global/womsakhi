import { apiClient } from "./api";

/**
 * Shop categories, as a member sees them — backend: routes/market_categories.py.
 *
 * Staff control the tree. Her store has ONE category; every product or service
 * she lists sits in an active sub-category of it, of a kind that sub-category
 * allows. The server enforces this; these types let the screens offer only
 * what will be accepted.
 */

export type ListingKind = "product" | "service";

export interface ShopSubcategory {
  key: string;
  name: string;
  parent_key: string | null;
  kinds: ListingKind[];
  description: string;
  icon: string;
  image: string;
  active: boolean;
  order: number;
}

export interface ShopCategory extends ShopSubcategory {
  subcategories: ShopSubcategory[];
}

export interface MyShopCategories {
  /** Her store's category; "" until she chooses one. */
  store_category_key: string;
  /** Active categories and their active sub-categories, in staff's order. */
  categories: ShopCategory[];
}

export interface StoreCategoryResult {
  category_key: string;
  category_name: string;
  /** Live listings put on pause because they sit outside the new category. */
  paused: number;
  paused_titles: string[];
}

/** Error codes the listing endpoints answer with, written for her. */
export const CATEGORY_ERRORS = [
  "store_category_required", "category_outside_store", "store_category_missing", "category_disabled",
  "subcategory_required", "subcategory_disabled", "kind_not_allowed",
] as const;

export const apiShopCategories = (signal?: AbortSignal) =>
  apiClient.get<MyShopCategories>("/shop/categories", { signal }).then((r) => r.data);

export const apiSetStoreCategory = (category_key: string) =>
  apiClient.put<StoreCategoryResult>("/shop/store/category", { category_key }).then((r) => r.data);

/** Sub-categories of `cat` that take this kind of listing. */
export const subsFor = (cat: ShopCategory | null | undefined, kind: ListingKind) =>
  (cat?.subcategories ?? []).filter((s) => s.kinds.includes(kind));

/** The error code of a failed listing call, if it is one of the category rules. */
export function categoryErrorCode(e: unknown): (typeof CATEGORY_ERRORS)[number] | "" {
  const code = (e as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code ?? "";
  return (CATEGORY_ERRORS as readonly string[]).includes(code) ? (code as (typeof CATEGORY_ERRORS)[number]) : "";
}
