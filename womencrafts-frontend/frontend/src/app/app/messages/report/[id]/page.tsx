"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as Icons from "@/components/ux/icons";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { apiConversation, type ConvDetail } from "@/lib/me-messages-api";
import { apiFileReport } from "@/lib/safety-api";
import { Avatar } from "../../views";

/**
 * Report a person, from inside the conversation with her.
 *
 * The ⋮ menu and the About popover used to send her to the Safety centre's
 * general form, where she had to say again who it was about. This screen
 * already knows: the person is at the top, and the report carries the
 * conversation it came from.
 *
 * ── The reasons are hers, the categories are the queue's ───────────────────
 * The reasons below are worded the way a woman would describe what happened.
 * `SafetyReportModel.CATEGORIES` on the server is how the safety team sorts
 * the queue. Each reason maps onto one category, and the reason itself is
 * written into the details so nothing she chose is lost in the mapping.
 */

const REASONS = [
  { id: "harassment", label: "Harassment or bullying", category: "Harassment or abuse" },
  { id: "fake", label: "Fake or impersonating account", category: "Fake or impersonating account" },
  { id: "otp", label: "Asked for money, OTP or bank details", category: "Money or fraud" },
  { id: "offplatform", label: "Payment outside WomSakhi", category: "Money or fraud" },
  { id: "sexual", label: "Inappropriate or sexual content", category: "Inappropriate or sexual content" },
  { id: "threat", label: "Threats or safety concern", category: "Threats or safety concern" },
  { id: "other", label: "Something else", category: "Something else" },
] as const;

const MIN = 10;
const MAX = 1000;

export default function ReportPersonPage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id ?? "");
  const [conv, setConv] = useState<ConvDetail | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [hidden, setHidden] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [touched, setTouched] = useState(false);
  const detailsId = useId();
  const hintId = useId();
  const groupId = useId();

  useEffect(() => {
    if (!id) return;
    let alive = true;
    apiConversation(id)
      .then((c) => { if (alive) setConv(c); })
      .catch(() => { if (alive) setLoadError(true); });
    return () => { alive = false; };
  }, [id]);

  const len = details.trim().length;
  const detailsOk = len >= MIN && len <= MAX;
  const chosen = REASONS.find((r) => r.id === reason);
  const ready = Boolean(chosen) && detailsOk && !busy;
  const name = conv?.name ?? "this person";
  const first = name.split(" ")[0];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!chosen || !detailsOk || busy) return;
    setBusy(true);
    setError("");
    try {
      await apiFileReport({
        category: chosen.category,
        details: `Reason: ${chosen.label}\n\n${details.trim()}`,
        about: `${name} (conversation ${id})`,
        anonymous: hidden,
      });
      setDone(true);
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      setError(typeof detail === "string" && detail ? detail
        : "Your report did not reach us. Check your connection and try again — what you wrote is still here.");
    } finally { setBusy(false); }
  }

  return (
    <HomeShell active="/app/messages" bare>
      <div className="mx-auto w-full max-w-[640px] pb-10">
        <Link href="/app/messages" title="Back to messages"
              className="ux-row -ms-2 hidden min-h-[44px] items-center lg:inline-flex gap-1.5 rounded-full px-2 text-[15px] font-semibold lg:text-xsm"
              style={{ color: "var(--ux-ink-2)" }}>
          <Icons.ChevronLeft className="h-[18px] w-[18px] rtl:rotate-180" /> Messages
        </Link>

        <section className="ux-sq mt-2 rounded-[20px] p-4 lg:p-6"
                 style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line-strong)", boxShadow: "var(--ux-shadow-card)" }}>
          {/* Who this is about. */}
          <div className="flex items-center gap-3">
            {conv
              ? <Avatar src={conv.avatar} name={conv.name} kind={conv.kind} size={52} />
              : <span className="block h-[52px] w-[52px] shrink-0 rounded-full" style={{ background: "var(--ux-surface-2)" }} />}
            <div className="min-w-0">
              <p className="text-[12px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--ux-pink-ink)" }}>
                {done ? "Report sent" : "Report"}
              </p>
              <h1 className="ux-screen-title truncate text-xl font-bold tracking-[-0.02em] lg:text-2xl" style={{ color: "var(--ux-ink)" }}>
                {conv ? conv.name : loadError ? "This conversation" : "…"}
              </h1>
            </div>
          </div>

          {done ? (
            <div className="mt-6 text-center" role="status" data-report-done>
              <span className="mx-auto grid h-[56px] w-[56px] place-items-center rounded-full"
                    style={{ background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" }}>
                <Icons.Check className="h-[26px] w-[26px]" />
              </span>
              <h2 className="mt-3 text-lg font-bold" style={{ color: "var(--ux-ink)" }}>
                Thank you. Our safety team will review this within 24 hours
              </h2>
              <p className="mx-auto mt-1.5 max-w-[420px] text-xsm leading-relaxed" style={{ color: "var(--ux-muted)" }}>
                {hidden ? `${first} will not be told who reported her. ` : ""}
                You can follow it in the Safety centre. If you are in danger right now, call 112.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Link href="/app/messages"
                      className="ux-press inline-flex min-h-[46px] items-center gap-2 rounded-full px-5 text-[15px] font-bold lg:text-xsm"
                      style={{ background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))", color: "var(--ux-on-brand)" }}>
                  Back to messages
                </Link>
                <Link href="/app/safety"
                      className="ux-press inline-flex min-h-[46px] items-center gap-2 rounded-full px-5 text-[15px] font-bold lg:text-xsm"
                      style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink-2)" }}>
                  Safety centre
                </Link>
              </div>
            </div>
          ) : (
            <form className="mt-5" onSubmit={submit} noValidate>
              <fieldset aria-describedby={touched && !chosen ? `${groupId}-err` : undefined}>
                <legend className="text-sm font-bold" style={{ color: "var(--ux-ink)" }}>What happened?</legend>
                <div className="mt-2 grid gap-1.5">
                  {REASONS.map((r) => {
                    const on = reason === r.id;
                    return (
                      <label key={r.id}
                             className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-[12px] px-3 text-[15px] lg:text-xsm"
                             style={{ background: on ? "var(--ux-brand-tint)" : "var(--ux-surface)",
                                      border: `1px solid ${on ? "var(--ux-brand)" : "var(--ux-line-strong)"}`,
                                      color: "var(--ux-ink)" }}>
                        <input type="radio" name="reason" value={r.id} checked={on}
                               onChange={() => setReason(r.id)}
                               className="h-[18px] w-[18px] shrink-0 accent-[var(--ux-brand)]"
                               /* The 48px row is the target; the phone rule
                                  that grows every radio to 44px would draw a
                                  44px circle inside it. */
                               style={{ minHeight: 0, minWidth: 0 }} />
                        <span className="font-semibold">{r.label}</span>
                      </label>
                    );
                  })}
                </div>
                {touched && !chosen && (
                  <p id={`${groupId}-err`} className="mt-1.5 text-[13px]" style={{ color: "var(--ux-pink-ink)" }}>Choose what happened.</p>
                )}
              </fieldset>

              <div className="mt-5">
                <label htmlFor={detailsId} className="text-sm font-bold" style={{ color: "var(--ux-ink)" }}>
                  Tell us more
                </label>
                <textarea id={detailsId} value={details} rows={5} maxLength={MAX}
                          aria-describedby={hintId} aria-invalid={touched && !detailsOk}
                          onChange={(e) => setDetails(e.target.value)}
                          onBlur={() => { if (details) setTouched(true); }}
                          placeholder="What did she say or ask for? When did it happen?"
                          className="mt-2 block w-full resize-y rounded-[12px] px-3.5 py-3 text-[16px] leading-relaxed outline-none lg:text-sm"
                          style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink)",
                                   border: `1px solid ${touched && !detailsOk ? "var(--ux-pink-ink)" : "var(--ux-line-strong)"}` }} />
                <div id={hintId} className="mt-1.5 flex items-center justify-between gap-3 text-[13px]">
                  <span style={{ color: touched && !detailsOk ? "var(--ux-pink-ink)" : "var(--ux-muted)" }}>
                    {len < MIN ? `At least ${MIN} characters — ${MIN - len} more` : "Your words go only to the safety team."}
                  </span>
                  <span className="shrink-0 tabular-nums" data-report-count
                        style={{ color: len > MAX - 50 ? "var(--ux-amber-ink)" : "var(--ux-muted)" }}>
                    {details.length} / {MAX}
                  </span>
                </div>
              </div>

              <label className="mt-5 flex min-h-[52px] cursor-pointer items-center gap-3 rounded-[12px] px-3"
                     style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line)" }}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold lg:text-xsm" style={{ color: "var(--ux-ink)" }}>Keep my name hidden from her</span>
                  <span className="block text-[13px]" style={{ color: "var(--ux-muted)" }}>The safety team still sees it, so they can reach you.</span>
                </span>
                <input type="checkbox" role="switch" checked={hidden} onChange={(e) => setHidden(e.target.checked)}
                       aria-checked={hidden} className="peer sr-only" />
                <span aria-hidden className="relative h-[28px] w-[48px] shrink-0 rounded-full transition-colors peer-focus-visible:outline peer-focus-visible:outline-2"
                      style={{ background: hidden ? "var(--ux-brand)" : "var(--ux-line-strong)" }}>
                  <span className="absolute top-[3px] block h-[22px] w-[22px] rounded-full transition-[left]"
                        style={{ left: hidden ? 23 : 3, background: "var(--ux-surface)", boxShadow: "0 1px 2px rgb(0 0 0 / 0.2)" }} />
                </span>
              </label>

              {error && (
                <p role="alert" className="mt-4 flex items-start gap-2 text-[14px]" style={{ color: "var(--ux-pink-ink)" }}>
                  <Icons.TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                </p>
              )}

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Link href="/app/messages"
                      className="ux-press inline-flex min-h-[48px] items-center justify-center rounded-full px-5 text-[15px] font-bold lg:text-xsm"
                      style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink-2)" }}>
                  Cancel
                </Link>
                <button type="submit" disabled={!ready} aria-busy={busy} data-report-submit
                        className="ux-press inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-6 text-[15px] font-bold disabled:cursor-not-allowed disabled:opacity-50 lg:text-xsm"
                        style={{ background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))", color: "var(--ux-on-brand)" }}>
                  {busy ? <Icons.Loader2 className="h-4 w-4 animate-spin" /> : <Icons.Flag className="h-4 w-4" />}
                  {busy ? "Sending…" : "Send report"}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </HomeShell>
  );
}
