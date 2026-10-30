"use client";

import { PlaceMark } from "@/components/ux/nav/Place";
import { useCallback, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn, Card, EmptyState, I, SectionHead, ScreenSkeleton, v } from "@/components/ux/kit";
import { MediaCard, MediaGrid, Fact } from "@/components/ux/media/MediaCard";
import { artFor } from "@/components/ux/media/art";
import { toast } from "@/components/ux/mobile/Toast";
import { PhoneTitle } from "@/components/ux/PhoneParts";
import { useResource } from "@/lib/use-resource";
import { apiCover, apiMarkReference, type MyState, type Reference } from "@/lib/entitlements-api";

/**
 * Health cover — what she is entitled to, and where she stands with it.
 *
 * ── What was here ───────────────────────────────────────────────────────────
 * The menu promised "Health cover — what you are entitled to" and this page
 * was a rota for covering work days, built from fixture women ("Sunita can take
 * Friday", "you owe 6 hours in care") whose accept button sent nothing to
 * anyone. Nothing on it was hers or true.
 *
 * ── What it is now ──────────────────────────────────────────────────────────
 * The cover catalogue staff keep (`/cover` — reference topic "cover"): health
 * insurance first (Ayushman Bharat PM-JAY and any state scheme for her city),
 * then accident, life and pension cover worth having. Each card says what it
 * pays, what it costs, and the steps — and her status on it ("I have this",
 * "I applied", "Not for me") is saved on the server, so the page remembers
 * which ones she has already sorted.
 */

const STATUS: { state: MyState["state"]; label: string; tone: "green" | "blue" | "neutral" }[] = [
  { state: "active", label: "I have this", tone: "green" },
  { state: "applied", label: "I applied", tone: "blue" },
  { state: "declined", label: "Not for me", tone: "neutral" },
];

function kindOf(r: Reference) {
  return String(r.payload?.kind || "").toLowerCase();
}

function CoverCard({ r, onMark, busy }: { r: Reference; onMark: (r: Reference, s: MyState["state"]) => void; busy: boolean }) {
  const steps = Array.isArray(r.payload?.steps) ? (r.payload.steps as string[]) : [];
  const status = STATUS.find((s) => s.state === r.mine?.state);
  const kind = kindOf(r);
  const health = kind === "health";
  return (
    <MediaCard
      image={artFor([r.title, kind, r.body], health ? "health" : "scheme", null, r.id)} alt={r.title}
      topLeft={r.payload?.kind ? { text: String(r.payload.kind) } : null}
      topRight={status ? { text: status.label, tone: status.tone === "green" ? "green" : status.tone === "blue" ? "brand" : "dark" }
               : r.free === true ? { text: "Free", tone: "green" } : null}
      overlay={r.payload?.pays ? <><I name="ShieldCheck" className="h-[13px] w-[13px]" /> Pays {String(r.payload.pays)}</> : undefined}
      title={r.title}
      subtitle={r.who}
      highlight={health}
      meta={<>
        <Fact icon="IndianRupee">{r.free === true ? "Free" : r.cost_label || "See the cost"}</Fact>
        {r.payload?.renews ? <Fact icon="CalendarClock">Renews {String(r.payload.renews)}</Fact> : null}
      </>}
      footer={
        <div className="flex flex-wrap gap-2" role="group" aria-label={`Your status for ${r.title}`}>
          {STATUS.map((s) => {
            const on = r.mine?.state === s.state;
            return (
              <button key={s.state} type="button" aria-pressed={on} disabled={busy} onClick={() => onMark(r, s.state)}
                      className="ux-press ux-sq flex min-h-[36px] items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold"
                      style={{ borderColor: v(on ? "--ux-brand" : "--ux-line"), background: v(on ? "--ux-brand-tint" : "--ux-surface"),
                               color: v(on ? "--ux-brand" : "--ux-ink-2") }}>
                {on && <I name="Check" className="h-[12px] w-[12px]" />}{s.label}
              </button>
            );
          })}
        </div>
      }>
      {r.body && <p className="line-clamp-3 text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>{r.body}</p>}
      {steps.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-bold" style={{ color: v("--ux-brand") }}>How to get it ({steps.length} steps)</summary>
          <ol className="mt-2 space-y-1.5">
            {steps.map((st, i) => (
              <li key={st} className="flex items-start gap-2 text-xs leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full text-[10px] font-bold"
                      style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>{i + 1}</span>{st}
              </li>
            ))}
          </ol>
        </details>
      )}
    </MediaCard>
  );
}

export default function HealthCoverPage() {
  const cover = useResource(useCallback((s: AbortSignal) => apiCover(s), []), [] as Reference[]);
  const [marked, setMarked] = useState<Record<string, Reference>>({});
  const [busy, setBusy] = useState("");

  const rows = cover.data.map((r) => marked[r.id] ?? r);
  const health = rows.filter((r) => kindOf(r) === "health");
  const rest = rows.filter((r) => kindOf(r) !== "health");
  const have = rows.filter((r) => r.mine?.state === "active").length;

  const mark = async (r: Reference, state: MyState["state"]) => {
    setBusy(r.id);
    try {
      const next = await apiMarkReference(r.id, state);
      setMarked((m) => ({ ...m, [r.id]: next }));
      toast("Saved", { tone: "success" });
    } catch { toast("That did not save. Try again.", { tone: "error" }); }
    finally { setBusy(""); }
  };

  return (
    <HomeShell active="/app/health">
      <div className="flex flex-col gap-5">
        <div className="hidden lg:flex"><Back to="/app/health" label="Back to health" /></div>

        <PhoneTitle title="Health cover" sub="What you are entitled to"
                    note="A hospital stay should not cost you your savings. Most of these are free or cost a few rupees a year." />
        <header className="hidden lg:block">
          <p className="text-2xs font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>Health cover</p>
          <div className="mt-2 flex min-w-0 items-center gap-3">
            <PlaceMark size={44} />
            <h1 className="text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em] min-w-0" style={{ color: v("--ux-ink") }}>
              What you are entitled to
            </h1>
          </div>
          <p className="mt-1.5 max-w-[58ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
            A hospital stay should not cost you your savings. Most of these are free or cost a few rupees a year —
            mark the ones you have, and we will keep track with you.
          </p>
        </header>

        {cover.source === "loading" && !cover.data.length ? <ScreenSkeleton shape="list" /> : cover.source === "error" ? (
          <Card><EmptyState icon="WifiOff" title="This did not load" body="Check your connection and try again."
                            action={<Btn size="sm" onClick={cover.refetch}>Try again</Btn>} /></Card>
        ) : !rows.length ? (
          <Card><EmptyState icon="ShieldCheck" title="Nothing listed for your area yet"
                            body="Our team adds the cover available where you live. Meanwhile, ask at your bank or the nearest Common Service Centre."
                            action={<Btn size="sm" variant="outline" href="/app/haq">See schemes you can claim</Btn>} /></Card>
        ) : (
          <>
            <Card pad={16} style={{ background: v(have ? "--ux-tint-green" : "--ux-surface-2"), borderColor: "transparent" }}>
              <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: v(have ? "--ux-green-ink" : "--ux-ink-2") }}>
                <I name={have ? "ShieldCheck" : "Info"} className="h-[16px] w-[16px]" />
                {have ? `You have ${have} of ${rows.length} kinds of cover listed here.` : "Mark the ones you already have — it takes a tap each."}
              </p>
            </Card>

            {health.length > 0 && (
              <div>
                <SectionHead title="Health insurance" sub="Hospital treatment, paid for" icon="HeartPulse" />
                <MediaGrid cols={2}>
                  {health.map((r) => <CoverCard key={r.id} r={r} onMark={mark} busy={busy === r.id} />)}
                </MediaGrid>
              </div>
            )}
            {rest.length > 0 && (
              <div>
                <SectionHead title="Also worth having" sub="Accident, life and pension cover" icon="ShieldCheck" />
                <MediaGrid>
                  {rest.map((r) => <CoverCard key={r.id} r={r} onMark={mark} busy={busy === r.id} />)}
                </MediaGrid>
              </div>
            )}
          </>
        )}

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex flex-wrap items-center gap-3">
            <I name="Landmark" className="h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="min-w-0 flex-1 text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              Money schemes you may be owed — pensions, maternity benefit, scholarships — are in Haq.
            </p>
            <Btn size="sm" variant="outline" href="/app/haq" iconEnd="ArrowRight">Open Haq</Btn>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}
