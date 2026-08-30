"use client";

import { useState } from "react";
import * as Icons from "lucide-react";

import { apiMarkAllRead, apiMarkRead } from "@/lib/member-api";
import { useAction } from "@/lib/use-action";

import { Btn, Card, EmptyState, I, IconTile, Progress, SectionHead, SourceNote, Tabs, plural } from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useNotifications } from "@/components/ux/live";

const TABS = ["All", "Unread", "Learning", "Work", "Money"] as const;
const KIND_TAB: Record<string, string> = {
  course: "Learning", work: "Work", money: "Money", mentor: "Learning",
  circle: "All", event: "All",
};

/** Notifications — what she may have missed. */
export default function Notifications() {
  const { data: NOTIFICATIONS, source, refetch } = useNotifications();
  const [tab, setTab] = useState<string>("All");

  /**
   * Which ones she has read — the server's answer, with presses still in
   * flight allowed to show through.
   *
   * Both of these were local. Opening a notification pushed its id into a
   * `read` array and marking all read filled that array with every id, and
   * neither sent anything: fifty unread before, fifty unread after, and the
   * badge in the topbar still said fifty on her next visit.
   */
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const isUnread = (n: (typeof NOTIFICATIONS)[number]) => (pending[n.id] ?? n.unread);

  const markOne = useAction(
    async (id: string) => { await apiMarkRead(id); },
    {
      onDone: refetch,
      optimistic: (id) => setPending((p) => ({ ...p, [id]: false })),
      rollback: (id) => setPending((p) => { const n = { ...p }; delete n[id]; return n; }),
      fallbackError: "Could not mark that read just now. It is still waiting for you.",
    },
  );

  const markAll = useAction(
    async () => { await apiMarkAllRead(); },
    {
      onDone: refetch,
      optimistic: () => setPending(Object.fromEntries(NOTIFICATIONS.map((n) => [n.id, false]))),
      rollback: () => setPending({}),
      fallbackError: "Could not mark them read just now. Nothing has changed — try again in a moment.",
    },
  );
  const shown = NOTIFICATIONS.filter((n) =>
    tab === "All" ? true : tab === "Unread" ? isUnread(n) : KIND_TAB[n.kind] === tab);
  const unreadCount = NOTIFICATIONS.filter(isUnread).length;

  // Counts for the rail come from the same pass as the list, so a filter can
  // never disagree with the number printed beside it.
  const byTab = TABS.reduce<Record<string, number>>((m, t) => {
    m[t] = NOTIFICATIONS.filter((n) =>
      t === "All" ? true : t === "Unread" ? isUnread(n) : KIND_TAB[n.kind] === t).length;
    return m;
  }, {});

  return (
    <HomeShell
      active="/app/notifications"
      rail={
        <div className="space-y-[15px]">
          <Card>
            <SectionHead title="At a glance" />
            <p className="text-[30px] font-bold leading-none" style={{ color: "var(--ux-ink)" }}>
              {unreadCount}
            </p>
            <p className="mt-1.5 text-[12px]" style={{ color: "var(--ux-muted)" }}>
              unread of {NOTIFICATIONS.length} in the last week
            </p>
            <div className="mt-3">
              <Progress pct={NOTIFICATIONS.length ? (unreadCount / NOTIFICATIONS.length) * 100 : 0}
                        tone="--ux-brand-600" track="--ux-track" />
            </div>
            <ul className="mt-4 space-y-1">
              {TABS.filter((t) => t !== "All" && t !== "Unread").map((t) => (
                <li key={t}>
                  <button onClick={() => setTab(t)}
                          className="ux-hov flex w-full items-center justify-between rounded-[9px] px-2.5 py-2 text-[13px] transition-colors"
                          style={{ background: tab === t ? "var(--ux-brand-tint)" : "transparent",
                                   color: tab === t ? "var(--ux-brand)" : "var(--ux-ink-2)",
                                   fontWeight: tab === t ? 600 : 400 }}>
                    {t}
                    <span className="text-[11.5px]" style={{ color: "var(--ux-faint)" }}>{byTab[t]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <SectionHead title="How you are notified" action="Settings"
                         onAction={() => { window.location.href = "/app/settings/notifications"; }} />
            <ul className="space-y-2.5">
              {[["Bell", "In the app", "Always on"],
                ["Mail", "Email", "Daily summary"],
                ["MessageSquare", "SMS", "Payments only"]].map(([ic, label, val]) => (
                <li key={label} className="flex items-center gap-2.5 text-[12.5px]">
                  <I name={ic} className="h-[15px] w-[15px] shrink-0" style={{ color: "var(--ux-brand)" }} />
                  <span className="flex-1" style={{ color: "var(--ux-ink-2)" }}>{label}</span>
                  <span style={{ color: "var(--ux-muted)" }}>{val}</span>
                </li>
              ))}
            </ul>
          </Card>

          <div className="relative overflow-hidden rounded-[16px] p-[18px]"
               style={{ background: "linear-gradient(140deg, var(--ux-tint-lilac), var(--ux-tint-green))" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ux/art/scene-woman-order-notification.webp" alt=""
                 className="ux-float pointer-events-none absolute -bottom-3 -end-3 h-[96px] w-[96px] object-contain" />
            <h3 className="relative w-[62%] text-[14px] font-semibold" style={{ color: "var(--ux-ink)" }}>
              Nothing slips past
            </h3>
            <p className="relative mt-2 w-[62%] text-[12px] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
              Payments, replies and class reminders all land here first.
            </p>
          </div>
        </div>
      }
    >
      <div className="mb-[18px] flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold" style={{ color: "var(--ux-ink)" }}>Notifications</h1>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--ux-muted)" }}>
            {unreadCount
              ? `${unreadCount} ${plural("notification", unreadCount)} you have not read`
              : "You are all caught up."}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Tabs items={[...TABS]} active={tab} onChange={setTab} />
          <Btn variant="outline" size="sm"
               icon={markAll.busy ? "Loader" : "CheckCheck"}
               disabled={markAll.busy || unreadCount === 0}
               onClick={() => void markAll.run()}>
            {markAll.busy ? "Marking…" : "Mark all read"}
          </Btn>
        </div>
      </div>

      <SourceNote source={source} what="notifications" />

      {/* A refusal belongs where she pressed, in words she can act on. */}
      {(markAll.error || markOne.error) && (
        <p role="alert" className="ux-slide-up mb-3 rounded-[11px] p-3 text-[12.5px] leading-relaxed"
           style={{ background: "var(--ux-tint-orange)", color: "var(--ux-orange-ink)" }}>
          {markAll.error || markOne.error}
        </p>
      )}

      <Card pad={0}>
        {shown.length ? (
          <ul>
            {shown.map((n, i) => {
              const unread = isUnread(n);
              return (
                <li key={n.id} className="ux-rise" style={{ ["--i" as string]: i }}>
                  <button
                    onClick={() => { if (unread) void markOne.run(n.id); }}
                    className="ux-hov flex w-full items-start gap-3.5 px-[18px] py-4 text-start transition-colors hover:bg-[var(--ux-surface-2)]"
                    style={{
                      background: unread ? "var(--ux-brand-tint)" : "transparent",
                      borderTop: i ? "1px solid var(--ux-line)" : "none",
                    }}
                  >
                    <IconTile icon={n.icon} tint={n.tint} ink={n.ink} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[13.5px] font-semibold" style={{ color: "var(--ux-ink)" }}>
                          {n.title}
                        </span>
                        {unread && (
                          <span className="ux-ping relative h-[7px] w-[7px] shrink-0 rounded-full"
                                style={{ background: "var(--ux-brand-600)" }} aria-label="unread" />
                        )}
                      </span>
                      <span className="mt-1 block text-[12.5px] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
                        {n.body}
                      </span>
                      <span className="mt-1.5 block text-[11px]" style={{ color: "var(--ux-faint)" }}>{n.when}</span>
                    </span>
                    <Icons.ChevronRight className="ux-arrow mt-1 h-4 w-4 shrink-0" style={{ color: "var(--ux-faint)" }} />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="p-4">
            <EmptyState
              icon="BellOff"
              title={tab === "Unread" ? "Nothing unread" : `No ${tab.toLowerCase()} notifications`}
              body="When something happens that needs you, it will appear here."
              action={<Btn variant="soft" onClick={() => setTab("All")}>Show all</Btn>}
            />
          </div>
        )}
      </Card>
    </HomeShell>
  );
}
