"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import * as Icons from "lucide-react";

import { Btn, Card, EmptyState, IconTile, NoteBtn, Pill, SectionHead, SourceNote, Tabs, plural } from "@/components/ux/kit";
import { apiMeProfile, apiSendMessage, type MeProfile } from "@/lib/member-api";
import { apiLikeStory, apiStories, type Story } from "@/lib/community-api";
import { useResource } from "@/lib/use-resource";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useCircles } from "@/components/ux/live";
import { LOCAL_ART, LOCAL_HELP } from "@/components/ux/local/data";

/**
 * Sakhi Local — her city, not the country.
 *
 * Everything national already has a home elsewhere. This screen is deliberately
 * narrow: women within a bus ride, groups she could walk to, and the two or
 * three places that will help her in person. A "local" page showing the whole
 * country is just the home page again.
 */
export default function LocalPage() {
  /**
   * The stories, from `/community/stories` rather than through `useStories`.
   *
   * That hook's mapper spreads a fixture and overrides six fields, so every
   * story it returns carries Sunita Devi's trade, her address, her distance
   * and her income — printed under whoever's name. It also drops
   * `liked_by_me`, which is the field that decides whether the heart is
   * filled, so a like that reached the server came back unfilled on reload
   * and looked exactly like a like that had not.
   */
  const { data: STORIES, source } = useResource(
    useCallback(() => apiStories(), []),
    [] as Story[],
  );
  /**
   * The groups were `LOCAL_GROUPS`, three of them, written into a module:
   * "Tailors of Sector 12 · 28 members · 1.2 km · 2 shared orders open".
   * None existed, none were joinable, and the whole tab was a shop window
   * onto nothing. Circles are the real thing this screen was describing.
   */
  const { data: circles } = useCircles();
  const GROUPS = [...circles.mine, ...circles.discover];
  /** Her city, from her profile — `CITY` was the constant "Jaipur". */
  const { data: profile } = useResource(
    useCallback(() => apiMeProfile(), []),
    null as MeProfile | null,
  );
  const city = profile?.location || "";
  const [tab, setTab] = useState("Women near you");
  /**
   * Likes, from the server.
   *
   * The heart used to push the id into a local array and add one to the count
   * on screen. Nothing was recorded, so the woman whose story it was never
   * knew, and the number reset on reload. `/community/stories/{id}/like`
   * toggles it and answers with the true count and whether she is in it, and
   * both are taken from that answer rather than guessed.
   */
  const [likes, setLikes] = useState<Record<string, { n: number; mine: boolean }>>({});
  const [liking, setLiking] = useState<string | null>(null);
  const [likeProblem, setLikeProblem] = useState("");

  async function like(id: string) {
    setLiking(id);
    setLikeProblem("");
    try {
      const got = await apiLikeStory(id);
      setLikes((p) => ({ ...p, [id]: { n: got.likes, mine: got.liked_by_me } }));
    } catch {
      setLikeProblem("That did not reach us. Your like was not recorded — try again in a moment.");
    } finally {
      setLiking(null);
    }
  }

  return (
    <HomeShell
      active="/app/stories"
      rail={
        <div className="space-y-[15px]">
          <Card className="ux-onscroll-soft">
            <SectionHead title={city ? `Groups in ${city}` : "Groups"} action="See all"
                         onAction={() => { window.location.href = "/app/circles"; }} />
            <ul className="ux-deck ux-stagger space-y-2.5">
              {GROUPS.slice(0, 3).map((g, i) => (
                <li key={g.id}>
                  <Link href={`/app/circles/${g.id}`}
                     className="ux-i ux-sq flex items-center gap-3 rounded-[12px] border p-2.5"
                     style={{ borderColor: "var(--ux-line)", ["--i" as string]: i }}>
                    <IconTile icon={g.icon} tint={g.tint} ink={g.ink} size={36} radius={10} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-semibold" style={{ color: "var(--ux-ink)" }}>
                        {g.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px]" style={{ color: "var(--ux-muted)" }}>
                        {g.members} {plural("member", g.members)} · {g.place}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="ux-onscroll-soft">
            <SectionHead title="Help you can walk into" sub="Real places, real people" />
            <ul className="ux-stagger space-y-3">
              {LOCAL_HELP.map((h) => (
                <li key={h.id} className="ux-hov flex items-start gap-3">
                  <IconTile icon={h.icon} tint={h.tint} ink={h.ink} size={36} radius={10} />
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-medium leading-snug" style={{ color: "var(--ux-ink)" }}>{h.label}</p>
                    <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--ux-muted)" }}>{h.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <div className="ux-clay ux-onscroll-soft relative overflow-hidden p-[18px]"
               style={{ background: "linear-gradient(140deg, var(--ux-tint-orange), var(--ux-tint-pink))" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOCAL_ART.hero} alt=""
                 className="ux-float pointer-events-none absolute -bottom-3 -end-4 h-[100px] w-[100px] object-contain" />
            <h3 className="relative w-[60%] text-[14px] font-semibold" style={{ color: "var(--ux-ink)" }}>
              Tell yours
            </h3>
            <p className="relative mt-2 w-[60%] text-[12px] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
              Someone two streets away is where you were a year ago.
            </p>
            <div className="relative mt-3 w-[60%]">
              <Btn href="/app/feedback" variant="soft" size="sm" iconEnd="ArrowRight">Share your story</Btn>
            </div>
          </div>
        </div>
      }
    >
      <div className="mb-[18px] flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold" style={{ color: "var(--ux-ink)" }}>Sakhi Local</h1>
          <p className="mt-1.5 flex items-center gap-1.5 text-[13px]" style={{ color: "var(--ux-muted)" }}>
            <Icons.MapPin className="h-4 w-4" />
            {city ? `${city} · ` : ""}{STORIES.length} {plural("story", STORIES.length)} from women on WomSakhi
          </p>
        </div>
        <Tabs items={["Women near you", "Groups"]} active={tab} onChange={setTab} />
      </div>

      <SourceNote source={source} what="stories" />

      {likeProblem && (
        <p role="alert" className="ux-slide-up mb-[15px] rounded-[12px] p-3.5 text-[12.5px] leading-relaxed"
           style={{ background: "var(--ux-tint-orange)", color: "var(--ux-orange-ink)" }}>
          {likeProblem}
        </p>
      )}

      {tab === "Women near you" && (
        <div className="ux-deck ux-stagger space-y-[15px]">
          {STORIES.map((s, i) => {
            const on = likes[s.id]?.mine ?? s.liked_by_me;
            return (
              <Card key={s.id} className="ux-i ux-onscroll overflow-hidden" style={{ ["--i" as string]: i }} pad={0}>
                <div className="relative h-[160px] overflow-hidden" style={{ background: "var(--ux-tint-lilac)" }}>
                  {s.cover && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={s.cover} alt="" className="ux-art h-full w-full object-cover" />
                  )}
                  {/* The scrim belongs on the text's own container, not on a
                      sibling: as a sibling, white text over a cover that failed
                      to load would sit on a pale tint at 1.09:1. */}
                  <div className="absolute bottom-0 start-0 end-0 flex items-end gap-3 px-4 pb-3.5 pt-10"
                       style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.72), rgba(0,0,0,0.45) 45%, transparent)" }}>
                    {s.author_avatar
                      ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={s.author_avatar} alt=""
                             className="h-[48px] w-[48px] shrink-0 rounded-full border-2 border-white object-cover" />
                      )
                      : (
                        <span className="grid h-[48px] w-[48px] shrink-0 place-items-center rounded-full border-2 border-white text-[19px] font-semibold"
                              style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>
                          {s.author_name.trim().charAt(0).toUpperCase()}
                        </span>
                      )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-white">{s.author_name}</p>
                      {/* Her trade, her distance and what she earns were
                          Sunita Devi's fixture values, printed under every
                          woman's name. The API carries none of the three, so
                          nothing stands where they were — the date she wrote
                          it is real and is below. */}
                      <p className="mt-0.5 truncate text-[11.5px]" style={{ color: "rgba(255,255,255,0.86)" }}>
                        {s.when}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-[18px]">
                  {s.title && (
                    <p className="text-[16px] font-semibold leading-snug" style={{ color: "var(--ux-ink)" }}>
                      &ldquo;{s.title}&rdquo;
                    </p>
                  )}
                  <p className="mt-2.5 line-clamp-4 text-[13px] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{s.body}</p>

                  <div className="mt-4 flex items-center justify-between gap-4 border-t pt-3.5"
                       style={{ borderColor: "var(--ux-line)" }}>
                    <span className="flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--ux-faint)" }}>
                      <Icons.Clock className="h-[14px] w-[14px]" /> {s.when}
                    </span>
                    <span className="flex items-center gap-2">
                      <button
                        onClick={() => void like(s.id)}
                        disabled={liking === s.id}
                        aria-pressed={on}
                        aria-label={on ? `Unlike ${s.author_name}'s story` : `Like ${s.author_name}'s story`}
                        className="ux-press ux-hov ux-sq inline-flex items-center gap-1.5 rounded-[11px] px-3 py-2 text-[12.5px] font-medium"
                        style={{ background: on ? "var(--ux-tint-pink)" : "var(--ux-surface-2)",
                                 color: on ? "var(--ux-pink-ink)" : "var(--ux-muted)" }}
                      >
                        {/* `currentColor`, not a token: the button already
                            carries the pink, and a filled heart has to be
                            distinguishable from an unfilled one by anything
                            reading the DOM as well as by eye. */}
                        <Icons.Heart className="ux-ico h-[15px] w-[15px]"
                                     fill={on ? "currentColor" : "none"} strokeWidth={1.9} />
                        {likes[s.id]?.n ?? s.likes}
                      </button>
                      {/* This said "Sent to {her}" and sent nothing. There is
                          no member-to-member messaging in this API — /me/messages
                          is one thread, hers with the WomSakhi team, and that
                          is where these words land. So the button now names
                          who really reads it and puts her name in the message
                          rather than pretending to deliver it. */}
                      <NoteBtn label="Ask about her" variant="outline" icon="MessageCircle"
                               title={`Ask the WomSakhi team about ${s.author_name}`} to="the WomSakhi team"
                               placeholder="WomSakhi has no direct messages between members yet, so this goes to the team — say what you would like to ask her and they will answer you."
                               send={(n) => apiSendMessage(`About ${s.author_name}'s story: ${n.text}`)}
                               sent="Your message is with the WomSakhi team"
                               sentBody={`They read every one and reply in Messages. ${s.author_name} is not told you wrote.`} />
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {tab === "Groups" && (
        GROUPS.length ? (
          <div className="ux-deck grid grid-cols-2 gap-[15px]">
            {GROUPS.map((g, i) => (
              <Card key={g.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
                <div className="flex items-start gap-3.5">
                  <IconTile icon={g.icon} tint={g.tint} ink={g.ink} size={48} radius={13} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <h3 className="min-w-0 flex-1 truncate text-[14.5px] font-semibold" style={{ color: "var(--ux-ink)" }}>
                        {g.name}
                      </h3>
                      {g.joined && <Pill tone="brand" size="sm">You are in this</Pill>}
                    </div>
                    <p className="mt-1 text-[11.5px]" style={{ color: "var(--ux-muted)" }}>
                      {g.members} {plural("member", g.members)} · {g.place} · {g.activity}
                    </p>
                    {g.blurb && <p className="mt-2 text-[12.5px]" style={{ color: "var(--ux-ink-2)" }}>{g.blurb}</p>}
                  </div>
                </div>
                <div className="mt-3.5 flex justify-end border-t pt-3.5" style={{ borderColor: "var(--ux-line)" }}>
                  <Btn href={`/app/circles/${g.id}`} variant="soft" size="sm" iconEnd="ArrowRight">Open</Btn>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState icon="UsersRound" title="No groups yet"
                        body="Circles are where women near you organise — savings, shared orders, and getting somebody to answer at 9pm."
                        action={<Btn href="/app/circles" variant="primary" iconEnd="ArrowRight">See circles</Btn>} />
          </Card>
        )
      )}
    </HomeShell>
  );
}
