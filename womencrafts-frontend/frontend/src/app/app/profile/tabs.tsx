"use client";

import { Btn, Card, EmptyState, I, IconTile, Pill, SectionHead, formatRupees, v } from "@/components/ux/kit";
import {
  CONTRIBUTION, LEARNING, PORTFOLIO, SKILLS, WORK,
} from "@/components/ux/profile/data";

/**
 * The profile tabs that used to be one "coming soon" card.
 *
 * Every tab here answers a question a stranger actually asks before trusting
 * her with money or an order: what can you do, what have you done, what does it
 * look like, and who says so. That ordering is the design — a CV's ordering
 * (education first) is wrong for a woman whose skill did not come from a
 * classroom.
 */

/* ── skills ───────────────────────────────────────────────────────────────── */

/**
 * Skills with evidence attached, never a self-rated bar.
 *
 * A five-star self-assessment is the standard pattern and it is worthless here
 * twice over: a woman with eleven years of stitching will rate herself three,
 * and a stranger has no reason to believe the number anyway. "87 finished, 11
 * buyers came back" is checkable and cannot be talked up.
 */
export function SkillsTab() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <SectionHead title="What you can do" sub="With what you did with it — not a rating you gave yourself"
                     icon="Sparkles" action="Add a skill" />
        <div className="grid gap-3 sm:grid-cols-2">
          {SKILLS.map((s) => (
            <Card key={s.id} pad={16}>
              <div className="flex items-start gap-3.5">
                <IconTile icon={s.icon} tint={s.tint} ink={s.ink} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[0.9375rem] font-bold" style={{ color: v("--ux-ink") }}>{s.name}</p>
                    <Pill tone="neutral" size="sm">{s.years} years</Pill>
                  </div>
                  <p className="mt-1 flex items-start gap-1.5 text-[0.8125rem] leading-snug"
                     style={{ color: v("--ux-green-ink") }}>
                    <I name="Check" className="mt-[2px] h-[0.75rem] w-[0.75rem] shrink-0" sw={3} />
                    {s.proof}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
        <div className="flex items-start gap-3">
          <I name="Info" className="mt-[2px] h-[1rem] w-[1rem] shrink-0" style={{ color: v("--ux-muted") }} />
          <p className="text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
            There are no stars here and no levels. What is written beside each skill is what you
            actually did with it, which is the part a buyer can check.
          </p>
        </div>
      </Card>
    </div>
  );
}

/* ── experience ───────────────────────────────────────────────────────────── */

/**
 * Work and learning, with the gaps left visible.
 *
 * Most CV tools quietly encourage hiding a break. This one lets her name it —
 * "my mother was unwell and I looked after her" — because for the women this is
 * built for, a gap is the norm rather than a flaw, and a timeline that pretends
 * otherwise teaches her that the truth is a problem.
 */
export function ExperienceTab() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <SectionHead title="What you have done" sub="Including the time you were not working" icon="Briefcase"
                     action="Add" />
        <Card pad={0} style={{ overflow: "hidden" }}>
          <ol className="px-5 py-2">
            {WORK.map((w, i) => (
              <li key={w.id} className="relative flex gap-4 py-4">
                {i < WORK.length - 1 && (
                  <span className="absolute left-[0.5rem] top-[1.75rem] bottom-0 w-[2px]"
                        style={{ background: v("--ux-line") }} />
                )}
                <span className="relative z-[1] mt-1.5 h-[1rem] w-[1rem] shrink-0 rounded-full border-2"
                      style={{ background: v(w.until === null ? "--ux-green-ink" : "--ux-surface"),
                               borderColor: v(w.until === null ? "--ux-green-ink" : "--ux-line-strong") }} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[0.9375rem] font-bold" style={{ color: v("--ux-ink") }}>{w.what}</p>
                    {w.until === null && <Pill tone="green" size="sm">Now</Pill>}
                  </div>
                  <p className="mt-0.5 text-[0.75rem]" style={{ color: v("--ux-muted") }}>
                    {[w.where, `${w.when}${w.until ? ` – ${w.until}` : " – now"}`].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-1.5 text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                    {w.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <div>
        <SectionHead title="What you learned" sub="A certificate is not the only thing that counts"
                     icon="GraduationCap" action="Add" />
        <Card pad={0} style={{ overflow: "hidden" }}>
          {LEARNING.map((l, i) => (
            <div key={l.id} className="flex flex-wrap items-center gap-3.5 px-5 py-4"
                 style={{ borderTop: i === 0 ? "none" : `1px solid ${v("--ux-line")}` }}>
              <span className="grid h-[2.25rem] w-[2.25rem] shrink-0 place-items-center rounded-[12px]"
                    style={{ background: v(l.certificate ? "--ux-tint-green" : "--ux-surface-2"),
                             color: v(l.certificate ? "--ux-green-ink" : "--ux-muted") }}>
                <I name={l.certificate ? "Award" : "BookOpen"} className="h-[1rem] w-[1rem]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.875rem] font-bold" style={{ color: v("--ux-ink") }}>{l.what}</p>
                <p className="text-[0.75rem]" style={{ color: v("--ux-muted") }}>{l.where} · {l.when}</p>
              </div>
              {l.certificate && <Btn size="sm" variant="ghost" icon="Download" href="/app/certificates">Get it</Btn>}
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

/* ── portfolio ────────────────────────────────────────────────────────────── */

/** Work she can point at. The thing a buyer asks for before an order. */
export function PortfolioTab() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <SectionHead title="Work you can show someone"
                     sub="The thing a buyer asks for before a first order" icon="Camera" action="Add a photo" />
        {PORTFOLIO.length === 0 ? (
          <Card>
            <EmptyState icon="Camera" title="Nothing here yet"
                        body="Photograph the next thing you finish. One clear photo of real work does more than any description."
                        action={<Btn size="sm" icon="Camera">Add your first</Btn>} />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PORTFOLIO.map((p) => (
              <Card key={p.id} pad={16}>
                <IconTile icon={p.icon} tint={p.tint} ink={p.ink} size={44} radius={12} />
                <p className="mt-3 text-[0.9375rem] font-bold" style={{ color: v("--ux-ink") }}>{p.title}</p>
                <p className="mt-1 text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-muted") }}>{p.detail}</p>
                {p.minor !== null && (
                  <p className="mt-2.5 text-[0.875rem] font-bold tabular-nums" style={{ color: v("--ux-green-ink") }}>
                    Sold for {formatRupees(p.minor)}
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── contribution ─────────────────────────────────────────────────────────── */

/**
 * What she has done for other women.
 *
 * Counted, never ranked. The research on this product is explicit that follower
 * counts measure the wrong thing — "mentored 12 women" and "helped 4 women find
 * work" are what mean something in a trust network. A leaderboard would also
 * turn helping into a way of climbing, which is the opposite of the point.
 */
export function ContributionTab() {
  const total = CONTRIBUTION.reduce((n, c) => n + c.value, 0);
  return (
    <div className="flex flex-col gap-4">
      <Card pad={0} style={{ overflow: "hidden" }}>
        <div className="px-6 py-7"
             style={{ background: `linear-gradient(140deg, ${v("--ux-tint-pink")}, ${v("--ux-surface")})` }}>
          <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.18em]" style={{ color: v("--ux-pink-ink") }}>
            Women helping women
          </p>
          <p className="mt-2 text-[clamp(1.5rem,3vw,2.25rem)] font-extrabold leading-tight tracking-[-0.03em]"
             style={{ color: v("--ux-ink") }}>
            {total} women are further along because of you
          </p>
          <p className="mt-2 max-w-[52ch] text-[0.875rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
            This is not a score and there is no ranking. It is a count of things you actually did,
            and nobody else can see it unless you show them.
          </p>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {CONTRIBUTION.map((c) => (
          <Card key={c.id} pad={16}>
            <div className="flex items-center gap-3.5">
              <IconTile icon={c.icon} tint={c.tint} ink={c.ink} size={42} />
              <div className="min-w-0 flex-1">
                <p className="text-[1.5rem] font-extrabold leading-none tabular-nums" style={{ color: v("--ux-ink") }}>
                  {c.value}
                </p>
                <p className="mt-1 text-[0.8125rem] font-semibold" style={{ color: v("--ux-ink-2") }}>{c.label}</p>
                <p className="text-[0.75rem]" style={{ color: v("--ux-muted") }}>{c.detail}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card pad={16}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[0.875rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
            There is always another woman a step behind you.
          </p>
          <Btn size="sm" href="/app/together" icon="Handshake">Help someone</Btn>
        </div>
      </Card>
    </div>
  );
}

/* ── documents ────────────────────────────────────────────────────────────── */

/** Points at the vault rather than copying it — one place, not two. */
export function DocumentsTab() {
  return (
    <Card>
      <EmptyState
        icon="FolderLock"
        title="Your papers live in your locker"
        body="Aadhaar, PAN, bank details and registrations are kept there rather than on your profile, so nothing anyone can see is ever one tap from a document."
        action={<Btn size="sm" href="/app/vault" icon="Lock">Open your locker</Btn>}
      />
    </Card>
  );
}
