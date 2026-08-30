"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  Clock,
  Command,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { TONE_CHIP } from "@/lib/notifications";
import {
  QUICK_ACTIONS,
  JUMP_TO,
  searchItems,
  groupResults,
  highlightRange,
  getSearchItem,
  type SearchItem,
  type SearchSection,
} from "@/lib/search";
import { getRecent, pushRecent, clearRecent, type RecentEntry } from "@/lib/recent-searches";

/** Warm the most-visited routes on open so clicks are instant (dev has no auto-prefetch). */
const PREFETCH_ON_OPEN = [
  "/dashboard",
  "/dashboard/users",
  "/dashboard/appointments",
  "/dashboard/programs",
  "/dashboard/services",
  "/dashboard/analytics",
  "/dashboard/messages",
  "/dashboard/settings",
];

/** Highlights the matched portion of a title. */
function Highlight({ text, query }: { text: string; query: string }) {
  const range = query.trim() ? highlightRange(text, query) : null;
  if (!range) return <>{text}</>;
  const [s, e] = range;
  return (
    <>
      {text.slice(0, s)}
      <mark className="rounded bg-transparent font-bold text-brand-ink">{text.slice(s, e)}</mark>
      {text.slice(e)}
    </>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-4 items-center justify-center rounded border border-line-strong bg-surface px-1 py-0.5 text-3xs font-semibold text-ink-subtle dark:border-white/10 dark:bg-white/10">
      {children}
    </kbd>
  );
}

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { toggle } = useTheme();

  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [active, setActive] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => (query.trim() ? searchItems(query) : null), [query]);
  const sections = useMemo<SearchSection[] | null>(
    () => (results ? groupResults(results) : null),
    [results],
  );

  // Empty state = Recent + Quick actions + Jump to. Typing = grouped results.
  const view = useMemo(() => {
    if (sections) {
      const flat = sections.flatMap((s) => s.items);
      return { mode: "results" as const, sections, flat };
    }
    const recentItems: SearchItem[] = recent.map((r) => {
      const found = getSearchItem(r.id);
      if (found) return found;
      return {
        id: r.id,
        title: r.title,
        subtitle: r.subtitle,
        group: "Quick actions",
        kind: "record",
        href: r.href,
        icon: Clock,
        tone: "slate",
      } as SearchItem;
    });
    // Recent wins: don't repeat an item under Quick actions / Jump to as well.
    const recentIds = new Set(recent.map((r) => r.id));
    const emptySections = (
      [
        recentItems.length
          ? { key: "Recent", label: "Recent", items: recentItems, clearable: true }
          : null,
        {
          key: "Quick actions",
          label: "Quick actions",
          items: QUICK_ACTIONS.filter((a) => !recentIds.has(a.id)),
        },
        { key: "Jump to", label: "Jump to", items: JUMP_TO.filter((p) => !recentIds.has(p.id)) },
      ] as ({
        key: string;
        label: string;
        items: SearchItem[];
        clearable?: boolean;
      } | null)[]
    ).filter((s): s is { key: string; label: string; items: SearchItem[]; clearable?: boolean } =>
      Boolean(s && s.items.length),
    );
    const flat = emptySections.flatMap((s) => s.items);
    return { mode: "empty" as const, emptySections, flat };
  }, [sections, recent]);

  const flat = view.flat;
  const activeIndex = flat.length ? Math.min(active, flat.length - 1) : 0;

  // Open: reset, focus, lock scroll, warm top routes.
  useEffect(() => {
    if (!open) return;
    // Remember who opened us so we can hand focus back on close (dialog contract).
    const opener = document.activeElement as HTMLElement | null;
    setQuery("");
    setActive(0);
    setRecent(getRecent());
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusId = window.setTimeout(() => inputRef.current?.focus(), 20);
    PREFETCH_ON_OPEN.forEach((h) => {
      try {
        router.prefetch(h);
      } catch {
        /* noop */
      }
    });
    return () => {
      window.clearTimeout(focusId);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [open, router]);

  // New query resets the highlighted row to the top.
  useEffect(() => {
    setActive(0);
  }, [query]);

  // Keep the active row in view and warm its route for an instant click.
  useEffect(() => {
    if (!open) return;
    activeRef.current?.scrollIntoView({ block: "nearest" });
    const it = flat[activeIndex];
    if (it && it.href && !it.run) {
      try {
        router.prefetch(it.href);
      } catch {
        /* noop */
      }
    }
  }, [activeIndex, open, flat, router]);

  const select = useCallback(
    (item?: SearchItem) => {
      const it = item ?? flat[activeIndex];
      if (!it) return;
      if (it.run === "toggle-theme") {
        toggle();
        onClose();
        return;
      }
      pushRecent({
        id: it.id,
        title: it.title,
        subtitle: it.subtitle,
        group: it.group,
        href: it.href,
      });
      onClose();
      router.push(it.href);
    },
    [flat, activeIndex, toggle, onClose, router],
  );

  // Handled on the dialog container so it works regardless of which child has
  // focus, and so Tab can be trapped inside the modal.
  const onDialogKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Let the IME own Enter/arrows while composing (CJK etc.).
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;

    if (e.key === "Tab") {
      const root = dialogRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input,textarea,select,[tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const el = document.activeElement;
      if (e.shiftKey) {
        if (el === first || !root.contains(el)) {
          e.preventDefault();
          last.focus();
        }
      } else if (el === last || !root.contains(el)) {
        e.preventDefault();
        first.focus();
      }
      return;
    }

    const n = flat.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (n ? (Math.min(a, n - 1) + 1) % n : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (n ? (Math.min(a, n - 1) - 1 + n) % n : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      select();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(n - 1);
    }
  };

  const clearRecentList = () => setRecent(clearRecent());

  if (!open || typeof document === "undefined") return null;

  const renderRow = (item: SearchItem, globalIdx: number) => {
    const isActive = globalIdx === activeIndex;
    const Icon = item.icon;
    return (
      <button
        key={`${item.id}:${globalIdx}`}
        id={`wc-search-row-${globalIdx}`}
        ref={isActive ? activeRef : undefined}
        type="button"
        tabIndex={-1}
        role="option"
        aria-selected={isActive}
        onMouseMove={() => setActive(globalIdx)}
        onClick={() => select(item)}
        className={`group/row flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition ${
          isActive ? "bg-brand-tint dark:bg-white/10" : "hover:bg-surface-hover dark:hover:bg-white/5"
        }`}
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            TONE_CHIP[item.tone] ?? TONE_CHIP.slate
          }`}
        >
          <Icon className="h-4.5 w-4.5" strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xsm font-semibold text-ink">
            <Highlight text={item.title} query={query} />
          </span>
          {item.subtitle && (
            <span className="block truncate text-2xs text-ink-subtle">{item.subtitle}</span>
          )}
        </span>
        {item.meta && (
          <span className="shrink-0 rounded-md bg-surface-inset px-1.5 py-0.5 text-3xs font-semibold text-ink-subtle dark:bg-white/10">
            {item.meta}
          </span>
        )}
        <span
          className={`shrink-0 items-center gap-1 rounded-md border border-line-strong px-1.5 py-0.5 text-3xs font-semibold text-brand-ink dark:border-white/10 ${
            isActive ? "flex" : "hidden"
          }`}
        >
          <CornerDownLeft className="h-3 w-3" />
        </span>
      </button>
    );
  };

  const sectionHeader = (label: string, right?: React.ReactNode) => (
    <div className="flex items-center justify-between px-2.5 pb-1 pt-3 first:pt-1.5">
      <span className="text-2xs font-bold uppercase tracking-wider text-ink-subtle">
        {label}
      </span>
      {right}
    </div>
  );

  // Render body with a running global index that lines up with `flat`.
  let offset = 0;
  const body =
    view.mode === "results" ? (
      view.sections.length ? (
        view.sections.map((sec) => {
          const start = offset;
          offset += sec.items.length;
          return (
            <div key={sec.group} role="group" aria-label={sec.group}>
              {sectionHeader(
                sec.group,
                <span className="text-2xs font-semibold text-ink-faint">
                  {sec.items.length}
                </span>,
              )}
              {sec.items.map((it, j) => renderRow(it, start + j))}
            </div>
          );
        })
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-inset text-ink-subtle dark:bg-white/10">
            <Search className="h-5 w-5" />
          </span>
          <p className="text-sm font-semibold text-ink-muted">No results for “{query}”</p>
          <p className="text-xs text-ink-subtle">Try a page, a person, or an action.</p>
        </div>
      )
    ) : (
      view.emptySections.map((sec) => {
        const start = offset;
        offset += sec.items.length;
        return (
          <div key={sec.key} role="group" aria-label={sec.label}>
            {sectionHeader(
              sec.label,
              sec.clearable ? (
                <button
                  type="button"
                  onClick={clearRecentList}
                  className="text-2xs font-semibold text-violet-ink transition hover:text-violet-ink"
                >
                  Clear
                </button>
              ) : undefined,
            )}
            {sec.items.map((it, j) => renderRow(it, start + j))}
          </div>
        );
      })
    );

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-[12vh] sm:pt-[14vh]">
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-md dark:bg-black/70"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
        onKeyDown={onDialogKeyDown}
        className="wc-page-enter wc-modal relative z-10 flex max-h-[72vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl"
      >
        {/* search field */}
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-5 w-5 shrink-0 text-ink-subtle" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, people, actions…"
            className="w-full bg-transparent py-4 text-smd text-ink placeholder-ink-subtle outline-none"
            aria-label="Search"
            role="combobox"
            aria-expanded
            aria-controls="wc-search-listbox"
            aria-activedescendant={flat.length ? `wc-search-row-${activeIndex}` : undefined}
            autoComplete="off"
            spellCheck={false}
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-subtle transition hover:bg-surface-hover hover:text-ink-muted dark:hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <span className="hidden shrink-0 rounded-md border border-line-strong px-1.5 py-0.5 text-3xs font-semibold text-ink-subtle sm:block dark:border-white/10">
              esc
            </span>
          )}
        </div>

        {/* results */}
        <div id="wc-search-listbox" role="listbox" className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
          {body}
        </div>

        {/* footer hints */}
        <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-2xs text-ink-subtle">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Kbd>
                <ArrowUp className="h-2.5 w-2.5" />
              </Kbd>
              <Kbd>
                <ArrowDown className="h-2.5 w-2.5" />
              </Kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <Kbd>
                <CornerDownLeft className="h-2.5 w-2.5" />
              </Kbd>
              open
            </span>
            <span className="hidden items-center gap-1 sm:flex">
              <Kbd>esc</Kbd>
              close
            </span>
          </div>
          <span className="flex items-center gap-1 font-semibold text-ink-subtle">
            <Command className="h-3 w-3" />K
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
