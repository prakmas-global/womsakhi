"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import Link from "next/link";

import * as Icons from "@/components/ux/icons";
import { useNotifications } from "./live";
import { useShell } from "./ShellProvider";
import { apiReadAllNotifications, apiReadNotification } from "@/lib/me-api";

const LATEST = 6;

function Icon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const C = (Icons as unknown as Record<string, React.ComponentType<{ className?: string; strokeWidth?: number; style?: React.CSSProperties }>>)[name]
    ?? Icons.Bell;
  return <C className={className} strokeWidth={1.9} style={style} />;
}

/**
 * The bell's popup: her latest six, without leaving the screen she is on.
 *
 * The bell used to be a link to `/app/notifications`, so glancing at what had
 * arrived cost a whole page and a way back. This drops down from the bell on a
 * laptop and spans the width under the top bar on a phone, in the same
 * `ux-sheet` surface as the account menu beside it — and like that menu it is
 * rendered inside the header, so it stays inside the `.ux` token scope.
 *
 * Mounted only while open, so the list is fetched fresh each time she opens it
 * and not at all on screens where she never does.
 */
export function NotificationsPopover({
  onClose,
  wrapRef,
  panelId,
}: {
  /** `refocus` is false when she clicked somewhere else — focus goes where she clicked. */
  onClose: (refocus: boolean) => void;
  /** The bell and this panel together; a press inside it is not "outside". */
  wrapRef: RefObject<HTMLElement | null>;
  panelId: string;
}) {
  const shell = useShell();
  const { data, source, refetch } = useNotifications();
  const panel = useRef<HTMLDivElement>(null);
  const [marking, setMarking] = useState(false);
  const focused = useRef(false);

  const items = data.slice(0, LATEST);
  const unread = data.filter((n) => n.unread).length;

  // Close on a press outside, or Escape. Escape hands focus back to the bell.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) onClose(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(true); return; }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const list = [...(panel.current?.querySelectorAll<HTMLElement>("[data-notif-item]") ?? [])];
      if (!list.length) return;
      e.preventDefault();
      const at = list.indexOf(document.activeElement as HTMLElement);
      const next = e.key === "ArrowDown" ? (at + 1) % list.length : (at - 1 + list.length) % list.length;
      list[at === -1 ? 0 : next].focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, wrapRef]);

  // Focus the first item once there is one; until then, the panel itself, so a
  // screen reader lands inside the popup rather than staying on the bell.
  useEffect(() => {
    if (focused.current) return;
    const first = panel.current?.querySelector<HTMLElement>("[data-notif-item]");
    if (first) { first.focus(); focused.current = true; }
    else if (source !== "loading") { panel.current?.focus(); focused.current = true; }
    else panel.current?.focus();
  }, [source, items.length]);

  async function markAll() {
    setMarking(true);
    try { await apiReadAllNotifications(); } catch { /* the list below re-reads either way */ }
    refetch();
    shell.refresh();
    setMarking(false);
  }

  function open(id: string, wasUnread: boolean) {
    if (wasUnread) void apiReadNotification(id).then(() => shell.refresh()).catch(() => {});
    onClose(false);
  }

  return (
    <div
      ref={panel}
      id={panelId}
      role="dialog"
      aria-label="Notifications"
      tabIndex={-1}
      data-notif-popover
      className="ux-sheet ux-slide-up fixed inset-x-2 top-[calc(var(--ux-topbar-h)+6px)] z-[var(--ux-z-dropdown)] flex max-h-[calc(100dvh-var(--ux-topbar-h)-96px)] flex-col overflow-hidden rounded-[18px] outline-none
                 sm:absolute sm:inset-x-auto sm:end-0 sm:top-[calc(100%+8px)] sm:max-h-[min(560px,calc(100dvh-var(--ux-topbar-h)-24px))] sm:w-[380px]"
    >
      <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2" style={{ borderColor: "var(--ux-line)" }}>
        <h2 className="flex-1 text-sm font-bold" style={{ color: "var(--ux-ink)" }}>
          Notifications
          {unread > 0 && (
            <span className="ms-2 text-xs font-semibold" style={{ color: "var(--ux-muted)" }}>{unread} unread</span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => void markAll()}
          disabled={!unread || marking}
          className="ux-press -me-2 flex min-h-[44px] items-center gap-1.5 rounded-[10px] px-2.5 text-xs font-semibold transition-colors hover:bg-[var(--ux-surface-2)] disabled:opacity-45"
          style={{ color: "var(--ux-brand)" }}
        >
          <Icons.CheckCheck className="h-4 w-4" />
          {marking ? "Marking…" : "Mark all read"}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {source === "loading" && !items.length ? (
          <ul aria-label="Loading notifications" className="space-y-1">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-3 px-2.5 py-2.5">
                <span className="h-[36px] w-[36px] shrink-0 animate-pulse rounded-[12px]" style={{ background: "var(--ux-surface-2)" }} />
                <span className="h-3 flex-1 animate-pulse rounded" style={{ background: "var(--ux-surface-2)" }} />
              </li>
            ))}
          </ul>
        ) : !items.length ? (
          <div className="flex flex-col items-center px-6 py-8 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full" style={{ background: "var(--ux-surface-2)", color: "var(--ux-muted)" }}>
              <Icons.BellOff className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>
              {source === "error" ? "Could not load notifications" : "You are all caught up"}
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--ux-muted)" }}>
              {source === "error" ? "Check your connection and try again." : "New replies, orders and reminders will appear here."}
            </p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {items.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.href || "/app/notifications"}
                  data-notif-item
                  onClick={() => open(n.id, !!n.unread)}
                  className="ux-hov flex min-h-[56px] items-start gap-3 rounded-[12px] px-2.5 py-2.5 outline-none transition-colors hover:bg-[var(--ux-surface-2)] focus-visible:bg-[var(--ux-surface-2)]"
                >
                  <span className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-[12px]"
                        style={{ background: `var(${n.tint})`, color: `var(${n.ink})` }}>
                    <Icon name={n.icon} className="h-[17px] w-[17px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block text-xsm leading-snug"
                          style={{ color: "var(--ux-ink)", fontWeight: n.unread ? 700 : 500 }}>
                      {n.title}
                    </span>
                    {n.when && (
                      <span className="mt-0.5 block text-2xs" style={{ color: "var(--ux-muted)" }}>{n.when}</span>
                    )}
                  </span>
                  {n.unread ? (
                    <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: "var(--ux-brand-600)" }}>
                      <span className="sr-only">Unread</span>
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link
        href="/app/notifications"
        onClick={() => onClose(false)}
        className="ux-hov flex min-h-[48px] shrink-0 items-center justify-center gap-1.5 border-t text-xsm font-semibold transition-colors hover:bg-[var(--ux-surface-2)]"
        style={{ borderColor: "var(--ux-line)", color: "var(--ux-brand)" }}
      >
        View more <Icons.ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
