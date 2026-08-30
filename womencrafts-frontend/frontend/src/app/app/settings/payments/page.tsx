"use client";

import { useState } from "react";
import * as Icons from "lucide-react";

import { Btn, IconTile, Pill, SourceNote } from "@/components/ux/kit";
import { Card, Field, SectionHead, SettingsPage, TextInput } from "@/components/ux/settings/Frame";
import { usePayoutMethods } from "@/components/ux/business";
import { apiAddBankAccount, apiAddUpi, apiMakePrimary, apiRemoveAccount } from "@/lib/shop-api";

type Draft = "bank" | "upi" | null;

const BLANK = { account: "", confirm: "", ifsc: "", holder: "", upi: "" };

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
          ?.response?.data?.error?.message || "That did not go through. Try again in a moment.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsPage
      title="How you get paid"
      sub="Your earnings go to the method marked Primary. Everything here is between you and your bank — buyers never see it."
    >
      <SourceNote source={source} what="accounts" />

      <Card>
        <SectionHead title="Your methods" sub={`${methods.length} added`} />
        {methods.length ? (
          <div className="ux-deck space-y-2.5">
            {methods.map((m, i) => (
              <div
                key={m.id}
                className="ux-i ux-sq rounded-[13px] border p-3.5"
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
                      <p className="truncate text-[13.5px] font-semibold" style={{ color: "var(--ux-ink)" }}>{m.label}</p>
                      {/* Named, not implied by position. */}
                      {m.primary && <Pill tone="brand" size="sm">Primary</Pill>}
                      {m.verified
                        ? <Pill tone="green" size="sm">Checked</Pill>
                        : <Pill tone="orange" size="sm">Not checked yet</Pill>}
                    </div>
                    <p className="mt-0.5 truncate text-[11.5px]" style={{ color: "var(--ux-muted)" }}>
                      {/* "UPI · UPI ID" says the same thing twice. */}
                      {m.detail.toLowerCase().includes(m.kind.toLowerCase()) ? m.kind : `${m.kind} · ${m.detail}`}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 border-t pt-3" style={{ borderColor: "var(--ux-line)" }}>
                  {m.primary ? (
                    <span className="inline-flex items-center gap-1.5 py-1.5 text-[12px] font-medium" style={{ color: "var(--ux-green-ink)" }}>
                      <Icons.CheckCircle2 className="h-[14px] w-[14px]" /> Your money comes here
                    </span>
                  ) : (
                    <Btn variant="outline" size="sm" icon="Star" onClick={() => void run(() => apiMakePrimary(m.id))}>
                      Send my money here
                    </Btn>
                  )}
                  <Btn variant="ghost" size="sm" icon="Trash2" onClick={() => void run(() => apiRemoveAccount(m.id))}>Remove</Btn>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-2 text-[13px]" style={{ color: "var(--ux-muted)" }}>
            Nothing added yet. Add a bank account or a UPI ID and your earnings have somewhere to go.
            Until then, Withdraw has nowhere to send them.
          </p>
        )}
      </Card>

      {added && (
        <Card>
          <div className="ux-slide-up flex items-start gap-3">
            <Icons.CheckCircle2 className="mt-[1px] h-[18px] w-[18px] shrink-0" style={{ color: "var(--ux-green-ink)" }} />
            <div>
              <p className="text-[13.5px] font-semibold" style={{ color: "var(--ux-ink)" }}>Added</p>
              <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
                We will send ₹1 to check it works, and it will show as Checked within a day. You can use it
                straight away — the ₹1 comes back.
              </p>
            </div>
          </div>
        </Card>
      )}

      {draft === null ? (
        <Card>
          <SectionHead title="Add a way to get paid" />
          <div className="grid gap-2.5 sm:grid-cols-2">
            {[
              { k: "bank" as const, icon: "Landmark", tint: "--ux-tint-blue", ink: "--ux-blue",
                t: "Bank account", d: "Money in one working day. Works everywhere." },
              { k: "upi" as const, icon: "Smartphone", tint: "--ux-tint-violet", ink: "--ux-violet",
                t: "UPI ID", d: "Usually within minutes. Needs a smartphone." },
            ].map((o, i) => (
              <button
                key={o.k}
                onClick={() => setDraft(o.k)}
                className="ux-i ux-sq rounded-[13px] border p-4 text-start"
                style={{ borderColor: "var(--ux-line)", background: "var(--ux-surface)", ["--i" as string]: i }}
              >
                <IconTile icon={o.icon} tint={o.tint} ink={o.ink} size={40} radius={11} />
                <p className="mt-2.5 text-[13.5px] font-semibold" style={{ color: "var(--ux-ink)" }}>{o.t}</p>
                <p className="mt-1 text-[12px] leading-snug" style={{ color: "var(--ux-muted)" }}>{o.d}</p>
              </button>
            ))}
          </div>
        </Card>
      ) : (
        <Card>
          <SectionHead title={draft === "bank" ? "Add a bank account" : "Add a UPI ID"} />
          <div className="space-y-3.5">
            {draft === "bank" ? (
              <>
                <Field label="Account number">
                  <TextInput inputMode="numeric" placeholder="20 digits" value={form.account}
                             onChange={(e) => set("account", e.target.value.replace(/\D/g, ""))} />
                </Field>
                <Field label="Type it again"
                       hint="One wrong digit sends your money to a stranger. This is why we ask twice.">
                  <TextInput inputMode="numeric" value={form.confirm}
                             onChange={(e) => set("confirm", e.target.value.replace(/\D/g, ""))} />
                </Field>
                {/* Said here, while she can still fix it — not after she has
                    pressed save and the money has gone somewhere else. */}
                {form.confirm && form.confirm !== form.account && (
                  <p className="text-[12.5px]" style={{ color: "var(--ux-orange-ink)" }}>
                    These two do not match yet.
                  </p>
                )}
                <Field label="IFSC code" hint="On the first page of your passbook, and on your cheque book.">
                  <TextInput placeholder="HDFC0001234" value={form.ifsc}
                             onChange={(e) => set("ifsc", e.target.value.toUpperCase().slice(0, 11))} />
                </Field>
                <Field label="Name on the account"
                       hint="Must match your bank exactly, or the transfer bounces.">
                  <TextInput placeholder="Priya Sharma" value={form.holder}
                             onChange={(e) => set("holder", e.target.value)} />
                </Field>
              </>
            ) : (
              <Field label="UPI ID"
                     hint="Looks like yourname@bank. Find it in PhonePe, GPay or Paytm under your profile.">
                <TextInput placeholder="priya@okhdfcbank" value={form.upi}
                           onChange={(e) => set("upi", e.target.value.trim())} />
              </Field>
            )}
          </div>

          {problem && (
            <p className="ux-slide-up mt-3 text-[12.5px]" style={{ color: "var(--ux-orange-ink)" }}>
              {problem}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2.5">
            <Btn variant="primary" iconEnd="ArrowRight"
                 className={ready && !busy ? "" : "pointer-events-none opacity-50"}
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
            <Btn variant="ghost" onClick={() => { setDraft(null); setProblem(""); }}>Not now</Btn>
          </div>
        </Card>
      )}

      <Card>
        <SectionHead title="What we never do" icon="ShieldCheck" />
        <ul className="space-y-2.5">
          {[
            "We never ask for your PIN, your password or an OTP. Nobody from WomSakhi will.",
            "Buyers and employers never see your account number.",
            "We never take money out. Only you can start a withdrawal.",
          ].map((t) => (
            <li key={t} className="flex items-start gap-2.5 text-[12.5px] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              <Icons.Check className="mt-[2px] h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-green-ink)" }} strokeWidth={2.6} />
              {t}
            </li>
          ))}
        </ul>
      </Card>
    </SettingsPage>
  );
}
