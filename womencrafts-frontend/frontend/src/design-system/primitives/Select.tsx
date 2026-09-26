"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, Search } from "lucide-react";

import { controlClass, labelClass } from "./Input";

/**
 * Dropdown select.
 *
 * Deliberately NOT a native <select>: the option panel renders in a portal so a
 * modal's scroll area can never clip it, and it flips upward when there isn't
 * room below. It keeps the native onChange contract — callers still read
 * `e.target.value` — so it can stand in for a <select> anywhere.
 */

type Opt = string | { value: string; label: string };

/**
 * Labeled custom dropdown (NOT a native <select>) with neumorphic styling.
 * The option panel renders in a portal so it never gets clipped by a modal's
 * scroll area, and flips upward when there isn't room below. Keeps the native
 * onChange contract — callers still use `(e) => e.target.value`.
 */
export default function Select({
  label,
  icon: Icon,
  required,
  options,
  className = "",
  value,
  onChange,
  placeholder = "Select…",
  searchable,
  searchPlaceholder = "Search options…",
}: {
  label?: string;
  icon?: React.ElementType;
  required?: boolean;
  options: Opt[];
  className?: string;
  value?: string;
  onChange?: (e: { target: { value: string } }) => void;
  placeholder?: string;
  /** Defaults on for lists long enough to be slow to scan. */
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const norm = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const selected = norm.find((o) => o.value === value);
  const canSearch = searchable ?? norm.length > 7;

  /**
   * This is a <button>, not a native <select>, so a <label> cannot be tied to
   * it — `htmlFor` only works on form controls, and a button is not one. The
   * label was therefore decorative: the trigger announced only its current
   * value ("Active"), with no indication of WHICH field that value belonged to.
   *
   * `aria-labelledby` pointing at both the label and the value gives the pair:
   * "Status, Active".
   */
  const id = useId();
  const labelId = `${id}-label`;
  const valueId = `${id}-value`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, flip: false });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const shown = query.trim()
    ? norm.filter((o) => `${o.label} ${o.value}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    : norm;

  const place = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const panelH = Math.min(norm.length * 40 + 8, 264);
    const spaceBelow = window.innerHeight - r.bottom;
    const flip = spaceBelow < panelH + 12 && r.top > panelH + 12;
    setCoords({ top: flip ? r.top - 6 : r.bottom + 6, left: r.left, width: r.width, flip });
  };

  const toggle = () => {
    if (!open) place();
    if (open) setQuery("");
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    };
    const onScrollResize = () => setOpen(false);

    /**
     * The panel is portalled to <body>, so it sits at the END of the document
     * no matter where the field is. Tabbing out of the trigger therefore jumps
     * a keyboard user to the far side of the page instead of into the options
     * they just opened — the list is on screen but unreachable in order.
     *
     * Moving focus into the panel on open, and back to the trigger on close,
     * makes the tab order match what the eye sees.
     */
    const options = () =>
      [...(panelRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])];

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const list = options();
      if (!list.length) return;
      e.preventDefault();
      const at = list.indexOf(document.activeElement as HTMLButtonElement);
      const next =
        e.key === "ArrowDown"
          ? list[at < 0 ? 0 : Math.min(list.length - 1, at + 1)]
          : list[at <= 0 ? 0 : at - 1];
      next?.focus();
    };

    // Start on the current value, so arrowing moves from where she is rather
    // than from the top of a list she has already made a choice in.
    const focusFrame = requestAnimationFrame(() => {
      if (canSearch) searchRef.current?.focus();
      else {
        const list = options();
        (list.find((o) => o.getAttribute("aria-selected") === "true") ?? list[0])?.focus();
      }
    });
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScrollResize, true);
    window.addEventListener("resize", onScrollResize);
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScrollResize, true);
      window.removeEventListener("resize", onScrollResize);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, canSearch]);

  const pick = (v: string) => {
    onChange?.({ target: { value: v } });
    setQuery("");
    setOpen(false);
    // The option that had focus is about to be unmounted. Without this, focus
    // falls to <body> and the next Tab starts again from the top of the page.
    triggerRef.current?.focus();
  };

  return (
    <div className={className}>
      {label && (
        <span id={labelId} className={labelClass}>
          {label}
          {required && <span className="text-brand-ink"> *</span>}
        </span>
      )}
      <button
        type="button"
        ref={triggerRef}
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={label ? `${labelId} ${valueId}` : undefined}
        aria-label={label ? undefined : placeholder}
        className={`${controlClass} ${Icon ? "pl-11" : ""} relative flex cursor-pointer items-center justify-between pr-3 text-left`}
      >
        {Icon && (
          <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
        )}
        <span id={valueId} className={`truncate ${selected ? "text-ink" : "text-ink-subtle"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-ink-subtle transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            aria-labelledby={label ? labelId : undefined}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: coords.width,
              transform: coords.flip ? "translateY(-100%)" : undefined,
            }}
            className="wc-overlay z-[250] max-h-64 overflow-y-auto !rounded-xl py-1"
          >
            {canSearch && (
              <div className="sticky top-0 z-10 border-b border-line bg-surface p-2">
                <label className="relative block">
                  <span className="sr-only">Search {label || "options"}</span>
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-subtle" />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="h-9 w-full rounded-lg border border-line-strong bg-surface-2 pl-8 pr-2 text-sm text-ink outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-50"
                  />
                </label>
              </div>
            )}
            {shown.map((o) => {
              const active = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => pick(o.value)}
                  className={`flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left text-sm transition ${
                    active
                      ? "font-semibold text-brand-ink"
                      : "text-ink-muted hover:bg-surface-hover dark:hover:bg-white/5"
                  }`}
                >
                  <span className="truncate">{o.label}</span>
                  {active && <Check className="h-4 w-4 shrink-0 text-brand-ink" />}
                </button>
              );
            })}
            {shown.length === 0 && (
              <p className="px-3.5 py-4 text-center text-sm text-ink-subtle">No matching option</p>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
