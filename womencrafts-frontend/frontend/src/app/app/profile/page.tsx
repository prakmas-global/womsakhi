"use client";

import { useCallback, useState } from "react";
import * as Icons from "@/components/ux/icons";

import { apiMeProfile, type MeProfile } from "@/lib/member-api";
import { useResource } from "@/lib/use-resource";
import { useAuth } from "@/context/AuthContext";
import { Btn, Card, I, Pill, Progress, SectionHead, Stat, Tabs } from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { ContributionTab, DocumentsTab, ExperienceTab, PortfolioTab, SkillsTab } from "./tabs";
import { useMe } from "@/components/ux/me";
import { useCertificates, useCircles, useProgress } from "@/components/ux/live";
import { useGoals } from "@/components/ux/business";
import { useMoney } from "@/components/ux/money/live";
import { formatMoney } from "@/components/ux/kit/money";
import { useT } from "@/i18n";

/**
 * The five things this profile is actually made of.
 *
 * This screen used to render `PROFILE_STEPS`, a module constant: five steps
 * with `done` hardcoded, three of them true. Every woman was told she was 40%
 * complete and that her photo and her skills were already in — and ticking a
 * box wrote to component state and nothing else, so the ticks vanished on
 * reload. The fields below are the ones `/me/profile` actually carries and
 * `/app/settings/account` actually writes, so the checklist is a reading of
 * her profile rather than a list of chores nobody is keeping.
 */
function stepsFor(p: MeProfile | null) {
  return [
    { id: "photo", label: "Add a photo", done: !!p?.avatar },
    { id: "bio", label: "Write a line about yourself", done: !!p?.bio },
    { id: "phone", label: "Add your phone number", done: !!p?.phone },
    { id: "place", label: "Say which city you are in", done: !!p?.location },
    { id: "dob", label: "Add your date of birth", done: !!p?.dob },
  ];
}

/** Her profile — and the honest list of what is still missing from it. */
export default function Profile() {
  const tr = useT();
  const ME = useMe();
  const { user } = useAuth();
  const [tab, setTab] = useState("Overview");

  const { data: profile, source } = useResource(
    useCallback(() => apiMeProfile(), []),
    null as MeProfile | null,
  );
  const { data: progress } = useProgress();
  const { data: CERTIFICATES } = useCertificates();
  const { data: circles } = useCircles();
  const { data: GOALS } = useGoals();
  const { data: money } = useMoney();

  // Derived from the fetched profile, never held in state. `useState(x ?? [])`
  // runs before the fetch answers, so it would freeze on the fallback and the
  // percentage would never move — the exact bug this screen already had.
  const steps = stepsFor(profile);
  const done = steps.filter((s) => s.done).length;
  const pct = Math.round((done / steps.length) * 100);
  const left = steps.filter((s) => !s.done);

  const name = profile?.full_name || user?.full_name || ME.name;
  const verified = profile?.verification_status === "active";
  const avatar = profile?.avatar || ME.avatar;

  // Settled credits dated inside this calendar month. The card said ₹24,350
  // to everybody, including a woman who has never been paid through WomSakhi.
  const thisMonth = new Date().toISOString().slice(0, 7);
  const earnedMinor = money.txns
    .filter((t) => t.kind === "credit" && t.status === "settled" && String(t.when).slice(0, 7) === thisMonth)
    .reduce((a, t) => a + t.amount_minor, 0);

  return (
    <HomeShell
      active="/app/profile"
      rail={
        <div className="space-y-[16px]">
          <Card>
            <SectionHead title={tr("profile.profileStrength")} />
            <p className="text-2xlm font-bold leading-none" style={{ color: "var(--ux-ink)" }}>{pct}%</p>
            <div className="mt-3"><Progress pct={pct} /></div>
            <p className="mt-2.5 text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>
              {source === "loading"
                ? "Reading your profile…"
                : left.length
                  ? `${done} of ${steps.length} filled in. ${left.length} left.`
                  : "Complete. Employers can see everything they need."}
            </p>
          </Card>

          {/*
            * A card here counted "34 people looked you up", "+12 vs last
            * month", three faces from a fixture and "2 employers and a
            * mentor". Nothing in this API counts profile views, so there was
            * nothing behind any of it. It is gone rather than guessed.
            */}

          <Card>
            <SectionHead title={tr("profile.whyItMatters")} />
            <ul className="space-y-2.5">
              {[["Appear in more searches", "Search"],
                ["Get matched to better work", "Target"],
                ["Mentors can see your goals", "Users"]].map(([t, ic]) => (
                <li key={t} className="flex items-start gap-2.5 text-xsm leading-snug" style={{ color: "var(--ux-ink-2)" }}>
                  <I name={ic} className="mt-[1px] h-[15px] w-[15px] shrink-0" style={{ color: "var(--ux-brand)" }} /> {t}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      }
    >
      <Card className="mb-[16px]">
        <div className="flex items-start gap-5">
          <div className="relative shrink-0">
            <span className="ux-hov block h-[92px] w-[92px] overflow-hidden rounded-full"
                  style={{ background: "var(--ux-brand-tint)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img loading="lazy" decoding="async" src={avatar} alt="" className="ux-art h-full w-full object-cover" />
            </span>
            {/* Was a <button> with no handler at all. It goes where the photo
                is actually changed. */}
            <Btn href="/app/settings/account" variant="soft" size="sm" icon="Camera"
                 ariaLabel={tr("profile.changePhoto2")}
                 className="absolute -bottom-1 -end-1 !rounded-full !px-2 !py-2">
              <span className="sr-only">{tr("profile.changePhoto")}</span>
            </Btn>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-xl font-bold" style={{ color: "var(--ux-ink)" }}>
              {name}
              {/* The blue tick was painted on every profile. It now means what
                  the server says it means. */}
              {verified && <Icons.BadgeCheck className="h-5 w-5" style={{ color: "var(--ux-blue)" }} />}
            </h1>
            <p className="mt-1 text-xsm" style={{ color: profile?.bio ? "var(--ux-muted)" : "var(--ux-faint)" }}>
              {profile?.bio || "You have not written a line about yourself yet."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {/* Three interests — "Digital Marketing", "Financial Freedom",
                  "Career Growth" — were shown as hers on every profile. The
                  server keeps one segment, and only that is shown. */}
              {verified && <Pill tone="green">{tr("profile.verifiedMember")}</Pill>}
              {profile?.segment && <Pill tone="brand">{profile.segment}</Pill>}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Btn href="/app/profile/preview" variant="outline" size="sm" icon="Eye">{tr("profile.seeItAsOthersDo")}</Btn>
            <Btn href="/app/settings/account" variant="primary" size="sm" icon="Pencil">{tr("profile.editProfile")}</Btn>
          </div>
        </div>

        {/* Every one of these four was a constant: 6, 4, 15 and ₹24,350. */}
        <div className="mt-5 grid grid-cols-4 gap-[16px] border-t pt-4" style={{ borderColor: "var(--ux-line)" }}>
          <Stat value={String(progress?.programs_completed ?? 0)} label={tr("profile.coursesFinished")}
                icon="BookOpenCheck" tint="--ux-tint-violet" ink="--ux-violet" />
          {/* The one metal surface in the app. Cold and hard is the right
              feeling for something awarded; everywhere else it fights the
              brand's warmth, so it is deliberately not reused. */}
          <div className="flex items-center gap-3">
            <span className="ux-metal ux-sq grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[12px]">
              <Icons.Award className="ux-ico h-[17px] w-[17px]" strokeWidth={1.9} />
            </span>
            <div className="min-w-0">
              <p className="text-lg font-bold leading-none" style={{ color: "var(--ux-ink)" }}>
                {CERTIFICATES.length}
              </p>
              <p className="mt-1 truncate text-xs" style={{ color: "var(--ux-muted)" }}>Certificates</p>
            </div>
          </div>
          <Stat value={String(circles.mine.length)} label={tr("profile.circlesJoined")} icon="UsersRound" tint="--ux-tint-pink" ink="--ux-pink" />
          <Stat value={formatMoney(earnedMinor)} label={tr("profile.earnedThisMonth")} icon="BadgeIndianRupee" tint="--ux-tint-orange" ink="--ux-orange" />
        </div>
      </Card>

      <div className="mb-[16px]"><Tabs items={["Overview", "Skills", "Experience", "What you made", "Helping others", "Documents"]} active={tab} onChange={setTab} /></div>

      {tab === "Overview" && (
        <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-[16px]">
          <Card>
            <SectionHead title={tr("profile.finishYourProfile")}
                         sub={left.length ? `${left.length} still to fill in` : "Nothing left to do"} />
            <ul className="space-y-2.5">
              {steps.map((s, i) => (
                <li key={s.id} className="ux-i ux-rise flex items-center gap-3 rounded-[12px] border p-3"
                    style={{ borderColor: "var(--ux-line)", ["--i" as string]: i }}>
                  {/* Not a checkbox. Ticking one used to set component state
                      and write nothing anywhere, so a woman could mark her
                      profile complete without adding a single thing to it.
                      This reads the field; the button below fills it. */}
                  <span aria-hidden
                        className="ux-sq grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border-2"
                        style={{ background: s.done ? "var(--ux-green)" : "transparent",
                                 borderColor: s.done ? "var(--ux-green)" : "var(--ux-line-strong)" }}>
                    {s.done && <Icons.Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1 text-xsm"
                        style={{ color: s.done ? "var(--ux-muted)" : "var(--ux-ink)",
                                 textDecoration: s.done ? "line-through" : "none" }}>
                    {s.label}
                  </span>
                  <span className="sr-only">{s.done ? "Done" : "Not done yet"}</span>
                  {!s.done && <Btn href="/app/settings/account" variant="soft" size="sm">Add</Btn>}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <SectionHead title={tr("profile.aboutYou")} action="Edit"
                         onAction={() => { window.location.href = "/app/settings/account"; }} />
            {/* Location, languages, trade and joining date were "Jaipur,
                Rajasthan", "Hindi, English", "Digital marketing" and "March
                2025" — for everyone. Each is now her own, or says it is
                missing rather than filling the gap. */}
            <dl className="space-y-3 text-xsm">
              {[
                ["Location", profile?.location || ""],
                ["App language", profile?.locale === "hi" ? "हिंदी" : profile?.locale === "en" ? "English" : profile?.locale || ""],
                ["Works in", profile?.segment || ""],
                ["Member since", progress?.member_since || ""],
              ].map(([k, val]) => (
                <div key={k} className="flex items-start justify-between gap-3">
                  <dt style={{ color: "var(--ux-muted)" }}>{k}</dt>
                  <dd className="text-end font-medium"
                      style={{ color: val ? "var(--ux-ink)" : "var(--ux-faint)" }}>
                    {val || "Not added yet"}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="my-4 h-px" style={{ background: "var(--ux-line)" }} />
            <h3 className="mb-2.5 text-xsm font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("profile.whatYouAreWorkingTowards")}</h3>
            {/* Three goals at 72%, 65% and 50% were written into the screen.
                `/me/goals` holds hers, and says so when there are none. */}
            {GOALS.length ? (
              <ul className="ux-stagger space-y-3.5">
                {GOALS.map((g) => (
                  <li key={g.id}>
                    {/* Label and percentage share a line; the bar gets its own,
                        indented to clear the icon. Centring the percentage against
                        a two-line block put it between the two, aligned to
                        neither. */}
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-[28px] w-[28px] shrink-0 place-items-center rounded-[8px]"
                            style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>
                        <I name={g.icon || "Target"} className="ux-ico h-[14px] w-[14px]" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xsm" style={{ color: "var(--ux-ink-2)" }}>
                        {g.label}
                      </span>
                      <span className="shrink-0 text-xs font-medium tabular-nums" style={{ color: "var(--ux-muted)" }}>
                        {g.pct}%
                      </span>
                    </div>
                    <div className="ms-[40px] mt-2"><Progress pct={g.pct} h={5} track="--ux-track" /></div>
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <p className="text-xsm leading-relaxed" style={{ color: "var(--ux-muted)" }}>
                  You have not set a goal yet. One number you are aiming at makes the rest of this screen
                  mean something.
                </p>
                <div className="mt-3">
                  <Btn href="/app/wallet" variant="soft" size="sm" iconEnd="ArrowRight">{tr("profile.setAGoal")}</Btn>
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {tab === "Skills" && <SkillsTab />}
      {tab === "Experience" && <ExperienceTab />}
      {tab === "What you made" && <PortfolioTab />}
      {tab === "Helping others" && <ContributionTab />}
      {tab === "Documents" && <DocumentsTab />}
    </HomeShell>
  );
}
