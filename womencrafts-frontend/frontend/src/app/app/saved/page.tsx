"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import * as Icons from "lucide-react";

import { Btn, Card, EmptyState, IconTile, Pill, SectionHead, SourceNote, Tabs, plural } from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useSavedItems } from "@/components/ux/entitlements";
import { apiUnsave, type SavedKind } from "@/lib/entitlements-api";

type Item = {
  id: string; kind: string; title: string; sub: string; href: string;
  icon: string; tint: string; ink: string; art?: string;
  /** Why it still matters, or why it stopped mattering. */
  urgent?: string; gone?: boolean;
  /** What to call the API with when she unsaves it. */
  refKind: SavedKind; refId: string;
};

/** Where each kind of saved thing lives, and how to draw it. */
const LOOK: Record<string, { route: string; icon: string; label: string }> = {
  job:     { route: "/app/opportunities", icon: "Briefcase",     label: "Work" },
  program: { route: "/app/programs",      icon: "GraduationCap", label: "Learning" },
  event:   { route: "/app/events",        icon: "Ticket",        label: "Events" },
  scheme:  { route: "/app/support-fund",  icon: "Landmark",      label: "Money" },
  mentor:  { route: "/app/mentors",       icon: "UserRound",     label: "People" },
  service: { route: "/app/explore",       icon: "Store",         label: "Explore" },
};

const TINTS = ["violet", "green", "blue", "orange", "pink"] as const;
function tintFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const t = TINTS[Math.abs(h) % TINTS.length];
  return { tint: `--ux-tint-${t}`, ink: `--ux-${t}` };
}

export default function SavedPage() {
  const { data: rows, source, refetch } = useSavedItems();
  const [tab, setTab] = useState("Everything");
  const [removed, setRemoved] = useState<string[]>([]);

  const items = useMemo<Item[]>(() => rows.map((r) => {
    const look = LOOK[r.kind] ?? { route: "/app", icon: "Bookmark", label: "Saved" };
    return {
      id: r.id,
      kind: look.label,
      title: r.title,
      sub: r.sub || `Saved ${r.saved_on}`,
      // A saved thing whose subject has been taken down must not link into a
      // 404 — the row stays, greyed, and goes nowhere.
      href: r.gone ? "" : `${look.route}/${r.ref_id}`,
      icon: look.icon,
      ...tintFor(r.ref_id),
      gone: r.gone,
      refKind: r.kind,
      refId: r.ref_id,
    };
  }), [rows]);

  const live = items.filter((i) => !removed.includes(i.id));
  const shown = tab === "Everything" ? live : live.filter((i) => i.kind === tab);
  const tabs = ["Everything", "Work", "Learning", "Events", "Money", "People"];
  const closing = live.filter((i) => i.urgent && !i.gone);

  return (
    <HomeShell
      skeleton="list"
      loadFailed="your saved things"
      rail={
        <div className="space-y-[15px]">
          {closing.length > 0 && (
            <Card>
              <SectionHead title="Running out of time" icon="Clock" />
              <ul className="space-y-3">
                {closing.map((i) => (
                  <li key={i.id}>
                    <Link href={i.href as never} className="ux-hov block">
                      <p className="text-[13px] font-medium leading-snug" style={{ color: "var(--ux-ink)" }}>{i.title}</p>
                      <p className="mt-0.5 text-[11.5px] font-medium" style={{ color: "var(--ux-orange-ink)" }}>{i.urgent}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <SectionHead title="What saving does" icon="Info" />
            <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              Saving keeps a thing here, on this phone and any other you sign in on. It does not apply, book
              or reserve anything — you still have to press the button on the day.
            </p>
          </Card>
        </div>
      }
    >
      <div className="mb-[18px] flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold" style={{ color: "var(--ux-ink)" }}>Saved</h1>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--ux-muted)" }}>
            {live.length} {plural("thing", live.length)} you kept for later.
          </p>
        </div>
        <Tabs items={tabs} active={tab} onChange={setTab} />
      </div>

      <SourceNote source={source} what="bookmarks" />

      {shown.length ? (
        <div className="ux-deck space-y-2.5">
          {shown.map((it, i) => (
            <div
              key={it.id}
              className="ux-i ux-sq flex items-center gap-3.5 rounded-[14px] border p-3.5"
              style={{
                borderColor: "var(--ux-line)",
                background: "var(--ux-surface)",
                opacity: it.gone ? 0.62 : 1,
                ["--i" as string]: i,
              }}
            >
              {it.art ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={it.art} alt="" width={52} height={52}
                     className="ux-sq h-[52px] w-[52px] shrink-0 rounded-[12px] object-cover"
                     style={{ filter: it.gone ? "grayscale(1)" : "none" }} />
              ) : (
                <IconTile icon={it.icon} tint={it.tint} ink={it.ink} size={52} radius={12} />
              )}

              <Link href={(it.href || "/app/saved") as never}
                    className={`min-w-0 flex-1 ${it.href ? "ux-hov" : "pointer-events-none"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-[14px] font-semibold" style={{ color: "var(--ux-ink)" }}>{it.title}</p>
                  <Pill tone="neutral" size="sm">{it.kind}</Pill>
                  {/* Expired is stated, not hidden. Finding out it closed is information. */}
                  {it.gone && <Pill tone="neutral" size="sm">Closed</Pill>}
                </div>
                <p className="mt-0.5 truncate text-[12px]" style={{ color: "var(--ux-muted)" }}>{it.sub}</p>
                {it.urgent && !it.gone && (
                  <p className="mt-1 inline-flex items-center gap-1.5 text-[11.5px] font-medium" style={{ color: "var(--ux-orange-ink)" }}>
                    <Icons.Clock className="h-[12px] w-[12px]" /> {it.urgent}
                  </p>
                )}
              </Link>

              <div className="flex shrink-0 items-center gap-1.5">
                {!it.gone && it.href && (
                  <Btn href={it.href} variant="outline" size="sm" iconEnd="ArrowRight">Open</Btn>
                )}
                <button
                  onClick={() => {
                    // Hide it at once so the tap feels instant, then tell the
                    // server. `refetch` puts it back if the delete failed —
                    // a bookmark that silently survives a delete is worse than
                    // one that visibly refuses to go.
                    setRemoved((r) => [...r, it.id]);
                    void apiUnsave(it.refKind, it.refId).catch(refetch);
                  }}
                  aria-label={`Remove ${it.title} from saved`}
                  className="ux-press ux-sq grid h-[36px] w-[36px] place-items-center rounded-[10px] border"
                  style={{ borderColor: "var(--ux-line)" }}
                >
                  <Icons.BookmarkX className="h-[16px] w-[16px]" style={{ color: "var(--ux-muted)" }} strokeWidth={1.9} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon="Bookmark"
            title={tab === "Everything" ? "Nothing saved yet" : `Nothing saved under ${tab}`}
            body="Press the bookmark on any job, course, mela or scheme and it waits for you here."
            action={<Btn href="/app/explore" variant="primary" iconEnd="ArrowRight">Have a look around</Btn>}
          />
        </Card>
      )}
    </HomeShell>
  );
}
