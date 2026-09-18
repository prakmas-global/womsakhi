"use client";

import { useState } from "react";
import * as Icons from "@/components/ux/icons";

import { apiAskSwap } from "@/lib/shop-api";

import {
  Btn, Card, Chip, EmptyState, IconTile, NoteBtn, SectionHead, SourceNote, plural
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { ChipRow, ScreenHead, Segments, Tag } from "@/components/ux/learning/native";
import { EXCHANGE_ART, SKILL_TAGS } from "@/components/ux/exchange/data";
import { useMyExchanges, useSwaps } from "@/components/ux/business";
import { useT } from "@/i18n";

/**
 * Skill Exchange — teaching each other, with no money involved.
 *
 * Offers and asks live in the same list and look the same, because the same
 * woman is usually both. Splitting them into "teachers" and "learners" would
 * quietly tell her she is only one of the two.
 */
export default function SkillExchangePage() {
  const tr = useT();
  const { data: SWAPS, source } = useSwaps();
  const { data: MY_SWAPS, refetch: refetchMine } = useMyExchanges();
  const [tab, setTab] = useState("Browse");
  const [side, setSide] = useState<"All" | "Offering" | "Looking for">("All");
  const [tags, setTags] = useState<string[]>([]);

  /**
   * Which offers she has already asked about — from the server.
   *
   * There is a thread for every swap she has asked about, so `/exchange/threads`
   * is the answer; this used to be `useState<string[]>([])` that "Propose a
   * swap" pushed an id into. Nothing left the browser, so the woman on the
   * other side never heard, and the next visit showed the button again as
   * though she had never pressed it.
   */
  const askedIds = new Set(MY_SWAPS.map((m) => m.swapId));
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const isAsked = (id: string) => pending[id] ?? askedIds.has(id);

  // No `useMemo`. It had one, with `[side, tags]` and no `SWAPS` — so the list
  // was built once from the mock fallback and never rebuilt when the four real
  // offers landed.
  const shown = SWAPS.filter((s) => {
    if (s.mine) return false;                       // her own post is not a match for her
    if (side !== "All" && s.side !== side) return false;
    if (tags.length && !tags.some((t) => `${s.skill} ${s.wants}`.toLowerCase().includes(t.toLowerCase()))) return false;
    return true;
  });

  const mine = SWAPS.filter((s) => s.mine);

  return (
    <HomeShell
      active="/app/library"
      rail={
        <div className="space-y-[16px]">
          <Card className="ux-onscroll-soft">
            <SectionHead title={tr("library.whatYouHaveOffered")} action="Edit" onAction={() => setTab("Your exchanges")} />
            {mine.length ? mine.map((m) => (
              <div key={m.id}>
                <div className="flex items-start gap-3">
                  <IconTile icon={m.icon} tint={m.tint} ink={m.ink} size={38} radius={11} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xsm font-semibold" style={{ color: "var(--ux-ink)" }}>{m.skill}</p>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--ux-muted)" }}>
                      {m.matches} {plural("woman", m.matches)} interested
                    </p>
                  </div>
                </div>
                <p className="mt-3 rounded-[12px] p-3 text-xs leading-relaxed"
                   style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>{tr("library.inReturnYouAskedFor")}<strong style={{ color: "var(--ux-ink)" }}>{m.wants}</strong>
                </p>
              </div>
            )) : (
              <p className="text-xsm" style={{ color: "var(--ux-muted)" }}>{tr("library.youHaveNotOfferedAnythingYet")}</p>
            )}
            <div className="mt-3.5">
              <Btn href="/app/documents/service/new" variant="soft" size="sm" full icon="Plus">{tr("library.offerAnotherSkill")}</Btn>
            </div>
          </Card>

          <Card className="ux-onscroll-soft">
            {/* Merged in from /app/together/learn, which was a second screen
                for this same idea. The finding is why pairs are encouraged at
                all — without it the rule reads as an arbitrary restriction. */}
            <div className="mb-4 rounded-[16px] p-5"
                 style={{ background: "var(--ux-brand-tint)", border: "1px solid transparent" }}>
              <p className="text-sm font-bold" style={{ color: "var(--ux-ink)" }}>{tr("library.bringSomeoneWithYou")}</p>
              <p className="mt-1.5 max-w-[54ch] text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
                Women taught alongside a friend kept what they learned and earned more from it.
                Women taught alone mostly went back to how they worked before.
              </p>
            </div>

            <SectionHead title={tr("library.howAnExchangeWorks")} icon="Info" />
            <ol className="space-y-3">
              {[
                "You offer something you know, and say what you want in return.",
                "Someone whose offer matches your ask gets in touch.",
                "You agree times between yourselves. No money changes hands.",
                "Both of you teach. Both of you learn.",
              ].map((t, i) => (
                <li key={t} className="flex items-start gap-2.5">
                  <span className="grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full text-2xs font-bold"
                        style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>{i + 1}</span>
                  <span className="text-xsm leading-snug" style={{ color: "var(--ux-ink-2)" }}>{t}</span>
                </li>
              ))}
            </ol>
          </Card>

          <div className="ux-clay ux-onscroll-soft relative overflow-hidden p-[20px]"
               style={{ background: "linear-gradient(140deg, var(--ux-tint-violet), var(--ux-tint-green))" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" decoding="async" src={EXCHANGE_ART.hero} alt=""
                 className="ux-float pointer-events-none absolute -bottom-3 -end-4 h-[100px] w-[100px] object-contain" />
            <h2 className="relative w-[60%] text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("library.youKnowMoreThanYouThink")}</h2>
            <p className="relative mt-2 w-[60%] text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>{tr("library.whateverTookYouAYearTo")}</p>
          </div>
        </div>
      }
    >
      <ScreenHead
        title={tr("library.teachAndLearn")}
        sub={tr("library.teachWhatYouKnowLearnWhat")}
        note={<SourceNote source={source} what="swaps" />}
      >
        <Segments items={["Browse", "Your exchanges"]} active={tab} onChange={setTab} label="Which exchanges" />
      </ScreenHead>

      {tab === "Browse" && (
        <>
          <ChipRow className="mb-[16px] items-center">
            {(["All", "Offering", "Looking for"] as const).map((s) => (
              <Chip key={s} selected={side === s} onClick={() => setSide(s)}>{s}</Chip>
            ))}
            <span className="mx-1 h-6 w-px" style={{ background: "var(--ux-line)" }} />
            {SKILL_TAGS.slice(0, 5).map((t) => (
              <Chip key={t} selected={tags.includes(t)}
                    onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}>
                {t}
              </Chip>
            ))}
          </ChipRow>

          {shown.length ? (
            <div className="ux-deck ux-stagger space-y-[12px]">
              {shown.map((s, i) => (
                <Card key={s.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
                  <div className="flex items-start gap-3.5">
                    <IconTile icon={s.icon} tint={s.tint} ink={s.ink} size={48} radius={13} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <h2 className="min-w-0 flex-1 text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>
                          {s.skill}
                        </h2>
                        {/* Offer and ask are the same shape, told apart by one
                            word — because the same woman is usually both. */}
                        <Tag tone={s.side === "Offering" ? "green" : "blue"} size="sm">{s.side}</Tag>
                      </div>
                      <p className="mt-1.5 text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{s.detail}</p>
                      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
                         style={{ color: "var(--ux-muted)" }}>
                        <span className="inline-flex items-center gap-1.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img loading="lazy" decoding="async" src={s.avatar} alt="" className="h-[20px] w-[20px] rounded-full object-cover" />
                          {s.who}
                        </span>
                        <span className="inline-flex items-center gap-1"><Icons.MapPin className="h-3.5 w-3.5" /> {s.place}</span>
                        <span className="inline-flex items-center gap-1">
                          {s.online ? <Icons.Video className="h-3.5 w-3.5" /> : <Icons.Users className="h-3.5 w-3.5" />}
                          {s.online ? tr("library.canDoItOnline")
              : tr("library.inPerson")}
                        </span>
                        <span>{s.level}</span>
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 rounded-[12px] px-4 py-3 text-smd leading-relaxed lg:mt-3.5 lg:p-3 lg:text-xsm"
                     style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>
                    <span style={{ color: "var(--ux-muted)" }}>
                      {s.side === "Offering" ? tr("library.sheWouldLikeInReturn")
              : tr("library.sheCanTeachInReturn")}
                    </span>
                    <strong style={{ color: "var(--ux-ink)" }}>{s.wants}</strong>
                  </p>

                  {/* "0 womans already interested" was a three-line stub in a
                      70px column beside two squeezed buttons — "Open the /
                      exchange" broken in half. The count goes above the
                      actions on a phone and the actions take the width. */}
                  <div className="mt-4 flex flex-col gap-3 border-t pt-4 lg:mt-3.5 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:pt-3.5"
                       style={{ borderColor: "var(--ux-line)" }}>
                    <span className="text-[13px] lg:text-xs" style={{ color: "var(--ux-faint)" }}>
                      {s.matches} {plural("woman", s.matches)} already interested
                    </span>
                    <span className="flex items-center gap-2 [&>*]:flex-1 lg:[&>*]:flex-none">
                      {isAsked(s.id) ? (
                        <>
                          <span className="ux-pop ux-sq inline-flex items-center justify-center gap-1.5 rounded-[12px] px-4 py-2 text-xsm font-semibold lg:justify-start lg:px-3.5"
                                style={{ background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" }}>
                            <Icons.Check className="h-[15px] w-[15px]" strokeWidth={2.6} /> Asked
                          </span>
                          <Btn href={`/app/library/${s.id}`} variant="primary" size="sm" iconEnd="ArrowRight">{tr("library.openTheExchange")}</Btn>
                        </>
                      ) : (
                        /* Her own words, not a canned line sent in her name.
                           `POST /exchange/swaps/{id}/ask` requires text, and a
                           message she did not write is the wrong thing to put
                           in front of a stranger she wants to learn from. */
                        <NoteBtn
                          label={tr("library.proposeASwap")}
                          variant="primary"
                          icon="ArrowRight"
                          title={`Ask ${s.who.split(" ")[0]} about this`}
                          to={s.who}
                          placeholder={`Say what you would like to learn from her, and what you can teach in return — she asked for ${s.wants}.`}
                          sent={tr("library.sentSheHasItNow")}
                          sentBody="You will both see the reply in the exchange. No money changes hands, in either direction."
                          sentLink={{ href: `/app/library/${s.id}`, label: "Open the exchange" }}
                          send={async ({ text }) => {
                            await apiAskSwap(s.id, text);
                            setPending((p) => ({ ...p, [s.id]: true }));
                            refetchMine();
                          }}
                        />
                      )}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState
                icon="RefreshCw"
                title={tr("library.nothingMatchesThat")}
                body="Try fewer tags, or offer something and let people come to you."
                action={<Btn onClick={() => { setTags([]); setSide("All"); }} variant="soft">{tr("library.showEverything")}</Btn>}
              />
            </Card>
          )}
        </>
      )}

      {tab === "Your exchanges" && (
        <div className="ux-deck ux-stagger space-y-[12px]">
          {MY_SWAPS.map((m, i) => (
            <Card key={m.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
              <div className="flex items-center gap-3.5">
                <span className="h-[48px] w-[48px] shrink-0 overflow-hidden rounded-full"
                      style={{ background: "var(--ux-brand-tint)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img loading="lazy" decoding="async" src={m.avatar} alt="" className="ux-art h-full w-full object-cover" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <h2 className="min-w-0 flex-1 truncate text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>
                      With {m.with}
                    </h2>
                    <Tag tone={m.state === "Agreed" ? "green" : "blue"} size="sm">{m.state}</Tag>
                  </div>
                  <p className="mt-1.5 text-xsm" style={{ color: "var(--ux-muted)" }}>{m.next}</p>
                </div>
              </div>

              {/* Both directions, side by side — an exchange is not a favour. */}
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:mt-3.5 lg:gap-2.5">
                {[["You teach", m.youTeach, "--ux-tint-violet", "--ux-violet", "GraduationCap"],
                  ["You learn", m.youLearn, "--ux-tint-green", "--ux-green", "BookOpen"]].map(([k, v, tint, ink, icon]) => (
                  <div key={k} className="ux-sq flex items-center gap-3 rounded-[12px] px-4 py-3 lg:gap-2.5 lg:p-3"
                       style={{ background: "var(--ux-surface-2)" }}>
                    <IconTile icon={icon} tint={tint} ink={ink} size={32} radius={9} />
                    <span className="min-w-0">
                      <span className="block text-[13px] uppercase tracking-[0.06em] lg:text-2xs" style={{ color: "var(--ux-faint)" }}>{k}</span>
                      <span className="mt-0.5 block truncate text-xsm font-medium" style={{ color: "var(--ux-ink)" }}>{v}</span>
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-2 border-t pt-4 lg:mt-3.5 lg:justify-end lg:pt-3.5 [&>*]:flex-1 lg:[&>*]:flex-none" style={{ borderColor: "var(--ux-line)" }}>
                <Btn href={`/app/library/${m.swapId}`} variant="outline" size="sm" icon="MessageCircle">Message</Btn>
                <Btn href={`/app/library/${m.swapId}`} variant="primary" size="sm" icon="CalendarCheck">
                  {m.state === "Agreed" ? tr("library.seeThePlan")
              : tr("library.pickATime")}
                </Btn>
              </div>
            </Card>
          ))}
        </div>
      )}
    </HomeShell>
  );
}
