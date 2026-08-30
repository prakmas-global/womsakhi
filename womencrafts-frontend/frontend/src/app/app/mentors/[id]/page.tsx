"use client";

import { use, useState } from "react";

import { apiRequestMentor } from "@/lib/growth-api";
import { useAction } from "@/lib/use-action";
import Link from "next/link";
import * as Icons from "lucide-react";

import {
  Btn, Card, EmptyState, IconTile, Pill, RailSkeleton, Rating, ScreenSkeleton, SectionHead,
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useMentors } from "@/components/ux/live";
import { rupees } from "@/components/ux/mentors/data";

const SLOTS = [
  { day: "Mon 26 May", times: ["11:00 AM", "5:30 PM"] },
  { day: "Tue 27 May", times: ["6:00 PM"] },
  { day: "Thu 29 May", times: ["11:00 AM", "4:00 PM", "6:30 PM"] },
];

/**
 * One mentor, and the way to ask her for time.
 *
 * Asking is three states — idle, sending, asked — and once asked the button
 * cannot be pressed again. A mentor receiving the same request four times
 * because a slow connection hid the confirmation is a real cost to a real
 * person's evening.
 */
export default function MentorDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: MENTORS, source, refetch } = useMentors();
  const m = MENTORS.find((x) => x.id === id);
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
            title="That mentor is not listed"
            body="She may have paused her sessions. The others are still here."
            action={<Btn href="/app/mentors" variant="primary" iconEnd="ArrowRight">All mentors</Btn>}
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
        <div className="space-y-[15px]">
          <Card>
            <SectionHead title="Ask for a session" />
            {asked ? (
              <div className="ux-slide-up rounded-[13px] p-3.5" style={{ background: "var(--ux-tint-green)" }}>
                <p className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: "var(--ux-ink)" }}>
                  <Icons.CheckCheck className="h-[16px] w-[16px]" style={{ color: "var(--ux-green-ink)" }} />
                  Sent to {m.name.split(" ")[0]}
                </p>
                <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
                  {slot ? `You asked for ${slot}. ` : ""}She usually replies within a day.
                </p>
                <div className="mt-3">
                  <Btn href="/app/mentors" variant="soft" size="sm" iconEnd="ArrowRight">See your sessions</Btn>
                </div>
              </div>
            ) : (
              <>
                <p className="mb-3 text-[12px]" style={{ color: "var(--ux-muted)" }}>
                  Pick a time that suits you. She will confirm or suggest another.
                </p>
                <div className="space-y-3">
                  {SLOTS.map((d) => (
                    <div key={d.day}>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.07em]"
                         style={{ color: "var(--ux-faint)" }}>{d.day}</p>
                      <div className="flex flex-wrap gap-2">
                        {d.times.map((t) => {
                          const v = `${d.day}, ${t}`;
                          const on = slot === v;
                          return (
                            <button
                              key={t}
                              onClick={() => setSlot(v)}
                              aria-pressed={on}
                              className="ux-press ux-sq rounded-[10px] border px-3 py-2 text-[12px] font-medium transition-colors"
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
                  <label className="mb-1.5 block text-[12px] font-medium" style={{ color: "var(--ux-ink-2)" }}>
                    What do you want help with?
                  </label>
                  <textarea
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    rows={3}
                    placeholder="I want to price my tailoring work so I stop losing money on big orders."
                    className="ux-sq w-full rounded-[11px] border p-3 text-[13px] leading-relaxed"
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
                    {ask.busy ? "Sending…" : slot ? "Ask for this time" : "Ask her to suggest a time"}
                  </Btn>
                </div>
                {goal.trim().length < 10 && !ask.error && (
                  <p className="mt-2 text-[11.5px]" style={{ color: "var(--ux-faint)" }}>
                    A line about what you need is enough — it is what she reads first.
                  </p>
                )}
                {ask.error && (
                  <p role="alert" className="ux-slide-up mt-2 text-[12.5px] leading-relaxed"
                     style={{ color: "var(--ux-orange-ink)" }}>
                    {ask.error}
                  </p>
                )}
                <p className="mt-2.5 text-[11.5px]" style={{ color: "var(--ux-faint)" }}>
                  {m.free_first ? "Your first session with her is free." : `${rupees(m.fee_minor)} a session.`}
                </p>
              </>
            )}
          </Card>

          <Card>
            <SectionHead title="Staying safe" icon="ShieldCheck" />
            <ul className="space-y-2.5">
              {[
                "Sessions happen inside WomSakhi — no personal numbers needed.",
                "No mentor may ask you for money outside the app.",
                "You can end a session at any time, for any reason.",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-[12.5px] leading-snug" style={{ color: "var(--ux-ink-2)" }}>
                  <Icons.Check className="mt-[2px] h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-green-ink)" }} strokeWidth={2.6} />
                  {t}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      }
    >
      <Link href="/app/mentors"
            className="ux-hov -my-1 mb-3.5 inline-flex items-center gap-1.5 py-1 text-[12.5px] font-medium"
            style={{ color: "var(--ux-brand)" }}>
        <Icons.ArrowLeft className="ux-ico h-4 w-4" /> All mentors
      </Link>

      <Card className="mb-[15px]">
        <div className="flex items-start gap-4">
          <span className="h-[92px] w-[92px] shrink-0 overflow-hidden rounded-[20px]"
                style={{ background: `var(${m.tint})` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.photo} alt="" className="h-full w-full object-cover" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-bold leading-tight" style={{ color: "var(--ux-ink)" }}>{m.name}</h1>
            <p className="mt-1 text-[13.5px]" style={{ color: "var(--ux-ink-2)" }}>{m.headline}</p>
            <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]" style={{ color: "var(--ux-muted)" }}>
              <span className="inline-flex items-center gap-1"><Icons.MapPin className="h-4 w-4" /> {m.location}</span>
              <span className="inline-flex items-center gap-1"><Icons.Briefcase className="h-4 w-4" /> {m.experience_years} years</span>
              <span className="inline-flex items-center gap-1"><Icons.Languages className="h-4 w-4" /> {m.languages.join(", ")}</span>
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Rating value={m.rating} count={`${m.rating_count} notes`} />
              {m.free_first && <Pill tone="green" size="sm">First session free</Pill>}
            </div>
          </div>
        </div>
        <p className="mt-4 border-t pt-4 text-[13.5px] leading-relaxed" style={{ borderColor: "var(--ux-line)", color: "var(--ux-ink-2)" }}>
          {m.bio}
        </p>
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-[15px]">
        <Card>
          <SectionHead title="What she can help with" />
          <ul className="ux-stagger space-y-2.5">
            {m.expertise.map((e, i) => (
              <li key={e} className="ux-hov flex items-center gap-3">
                <IconTile icon={["Megaphone", "Table2", "Compass", "MessageCircle"][i % 4]}
                          tint={m.tint} ink={m.ink} size={36} radius={10} />
                <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: "var(--ux-ink-2)" }}>{e}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionHead title="Her record" />
          <div className="space-y-3.5">
            {[
              [`${m.sessions_done}`, "Sessions given", "MessageSquare", "--ux-tint-violet", "--ux-violet"],
              [`${m.rating}`, "Average note", "Star", "--ux-tint-orange", "--ux-amber"],
              [m.availability, "Usually free", "Clock", "--ux-tint-blue", "--ux-blue"],
            ].map(([val, label, icon, tint, ink]) => (
              <div key={label} className="ux-hov flex items-center gap-3">
                <IconTile icon={icon} tint={tint} ink={ink} size={36} />
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold" style={{ color: "var(--ux-ink)" }}>{val}</p>
                  <p className="mt-0.5 truncate text-[11px]" style={{ color: "var(--ux-muted)" }}>{label}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {others.length > 0 && (
        <div className="mt-[15px]">
          <SectionHead title="Others who help with the same things" />
          <div className="ux-deck grid grid-cols-2 gap-[15px]">
            {others.map((o, i) => (
              <Card key={o.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
                <div className="flex items-center gap-3">
                  <span className="h-[46px] w-[46px] shrink-0 overflow-hidden rounded-[12px]"
                        style={{ background: `var(${o.tint})` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={o.photo} alt="" className="ux-art h-full w-full object-cover" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[13.5px] font-semibold" style={{ color: "var(--ux-ink)" }}>{o.name}</h3>
                    <p className="mt-0.5 truncate text-[11.5px]" style={{ color: "var(--ux-muted)" }}>{o.headline}</p>
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
