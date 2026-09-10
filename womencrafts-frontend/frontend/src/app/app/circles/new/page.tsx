"use client";

import { useMemo, useState } from "react";

import { apiCreateCircle, type ApiCircleDetail } from "@/lib/growth-api";
import { messageFrom } from "@/lib/use-action";
import { settled, useAttemptKey } from "@/lib/idempotency";
import * as Icons from "@/components/ux/icons";

import {Back, ActionBtn, Btn, Card, IconTile, Pill, SectionHead, copy } from "@/components/ux/kit";
import { Field, TextInput } from "@/components/ux/settings/Frame";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { rupees } from "@/components/ux/circles/data";
import { useT } from "@/i18n";

const KINDS = [
  { id: "Savings", label: "A savings circle", note: "Everyone pays in monthly; one member takes the pot each month",
    icon: "PiggyBank", tint: "--ux-tint-green", ink: "--ux-green" },
  { id: "Trade", label: "A trade group", note: "Women in the same work, sharing orders too big for one",
    icon: "Scissors", tint: "--ux-tint-orange", ink: "--ux-orange" },
  { id: "Community", label: "A community circle", note: "Somewhere to ask questions and know people",
    icon: "UsersRound", tint: "--ux-tint-pink", ink: "--ux-pink" },
];

/**
 * Starting a circle.
 *
 * A savings circle is a financial commitment between women who mostly know each
 * other, so this screen does one thing before anything else: it shows the maths.
 * Members × monthly × months, the pot, and when her own turn falls — all of it
 * before she can invite a single person.
 *
 * A screen that takes the numbers and only reveals the consequence later is how
 * somebody ends up promising ₹1,000 a month she does not have.
 */
export default function NewCircle() {
  const tr = useT();
  const [step, setStep] = useState(1);
  const [kind, setKind] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", place: "Jaipur", members: "10", monthly: "500", about: "" });
  // The circle the server actually made, not a flag saying we asked it to.
  const [created, setCreated] = useState<ApiCircleDetail | null>(null);
  const [making, setMaking] = useState(false);
  const [problem, setProblem] = useState("");
  const attempt = useAttemptKey("new-circle");

  /**
   * Make the circle.
   *
   * This button used to set a flag and nothing else — the screen announced
   * "<name> exists" about a circle that did not.
   */
  async function create() {
    setMaking(true);
    setProblem("");
    try {
      const made = await apiCreateCircle({
        name: form.name.trim(),
        topic: form.place.trim(),
        desc: form.about.trim(),
        is_savings: savings,
        monthly_minor: savings ? Math.round(Number(form.monthly || 0) * 100) : 0,
      }, attempt.current());
      attempt.settle();
      setCreated(made);
    } catch (e) {
      if (settled(e)) attempt.settle();
      setProblem(messageFrom(e, "That did not go through. The circle has not been made — try again in a moment."));
    } finally {
      setMaking(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };

  const savings = kind === "Savings";
  const n = Math.max(0, Number(form.members) || 0);
  const monthly_minor = Math.round((Number(form.monthly) || 0) * 100);
  const pot_minor = n * monthly_minor;
  const total_minor = n * monthly_minor;   // what each member pays over the full cycle

  const ready = useMemo(() => {
    if (!kind) return false;
    if (form.name.trim().length < 3) return false;
    if (savings && (n < 3 || monthly_minor <= 0)) return false;
    return true;
  }, [kind, form, savings, n, monthly_minor]);

  if (created) {
    return (
      <HomeShell>
        <Card className="ux-slide-up mx-auto max-w-[560px]">
          <div className="flex flex-col items-center py-4 text-center">
            <span className="grid h-[68px] w-[68px] place-items-center rounded-full" style={{ background: "var(--ux-tint-green)" }}>
              <Icons.CheckCheck className="h-[32px] w-[32px]" style={{ color: "var(--ux-green-ink)" }} strokeWidth={2} />
            </span>
            <h1 className="mt-4 text-xl font-bold" style={{ color: "var(--ux-ink)" }}>{created.name} exists</h1>
            <p className="mt-2 max-w-[42ch] text-sm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              You are the first member. Nothing starts — and nobody owes anything — until at least three women
              have joined and agreed the order.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2.5">
              <ActionBtn variant="primary" icon="Share2" doneIcon="Copy" done={tr("circlesNew.inviteLinkCopiedSendItOn")}
                         act={() => copy(`https://womsakhi.in/join/${created.id}`,
                                         "Invite link copied — send it on WhatsApp", "Copy it by hand from your circle page")}>{tr("circlesNew.inviteWomenYouTrust")}</ActionBtn>
              <Btn href={`/app/circles/${created.id}`} variant="outline" iconEnd="ArrowRight">{tr("circlesNew.openIt")}</Btn>
            </div>
          </div>
        </Card>
      </HomeShell>
    );
  }

  return (
    <HomeShell
      rail={
        savings && n > 0 && monthly_minor > 0 ? (
          <div className="space-y-[16px]">
            {/* The maths, before she can invite anybody. */}
            <Card>
              <SectionHead title={tr("circlesNew.whatThisMeans")} sub={tr("circlesNew.recalculatesAsYouType")} />
              <div className="space-y-3 text-xsm">
                {[
                  ["Each woman pays", `${rupees(monthly_minor)} a month`],
                  ["The pot each month", rupees(pot_minor)],
                  ["It runs for", `${n} months`],
                  ["You will pay in total", rupees(total_minor)],
                  ["And receive", rupees(pot_minor)],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-3">
                    <span style={{ color: "var(--ux-muted)" }}>{k}</span>
                    <span className="font-semibold tabular-nums" style={{ color: "var(--ux-ink)" }}>{v}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3.5 rounded-[12px] p-3 text-xs leading-relaxed"
                 style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>
                Nobody gains or loses money overall — a circle turns small monthly amounts into one lump sum
                when your turn comes. What it costs is <strong style={{ color: "var(--ux-ink)" }}>{rupees(monthly_minor)}
                every month for {n} months</strong>, without fail.
              </p>
            </Card>

            <Card style={{ borderColor: "var(--ux-orange)" }}>
              <SectionHead title={tr("circlesNew.beforeYouInviteAnyone")} icon="AlertTriangle" />
              <ul className="space-y-2.5">
                {[
                  "Only ask women you would lend money to.",
                  "Agree the order together, in the open, at the start.",
                  "Decide now what happens if somebody cannot pay one month.",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-xsm leading-snug" style={{ color: "var(--ux-ink-2)" }}>
                    <Icons.Dot className="mt-[1px] h-[15px] w-[15px] shrink-0" style={{ color: "var(--ux-orange-ink)" }} />
                    {t}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        ) : undefined
      }
    >
      <Back to="/app/circles" label={tr("circlesNew.allCircles")} className="mb-4" />

      <p className="text-xsm" style={{ color: "var(--ux-faint)" }}>Step {step} of 2</p>
      <h1 className="mt-1 text-2xl font-bold" style={{ color: "var(--ux-ink)" }}>
        {step === 1 ? "What kind of circle?" : `Set up ${form.name || "your circle"}`}
      </h1>
      <p className="mb-[20px] mt-1.5 text-xsm" style={{ color: "var(--ux-muted)" }}>
        {step === 1
          ? tr("circlesNew.threeKindsAndTheyWorkDifferently")
              : tr("circlesNew.nothingIsCommittedUntilWomenJoin")}
      </p>

      {step === 1 && (
        <div className="ux-deck space-y-[12px]">
          {KINDS.map((k, i) => {
            const on = kind === k.id;
            return (
              <button
                key={k.id}
                onClick={() => setKind(k.id)}
                aria-pressed={on}
                className="ux-i ux-sq flex w-full items-center gap-4 rounded-[12px] border p-4 text-start"
                style={{
                  borderColor: on ? "var(--ux-brand)" : "var(--ux-line)",
                  background: on ? "var(--ux-brand-tint)" : "var(--ux-surface)",
                  ["--i" as string]: i,
                }}
              >
                <IconTile icon={k.icon} tint={k.tint} ink={k.ink} size={48} radius={13} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-base font-semibold" style={{ color: "var(--ux-ink)" }}>{k.label}</span>
                    {k.id === "Savings" && <Pill tone="green" size="sm">{tr("circlesNew.involvesMoney")}</Pill>}
                  </span>
                  <span className="mt-1 block text-xsm leading-snug" style={{ color: "var(--ux-muted)" }}>
                    {k.note}
                  </span>
                </span>
                {on && <Icons.CheckCircle2 className="ux-pop h-[20px] w-[20px] shrink-0" style={{ color: "var(--ux-brand)" }} />}
              </button>
            );
          })}
        </div>
      )}

      {step === 2 && (
        <Card>
          <div className="space-y-4">
            <Field label={tr("circlesNew.whatIsItCalled")} hint={tr("circlesNew.somethingTheWomenYouInviteWill")}>
              <TextInput value={form.name} onChange={set("name")} placeholder={tr("circlesNew.jaipurTailorsCircle")} />
            </Field>
            <Field label="Where" hint={tr("circlesNew.aCityOrANeighbourhoodOnline")}>
              <TextInput value={form.place} onChange={set("place")} placeholder="Jaipur" />
            </Field>

            {savings && (
              <div className="grid grid-cols-2 gap-4">
                <Field label={tr("circlesNew.howManyWomen")} hint={tr("circlesNew.eachOneGetsThePotOnce")}>
                  <TextInput value={form.members} onChange={set("members")} inputMode="numeric" placeholder="10" />
                </Field>
                <Field label={tr("circlesNew.howMuchEachMonth")} hint={tr("circlesNew.inRupeesPickAnAmountEveryone")}>
                  <TextInput value={form.monthly} onChange={set("monthly")} inputMode="numeric" placeholder="500" />
                </Field>
              </div>
            )}

            <Field label={tr("circlesNew.sayWhatItIsFor")} hint={tr("circlesNew.womenDecideWhetherToJoinFrom")}>
              <textarea
                value={form.about}
                onChange={(e) => setForm((f) => ({ ...f, about: e.target.value }))}
                rows={3}
                aria-label={tr("circlesNew.sayWhatItIsFor2")}
                className="ux-sq w-full resize-y rounded-[12px] border p-3.5 text-sm leading-relaxed outline-none"
                style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" }}
              />
            </Field>
          </div>
        </Card>
      )}

      {problem && (
        <p role="alert" className="ux-slide-up mt-[20px] text-xsm leading-relaxed"
           style={{ color: "var(--ux-orange-ink)" }}>
          {problem}
        </p>
      )}

      <div className="mt-[20px] flex items-center justify-between gap-4">
        <p className="text-xs" style={{ color: "var(--ux-faint)" }}>
          {step === 1 && !kind ? "Pick a kind to continue."
            : step === 2 && !ready ? "It needs a name" + (savings ? ", at least 3 women and an amount." : ".")
            : "Nothing is committed yet."}
        </p>
        <span className="flex items-center gap-2.5">
          {step === 2 && <Btn variant="outline" icon="ArrowLeft" onClick={() => setStep(1)}>Back</Btn>}
          <Btn
            variant="primary"
            iconEnd={making ? undefined : "ArrowRight"}
            icon={making ? "Loader" : undefined}
            disabled={making || !(step === 1 ? !!kind : ready)}
            onClick={() => (step === 1 ? setStep(2) : void create())}
          >
            {step === 1 ? "Next" : making ? tr("circlesNew.makingIt")
              : tr("circlesNew.createTheCircle")}
          </Btn>
        </span>
      </div>
    </HomeShell>
  );
}
