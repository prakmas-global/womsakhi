"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Btn } from "@/components/ux/kit";
import { HUE, I, Panel, useHealthSettings, type Hue } from "./kit";

/**
 * Tick-lists kept in her health settings (`settings.checks[list]`), so they
 * follow her to any phone. Used by Fertility (preconception, questions) and
 * Pregnancy (care plan, hospital bag, questions).
 *
 * One `useChecks()` per screen holds every list: two lists on one screen
 * each saving their own stale copy of `checks` would undo each other's ticks.
 * Ticks apply at once and are saved in the background.
 */
export function useChecks() {
  const hs = useHealthSettings();
  const [local, setLocal] = useState<Record<string, string[]> | null>(null);
  const latest = useRef<Record<string, string[]> | null>(null);
  const server = hs.settings.checks;
  const checks = useMemo(() => local ?? server ?? {}, [local, server]);
  useEffect(() => { latest.current = checks; }, [checks]);
  const { save } = hs;
  const toggle = useCallback((list: string, id: string) => {
    const cur = latest.current ?? {};
    const done = cur[list] ?? [];
    const next = { ...cur, [list]: done.includes(id) ? done.filter((x) => x !== id) : [...done, id] };
    latest.current = next;
    setLocal(next);
    save({ checks: next });
  }, [save]);
  return { ...hs, checks, toggle };
}

export function Checklist({ items, done, onToggle, hue = "pink", label }: {
  items: { id: string; text: string }[]; done: string[]; onToggle: (id: string) => void; hue?: Hue; label?: string;
}) {
  const count = items.filter((i) => done.includes(i.id)).length;
  return (
    <div className="flex flex-col gap-3" data-checklist={label}>
      <div className="flex items-center gap-3">
        <span className="h-[7px] flex-1 overflow-hidden rounded-full" style={{ background: HUE[hue].tint }}>
          <span className="block h-full rounded-full transition-[width] duration-500"
                style={{ width: `${(count / Math.max(1, items.length)) * 100}%`, background: HUE[hue].ink }} />
        </span>
        <span className="text-xs font-bold tabular-nums" style={{ color: "var(--ux-muted)" }}>{count} of {items.length}</span>
      </div>
      <ul className="flex flex-col">
        {items.map((it, i) => {
          const on = done.includes(it.id);
          return (
            <li key={it.id} className={i ? "border-t" : ""} style={{ borderColor: "var(--ux-line)" }}>
              <button type="button" role="checkbox" aria-checked={on} onClick={() => onToggle(it.id)}
                      className="ux-press flex min-h-[48px] w-full items-center gap-3 py-2 text-start">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2"
                      style={on ? { background: "var(--ux-green-ink)", borderColor: "var(--ux-green-ink)", color: "var(--ux-surface)" }
                                : { borderColor: "var(--ux-line-strong)" }}>
                  {on && <I name="Check" className="h-3.5 w-3.5" />}
                </span>
                <span className="text-sm font-semibold"
                      style={{ color: on ? "var(--ux-muted)" : "var(--ux-ink)", textDecoration: on ? "line-through" : undefined }}>
                  {it.text}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** A tinted card that sends her to a doctor or a mentor. */
export function ConsultCard({ icon, hue, title, body, href, cta }: {
  icon: string; hue: Hue; title: string; body: string; href: string; cta: string;
}) {
  return (
    // Full height with the button at the foot, so cards side by side line up.
    <Panel hue={hue} tint className="h-full">
      <span className="grid h-11 w-11 place-items-center rounded-[12px]" style={{ background: "var(--ux-surface)", color: HUE[hue].ink }}>
        <I name={icon} />
      </span>
      <div className="flex-1">
        <h2 className="text-base font-extrabold" style={{ color: "var(--ux-ink)" }}>{title}</h2>
        <p className="text-sm" style={{ color: "var(--ux-ink-2)" }}>{body}</p>
      </div>
      <Btn size="sm" href={href}>{cta}</Btn>
    </Panel>
  );
}
