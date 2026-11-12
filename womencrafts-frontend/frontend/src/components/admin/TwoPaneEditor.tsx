"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown, ArrowLeft, ArrowUp, Check, ChevronRight, Inbox, Pencil, Search, SendHorizontal, Settings2, Trash2, X,
} from "lucide-react";

import { Badge, Tooltip } from "@/design-system";

/**
 * A two-pane editor for a list with sub-items — the same shape as a chat app.
 *
 *   left   the parents (categories), like conversations: pick one
 *   right  its children (sub-categories), like messages, with a composer at
 *          the bottom: type a name, press Enter, it's added
 *
 * Renaming is in place (the pencil, or double-click a name). Fuller settings
 * (icon, kinds, synonyms …) open the page's own dialog through `onDetails`.
 * One-level lists drop the left pane: the right pane is the whole list.
 * On a phone the panes take turns, with a Back button, like a chat app.
 */

export interface PaneRow {
  key: string;
  label: string;
  active: boolean;
  /** One quiet line under the name: "Used by 12 · 6 items". */
  meta?: string;
  /** A line that needs attention (shown in the warning colour). */
  warn?: string;
  /** Anything else under the name: a note, synonym chips. */
  more?: React.ReactNode;
  /** The avatar: an icon tile or a picture. */
  icon?: React.ReactNode;
  /** Badges after the name (kinds …). "Disabled" is added automatically. */
  badges?: React.ReactNode;
  canDelete: boolean;
  /** Why it can't be deleted, shown on the greyed-out bin. */
  deleteReason?: string;
  children?: PaneRow[];
}

type Filter = "all" | "active" | "disabled";

export interface TwoPaneEditorProps {
  /** Two levels: parents on the left, children on the right. */
  twoLevels: boolean;
  /** "category" / "learning path" — the left pane's noun, lower case. */
  parentNoun: string;
  /** "sub-category" / "item" — the right pane's noun, lower case. */
  childNoun: string;
  rows: PaneRow[];
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
  busy: boolean;
  searchPlaceholder?: string;
  /** Shown when a parent has no children yet. */
  emptyChildren?: (parent: PaneRow) => string;
  onAdd: (parentKey: string | null, label: string) => Promise<boolean>;
  onRename: (row: PaneRow, label: string) => Promise<boolean>;
  onToggle: (row: PaneRow, isParent: boolean) => void;
  onDelete: (row: PaneRow) => void;
  onMove: (parentKey: string | null, key: string, by: -1 | 1) => void;
  onDetails?: (row: PaneRow, parentKey: string | null) => void;
}

/** "a sub-category", "an item". */
const an = (noun: string) => `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;

function Switch({ on, label, disabled, onChange }: { on: boolean; label: string; disabled?: boolean; onChange: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={onChange}
            title={on ? "On — members can pick it" : "Off — nobody can pick it"}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${on ? "bg-status-ok-solid" : "bg-line-strong"}`}>
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${on ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

function Composer({ placeholder, busy, onAdd, label }: {
  placeholder: string; busy: boolean; onAdd: (text: string) => Promise<boolean>; label: string;
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const send = async () => {
    const t = text.trim().replace(/\s+/g, " ");
    if (!t || busy) return;
    if (await onAdd(t)) { setText(""); ref.current?.focus(); }
  };
  return (
    <form className="flex items-center gap-2 border-t border-line bg-surface p-3"
          onSubmit={(e) => { e.preventDefault(); void send(); }}>
      <input ref={ref} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={label}
             maxLength={80}
             className="min-w-0 flex-1 rounded-full border border-line-strong bg-surface-hover/60 px-4 py-2.5 text-sm text-ink outline-none focus:border-violet-300 focus:bg-surface" />
      <button type="submit" disabled={busy || !text.trim()} className="btn btn-primary shrink-0 rounded-full" aria-label={label}>
        <SendHorizontal className="h-4 w-4" /> Add
      </button>
    </form>
  );
}

export function TwoPaneEditor(props: TwoPaneEditorProps) {
  const {
    twoLevels, parentNoun, childNoun, rows, canAdd, canEdit, canDelete, busy, searchPlaceholder,
    emptyChildren, onAdd, onRename, onToggle, onDelete, onMove, onDetails,
  } = props;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string>("");
  const [showDetail, setShowDetail] = useState(false); // phone only: which pane is in view
  const [editing, setEditing] = useState<string>("");
  const [draft, setDraft] = useState("");
  // A parent just added on the left opens on the right, ready for its children.
  const [pending, setPending] = useState("");
  useEffect(() => {
    if (!pending) return;
    const made = rows.find((r) => r.label.toLowerCase() === pending.toLowerCase());
    if (!made) return;
    const t = window.setTimeout(() => { setSelected(made.key); setShowDetail(true); setPending(""); }, 0);
    return () => window.clearTimeout(t);
  }, [rows, pending]);

  const q = query.trim().toLowerCase();
  const keep = (r: PaneRow) => filter === "all" || (filter === "active" ? r.active : !r.active);
  const hit = (r: PaneRow) => !q || r.label.toLowerCase().includes(q);

  // Parents that match, or hold a child that matches.
  const parents = useMemo(() => rows.filter((p) =>
    (keep(p) && hit(p)) || (p.children ?? []).some((c) => keep(c) && hit(c))),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [rows, q, filter]);

  const current = twoLevels ? rows.find((r) => r.key === selected) ?? parents[0] ?? rows[0] : undefined;
  // Keep the selection valid as rows change (after an add, a delete, a filter).
  useEffect(() => {
    if (!twoLevels) return;
    if (!selected || !rows.some((r) => r.key === selected)) {
      const first = parents[0] ?? rows[0];
      if (first) {
        const t = window.setTimeout(() => setSelected(first.key), 0);
        return () => window.clearTimeout(t);
      }
    }
  }, [rows, parents, selected, twoLevels]);

  const items = twoLevels ? current?.children ?? [] : rows;
  const shownItems = items.filter((c) => keep(c) && (hit(c) || (twoLevels && current ? hit(current) : false)));
  const levelKey = twoLevels ? current?.key ?? null : null;

  const startRename = (r: PaneRow) => { setEditing(r.key); setDraft(r.label); };
  const saveRename = async (r: PaneRow) => {
    const t = draft.trim().replace(/\s+/g, " ");
    if (!t || t === r.label) { setEditing(""); return; }
    if (await onRename(r, t)) setEditing("");
  };

  const nameOrEditor = (r: PaneRow, big: boolean) => editing === r.key ? (
    <form className="flex min-w-0 flex-1 items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); void saveRename(r); }}>
      <input autoFocus onFocus={(e) => e.currentTarget.select()} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={80} aria-label={`New name for ${r.label}`}
             onKeyDown={(e) => { if (e.key === "Escape") setEditing(""); }}
             className={`min-w-0 flex-1 rounded-lg border border-violet-300 bg-surface px-2.5 py-1.5 text-ink outline-none ${big ? "text-base font-bold" : "text-sm font-semibold"}`} />
      <button type="submit" className="btn btn-sm btn-primary" disabled={busy} aria-label="Save name"><Check className="h-4 w-4" /></button>
      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing("")} aria-label="Cancel"><X className="h-4 w-4" /></button>
    </form>
  ) : (
    <span className={`min-w-0 truncate text-ink ${big ? "text-base font-bold" : "text-sm font-semibold"}`}
          onDoubleClick={() => canEdit && startRename(r)}>{r.label}</span>
  );

  const bin = (r: PaneRow) => !canDelete ? null : r.canDelete ? (
    <button className="btn btn-sm btn-ghost text-status-danger-ink" aria-label={`Delete ${r.label}`} disabled={busy}
            onClick={() => onDelete(r)}><Trash2 className="h-4 w-4" /></button>
  ) : (
    <Tooltip label={r.deleteReason || "In use"}>
      <span tabIndex={0} className="inline-flex" aria-label={`Can't delete ${r.label}: ${r.deleteReason || "in use"}`}>
        <button className="btn btn-sm btn-ghost" disabled aria-hidden="true" tabIndex={-1}><Trash2 className="h-4 w-4" /></button>
      </span>
    </Tooltip>
  );

  const actions = (r: PaneRow, level: PaneRow[], parentKey: string | null, isParent: boolean) => {
    const i = level.findIndex((x) => x.key === r.key);
    return (
      <div className="flex shrink-0 items-center gap-0.5">
        {canEdit && (
          <>
            <button className="btn btn-sm btn-ghost" aria-label={`Move ${r.label} up`} disabled={busy || i <= 0}
                    onClick={() => onMove(parentKey, r.key, -1)}><ArrowUp className="h-4 w-4" /></button>
            <button className="btn btn-sm btn-ghost" aria-label={`Move ${r.label} down`} disabled={busy || i < 0 || i >= level.length - 1}
                    onClick={() => onMove(parentKey, r.key, 1)}><ArrowDown className="h-4 w-4" /></button>
            <button className="btn btn-sm btn-ghost" aria-label={`Rename ${r.label}`} disabled={busy}
                    onClick={() => startRename(r)}><Pencil className="h-4 w-4" /></button>
            {onDetails && (
              <button className="btn btn-sm btn-ghost" aria-label={`More settings for ${r.label}`} disabled={busy}
                      onClick={() => onDetails(r, parentKey)}><Settings2 className="h-4 w-4" /></button>
            )}
          </>
        )}
        {bin(r)}
        {canEdit && <Switch on={r.active} disabled={busy} label={r.active ? `Disable ${r.label}` : `Enable ${r.label}`}
                            onChange={() => onToggle(r, isParent)} />}
      </div>
    );
  };

  const searchBar = (
    <div className="space-y-2 border-b border-line p-3">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
        <input aria-label="Search" value={query} onChange={(e) => setQuery(e.target.value)}
               placeholder={searchPlaceholder ?? "Search…"}
               className="w-full rounded-full border border-line-strong bg-surface-hover/60 py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-violet-300 focus:bg-surface" />
      </label>
      <div role="radiogroup" aria-label="Show" className="flex rounded-lg border border-line p-0.5">
        {(["all", "active", "disabled"] as Filter[]).map((f) => (
          <button key={f} type="button" role="radio" aria-checked={filter === f} onClick={() => setFilter(f)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition ${filter === f ? "bg-brand-tint text-brand-ink" : "text-ink-subtle hover:text-ink"}`}>
            {f}
          </button>
        ))}
      </div>
    </div>
  );

  const itemRow = (r: PaneRow) => (
    <li key={r.key} className={`group flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5 transition ${r.active ? "border-line bg-surface" : "border-dashed border-line bg-surface-hover/50"}`}>
      <div className={`flex min-w-0 flex-1 basis-52 items-center gap-3 ${r.active ? "" : "opacity-70"}`}>
        {r.icon}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {nameOrEditor(r, false)}
            {editing !== r.key && r.badges}
            {editing !== r.key && !r.active && <Badge tone="slate">Disabled</Badge>}
          </div>
          {r.meta && <p className="mt-0.5 text-xs text-ink-subtle">{r.meta}</p>}
          {r.warn && <p className="mt-0.5 text-xs text-status-warn-ink">{r.warn}</p>}
          {r.more}
        </div>
      </div>
      {actions(r, items, levelKey, !twoLevels)}
    </li>
  );

  const rightPane = (
    <section className={`min-h-0 flex-1 flex-col ${twoLevels ? (showDetail ? "flex" : "hidden md:flex") : "flex"}`}
             aria-label={twoLevels && current ? `${current.label}: ${childNoun}s` : "Items"}>
      {twoLevels && current ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-3 sm:p-4">
          <span className="md:hidden">
            <button className="btn btn-sm btn-ghost" onClick={() => setShowDetail(false)} aria-label={`Back to ${parentNoun}s`}>
              <ArrowLeft className="h-4 w-4" />
            </button>
          </span>
          <div className={`flex min-w-0 flex-1 basis-56 items-center gap-3 ${current.active ? "" : "opacity-70"}`}>
            {current.icon}
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                {nameOrEditor(current, true)}
                {editing !== current.key && current.badges}
                {editing !== current.key && !current.active && <Badge tone="slate">Disabled</Badge>}
              </div>
              {current.meta && <p className="mt-0.5 text-xs text-ink-subtle">{current.meta}</p>}
              {current.warn && <p className="mt-0.5 text-xs text-status-warn-ink">{current.warn}</p>}
            </div>
          </div>
          {actions(current, rows, null, true)}
        </div>
      ) : !twoLevels ? searchBar : null}

      <div className="min-h-0 flex-1 overflow-y-auto bg-surface-hover/30 p-3 sm:p-4">
        {twoLevels && !current ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-ink-subtle">
            <Inbox className="h-8 w-8" /> Pick a {parentNoun} on the left, or add one.
          </div>
        ) : shownItems.length === 0 ? (
          <div className="flex h-full min-h-[180px] flex-col items-center justify-center gap-2 text-center text-sm text-ink-subtle">
            <Inbox className="h-8 w-8" />
            {items.length && (q || filter !== "all") ? "Nothing here matches."
              : twoLevels && current ? (emptyChildren?.(current) ?? `No ${childNoun}s yet. Add the first one below.`)
              : `No ${childNoun}s yet. Add the first one below.`}
          </div>
        ) : (
          <ul className="space-y-2" aria-label={twoLevels && current ? `${childNoun}s of ${current.label}` : `${childNoun}s`}>
            {shownItems.map(itemRow)}
          </ul>
        )}
      </div>

      {canAdd && (!twoLevels || current) && (
        <Composer busy={busy}
                  label={twoLevels && current ? `Add ${an(childNoun)} to ${current.label}` : `Add ${an(childNoun)}`}
                  placeholder={twoLevels && current ? `Add ${an(childNoun)} to ${current.label}…` : `New ${childNoun}…`}
                  onAdd={(t) => onAdd(levelKey, t)} />
      )}
    </section>
  );

  if (!twoLevels) {
    return (
      <div className="flex h-[calc(100vh-240px)] min-h-[520px] overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex min-w-0 flex-1 flex-col">{rightPane}</div>
      </div>
    );
  }

  return (
    <div className="grid h-[calc(100vh-240px)] min-h-[560px] overflow-hidden rounded-2xl border border-line bg-surface md:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
      <section className={`min-h-0 flex-col border-line md:flex md:border-r ${showDetail ? "hidden" : "flex"}`} aria-label={`${parentNoun}s`}>
        {searchBar}
        <ul className="min-h-0 flex-1 overflow-y-auto p-2" aria-label={`${parentNoun}s`}>
          {parents.length === 0 ? (
            <li className="p-6 text-center text-sm text-ink-subtle">{rows.length ? "Nothing matches." : `No ${parentNoun}s yet.`}</li>
          ) : parents.map((p) => {
            const on = current?.key === p.key;
            const n = p.children?.length ?? 0;
            return (
              <li key={p.key}>
                <button type="button" onClick={() => { setSelected(p.key); setShowDetail(true); setEditing(""); }}
                        aria-current={on ? "true" : undefined}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${on ? "bg-brand-tint" : "hover:bg-surface-hover"} ${p.active ? "" : "opacity-70"}`}>
                  {p.icon}
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className={`truncate text-sm ${on ? "font-bold text-brand-ink" : "font-semibold text-ink"}`}>{p.label}</span>
                      {!p.active && <Badge tone="slate">Off</Badge>}
                    </span>
                    {p.meta && <span className="block truncate text-xs text-ink-subtle">{p.meta}</span>}
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${on ? "bg-brand-500 text-white" : "bg-surface-hover text-ink-muted"}`}
                        title={`${n} ${childNoun}${n === 1 ? "" : "s"}`}>{n}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-subtle md:hidden" />
                </button>
              </li>
            );
          })}
        </ul>
        {canAdd && (
          <Composer busy={busy} label={`Add ${an(parentNoun)}`} placeholder={`New ${parentNoun}…`}
                    onAdd={async (t) => {
                      setPending(t);
                      const ok = await onAdd(null, t);
                      if (!ok) setPending("");
                      return ok;
                    }} />
        )}
      </section>
      {rightPane}
    </div>
  );
}
