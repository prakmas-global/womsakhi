"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ListTree } from "lucide-react";

import {
  Badge, Card, ErrorState, Input, Modal, SkeletonTable, Textarea, useConfirm, useToast,
} from "@/design-system";
import { MASTER_ICON_NAMES, MasterIcon, placesOf } from "@/components/admin/master-icons";
import { TwoPaneEditor, type PaneRow } from "@/components/admin/TwoPaneEditor";
import { PicturePicker, PictureThumb } from "@/components/admin/PicturePicker";
import { masterPicture, type MasterKey } from "@/lib/masters-api";
import { memberError } from "@/lib/member-api";
import {
  apiAdminAddMasterItem, apiAdminDeleteMasterItem, apiAdminEditMasterItem, apiAdminMaster, apiAdminReorderMaster,
  type MasterAdminItem, type MasterListDetail,
} from "@/lib/masters-admin-api";

/**
 * One master list, edited (backend: routes/masters.py, /admin/masters/{list}).
 *
 * Generic over every list: one or two levels, and whichever extras the list
 * declares (an icon, a short note, synonyms). Records store an item's label,
 * so a rename is carried into them; disabling keeps the label on what already
 * has it and stops anyone picking it again; delete only when nothing uses it.
 * Without the list module's edit permission the page is read-only.
 */

type Dialog =
  | { kind: "add"; parent: MasterAdminItem | null }
  | { kind: "edit"; item: MasterAdminItem; parent: MasterAdminItem | null }
  | null;

/** `image`: an upload, a library picture, or "" for the automatic one. */
interface Form { label: string; icon: string; note: string; synonyms: string; image: string }
const EMPTY: Form = { label: "", icon: "", note: "", synonyms: "", image: "" };

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
const byOrder = (a: MasterAdminItem, b: MasterAdminItem) => a.order - b.order || a.label.localeCompare(b.label);

function deleteReason(item: MasterAdminItem, parentName: string) {
  if (item.children?.length) return `Delete or move the ${plural(item.children.length, "item")} under this ${parentName.toLowerCase() || "group"} first, or disable it instead.`;
  if (item.used) return `Used by ${plural(item.used, "record")}. Disable it instead: they keep it, and nobody can pick it again.`;
  return "";
}

export default function MasterListPage() {
  const params = useParams<{ list: string }>();
  const listKey = String(params?.list ?? "");
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState<MasterListDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setData(await apiAdminMaster(listKey)); setError(""); }
    catch (e) { setError(memberError(e)); }
    finally { setLoading(false); }
  }, [listKey]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const canEdit = !!data?.can_edit;
  const twoLevels = data?.levels === 2;
  const parentName = data?.parent_name || "Group";
  const has = (x: string) => !!data?.extras.includes(x);

  const ordered = useMemo(
    () => [...(data?.items ?? [])].sort(byOrder).map((i) => ({ ...i, children: i.children ? [...i.children].sort(byOrder) : undefined })),
    [data],
  );

  const all = ordered.flatMap((p) => [p, ...(p.children ?? [])]);
  const byKey = new Map(all.map((i) => [i.key, i]));

  // The rows the two-pane editor draws: picture or icon tile, usage line, note and synonyms.
  const toRow = (i: MasterAdminItem, parent: MasterAdminItem | null): PaneRow => ({
    key: i.key, label: i.label, active: i.active,
    meta: [i.used ? `Used by ${plural(i.used, "record")}` : "Not used yet",
           ...(twoLevels && !parent ? [plural(i.children?.length ?? 0, "item")] : [])].join(" · "),
    icon: has("image") ? (
      <PictureThumb src={masterPicture(listKey as MasterKey, i, parent)} size={parent ? "sm" : "md"} dim={!i.active} />
    ) : has("icon") ? (
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${i.active ? "bg-brand-tint text-brand-ink" : "bg-surface-hover text-ink-subtle"}`}>
        <MasterIcon name={i.extra.icon || parent?.extra.icon} className="h-4 w-4" />
      </span>
    ) : undefined,
    more: (i.extra.note || i.extra.synonyms?.length) ? (
      <>
        {i.extra.note && <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{i.extra.note}</p>}
        {!!i.extra.synonyms?.length && (
          <p className="mt-1 flex flex-wrap gap-1">
            {i.extra.synonyms.slice(0, 8).map((w) => (
              <span key={w} className="rounded-md bg-surface-hover px-1.5 py-0.5 text-[11px] text-ink-muted">{w}</span>
            ))}
            {i.extra.synonyms.length > 8 && <span className="text-[11px] text-ink-subtle">+{i.extra.synonyms.length - 8} more</span>}
          </p>
        )}
      </>
    ) : undefined,
    canDelete: i.can_delete, deleteReason: deleteReason(i, parentName),
    children: twoLevels && !parent ? (i.children ?? []).map((c) => toRow(c, i)) : undefined,
  });
  const paneRows = ordered.map((i) => toRow(i, null));
  const activeCount = all.filter((i) => i.active).length;

  const run = async (work: () => Promise<unknown>, done: string, fail: string) => {
    setBusy(true);
    try { await work(); toast.success(done); setDialog(null); await load(); return true; }
    catch (e) { toast.error(fail, { description: memberError(e) }); return false; }
    finally { setBusy(false); }
  };

  const openEdit = (item: MasterAdminItem, parent: MasterAdminItem | null) => {
    setForm({
      label: item.label, icon: item.extra.icon ?? "", note: item.extra.note ?? "",
      synonyms: (item.extra.synonyms ?? []).join(", "), image: (item.extra.image as string) ?? "",
    });
    setDialog({ kind: "edit", item, parent });
  };

  const extraFrom = (f: Form) => {
    const extra: Record<string, unknown> = {};
    if (has("icon")) extra.icon = f.icon;
    if (has("note")) extra.note = f.note.trim();
    if (has("synonyms")) extra.synonyms = f.synonyms.split(",").map((w) => w.trim().toLowerCase()).filter(Boolean);
    if (has("image") && f.image) extra.image = f.image;
    return extra;
  };

  const save = async () => {
    if (!dialog) return;
    const label = form.label.trim().replace(/\s+/g, " ");
    if (!label) { toast.error("Give it a name"); return; }
    if (dialog.kind === "add") {
      await run(() => apiAdminAddMasterItem(listKey, { label, parent_key: dialog.parent?.key ?? null, extra: extraFrom(form) }),
        dialog.parent ? `${label} added to ${dialog.parent.label}` : `${label} added`, "Could not add it");
      return;
    }
    setBusy(true);
    try {
      const res = await apiAdminEditMasterItem(listKey, dialog.item.key, { label, extra: extraFrom(form) });
      const n = res.renamed_records ?? 0;
      toast.success(`${label} saved`, n ? { description: `Renamed in ${plural(n, "record")}.` } : undefined);
      setDialog(null);
      await load();
    } catch (e) {
      toast.error("Could not save the changes", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (item: MasterAdminItem) => {
    if (item.active) {
      const ok = await confirm({
        title: `Disable ${item.label}?`,
        description: `Records keep it${item.used ? ` (${plural(item.used, "record")} use it now)` : ""}; nobody can pick it again until you enable it.`
          + (item.children?.length ? ` The ${plural(item.children.length, "item")} under it stay as they are.` : ""),
        confirmLabel: "Disable", danger: true,
      });
      if (!ok) return;
    }
    await run(() => apiAdminEditMasterItem(listKey, item.key, { active: !item.active }),
      item.active ? `${item.label} disabled` : `${item.label} enabled`, "Could not change it");
  };

  const remove = async (item: MasterAdminItem) => {
    const ok = await confirm({
      title: `Delete ${item.label}?`,
      description: "Nothing uses it, so nothing changes for members. This can't be undone.",
      confirmLabel: "Delete", danger: true,
    });
    if (!ok) return;
    await run(() => apiAdminDeleteMasterItem(listKey, item.key), `${item.label} deleted`, "Could not delete it");
  };

  // Moving within the full level, not the filtered one: the server needs every key.
  const levelOf = (parentKey: string | null) =>
    parentKey ? ordered.find((p) => p.key === parentKey)?.children ?? [] : ordered;

  const move = async (parentKey: string | null, key: string, by: -1 | 1) => {
    const keys = levelOf(parentKey).map((x) => x.key);
    const i = keys.indexOf(key);
    const j = i + by;
    if (i < 0 || j < 0 || j >= keys.length) return;
    [keys[i], keys[j]] = [keys[j], keys[i]];
    await run(() => apiAdminReorderMaster(listKey, parentKey, keys), "Order changed", "Could not change the order");
  };

  const title = !dialog ? "" : dialog.kind === "add"
    ? (dialog.parent ? `Add to ${dialog.parent.label}` : twoLevels ? `Add a ${parentName.toLowerCase()}` : "Add an item")
    : `Edit ${dialog.item.label}`;
  const usedNow = dialog?.kind === "edit" ? dialog.item.used : 0;

  return (
    <div>
      <Link href="/dashboard/masters" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-subtle hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> All masters
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand-ink"><ListTree className="h-6 w-6" /></span>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold text-ink">{data?.name ?? "Master list"}</h1>
            {data && <p className="mt-1 max-w-2xl text-sm text-ink-subtle">{data.description}</p>}
            {data && (
              <p className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge tone="violet">{data.section}</Badge>
                <Badge tone="emerald">{activeCount} active of {all.length}</Badge>
                {twoLevels && <Badge tone="sky">Two levels</Badge>}
                {!canEdit && <Badge tone="amber">Read-only</Badge>}
                {data.used_in.length > 0 && <span className="text-xs text-ink-subtle">Used in {placesOf(data.used_in)}</span>}
              </p>
            )}
          </div>
        </div>
      </div>

      {!canEdit && data && (
        <p className="mb-4 rounded-lg bg-status-warn-bg p-3 text-sm text-status-warn-ink">
          You can see this list but not change it. Changing it needs edit access to its module ({data.module}).
        </p>
      )}

      {loading ? <Card><SkeletonTable rows={6} cols={3} /></Card>
        : error ? <Card><ErrorState title="Could not load this list" description={error} onRetry={() => void load()} /></Card>
        : (
          <TwoPaneEditor
            twoLevels={twoLevels}
            parentNoun={parentName.toLowerCase()}
            childNoun="item"
            rows={paneRows}
            canAdd={canEdit}
            canEdit={canEdit}
            canDelete={canEdit}
            busy={busy}
            searchPlaceholder={has("synonyms") ? "Search names and synonyms…" : "Search…"}
            emptyChildren={(p) => `Nothing under ${p.label} yet. Add the first item below.`}
            onAdd={(parentKey, label) => run(
              () => apiAdminAddMasterItem(listKey, { label, parent_key: parentKey, extra: {} }),
              `${label} added`, "Could not add it")}
            onRename={async (row, label) => {
              setBusy(true);
              try {
                const res = await apiAdminEditMasterItem(listKey, row.key, { label });
                const n = res.renamed_records ?? 0;
                toast.success(`Renamed to ${label}`, n ? { description: `Updated in ${plural(n, "record")}.` } : undefined);
                await load();
                return true;
              } catch (e) {
                toast.error("Could not rename it", { description: memberError(e) });
                return false;
              } finally {
                setBusy(false);
              }
            }}
            onToggle={(row) => { const it = byKey.get(row.key); if (it) void toggle(it); }}
            onDelete={(row) => { const it = byKey.get(row.key); if (it) void remove(it); }}
            onMove={(parentKey, key, by) => void move(parentKey, key, by)}
            onDetails={has("icon") || has("note") || has("synonyms") || has("image")
              ? (row, parentKey) => { const it = byKey.get(row.key); if (it) openEdit(it, parentKey ? byKey.get(parentKey) ?? null : null); }
              : undefined}
          />
        )}

      <Modal open={dialog !== null} onClose={() => setDialog(null)} title={title} icon={ListTree}
             description={data ? `${data.name}. Members see changes the next time they open a screen that uses it.` : undefined}>
        <div className="space-y-4">
          <Input label="Name" required value={form.label} maxLength={80}
                 onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
          {has("note") && (
            <Input label="Short note (optional)" value={form.note} maxLength={120}
                   onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                   placeholder="A few words shown beside it" />
          )}
          {has("synonyms") && (
            <Textarea label="Synonyms (optional)" rows={2} value={form.synonyms}
                      onChange={(e) => setForm((f) => ({ ...f, synonyms: e.target.value }))}
                      placeholder="Words that mean the same, separated by commas — e.g. stitching, tailoring"
                      hint="Older free-text values and searches containing these words are filed under it." />
          )}
          {has("image") && (
            <PicturePicker label="Picture" value={form.image} onChange={(image) => setForm((f) => ({ ...f, image }))}
                           hint={dialog?.parent ? "Automatic uses its group's picture first." : "Shown on members' screens as a picture tile."}
                           auto={masterPicture(listKey as MasterKey,
                                               { key: dialog?.kind === "edit" ? dialog.item.key : form.label, label: form.label,
                                                 extra: { synonyms: form.synonyms.split(",").map((w) => w.trim()).filter(Boolean) } },
                                               dialog?.parent)} />
          )}
          {has("icon") && (
            <div>
              <p className="mb-2 text-sm font-semibold text-ink">Icon</p>
              <div role="radiogroup" aria-label="Icon" className="flex flex-wrap gap-1.5">
                <button type="button" role="radio" aria-checked={form.icon === ""} onClick={() => setForm((f) => ({ ...f, icon: "" }))}
                        className={`rounded-lg border px-2.5 text-xs font-semibold ${form.icon === "" ? "border-brand-500 bg-brand-tint text-brand-ink" : "border-line text-ink-subtle"}`}
                        style={{ minHeight: 36 }}>{dialog?.parent ? "Same as group" : "None"}</button>
                {MASTER_ICON_NAMES.map((n) => {
                  const on = form.icon === n;
                  return (
                    <button key={n} type="button" role="radio" aria-checked={on} aria-label={n} title={n}
                            onClick={() => setForm((f) => ({ ...f, icon: n }))}
                            className={`flex h-9 w-9 items-center justify-center rounded-lg border ${on ? "border-brand-500 bg-brand-tint text-brand-ink" : "border-line text-ink-subtle hover:text-ink"}`}>
                      <MasterIcon name={n} />
                    </button>
                  );
                })}
                {form.icon && !MASTER_ICON_NAMES.includes(form.icon) && (
                  <span className="self-center text-xs text-ink-subtle">Current: {form.icon}</span>
                )}
              </div>
            </div>
          )}
          {dialog?.kind === "edit" && usedNow > 0 && form.label.trim() !== dialog.item.label && (
            <p className="rounded-lg bg-status-warn-bg p-3 text-xs text-status-warn-ink">
              Renaming carries to the {plural(usedNow, "record")} that use it: they show the new name straight away.
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
