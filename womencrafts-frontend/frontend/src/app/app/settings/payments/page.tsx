"use client";

import { useState } from "react";
import { COPY } from "@/components/ux/copy";
import * as Icons from "@/components/ux/icons";

import { Btn, IconTile, Pill, SourceNote } from "@/components/ux/kit";
import { Card, Field, SettingsPage, TextInput } from "@/components/ux/settings/Frame";
import { ListRow } from "@/components/ux/mobile/ListRow";
import { PhoneRow, phonePrimary, phoneSecondary } from "@/components/ux/PhoneParts";
import { Group } from "../_parts/Group";
import { usePayoutMethods } from "@/components/ux/business";
import { apiAddBankAccount, apiAddUpi, apiMakePrimary, apiRemoveAccount } from "@/lib/shop-api";
import { useT } from "@/i18n";

type Draft = "bank" | "upi" | null;

const BLANK = { account: "", confirm: "", ifsc: "", holder: "", upi: "" };

/** The two ways to be paid. `row` is the `ListRow` tint name for the phone list. */
const ADD_WAYS = [
  { k: "bank" as const, icon: "Landmark", tint: "--ux-tint-blue", ink: "--ux-blue", row: "blue" as const,
    t: "Bank account", d: "Money in one working day. Works everywhere." },
  { k: "upi" as const, icon: "Smartphone", tint: "--ux-tint-violet", ink: "--ux-violet", row: "violet" as const,
    t: "UPI ID", d: "Usually within minutes. Needs a smartphone." },
];

/**
 * Where her money lands.
 *
 * One rule decides this screen: **exactly one method is primary, and it is
 * named on the row rather than implied by order.** Everywhere else in the app
 * a list is just a list; here the order is money, and a woman who assumes the
 * top one is used will lose a day when it is not.
 *
 * Removing a method is deliberately quiet — no red, no warning shout. It is
 * reversible by adding it again, and treating it as dangerous makes her afraid
 * to tidy up her own account.
 */
export default function PaymentMethodsPage() {
  const tr = useT();
  /**
   * The server is the source of truth here, deliberately.
   *
   * The first version kept the list in local state and edited it optimistically.
   * That is fine for a filter chip and wrong for this screen: it decides where
   * her money goes, and a local list that has drifted from the server shows her
   * a primary account that is not the one a payout will use. So every change
   * goes to the API and the answer comes back from it.
   */
  const { data: methods, source, refetch } = usePayoutMethods();
  const [draft, setDraft] = useState<Draft>(null);
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [form, setForm] = useState(BLANK);

  const set = (k: keyof typeof BLANK, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // The button is live only when the form could actually succeed. A "Save it"
  // that fails validation on the server is a round trip she waits through to
  // be told something the screen already knew.
  const ready = draft === "bank"
    ? form.account.length >= 6 && form.account === form.confirm
      && form.ifsc.length === 11 && form.holder.trim().length > 1
    : form.upi.includes("@") && form.upi.length > 3;

  const run = async (what: () => Promise<unknown>) => {
    setBusy(true);
    setProblem("");
    try {
      await what();
      refetch();
    } catch (e) {
      // Named, not swallowed: a woman who pressed "send my money here" and saw
      // nothing change must be told it did not work.
      setProblem(
        (e as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message || COPY.writeFailed,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsPage
      title={tr("settingsPayments.howYouGetPaid")}
      sub={tr("settingsPayments.yourEarningsGoToTheMethod")}
    >
      <SourceNote source={source} what="accounts" />

      {/*
        On a phone each method is a row of one grouped list — the tile, the
        name with its Primary / Checked marks, the detail, and the two actions
        under it — rather than a bordered card inside a bordered card.
      */}
      <Group
        title={tr("settingsPayments.yourMethods")}
        sub={`${methods.length} added`}
        inset={methods.length ? "flush" : "form"}
        phone={methods.length ? methods.map((m) => (
          <PhoneRow
            key={m.id}
            icon={m.icon}
            tint={m.tint}
            ink={m.ink}
            title={
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {m.label}
                {m.primary && <Pill tone="brand" size="sm">Primary</Pill>}
                {m.verified
                  ? <Pill tone="green" size="sm">Checked</Pill>
                  : <Pill tone="orange" size="sm">{tr("settingsPayments.notCheckedYet")}</Pill>}
              </span>
            }
            meta={m.detail.toLowerCase().includes(m.kind.toLowerCase()) ? m.kind : `${m.kind} · ${m.detail}`}
          >
            <span className="mt-2 flex flex-wrap items-center gap-2">
              {m.primary ? (
                <span className="inline-flex min-h-[44px] items-center gap-1.5 text-[13px] font-semibold" style={{ color: "var(--ux-green-ink)" }}>
                  <Icons.CheckCircle2 className="h-[14px] w-[14px]" />{tr("settingsPayments.yourMoneyComesHere")}</span>
              ) : (
                <Btn variant="outline" size="sm" icon="Star" onClick={() => void run(() => apiMakePrimary(m.id))}>{tr("settingsPayments.sendMyMoneyHere")}</Btn>
              )}
              <Btn variant="ghost" size="sm" icon="Trash2" onClick={() => void run(() => apiRemoveAccount(m.id))}>Remove</Btn>
            </span>
          </PhoneRow>
        )) : undefined}
      >
        {methods.length ? (
          <div className="ux-deck space-y-2.5">
            {methods.map((m, i) => (
              <div
                key={m.id}
                className="ux-i ux-sq rounded-[12px] border p-3.5"
                style={{
                  borderColor: m.primary ? "var(--ux-brand)" : "var(--ux-line)",
                  background: m.primary ? "var(--ux-brand-tint)" : "var(--ux-surface)",
                  ["--i" as string]: i,
                }}
              >
                <div className="flex items-center gap-3.5">
                  <IconTile icon={m.icon} tint={m.tint} ink={m.ink} size={42} radius={11} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{m.label}</p>
                      {/* Named, not implied by position. */}
                      {m.primary && <Pill tone="brand" size="sm">Primary</Pill>}
                      {m.verified
                        ? <Pill tone="green" size="sm">Checked</Pill>
                        : <Pill tone="orange" size="sm">{tr("settingsPayments.notCheckedYet")}</Pill>}
                    </div>
                    <p className="mt-0.5 truncate text-xs" style={{ color: "var(--ux-muted)" }}>
                      {/* "UPI · UPI ID" says the same thing twice. */}
                      {m.detail.toLowerCase().includes(m.kind.toLowerCase()) ? m.kind : `${m.kind} · ${m.detail}`}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 border-t pt-3" style={{ borderColor: "var(--ux-line)" }}>
                  {m.primary ? (
                    <span className="inline-flex items-center gap-1.5 py-1.5 text-xs font-medium" style={{ color: "var(--ux-green-ink)" }}>
                      <Icons.CheckCircle2 className="h-[14px] w-[14px]" />{tr("settingsPayments.yourMoneyComesHere")}</span>
                  ) : (
                    <Btn variant="outline" size="sm" icon="Star" onClick={() => void run(() => apiMakePrimary(m.id))}>{tr("settingsPayments.sendMyMoneyHere")}</Btn>
                  )}
                  <Btn variant="ghost" size="sm" icon="Trash2" onClick={() => void run(() => apiRemoveAccount(m.id))}>Remove</Btn>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-2 text-xsm" style={{ color: "var(--ux-muted)" }}>
            Nothing added yet. Add a bank account or a UPI ID and your earnings have somewhere to go.
            Until then, Withdraw has nowhere to send them.
          </p>
        )}
      </Group>

      {added && (
        <Card>
          <div className="ux-slide-up flex items-start gap-3">
            <Icons.CheckCircle2 className="mt-[1px] h-[18px] w-[18px] shrink-0" style={{ color: "var(--ux-green-ink)" }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>Added</p>
              <p className="mt-1 text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
                We will send ₹1 to check it works, and it will show as Checked within a day. You can use it
                straight away — the ₹1 comes back.
              </p>
            </div>
          </div>
        </Card>
      )}

      {draft === null ? (
        <Group
          title={tr("settingsPayments.addAWayToGetPaid")}
          inset="flush"
          phone={ADD_WAYS.map((o) => (
            <ListRow key={o.k} icon={o.icon} tint={o.row} title={o.t} subtitle={o.d} chevron
                     onClick={() => setDraft(o.k)} />
          ))}
        >
          <div className="grid gap-2.5 sm:grid-cols-2">
            {ADD_WAYS.map((o, i) => (
              <button
                key={o.k}
                onClick={() => setDraft(o.k)}
                className="ux-i ux-sq rounded-[12px] border p-4 text-start"
                style={{ borderColor: "var(--ux-line)", background: "var(--ux-surface)", ["--i" as string]: i }}
              >
                <IconTile icon={o.icon} tint={o.tint} ink={o.ink} size={40} radius={11} />
                <p className="mt-2.5 text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{o.t}</p>
                <p className="mt-1 text-xs leading-snug" style={{ color: "var(--ux-muted)" }}>{o.d}</p>
              </button>
            ))}
          </div>
        </Group>
      ) : (
        <Group title={draft === "bank" ? tr("settingsPayments.addABankAccount")
              : tr("settingsPayments.addAUpiId")} inset="form">
          <div className="space-y-3.5">
            {draft === "bank" ? (
              <>
                <Field label={tr("settingsPayments.accountNumber")}>
                  <TextInput inputMode="numeric" placeholder={tr("settingsPayments.digits")} value={form.account}
                             onChange={(e) => set("account", e.target.value.replace(/\D/g, ""))} />
                </Field>
                <Field label={tr("settingsPayments.typeItAgain")}
                       hint={tr("settingsPayments.oneWrongDigitSendsYourMoney")}>
                  <TextInput inputMode="numeric" value={form.confirm}
                             onChange={(e) => set("confirm", e.target.value.replace(/\D/g, ""))} />
                </Field>
                {/* Said here, while she can still fix it — not after she has
                    pressed save and the money has gone somewhere else. */}
                {form.confirm && form.confirm !== form.account && (
                  <p className="text-xsm" style={{ color: "var(--ux-orange-ink)" }}>{tr("settingsPayments.theseTwoDoNotMatchYet")}</p>
                )}
                <Field label={tr("settingsPayments.ifscCode")} hint={tr("settingsPayments.onTheFirstPageOfYour")}>
                  <TextInput placeholder="HDFC0001234" value={form.ifsc}
                             onChange={(e) => set("ifsc", e.target.value.toUpperCase().slice(0, 11))} />
                </Field>
                <Field label={tr("settingsPayments.nameOnTheAccount")}
                       hint={tr("settingsPayments.mustMatchYourBankExactlyOr")}>
                  <TextInput placeholder={tr("settingsPayments.priyaSharma")} value={form.holder}
                             onChange={(e) => set("holder", e.target.value)} />
                </Field>
              </>
            ) : (
              <Field label="UPI ID"
                     hint={tr("settingsPayments.looksLikeYournameBankFindIt")}>
                <TextInput placeholder="priya@okhdfcbank" value={form.upi}
                           onChange={(e) => set("upi", e.target.value.trim())} />
              </Field>
            )}
          </div>

          {problem && (
            <p className="ux-slide-up mt-3 text-xsm" style={{ color: "var(--ux-orange-ink)" }}>
              {problem}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2.5">
            <Btn variant="primary" iconEnd="ArrowRight"
                 className={`${phonePrimary} ${ready && !busy ? "" : "pointer-events-none opacity-50"}`}
                 onClick={() => void run(async () => {
                   if (draft === "bank") {
                     await apiAddBankAccount({
                       account_number: form.account,
                       confirm_account_number: form.confirm,
                       ifsc: form.ifsc,
                       holder: form.holder,
                     });
                   } else {
                     await apiAddUpi(form.upi);
                   }
                   setForm(BLANK);
                   setDraft(null);
                   setAdded(true);
                 })}>
              {busy ? "Saving…" : "Save it"}
            </Btn>
            <Btn variant="ghost" className={phoneSecondary} onClick={() => { setDraft(null); setProblem(""); }}>{tr("settingsPayments.notNow")}</Btn>
          </div>
        </Group>
      )}

      <Group title={tr("settingsPayments.whatWeNeverDo")} icon="ShieldCheck" inset="form">
        <ul className="space-y-2.5">
          {[
            "We never ask for your PIN, your password or an OTP. Nobody from WomSakhi will.",
            "Buyers and employers never see your account number.",
            "We never take money out. Only you can start a withdrawal.",
          ].map((t) => (
            <li key={t} className="flex items-start gap-2.5 text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              <Icons.Check className="mt-[2px] h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-green-ink)" }} strokeWidth={2.6} />
              {t}
            </li>
          ))}
        </ul>
      </Group>
    </SettingsPage>
  );
}
