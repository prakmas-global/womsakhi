"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import { Btn, Card, Chip, EmptyState, IconTile, Pill, SectionHead, SourceNote, Tabs, plural } from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useSavedItems } from "@/components/ux/entitlements";
import { apiUnsave, type SavedKind } from "@/lib/entitlements-api";
import { useT } from "@/i18n";
import { ListGroup } from "@/components/ux/mobile/ListRow";

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
  // Something another woman sells. Without this the row fell to the default
  // and linked to `/app/<listing id>`, which is a 404 — and sat under a label
  // that no tab on this screen offers.
  listing: { route: "/app/market",        icon: "ShoppingBasket", label: "Market" },
  post:    { route: "/app/circles",       icon: "MessagesSquare", label: "Circle" },
};

const TINTS = ["violet", "green", "blue", "orange", "pink"] as const;
function tintFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const t = TINTS[Math.abs(h) % TINTS.length];
  return { tint: `--ux-tint-${t}`, ink: `--ux-${t}` };
}

export default function SavedPage() {
  const tr = useT();
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
      //
      // `r.href` is the server's own answer, and it is set only where the
      // thing's id is NOT its address: a circle post lives inside a circle, so
      // `/app/circles/<post id>` would be a 404 with a plausible shape.
      href: r.gone ? "" : (r.href || `${look.route}/${r.ref_id}`),
      icon: look.icon,
      ...tintFor(r.ref_id),
      gone: r.gone,
      refKind: r.kind,
      refId: r.ref_id,
    };
  }), [rows]);

  const live = items.filter((i) => !removed.includes(i.id));
  const shown = tab === "Everything" ? live : live.filter((i) => i.kind === tab);
  const tabs = ["Everything", "Market", "Work", "Learning", "Events", "Money", "People", "Circle"];
  const closing = live.filter((i) => i.urgent && !i.gone);

  return (
    <HomeShell
      skeleton="list"
      loadFailed="your saved things"
      rail={
        <div className="space-y-[16px]">
          {closing.length > 0 && (
            <Card>
              <SectionHead title={tr("saved.runningOutOfTime")} icon="Clock" />
              <ul className="space-y-3">
                {closing.map((i) => (
                  <li key={i.id}>
                    <Link href={i.href as never} className="ux-hov block">
                      <p className="text-xsm font-medium leading-snug" style={{ color: "var(--ux-ink)" }}>{i.title}</p>
                      <p className="mt-0.5 text-xs font-medium" style={{ color: "var(--ux-orange-ink)" }}>{i.urgent}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <SectionHead title={tr("saved.whatSavingDoes")} icon="Info" />
            <p className="text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              Saving keeps a thing here, on this phone and any other you sign in on. It does not apply, book
              or reserve anything — you still have to press the button on the day.
            </p>
          </Card>
        </div>
      }
    >
      <div className="mb-6 flex flex-col gap-4 lg:mb-[20px] lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
        <div>
          <h1 className="ux-screen-title text-2xl font-bold" style={{ color: "var(--ux-ink)" }}>Saved</h1>
          <p className="mt-1.5 text-xsm" style={{ color: "var(--ux-muted)" }}>
            {live.length} {plural("thing", live.length)} you kept for later.
          </p>
        </div>
        <div className="hidden lg:flex">
          <Tabs items={tabs} active={tab} onChange={setTab} />
        </div>
        {/*
          Eight kinds do not fit across 390px: as tabs they were squeezed until
          every label overflowed its own button. On a phone they are a row of
          filter chips that scrolls sideways, bleeding to the screen edge so a
          thumb can tell it continues.
        */}
        <div className="ux-chiprow lg:hidden" role="group" aria-label="Show">
          {tabs.map((t) => (
            <Chip key={t} selected={tab === t} onClick={() => setTab(t)}>{t}</Chip>
          ))}
        </div>
      </div>

      <SourceNote source={source} what="bookmarks" />

      {shown.length ? (
        <>
        {/*
          On a phone the saved things are rows of one grouped list. The row
          opens the thing (as "Open" does on a desktop); the bookmark at the
          end removes it, at a full 44px.
        */}
        <ListGroup className="lg:hidden">
          {shown.map((it) => {
            const body = (
              <>
                {it.art ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img loading="lazy" decoding="async" src={it.art} alt="" width={40} height={40}
                       className="ux-sq mt-0.5 h-[40px] w-[40px] shrink-0 rounded-[12px] object-cover"
                       style={{ filter: it.gone ? "grayscale(1)" : "none" }} />
                ) : (
                  <IconTile icon={it.icon} tint={it.tint} ink={it.ink} size={40} radius={12} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[15px] font-semibold leading-snug" style={{ color: "var(--ux-ink)" }}>{it.title}</span>
                    <Pill tone="neutral" size="sm">{it.kind}</Pill>
                    {it.gone && <Pill tone="neutral" size="sm">Closed</Pill>}
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-snug" style={{ color: "var(--ux-muted)" }}>{it.sub}</span>
                  {it.urgent && !it.gone && (
                    <span className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: "var(--ux-orange-ink)" }}>
                      <Icons.Clock className="h-[12px] w-[12px]" /> {it.urgent}
                    </span>
                  )}
                </span>
                {it.href && (
                  <Icons.ChevronRight className="mt-3 h-[17px] w-[17px] shrink-0 rtl:rotate-180" style={{ color: "var(--ux-faint)" }} aria-hidden="true" />
                )}
              </>
            );
            return (
              <div key={it.id} className="relative flex items-start" style={{ opacity: it.gone ? 0.62 : 1 }}>
                {it.href ? (
                  <Link href={it.href as never}
                        className="flex min-h-[52px] min-w-0 flex-1 items-start gap-3 py-3 pe-1 ps-4 active:bg-[var(--ux-surface-2)]">
                    {body}
                  </Link>
                ) : (
                  <div className="flex min-h-[52px] min-w-0 flex-1 items-start gap-3 py-3 pe-1 ps-4">{body}</div>
                )}
                <button
                  onClick={() => {
                    setRemoved((r) => [...r, it.id]);
                    void apiUnsave(it.refKind, it.refId).catch(refetch);
                  }}
                  aria-label={`Remove ${it.title} from saved`}
                  className="ux-press me-1 mt-1 grid h-[44px] w-[44px] shrink-0 place-items-center rounded-[12px]"
                >
                  <Icons.BookmarkX className="h-[18px] w-[18px]" style={{ color: "var(--ux-muted)" }} strokeWidth={1.9} />
                </button>
                <span data-ux-sep aria-hidden="true" className="pointer-events-none absolute bottom-0 end-0 h-px"
                      style={{ insetInlineStart: 68, background: "var(--ux-line)" }} />
              </div>
            );
          })}
        </ListGroup>
        <div className="ux-deck hidden space-y-2.5 lg:block">
          {shown.map((it, i) => (
            <div
              key={it.id}
              className="ux-i ux-sq flex items-center gap-3.5 rounded-[12px] border p-3.5"
              style={{
                borderColor: "var(--ux-line)",
                background: "var(--ux-surface)",
                opacity: it.gone ? 0.62 : 1,
                ["--i" as string]: i,
              }}
            >
              {it.art ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img loading="lazy" decoding="async" src={it.art} alt="" width={52} height={52}
                     className="ux-sq h-[52px] w-[52px] shrink-0 rounded-[12px] object-cover"
                     style={{ filter: it.gone ? "grayscale(1)" : "none" }} />
              ) : (
                <IconTile icon={it.icon} tint={it.tint} ink={it.ink} size={52} radius={12} />
              )}

              <Link href={(it.href || "/app/saved") as never}
                    className={`min-w-0 flex-1 ${it.href ? "ux-hov" : "pointer-events-none"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{it.title}</p>
                  <Pill tone="neutral" size="sm">{it.kind}</Pill>
                  {/* Expired is stated, not hidden. Finding out it closed is information. */}
                  {it.gone && <Pill tone="neutral" size="sm">Closed</Pill>}
                </div>
                <p className="mt-0.5 truncate text-xs" style={{ color: "var(--ux-muted)" }}>{it.sub}</p>
                {it.urgent && !it.gone && (
                  <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--ux-orange-ink)" }}>
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
                  className="ux-press ux-sq grid h-[36px] w-[36px] place-items-center rounded-[12px] border"
                  style={{ borderColor: "var(--ux-line)" }}
                >
                  <Icons.BookmarkX className="h-[16px] w-[16px]" style={{ color: "var(--ux-muted)" }} strokeWidth={1.9} />
                </button>
              </div>
            </div>
          ))}
        </div>
        </>
      ) : (
        <Card>
          <EmptyState
            icon="Bookmark"
            title={tab === "Everything" ? "Nothing saved yet" : `Nothing saved under ${tab}`}
            body="Press the bookmark on any job, course, mela or scheme and it waits for you here."
            action={<Btn href="/app/explore" variant="primary" iconEnd="ArrowRight">{tr("saved.haveALookAround")}</Btn>}
          />
        </Card>
      )}
    </HomeShell>
  );
}
