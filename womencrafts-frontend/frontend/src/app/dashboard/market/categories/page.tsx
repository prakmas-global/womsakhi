"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Baby, Brush, Cake, ChefHat, FolderTree, Gem, GraduationCap, HeartHandshake, Home, Laptop,
  Layers, Leaf, Package, Palette, PartyPopper, Scissors, Shirt, ShoppingBag, Sparkles,
  Sprout, Store, Tag, Wrench,
} from "lucide-react";

import {
  Badge, Card, Checkbox, ErrorState, Input, Modal, SkeletonTable, StatCard,
  Textarea, useConfirm, useToast,
} from "@/design-system";
import { useAuth } from "@/context/AuthContext";
import { memberError } from "@/lib/member-api";
import { apiMarketPermissions, type MarketAction } from "@/lib/market-admin-api";
import { TwoPaneEditor, type PaneRow } from "@/components/admin/TwoPaneEditor";
import { PicturePicker, PictureThumb } from "@/components/admin/PicturePicker";
import { pictureFor } from "@/components/ux/media/art";
import {
  apiAdminAddCategory, apiAdminCategories, apiAdminDeleteCategory, apiAdminEditCategory, apiAdminReorderCategories,
  type AdminCategory, type AdminCategoryRow, type CategoryInput, type ListingKind,
} from "@/lib/market-categories-api";

/**
 * Shop categories — the one list a member's store and listings are filed
 * under (backend: routes/market_categories.py, /admin/market/categories).
 *
 * A store has ONE category; every product or service she lists must sit in an
 * active sub-category of it. Disabling a row keeps what is already on sale and
 * stops anyone choosing it again. A row can be deleted only when no shop and
 * no listing uses it, so nothing a woman built ever loses its filing.
 */

const ICONS: Record<string, React.ElementType> = {
  Shirt, Home, ChefHat, Sparkles, GraduationCap, HeartHandshake, Palette, Laptop, Wrench, PartyPopper, Sprout,
  Scissors, Gem, Baby, Cake, Leaf, Brush, ShoppingBag, Store, Package, Tag,
};
const ICON_NAMES = Object.keys(ICONS);

type Dialog =
  | { kind: "add"; parent: AdminCategory | null }
  | { kind: "edit"; row: AdminCategoryRow; parent: AdminCategory | null }
  | null;

/** `image`: an upload, a library picture, or "" for the automatic one. */
interface Form { name: string; kinds: ListingKind[]; description: string; icon: string; image: string }
const EMPTY: Form = { name: "", kinds: ["product", "service"], description: "", icon: "Tag", image: "" };

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

function usage(r: AdminCategoryRow, top: boolean) {
  const parts = [];
  if (top) parts.push(plural(r.stores, "shop"));
  parts.push(`${plural(r.listings, "listing")}${r.listings ? `, ${r.live_listings.toLocaleString()} on sale` : ""}`);
  return parts.join(" · ");
}

/** Listings filed under the category but in none of its sub-categories (older listings). */
function unfiled(c: AdminCategory) {
  return Math.max(0, c.listings - c.subcategories.reduce((n, s) => n + s.listings, 0));
}

function deleteReason(r: AdminCategoryRow, top: boolean, subs: number) {
  if (top && subs > 0) return `Delete its ${plural(subs, "sub-category", "sub-categories")} first, or disable it instead.`;
  if (r.stores || r.listings) return `In use by ${usage(r, top)}. Disable it instead.`;
  return "";
}

/** The picture members see: its own, else its category's, else the one its name points to. */
function RowPicture({ row, parent, size = "md" }: { row: AdminCategoryRow; parent?: AdminCategoryRow; size?: "md" | "sm" }) {
  return <PictureThumb src={pictureFor(row, [row.name, parent?.name], parent)} size={size} dim={!row.active} />;
}

function KindBadges({ kinds }: { kinds: ListingKind[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {kinds.includes("product") && <Badge tone="violet">Products</Badge>}
      {kinds.includes("service") && <Badge tone="sky">Services</Badge>}
    </span>
  );
}

export default function ShopCategoriesPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const { isSuperAdmin } = useAuth();
  const [cats, setCats] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [perms, setPerms] = useState<Set<MarketAction>>(new Set());
  const [dialog, setDialog] = useState<Dialog>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);
  const can = (a: MarketAction) => perms.has(a);

  const load = useCallback(async () => {
    try { setCats(await apiAdminCategories()); setError(""); }
    catch (e) { setError(memberError(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    let alive = true;
    apiMarketPermissions(isSuperAdmin)
      .then((p) => { if (alive) setPerms(p); })
      .catch(() => { if (alive) setPerms(new Set()); });
    return () => { alive = false; };
  }, [isSuperAdmin]);

  const ordered = useMemo(
    () => [...cats].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
      .map((c) => ({ ...c, subcategories: [...c.subcategories].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)) })),
    [cats],
  );

  // The rows the two-pane editor draws.
  const rowByKey = new Map<string, AdminCategoryRow>(
    ordered.flatMap((c) => [[c.key, c] as [string, AdminCategoryRow], ...c.subcategories.map((x) => [x.key, x] as [string, AdminCategoryRow])]));
  const paneRows: PaneRow[] = ordered.map((c) => ({
    key: c.key, label: c.name, active: c.active,
    meta: `${usage(c, true)} · ${plural(c.subcategories.length, "sub-category", "sub-categories")}`,
    warn: unfiled(c) > 0 ? `${plural(unfiled(c), "listing")} from before sub-categories, not in one yet. They stay on sale; sellers pick one when they next edit.` : undefined,
    more: c.description ? <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{c.description}</p> : undefined,
    icon: <RowPicture row={c} />, badges: <KindBadges kinds={c.kinds} />,
    canDelete: c.can_delete, deleteReason: deleteReason(c, true, c.subcategories.length),
    children: c.subcategories.map((x) => ({
      key: x.key, label: x.name, active: x.active, meta: usage(x, false),
      more: x.description ? <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{x.description}</p> : undefined,
      icon: <RowPicture row={x} parent={c} size="sm" />, badges: <KindBadges kinds={x.kinds} />,
      canDelete: x.can_delete, deleteReason: deleteReason(x, false, 0),
    })),
  }));

  const activeCats = cats.filter((c) => c.active).length;
  const activeSubs = cats.reduce((n, c) => n + c.subcategories.filter((s) => s.active).length, 0);
  const shops = cats.reduce((n, c) => n + c.stores, 0);
  // Counted per category: older listings may be filed under a category with no sub-category yet.
  const onSale = cats.reduce((n, c) => n + c.live_listings, 0);
  const disabled = cats.reduce((n, c) => n + (c.active ? 0 : 1) + c.subcategories.filter((s) => !s.active).length, 0);

  const run = async (work: () => Promise<unknown>, done: string, fail: string) => {
    setBusy(true);
    try { await work(); toast.success(done); setDialog(null); await load(); return true; }
    catch (e) { toast.error(fail, { description: memberError(e) }); return false; }
    finally { setBusy(false); }
  };

  const openEdit = (row: AdminCategoryRow, parent: AdminCategory | null) => {
    setForm({ name: row.name, kinds: [...row.kinds], description: row.description, icon: row.icon, image: row.image || "" });
    setDialog({ kind: "edit", row, parent });
  };

  const save = async () => {
    if (!dialog) return;
    const name = form.name.trim();
    if (name.length < 2) { toast.error("Give it a name of at least two letters"); return; }
    if (!form.kinds.length) { toast.error("Choose products, services or both"); return; }
    const body: CategoryInput = {
      name, kinds: form.kinds, description: form.description.trim(), icon: form.icon, image: form.image,
    };
    if (dialog.kind === "add") {
      await run(() => apiAdminAddCategory({ ...body, parent_key: dialog.parent?.key ?? null }),
        dialog.parent ? `${name} added to ${dialog.parent.name}` : `${name} added`,
        dialog.parent ? "Could not add the sub-category" : "Could not add the category");
    } else {
      await run(() => apiAdminEditCategory(dialog.row.key, body), `${name} saved`, "Could not save the changes");
    }
  };

  const toggle = async (row: AdminCategoryRow, top: boolean) => {
    if (row.active) {
      const ok = await confirm({
        title: `Disable ${row.name}?`,
        description: `What is on sale stays on sale (${usage(row, top)}). Nobody can choose it for a new ${top ? "shop" : "listing"} until you enable it again.`
          + (top ? " Its sub-categories can't take new listings either." : ""),
        confirmLabel: "Disable", danger: true,
      });
      if (!ok) return;
    }
    await run(() => apiAdminEditCategory(row.key, { active: !row.active }),
      row.active ? `${row.name} disabled` : `${row.name} enabled`, "Could not change it");
  };

  const remove = async (row: AdminCategoryRow) => {
    const ok = await confirm({
      title: `Delete ${row.name}?`,
      description: "Nothing uses it, so nothing changes for members. This can't be undone.",
      confirmLabel: "Delete", danger: true,
    });
    if (!ok) return;
    await run(() => apiAdminDeleteCategory(row.key), `${row.name} deleted`, "Could not delete it");
  };

  const move = async (siblings: AdminCategoryRow[], index: number, by: -1 | 1, parentKey: string | null) => {
    const keys = siblings.map((s) => s.key);
    const j = index + by;
    if (j < 0 || j >= keys.length) return;
    [keys[index], keys[j]] = [keys[j], keys[index]];
    await run(() => apiAdminReorderCategories(parentKey, keys), "Order changed", "Could not change the order");
  };

  // Moving within the full level, not the filtered one: the server needs every key.
  const levelOf = (parentKey: string | null) =>
    parentKey ? ordered.find((c) => c.key === parentKey)?.subcategories ?? [] : ordered;

  const title = !dialog ? "" : dialog.kind === "add"
    ? (dialog.parent ? `Add a sub-category to ${dialog.parent.name}` : "Add a category")
    : `Edit ${dialog.row.name}`;
  const isTop = dialog ? (dialog.kind === "add" ? !dialog.parent : !dialog.parent) : false;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand-ink"><FolderTree className="h-6 w-6" /></span>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold text-ink">Shop categories</h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-subtle">
              Every shop picks one category, and can only list products and services in its sub-categories.
              Disabling keeps what is on sale and stops new choices; delete is only for rows nothing uses.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Categories" value={String(activeCats)} icon={Layers} tone="brand" deltaNote="Open to shops" />
        <StatCard label="Sub-categories" value={String(activeSubs)} icon={Tag} tone="violet" deltaNote="Open to new listings" />
        <StatCard label="Shops filed" value={shops.toLocaleString()} icon={Store} tone="emerald" deltaNote="Shops with a category" />
        <StatCard label="On sale" value={onSale.toLocaleString()} icon={ShoppingBag} tone="sky" deltaNote={disabled ? `${disabled} disabled rows` : "Listings live now"} />
      </div>

      <div className="mt-6">
        {loading ? <Card><SkeletonTable rows={6} cols={4} /></Card>
          : error ? <Card><ErrorState title="Could not load the categories" description={error} onRetry={() => void load()} /></Card>
          : (
            <TwoPaneEditor
              twoLevels
              parentNoun="category"
              childNoun="sub-category"
              rows={paneRows}
              canAdd={can("create")}
              canEdit={can("edit")}
              canDelete={can("delete")}
              busy={busy}
              searchPlaceholder="Search categories and sub-categories…"
              emptyChildren={(c) => `No sub-categories in ${c.label} yet. Shops in it can't list anything until you add one below.`}
              onAdd={(parentKey, name) => {
                if (name.length < 2) { toast.error("Give it a name of at least two letters"); return Promise.resolve(false); }
                const parent = parentKey ? ordered.find((c) => c.key === parentKey) : undefined;
                return run(() => apiAdminAddCategory({
                  name, parent_key: parentKey, kinds: parent ? [...parent.kinds] : ["product", "service"],
                  description: "", icon: parent ? "" : "Tag", image: "",
                }), parent ? `${name} added to ${parent.name}` : `${name} added`,
                parent ? "Could not add the sub-category" : "Could not add the category");
              }}
              onRename={(row, name) => {
                if (name.length < 2) { toast.error("Give it a name of at least two letters"); return Promise.resolve(false); }
                return run(() => apiAdminEditCategory(row.key, { name }), `Renamed to ${name}`, "Could not rename it");
              }}
              onToggle={(row, isParent) => { const r = rowByKey.get(row.key); if (r) void toggle(r, isParent); }}
              onDelete={(row) => { const r = rowByKey.get(row.key); if (r) void remove(r); }}
              onMove={(parentKey, key, by) => {
                const level = levelOf(parentKey);
                void move(level, level.findIndex((x) => x.key === key), by, parentKey);
              }}
              onDetails={(row, parentKey) => {
                const r = rowByKey.get(row.key);
                if (r) openEdit(r, parentKey ? ordered.find((c) => c.key === parentKey) ?? null : null);
              }}
            />
          )}
      </div>

      <Modal open={dialog !== null} onClose={() => setDialog(null)} title={title} icon={FolderTree}
             description={isTop ? "Shops choose one category. They list under its sub-categories."
                                : "Shops in this category list their products and services here."}>
        <div className="space-y-4">
          <Input label={isTop ? "Category name" : "Sub-category name"} required value={form.name}
                 onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                 placeholder={isTop ? "Clothing and stitching" : "Blouses"} maxLength={60} />
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">What can be listed here</p>
            <div className="flex flex-wrap gap-5">
              {(["product", "service"] as ListingKind[]).map((k) => (
                <Checkbox key={k} label={k === "product" ? "Products" : "Services"} checked={form.kinds.includes(k)}
                          onChange={(on) => setForm((f) => ({ ...f, kinds: on ? [...new Set([...f.kinds, k])] : f.kinds.filter((x) => x !== k) }))} />
              ))}
            </div>
            {dialog?.kind === "edit" && (
              <p className="mt-2 text-xs text-ink-subtle">Listings already here keep their kind; this applies to new ones.</p>
            )}
          </div>
          <Textarea label="Description (optional)" rows={2} maxLength={200} value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="What belongs here, in a few words." />
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">Icon</p>
            <div role="radiogroup" aria-label="Icon" className="flex flex-wrap gap-1.5">
              {!isTop && (
                <button type="button" role="radio" aria-checked={form.icon === ""} onClick={() => setForm((f) => ({ ...f, icon: "" }))}
                        className={`rounded-lg border px-2.5 text-xs font-semibold ${form.icon === "" ? "border-brand-500 bg-brand-tint text-brand-ink" : "border-line text-ink-subtle"}`}
                        style={{ minHeight: 36 }}>Same as category</button>
              )}
              {ICON_NAMES.map((n) => {
                const Icon = ICONS[n];
                const on = form.icon === n;
                return (
                  <button key={n} type="button" role="radio" aria-checked={on} aria-label={n} title={n}
                          onClick={() => setForm((f) => ({ ...f, icon: n }))}
                          className={`flex h-9 w-9 items-center justify-center rounded-lg border ${on ? "border-brand-500 bg-brand-tint text-brand-ink" : "border-line text-ink-subtle hover:text-ink"}`}>
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          </div>
          <PicturePicker label="Picture" value={form.image} onChange={(image) => setForm((f) => ({ ...f, image }))}
                         hint={isTop ? "Shown on shop and market screens." : "Shown on listings and filters. Automatic uses the category's picture first."}
                         auto={pictureFor({ key: dialog?.kind === "edit" ? dialog.row.key : form.name },
                                          [form.name, dialog?.parent?.name], dialog?.parent)} />
          {dialog?.kind === "edit" && dialog.parent && form.name.trim() !== dialog.row.name && (
            <p className="rounded-lg bg-status-warn-bg p-3 text-xs text-status-warn-ink">
              Renaming carries to its {plural(dialog.row.listings, "listing")}: they show the new name straight away.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button className="btn btn-outline" onClick={() => setDialog(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
