import { apiClient } from "./api";

/**
 * Shop categories, staff side — backend: routes/market_categories.py
 * (`/admin/market/categories`, behind the Market module's permissions).
 *
 * The one list members pick their store's category from. A store has one
 * category; every product or service she lists must sit in an active
 * sub-category of it. Disabling keeps what is on sale on sale and stops anyone
 * choosing it again. Delete is only possible when nothing uses the row.
 */

export type ListingKind = "product" | "service";

export interface AdminCategoryRow {
  key: string;
  name: string;
  parent_key: string | null;
  /** What may be listed under it. */
  kinds: ListingKind[];
  description: string;
  /** A lucide icon name, e.g. "Shirt". */
  icon: string;
  image: string;
  active: boolean;
  order: number;
  /** Stores whose category this is (top-level rows only). */
  stores: number;
  listings: number;
  live_listings: number;
  can_delete: boolean;
}

export interface AdminCategory extends AdminCategoryRow {
  subcategories: AdminCategoryRow[];
}

export interface CategoryInput {
  name: string;
  parent_key?: string | null;
  kinds: ListingKind[];
  description?: string;
  icon?: string;
  /** A media path from the uploads API, or "" to clear. */
  image?: string;
  active?: boolean;
}

export type CategoryPatch = Partial<Omit<CategoryInput, "parent_key">>;

const BASE = "/admin/market/categories";

export const apiAdminCategories = (signal?: AbortSignal) =>
  apiClient.get<AdminCategory[]>(BASE, { signal }).then((r) => r.data);

export const apiAdminAddCategory = (body: CategoryInput) =>
  apiClient.post<AdminCategoryRow>(BASE, body).then((r) => r.data);

export const apiAdminEditCategory = (key: string, patch: CategoryPatch) =>
  apiClient.patch<AdminCategoryRow>(`${BASE}/${encodeURIComponent(key)}`, patch).then((r) => r.data);

export const apiAdminDeleteCategory = (key: string) =>
  apiClient.delete(`${BASE}/${encodeURIComponent(key)}`).then(() => undefined);

/** Every key at one level (null = top level), in the new order. */
export const apiAdminReorderCategories = (parentKey: string | null, keys: string[]) =>
  apiClient.post(`${BASE}/reorder`, { parent_key: parentKey, keys }).then(() => undefined);
