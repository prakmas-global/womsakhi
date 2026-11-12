"use client";

import { use, useCallback, useMemo, useState } from "react";

import { apiRequestMentor } from "@/lib/growth-api";
import { useAction } from "@/lib/use-action";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import { Back, Btn, Card, EmptyState, IconTile, RailSkeleton, Rating, ScreenSkeleton, SectionHead } from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { Tag } from "@/components/ux/learning/native";
import { useMentors } from "@/components/ux/live";
import { useMentorSessions } from "@/components/ux/growth";
import { rupees } from "@/components/ux/mentors/data";
import { apiMentorReviews, type MentorReviewPage } from "@/lib/mentor-reviews-api";
import { useResource } from "@/lib/use-resource";
import { useT } from "@/i18n";
import { SkillBadges } from "@/components/ux/SkillBadges";
import { Picks } from "@/components/ux/kit/form";
import { pictureOr, useMasterPictures } from "@/components/ux/media/MasterPictures";

const isRealPhoto = (src?: string) => !!src && !src.startsWith("data:") && !src.includes("/ux/art/avatar-");

/**
 * When suits HER, over the next six days — sent as her preferred time, which
 * the mentor confirms or changes. These used to be three fixed dates in May
 * ("Mon 26 May, 11:00 AM") offered as if they were the mentor's free slots,
 * on every mentor, in every month.
 */
const PARTS = [["Morning", "11 am"], ["Afternoon", "3 pm"], ["Evening", "6 pm"]] as const;
function nextDays(n = 6): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 1; i <= n; i++) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
    out.push(x.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }));
  }
  return out;
}

const EMPTY_REVIEWS: MentorReviewPage = { rating: 0, rating_count: 0, sessions_done: 0, learners: 0, came_back: 0, reviews: [] };

/**
 * One mentor, and the way to ask her for time.
 *
 * Asking is three states — idle, sending, asked — and once asked the button
 * cannot be pressed again. A mentor receiving the same request four times
 * because a slow connection hid the confirmation is a real cost to a real
 * person's evening.
 */
export default function MentorDetail({ params }: { params: Promise<{ id: string }> }) {
  const tr = useT();
  const { id } = use(params);
  const { data: MENTORS, source, refetch } = useMentors();
  const m = MENTORS.find((x) => x.id === id);
  const days = useMemo(() => nextDays(), []);
  const topicPics = useMasterPictures("mentor_topics");
  // Her own sessions with this mentor, and what women said — both real.
  const { data: mySessions } = useMentorSessions();
  const PAST_SESSIONS = mySessions.filter((x) => x.mentorId === id);
  const record = useResource(
    useCallback((s: AbortSignal) => apiMentorReviews(id, s).catch(() => EMPTY_REVIEWS), [id]), EMPTY_REVIEWS).data;
  const [slot, setSlot] = useState<string | null>(null);
  /**
   * What she wants help with — required by the server, and rightly so: a
   * mentor reading "someone wants to talk" with no subject cannot prepare,
   * and cannot decide whether she is the right person to say yes.
   */
  const [goal, setGoal] = useState("");
  const [askedNow, setAskedNow] = useState(false);

  const ask = useAction(
    async () => { await apiRequestMentor(id, goal.trim(), slot ?? ""); },
    {
      onDone: () => { setAskedNow(true); refetch(); },
      fallbackError: "That did not go through. She has not been asked — try again in a moment.",
    },
  );

  // Already asked, now or on an earlier visit. `requested` comes from the
  // server and was never read, so a woman who asked last week was shown the
  // form again with no sign her first message existed.
  const asked = askedNow || (m?.requested ?? false);

  // "Not listed" is a claim, and it cannot be made while the answer is still
  // on its way — saying it during the fetch makes the screen flash "that is
  // not here" before showing itself.
  if (!m && source === "loading") {
    return (
      <HomeShell skeleton="detail" rail={<RailSkeleton />}>
        <ScreenSkeleton shape="detail" />
      </HomeShell>
    );
  }

  if (!m) {
    return (
      <HomeShell active="/app/mentors">
        <Card>
          <EmptyState
            icon="SearchX"
            title={tr("mentors.thatMentorIsNotListed")}
            body={tr("mentors.sheMayHavePausedHerSessions")}
            action={<Btn href="/app/mentors" variant="primary" iconEnd="ArrowRight">{tr("mentors.allMentors")}</Btn>}
          />
        </Card>
      </HomeShell>
    );
  }

  const others = MENTORS.filter((x) => x.id !== m.id && x.expertise.some((e) => m.expertise.includes(e))).slice(0, 2);

  return (
    <HomeShell
      active="/app/mentors"
      rail={
        <div className="space-y-[16px]">
          <Card>
            <SectionHead title={m.is_mine ? "This is you" : tr("mentors.askForASession")} />
            {m.is_mine ? (
              <div className="space-y-2.5">
                <p className="text-xsm" style={{ color: "var(--ux-muted)" }}>This is how members see your mentor profile.</p>
                <Btn href="/app/mentoring" variant="primary" full iconEnd="ArrowRight">My mentoring</Btn>
              </div>
            ) : asked ? (
              <div className="ux-slide-up rounded-[12px] p-3.5" style={{ background: "var(--ux-tint-green)" }}>
                <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: "var(--ux-ink)" }}>
                  <Icons.CheckCheck className="h-[16px] w-[16px]" style={{ color: "var(--ux-green-ink)" }} />
                  Sent to {m.name.split(" ")[0]}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
                  {slot ? `You asked for ${slot}. ` : ""}She usually replies within a day.
                </p>
                <div className="mt-3">
                  <Btn href="/app/mentors" variant="soft" size="sm" iconEnd="ArrowRight">{tr("mentors.seeYourSessions")}</Btn>
                </div>
              </div>
            ) : (
              <>
                <p className="mb-3 text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>
                  When suits you? She confirms a time or suggests another.
                  {m.availability ? ` She is usually free: ${m.availability}.` : ""}
                </p>
                <div className="space-y-3">
                  {days.map((day) => (
                    <div key={day}>
                      <p className="ux-group-label mb-1.5 text-2xs font-semibold uppercase tracking-[0.07em]"
                         style={{ color: "var(--ux-faint)" }}>{day}</p>
                      <div className="flex flex-wrap gap-2">
                        {PARTS.map(([part, at]) => {
                          const t = `${part} (${at})`;
                          const v = `${day}, ${part.toLowerCase()} around ${at}`;
                          const on = slot === v;
                          return (
                            <button
                              key={t}
                              onClick={() => setSlot(v)}
                              aria-pressed={on}
                              className="ux-press ux-sq rounded-[12px] border px-3 py-2 text-xs font-medium transition-colors"
                              style={{
                                borderColor: on ? "var(--ux-brand)" : "var(--ux-line-strong)",
                                background: on ? "var(--ux-brand-tint)" : "var(--ux-surface)",
                                color: on ? "var(--ux-brand)" : "var(--ux-ink)",
                              }}
                            >
                              {t}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--ux-ink-2)" }}>{tr("mentors.whatDoYouWantHelpWith")}</label>
                  {/* Her topics as sentences to tap — the box below is only
                      for anything they do not cover. */}
                  <Picks options={[...m.expertise.map((e) => `I want help with ${e.toLowerCase()}`), "I am just starting out", "I want more customers"]}
                         value={goal.split(". ")} multi label={tr("mentors.whatDoYouWantHelpWith")}
                         onPick={(x) => setGoal((g) => {
                           const parts = g.split(". ").map((p) => p.trim()).filter(Boolean);
                           return (parts.includes(x) ? parts.filter((p) => p !== x) : [...parts, x]).join(". ");
                         })} />
                  <div className="mt-2" />
                  <textarea
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    rows={3}
                    placeholder={tr("mentors.iWantToPriceMyTailoring")}
                    className="ux-sq w-full rounded-[12px] border p-3 text-xsm leading-relaxed"
                    style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" }}
                  />
                </div>
                <div className="mt-3">
                  <Btn
                    variant="primary"
                    full
                    iconEnd={ask.busy ? undefined : "ArrowRight"}
                    icon={ask.busy ? "Loader" : undefined}
                    disabled={ask.busy || goal.trim().length < 10}
                    onClick={() => void ask.run()}
                  >
                    {ask.busy ? "Sending…" : slot ? tr("mentors.askForThisTime")
              : tr("mentors.askHerToSuggestATime")}
                  </Btn>
                </div>
                {goal.trim().length < 10 && !ask.error && (
                  <p className="mt-2 text-xs" style={{ color: "var(--ux-faint)" }}>{tr("mentors.aLineAboutWhatYouNeed")}</p>
                )}
                {ask.error && (
                  <p role="alert" className="ux-slide-up mt-2 text-xsm leading-relaxed"
                     style={{ color: "var(--ux-orange-ink)" }}>
                    {ask.error}
                  </p>
                )}
                <p className="mt-2.5 text-xs" style={{ color: "var(--ux-faint)" }}>
                  {m.free_first ? "Free" : `${rupees(m.fee_minor)} a session, paid to her by UPI once she accepts`} · {m.session_mode ?? "Video call"}.
                </p>
              </>
            )}
          </Card>

          <Card>
            <SectionHead title={tr("mentors.stayingSafe")} icon="ShieldCheck" />
            <ul className="space-y-2.5">
              {[
                "Sessions happen inside WomSakhi — no personal numbers needed.",
                "No mentor may ask you for money outside the app.",
                "You can end a session at any time, for any reason.",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-xsm leading-snug" style={{ color: "var(--ux-ink-2)" }}>
                  <Icons.Check className="mt-[2px] h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-green-ink)" }} strokeWidth={2.6} />
                  {t}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      }
    >
      <Back to="/app/mentors" label={tr("mentors.allMentors2")} className="mb-4" />

      {/* The wide picture: her own photo when she uploaded one, otherwise the
          work she guides in — so the page opens on what she helps with. */}
      <div className="relative mb-[-44px] overflow-hidden rounded-[var(--ux-r-card)]" style={{ aspectRatio: "21/8", background: "var(--ux-surface-2)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={pictureOr(isRealPhoto(m.photo) ? m.photo : null, [...m.expertise, m.headline], topicPics.of(m.expertise[0] ?? ""))} alt=""
             className="h-full w-full object-cover" />
        <span aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(16,6,24,0) 40%, rgba(16,6,24,.55))" }} />
      </div>

      <Card className="relative mx-3 mb-[16px] lg:mx-5">
        <div className="flex items-start gap-4">
          <span className="h-[92px] w-[92px] shrink-0 overflow-hidden rounded-[20px]"
                style={{ background: `var(${m.tint})` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" decoding="async" src={m.photo} alt="" className="h-full w-full object-cover" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[24px] font-bold leading-tight lg:text-xl" style={{ color: "var(--ux-ink)" }}>{m.name}</h1>
            <p className="mt-1 text-sm" style={{ color: "var(--ux-ink-2)" }}>{m.headline}</p>
            {!!m.verified_skills?.length && <div className="mt-2"><SkillBadges skills={m.verified_skills} /></div>}
            <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xsm" style={{ color: "var(--ux-muted)" }}>
              <span className="inline-flex items-center gap-1"><Icons.MapPin className="h-4 w-4" /> {m.location}</span>
              <span className="inline-flex items-center gap-1"><Icons.Briefcase className="h-4 w-4" /> {m.experience_years} years</span>
              <span className="inline-flex items-center gap-1"><Icons.Languages className="h-4 w-4" /> {m.languages.join(", ")}</span>
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {record.rating_count > 0
                ? <Rating value={record.rating} count={`${record.rating_count} ${record.rating_count === 1 ? "rating" : "ratings"}`} />
                : <Tag tone="neutral" size="sm">New — no ratings yet</Tag>}
              {m.free_first ? <Tag tone="green" size="sm">Free</Tag> : <Tag tone="orange" size="sm">{rupees(m.fee_minor)} a session</Tag>}
            </div>
          </div>
        </div>
        <p className="mt-4 border-t pt-4 text-[15px] leading-relaxed" style={{ borderColor: "var(--ux-line)", color: "var(--ux-ink-2)" }}>
          {m.bio}
        </p>
      </Card>

      {/* A fixed 300px second column inside a 350px content area leaves the
          first column 34px wide. One column below `lg`, the pair above it. */}
      <div className="ux-split-lg grid gap-[16px] lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card>
          <SectionHead title={tr("mentors.whatSheCanHelpWith")} />
          <ul className="ux-stagger space-y-2.5">
            {m.expertise.map((e, i) => (
              <li key={e} className="ux-hov flex items-center gap-3">
                <IconTile icon={["Megaphone", "Table2", "Compass", "MessageCircle"][i % 4]}
                          tint={m.tint} ink={m.ink} size={36} radius={10} />
                <span className="min-w-0 flex-1 truncate text-xsm" style={{ color: "var(--ux-ink-2)" }}>{e}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionHead title={tr("mentors.herRecord")} />
          <div className="space-y-3.5">
            {[
              [`${record.sessions_done}`, "Sessions given on WomSakhi", "MessageSquare", "--ux-tint-violet", "--ux-violet"],
              [record.rating_count ? `${record.rating} from ${record.rating_count}` : "Not rated yet", "Average rating", "Star", "--ux-tint-orange", "--ux-amber"],
              [record.learners ? `${record.came_back} of ${record.learners}` : "—", "Women who came back", "Repeat", "--ux-tint-green", "--ux-green"],
              [m.availability || "Ask her", "Usually free", "Clock", "--ux-tint-blue", "--ux-blue"],
            ].map(([val, label, icon, tint, ink]) => (
              <div key={label} className="ux-hov flex items-center gap-3">
                <IconTile icon={icon} tint={tint} ink={ink} size={36} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold" style={{ color: "var(--ux-ink)" }}>{val}</p>
                  <p className="mt-0.5 truncate text-[13px] lg:text-2xs" style={{ color: "var(--ux-muted)" }}>{label}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Sessions already had. A mentoring hour that starts with "so, how have
          you been?" wastes the first ten minutes; starting from what she agreed
          to last time does not. */}
      {PAST_SESSIONS.length > 0 && (
        <div className="mt-[16px]">
          <SectionHead title={tr("mentors.yourSessionsWithHer")} icon="History"
                       chip={String(PAST_SESSIONS.length)} />
          <Card pad={0} style={{ overflow: "hidden" }}>
            {PAST_SESSIONS.map((ps, i) => {
              const done = ps.state === "Done";
              return (
                <div key={ps.id} className="flex flex-wrap items-start gap-3.5 px-5 py-4"
                     style={{ borderTop: i === 0 ? "none" : "1px solid var(--ux-line)" }}>
                  <IconTile icon={done ? "CheckCircle2" : "Clock"}
                            tint={done ? "--ux-tint-green" : "--ux-tint-amber"}
                            ink={done ? "--ux-green-ink" : "--ux-amber-ink"} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold" style={{ color: "var(--ux-ink)" }}>{ps.topic}</p>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--ux-muted)" }}>{ps.when} · {ps.state}</p>
                    {ps.note && (
                      <p className="mt-2 flex items-start gap-2 rounded-[8px] px-3 py-2 text-xs leading-snug"
                         style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>
                        <Icons.Flag className="mt-[2px] h-[0.75rem] w-[0.75rem] shrink-0" style={{ color: "var(--ux-violet)" }} />
                        <span><b style={{ color: "var(--ux-ink)" }}>She said:</b> {ps.note}</span>
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      )}

      {/* What women said after a session with her — real ratings, left by
          learners whose session happened (routes/mentor_reviews.py). */}
      <div className="mt-[16px]">
        <SectionHead title={tr("mentors.whatWomenSaidAfterAnHour")}
                     sub={record.learners ? `${record.came_back} of ${record.learners} came back for another session` : undefined}
                     icon="MessageSquare" />
        {record.reviews.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {record.reviews.map((r, i) => (
              <Card key={`${r.first_name}-${i}`} pad={18}>
                <p className="flex items-center gap-0.5" aria-label={`${r.rating} out of 5`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Icons.Star key={n} className="h-[14px] w-[14px]" strokeWidth={1.8}
                                fill={n <= r.rating ? "currentColor" : "none"}
                                style={{ color: n <= r.rating ? "var(--ux-amber-ink)" : "var(--ux-faint)" }} />
                  ))}
                </p>
                {r.text && (
                  <p className="mt-2 text-sm italic leading-relaxed" style={{ color: "var(--ux-ink)" }}>&ldquo;{r.text}&rdquo;</p>
                )}
                <p className="mt-2.5 text-xs" style={{ color: "var(--ux-muted)" }}>
                  <b style={{ color: "var(--ux-ink-2)" }}>{r.first_name}</b> · {r.date}
                </p>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState icon="MessageSquare" title="No ratings yet"
                        body={`Women rate a session after it happens. ${m.is_mine ? "Yours will show here." : `Be one of the first to learn from ${m.name.split(" ")[0]}.`}`} />
          </Card>
        )}
      </div>

      {others.length > 0 && (
        <div className="mt-[16px]">
          <SectionHead title={tr("mentors.othersWhoHelpWithTheSame")} />
          <div className="ux-deck grid grid-cols-2 gap-[16px]">
            {others.map((o, i) => (
              <Card key={o.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
                <div className="flex items-center gap-3">
                  <span className="h-[46px] w-[46px] shrink-0 overflow-hidden rounded-[12px]"
                        style={{ background: `var(${o.tint})` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img loading="lazy" decoding="async" src={o.photo} alt="" className="ux-art h-full w-full object-cover" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{o.name}</h3>
                    <p className="mt-0.5 truncate text-xs" style={{ color: "var(--ux-muted)" }}>{o.headline}</p>
                  </div>
                  <Btn href={`/app/mentors/${o.id}`} variant="soft" size="sm" iconEnd="ArrowRight">Open</Btn>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </HomeShell>
  );
}
