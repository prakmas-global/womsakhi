"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, EmptyState, I, IconTile, Pill, SectionHead, Stat, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import { ASSIST_QUEUE, HELPED, assistEarned, noPhone, type AssistTask, type Helped } from "@/components/ux/together/data";

/**
 * You run this for them — the growth engine, made a real role.
 *
 * ── Why this is not a workaround ────────────────────────────────────────────
 * 810 million women in low- and middle-income countries do not use mobile
 * internet. The smartphone gap has been flat for years and the mobile money
 * gender gap is *widening* — 30% in 2021 to 36% in 2024. You cannot design your
 * way past that with a better signup screen. What works, consistently, in the
 * research on technology adoption in these communities, is a trusted person
 * doing it on someone's behalf.
 *
 * So she gets a login, a queue, and payment. One install becomes six users, and
 * the sixth woman is one who will never own a smartphone.
 *
 * ── The three things that keep it honest ────────────────────────────────────
 * **Consent is recorded, with a date.** Not a tick-box at signup — a specific
 * agreement from a specific woman, visible to both of them, revocable by her.
 * **Everything is logged.** She can see every action taken in her name.
 * **The helper is paid.** Unpaid "community volunteers" is exactly the model
 * that pays a million ASHA workers below minimum wage.
 */
export default function AssistPage() {
  const router = useRouter();
  const [queue, setQueue] = useState<AssistTask[]>(ASSIST_QUEUE);
  const [women] = useState<Helped[]>(HELPED);
  const [note, setNote] = useState<string | null>(null);

  const earned = useMemo(() => assistEarned(women), [women]);
  const shared = useMemo(() => noPhone(women), [women]);
  const pending = useMemo(() => queue.reduce((n, t) => n + t.paysMinor, 0), [queue]);

  const doTask = useCallback((id: string) => {
    const t = queue.find((x) => x.id === id);
    setQueue((q) => q.filter((x) => x.id !== id));
    setNote(`Done for ${t?.who}. ${formatRupees(t?.paysMinor ?? 0)} added to your wallet, and she can see exactly what you did.`);
  }, [queue]);

  return (
    <HomeShell active="/app/together">
      <div className="flex flex-col gap-5">
        <button type="button" onClick={() => router.push("/app/together")}
                className="ux-press inline-flex w-fit items-center gap-1.5 text-[0.8125rem] font-semibold"
                style={{ color: v("--ux-muted") }}>
          <I name="ArrowLeft" className="h-[15px] w-[15px]" /> Back to Together
        </button>

        <header>
          <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>
            You run this for them
          </p>
          <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>
            {women.length} women, through you
          </h1>
          <p className="mt-1.5 max-w-[56ch] text-[0.875rem] leading-relaxed" style={{ color: v("--ux-muted") }}>
            {shared} of them do not own the phone they use. You are how they are here — and this
            is work, so it is paid.
          </p>
        </header>

        <Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat value={formatRupees(earned)} label="You have earned doing this"
                  icon="Wallet" tint="--ux-tint-green" ink="--ux-green-ink" />
            <Stat value={formatRupees(pending)} label="Waiting to be done"
                  icon="Clock" tint="--ux-tint-amber" ink="--ux-amber-ink" />
            <Stat value={String(women.reduce((n, w) => n + w.doneCount, 0))} label="Things done for them"
                  icon="ListChecks" tint="--ux-tint-blue" ink="--ux-blue-ink" />
          </div>
        </Card>

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-[0.8125rem] font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}

        <div>
          <SectionHead title="Waiting on you" icon="ListChecks" chip={String(queue.length)} />
          {queue.length === 0 ? (
            <Card><EmptyState icon="CheckCircle2" title="Nothing waiting"
                              body="Everything is done. We will tell you when one of them needs something." /></Card>
          ) : (
            <div className="flex flex-col gap-2.5">
              {queue.map((t) => (
                <Card key={t.id} pad={16} style={t.urgent ? { borderColor: v("--ux-amber") } : undefined}>
                  <div className="flex flex-wrap items-center gap-3.5">
                    <IconTile icon={t.urgent ? "AlertTriangle" : "Circle"}
                              tint={t.urgent ? "--ux-tint-amber" : "--ux-surface-2"}
                              ink={t.urgent ? "--ux-amber-ink" : "--ux-muted"} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.875rem] font-bold" style={{ color: v("--ux-ink") }}>{t.who}</p>
                      <p className="mt-0.5 text-[0.8125rem]" style={{ color: v("--ux-muted") }}>{t.what}</p>
                    </div>
                    <p className="shrink-0 text-[0.8125rem] font-bold tabular-nums" style={{ color: v("--ux-green-ink") }}>
                      +{formatRupees(t.paysMinor)}
                    </p>
                    <Btn size="sm" onClick={() => doTask(t.id)}>Do it</Btn>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <SectionHead title="The women you help" sub="Each one agreed, and can stop any time"
                       icon="Users" chip={String(women.length)} />
          <div className="grid gap-3 sm:grid-cols-2">
            {women.map((w) => (
              <Card key={w.id} pad={16}>
                <div className="flex items-start gap-3.5">
                  <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full text-[1rem] font-bold"
                        style={{ background: v("--ux-brand-tint-2"), color: v("--ux-brand") }}>
                    {w.name.charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[0.875rem] font-bold" style={{ color: v("--ux-ink") }}>{w.name}</p>
                      {!w.ownsPhone && <Pill tone="orange" size="sm">Shares a phone</Pill>}
                    </div>
                    <p className="mt-0.5 text-[0.75rem]" style={{ color: v("--ux-muted") }}>
                      Since {w.since} · {w.because.toLowerCase()}
                    </p>
                  </div>
                </div>

                <div className="mt-3 rounded-[12px] px-3 py-2.5" style={{ background: v("--ux-surface-2") }}>
                  <p className="text-[0.75rem] font-semibold" style={{ color: v("--ux-ink-2") }}>
                    Last: {w.lastDid}
                  </p>
                  <p className="mt-1 text-[0.6875rem]" style={{ color: v("--ux-muted") }}>
                    {w.doneCount} things done · she agreed on {w.consentOn}
                  </p>
                </div>

                <div className="mt-3 flex gap-2">
                  <Btn size="sm" variant="outline" full
                       onClick={() => setNote(`${w.name} can see every single thing done in her name, on one screen.`)}>
                    What she can see
                  </Btn>
                  <Btn size="sm" variant="ghost" full
                       onClick={() => setNote(`${w.name} would be asked first, and it stops the moment she says so.`)}>
                    Stop helping
                  </Btn>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="ShieldCheck" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              You never see their vault, their pot balance or their private pockets — only the task
              in front of you. Everything you do is written down where they can read it.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}
