"use client";

import { use, useState } from "react";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import {Back, Btn, Card, EmptyState, IconTile, Pill, plural, Progress, RailSkeleton, ScreenSkeleton,
  SectionHead,
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useSchemes } from "@/components/ux/entitlements";
import { useAction } from "@/lib/use-action";
import { apiMarkReference } from "@/lib/entitlements-api";
import { useDocuments } from "@/components/ux/live";
import { useT } from "@/i18n";


/**
 * One scheme, and how to actually get the money.
 *
 * Scheme pages everywhere fail the same way: they describe the benefit and stop.
 * The thing that stops a woman is never the description — it is not knowing
 * which office, which paper, and what happens if she is turned down.
 *
 * So this page is built backwards from the counter. The steps say where to go
 * and what to carry. The papers list is checked against what she has already
 * uploaded, so "you need four documents" becomes "you need one more, and it is
 * this one". And a rejection has a named next move, because the most common
 * reason a woman never re-applies is that nobody told her she could.
 */
export default function SchemeDetail({ params }: { params: Promise<{ id: string }> }) {
  const tr = useT();
  const { id } = use(params);
  const { data: SCHEMES, source, refetch } = useSchemes();
  const { data: DOCUMENTS } = useDocuments();
  const s = SCHEMES.find((x) => x.id === id);
  const [applied, setApplied] = useState(s?.applied ?? false);

  /**
   * Applying used to be a local boolean.
   *
   * She would mark a scheme as applied for, close the app, come back, and it
   * had forgotten — which on a screen about money she may be owed is worse
   * than never offering the button: she cannot tell which of eleven schemes
   * she has already been to the bank for.
   */
  const mark = useAction(
    async (_id: string, state: "applied" | "saved") => apiMarkReference(id, state),
    {
      onDone: refetch,
      optimistic: (_id, state) => setApplied(state === "applied"),
      rollback: (_id, state) => setApplied(state !== "applied"),
      fallbackError: "We could not save that. Try again in a moment.",
    },
  );

  // "Not here" is a claim, and it cannot be made while the answer is still on
  // its way — saying it during the fetch makes the screen flash "that is not
  // here" before showing itself.
  if (!s && source === "loading") {
    return (
      <HomeShell skeleton="detail" rail={<RailSkeleton />}>
        <ScreenSkeleton shape="detail" />
      </HomeShell>
    );
  }

  if (!s) {
    return (
      <HomeShell>
        <Card>
          <EmptyState
            icon="FileQuestion"
            title={tr("supportfund.thatSchemeIsNotListed")}
            body="It may have closed, or the link may be old."
            action={<Btn href="/app/support-fund" variant="primary" iconEnd="ArrowRight">{tr("supportfund.allSchemes")}</Btn>}
          />
        </Card>
      </HomeShell>
    );
  }

  // Match the papers the scheme wants against what she has already uploaded, so
  // the ask shrinks to what is genuinely missing.
  const papers = s.needs.map((n) => {
    const held = DOCUMENTS.find((d) => d.name.toLowerCase() === n.toLowerCase());
    return { name: n, have: held?.status === "verified" };
  });
  const missing = papers.filter((p) => !p.have);

  const STEPS = [
    { t: "Check you qualify", d: s.reason, icon: "UserCheck" },
    { t: "Get your papers together",
      d: missing.length
        ? `You still need ${missing.map((m) => m.name).join(" and ")}. Everything else is already with us.`
        : "You already have every paper this asks for.",
      icon: "FolderOpen" },
    { t: "Fill the form",
      d: "Online at the scheme's own site, or on paper at your nearest bank branch or Common Service Centre. Both count the same.",
      icon: "PenLine" },
    { t: "Hand it in and keep the receipt",
      d: "Ask for an acknowledgement slip with a reference number. Without it you cannot chase anything later. Photograph it before you leave the counter.",
      icon: "Receipt" },
    { t: "Wait, then chase",
      d: "Most decisions take three to six weeks. If nothing has come after six weeks, go back with the slip and ask for the status in writing.",
      icon: "Clock" },
  ];

  const others = SCHEMES.filter((x) => x.id !== s.id && x.category === s.category).slice(0, 2);

  return (
    <HomeShell
      skeleton="detail"
      loadFailed="this scheme"
      rail={
        <div className="space-y-[16px]">
          <Card>
            <SectionHead title={applied ? tr("supportfund.yourApplication")
              : tr("supportfund.whatYouGet")} />
            <p className="text-xl font-bold" style={{ color: "var(--ux-ink)" }}>{s.amount}</p>
            <p className="mt-1 text-xsm leading-relaxed" style={{ color: "var(--ux-muted)" }}>{s.gives}</p>

            <div className="my-3.5 h-px" style={{ background: "var(--ux-line)" }} />

            {applied ? (
              <>
                {/* Track it — a real timeline, not a spinner. */}
                <ol className="space-y-3">
                  {[
                    { t: "Sent", d: "18 May 2026", done: true },
                    { t: "Papers checked", d: "21 May 2026", done: true },
                    { t: "With the bank", d: "Since 23 May 2026", done: false, now: true },
                    { t: "Decision", d: "Expected by 21 June", done: false },
                  ].map((r, i, a) => (
                    <li key={r.t} className="flex gap-3">
                      <span className="relative flex flex-col items-center">
                        <span className="grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full"
                              style={{ background: r.done ? "var(--ux-green)" : r.now ? "var(--ux-brand-600)" : "var(--ux-track)" }}>
                          {r.done && <Icons.Check className="h-[12px] w-[12px] text-white" strokeWidth={3} />}
                        </span>
                        {i < a.length - 1 && <span className="w-px flex-1" style={{ background: "var(--ux-line)" }} />}
                      </span>
                      <span className="pb-1">
                        <span className="block text-xsm font-medium" style={{ color: "var(--ux-ink)" }}>{r.t}</span>
                        <span className="block text-xs" style={{ color: "var(--ux-muted)" }}>{r.d}</span>
                      </span>
                    </li>
                  ))}
                </ol>
                <div className="mt-4 space-y-2.5">
                  <Btn variant="outline" full icon="Phone" href="/app/help">{tr("supportfund.askAboutIt")}</Btn>
                  <Btn variant="ghost" full icon="X"
                       className={mark.busy ? "pointer-events-none opacity-60" : ""}
                       onClick={() => void mark.run(id, "saved")}>{tr("supportfund.withdrawTheApplication")}</Btn>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2.5 text-xsm">
                  <div className="flex items-start justify-between gap-3">
                    <span style={{ color: "var(--ux-muted)" }}>Closes</span>
                    <span className="text-end font-medium" style={{ color: "var(--ux-ink)" }}>{s.deadline}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span style={{ color: "var(--ux-muted)" }}>{tr("supportfund.papersReady")}</span>
                    <span className="text-end font-medium" style={{ color: missing.length ? "var(--ux-orange-ink)" : "var(--ux-green-ink)" }}>
                      {papers.length - missing.length} of {papers.length}
                    </span>
                  </div>
                </div>
                <div className="mt-3">
                  <Progress pct={Math.round(((papers.length - missing.length) / papers.length) * 100)} />
                </div>
                <div className="mt-4 space-y-2.5">
                  {s.eligible ? (
                    <Btn variant="primary" full iconEnd="ArrowRight"
                         className={mark.busy ? "pointer-events-none opacity-60" : ""}
                         onClick={() => void mark.run(id, "applied")}>
                      {mark.busy ? "Saving…" : "Start the application"}
                    </Btn>
                  ) : (
                    <Btn variant="outline" full icon="Info" href="/app/support-fund">{tr("supportfund.findOneYouQualifyFor")}</Btn>
                  )}
                  {missing.length > 0 && (
                    <Btn variant="outline" full icon="Upload" href="/app/documents">
                      Add {missing.length} missing {plural("paper", missing.length)}
                    </Btn>
                  )}
                </div>
              </>
            )}
            {mark.error && (
              <p className="ux-slide-up mt-2.5 text-xsm" style={{ color: "var(--ux-orange-ink)" }}>
                {mark.error}
              </p>
            )}
          </Card>

          <Card>
            <SectionHead title={tr("supportfund.ifYouAreTurnedDown")} icon="LifeBuoy" />
            {/* The most common reason a woman never re-applies is that nobody
                told her she could. */}
            <p className="text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              A refusal is not final. Ask for the reason in writing — they must give it. Nine times in ten it
              is a missing paper or a spelling that does not match your Aadhaar, and you can apply again as
              soon as it is fixed. There is no limit on how many times you may apply.
            </p>
            <div className="mt-3">
              <Btn variant="soft" size="sm" full icon="MessageCircle" href="/app/help">{tr("supportfund.getHelpWithARefusal")}</Btn>
            </div>
          </Card>

          {others.length > 0 && (
            <Card>
              <SectionHead title={`Other ${s.category.toLowerCase()} schemes`} />
              <ul className="space-y-2.5">
                {others.map((o) => (
                  <li key={o.id}>
                    <Link href={`/app/support-fund/${o.id}` as never} className="ux-hov flex items-center gap-2.5">
                      <IconTile icon={o.icon} tint={o.tint} ink={o.ink} size={34} radius={9} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xsm font-medium" style={{ color: "var(--ux-ink)" }}>{o.name}</span>
                        <span className="block truncate text-2xs" style={{ color: "var(--ux-muted)" }}>{o.amount}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      }
    >
      <Back to="/app/support-fund" label={tr("supportfund.governmentSchemes")} className="mb-4" />

      <div className="mb-[20px] flex items-start gap-4">
        <IconTile icon={s.icon} tint={s.tint} ink={s.ink} size={56} radius={15} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="neutral" size="sm">{s.category}</Pill>
            {applied
              ? <Pill tone="blue" size="sm">Applied</Pill>
              : s.eligible
                ? <Pill tone="green" size="sm">{tr("supportfund.youQualify")}</Pill>
                : <Pill tone="orange" size="sm">{tr("supportfund.notForYouYet")}</Pill>}
          </div>
          <h1 className="mt-2 text-2xl font-bold leading-tight" style={{ color: "var(--ux-ink)" }}>{s.name}</h1>
          <p className="mt-1 text-xsm" style={{ color: "var(--ux-muted)" }}>{s.body} · {s.who}</p>
        </div>
      </div>

      <Card className="mb-[16px]">
        <SectionHead title={s.eligible ? tr("supportfund.whyYouQualify")
              : tr("supportfund.whyThisOneIsNotFor")}
                     icon={s.eligible ? "CircleCheck" : "CircleAlert"} />
        <p className="text-sm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{s.reason}</p>
      </Card>

      <Card className="mb-[16px]">
        <SectionHead title={tr("supportfund.howToApply")} sub={tr("supportfund.fiveStepsInOrderNothingHere")} />
        <ol className="space-y-2.5">
          {STEPS.map((st, i) => {
            const Icon = (Icons as never as Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties; strokeWidth?: number }>>)[st.icon] ?? Icons.Circle;
            return (
              <li key={st.t} className="ux-sq rounded-[12px] border p-3.5"
                  style={{ borderColor: "var(--ux-line)", background: "var(--ux-surface)" }}>
                <div className="flex items-center gap-3">
                  <span className="ux-sq grid h-[32px] w-[32px] shrink-0 place-items-center rounded-[8px] text-xsm font-bold"
                        style={{ background: "var(--ux-fill)", color: "var(--ux-on-brand)" }}>
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{st.t}</span>
                  <Icon className="h-[16px] w-[16px] shrink-0" style={{ color: "var(--ux-muted)" }} strokeWidth={1.9} />
                </div>
                <p className="mt-2 ps-[44px] text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
                  {st.d}
                </p>
              </li>
            );
          })}
        </ol>
      </Card>

      <Card>
        <SectionHead title={tr("supportfund.papersYouNeed")}
                     sub={missing.length ? `${missing.length} still to add` : "You have all of them"}
                     action="Documents" onAction={() => { window.location.href = "/app/documents"; }} />
        <ul className="space-y-2.5">
          {papers.map((p) => (
            <li key={p.name} className="flex items-center gap-3">
              <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full"
                    style={{ background: p.have ? "var(--ux-tint-green)" : "var(--ux-tint-orange)" }}>
                {p.have
                  ? <Icons.Check className="h-[14px] w-[14px]" style={{ color: "var(--ux-green-ink)" }} strokeWidth={2.8} />
                  : <Icons.Plus className="h-[14px] w-[14px]" style={{ color: "var(--ux-orange-ink)" }} strokeWidth={2.8} />}
              </span>
              <span className="flex-1 text-xsm" style={{ color: "var(--ux-ink)" }}>{p.name}</span>
              <span className="text-xs font-medium"
                    style={{ color: p.have ? "var(--ux-green-ink)" : "var(--ux-orange-ink)" }}>
                {p.have ? tr("supportfund.withUs")
              : tr("supportfund.notAdded")}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </HomeShell>
  );
}
