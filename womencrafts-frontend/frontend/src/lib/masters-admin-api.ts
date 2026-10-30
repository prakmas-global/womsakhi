import { apiClient } from "./api";
import type { MasterKey } from "./masters-api";

/**
 * Masters, staff side — backend: routes/masters.py (`/admin/masters`).
 *
 * Every pick-list staff control, one generic editor. Each list is guarded by
 * its own module's permissions: `<module>.view` to read it, `<module>.edit` to
 * change it. The hub only returns lists the signed-in staff member can view,
 * and each one says whether she can edit it (`can_edit`).
 *
 * Records store an item's LABEL, so a rename is carried into every record that
 * used the old one; delete is only possible when nothing uses the item.
 */

export interface MasterListMeta {
  key: MasterKey;
  name: string;
  description: string;
  /** Where it shows in the hub: "Learn", "Community", "Health" … */
  section: string;
  /** Permission module guarding it. */
  module: string;
  levels: 1 | 2;
  /** The parent level's name for two-level lists ("Learning path"). */
  parent_name: string;
  /** Extra fields staff may set per item: "icon", "note", "synonyms". */
  extras: string[];
  /** collection.field pairs that store its labels. */
  used_in: string[];
  can_edit: boolean;
}

export interface MasterListSummary extends MasterListMeta {
  items: number;
  active_items: number;
}

export interface MasterAdminItem {
  key: string;
  label: string;
  parent_key: string | null;
  active: boolean;
  order: number;
  extra: { icon?: string; note?: string; synonyms?: string[]; [k: string]: unknown };
  /** Records that use this label. */
  used: number;
  can_delete: boolean;
  /** Two-level lists: the items under a parent. */
  children?: MasterAdminItem[];
}

export interface MasterListDetail extends MasterListMeta {
  items: MasterAdminItem[];
}

export interface MasterItemInput {
  label: string;
  parent_key?: string | null;
  active?: boolean;
  extra?: Record<string, unknown>;
}

export interface MasterItemPatch {
  label?: string;
  active?: boolean;
  extra?: Record<string, unknown>;
}

const BASE = "/admin/masters";
const one = (list: string) => `${BASE}/${encodeURIComponent(list)}`;
const item = (list: string, key: string) => `${one(list)}/items/${encodeURIComponent(key)}`;

export const apiAdminMasters = (signal?: AbortSignal) =>
  apiClient.get<MasterListSummary[]>(BASE, { signal }).then((r) => r.data);

export const apiAdminMaster = (list: string, signal?: AbortSignal) =>
  apiClient.get<MasterListDetail>(one(list), { signal }).then((r) => r.data);

export const apiAdminAddMasterItem = (list: string, body: MasterItemInput) =>
  apiClient.post<MasterAdminItem>(`${one(list)}/items`, body).then((r) => r.data);

/** `renamed_records`: how many records took the new label. */
export const apiAdminEditMasterItem = (list: string, key: string, patch: MasterItemPatch) =>
  apiClient.patch<MasterAdminItem & { renamed_records?: number }>(item(list, key), patch).then((r) => r.data);

export const apiAdminDeleteMasterItem = (list: string, key: string) =>
  apiClient.delete(item(list, key)).then(() => undefined);

/** Every key at one level (null = top level), in the new order. */
export const apiAdminReorderMaster = (list: string, parentKey: string | null, keys: string[]) =>
  apiClient.post(`${one(list)}/reorder`, { parent_key: parentKey, keys }).then(() => undefined);
