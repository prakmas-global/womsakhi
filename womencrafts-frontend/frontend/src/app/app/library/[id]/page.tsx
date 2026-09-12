"use client";

import { use, useCallback, useRef, useState } from "react";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import { apiAgree, apiAskSwap, apiExchange, apiSayInExchange } from "@/lib/shop-api";
import { useAction } from "@/lib/use-action";
import { useResource } from "@/lib/use-resource";

import {Back, Btn, Card, EmptyState, IconTile, NoteBtn, RailSkeleton, ScreenSkeleton, SectionHead,
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { Tag } from "@/components/ux/learning/native";
import { useMyExchanges, useSwaps } from "@/components/ux/business";
import { useT } from "@/i18n";

/** How many sessions each — her choice, within what the server accepts (1–52). */
const SESSION_CHOICES = [1, 2, 3, 4, 6, 8];

/**
 * One exchange, in conversation.
 *
 * The agreement sits pinned above the messages — who teaches what, and how many
 * sessions each. An exchange that lives only in a chat thread is one where two
 * women remember it differently in a month, and neither of them is lying.
 *
 * **Every part of this screen used to be invented.** The conversation was a
 * three-message fixture called `OPENING` — the same "I saw you teach blouse
 * finishing" under every offer in the app, shown as though the woman named at
 * the top had written it. Sending pushed onto that array and nothing left the
 * browser. "Agree to this" set a boolean. And "Two sessions each" was printed
 * as fact beside it, an agreement nobody had made. All four now come from
 * `/exchange/threads/{id}`, and the buttons write to it.
 */
export default function ExchangeThread({ params }: { params: Promise<{ id: string }> }) {
  const tr = useT();
  const { id } = use(params);
  const { data: SWAPS, source } = useSwaps();
  const { data: MY_SWAPS, refetch: refetchMine } = useMyExchanges();
  const swap = SWAPS.find((s) => s.id === id);

  /**
   * The thread for THIS swap, or none at all.
   *
   * This used to end `?? MY_SWAPS[0]`, which put one woman's agreement on
   * another woman's screen the moment she opened an offer she had not asked
   * about yet. There is no such thing as a nearest exchange: either she has
   * asked about this one or she has not.
   */
  const thread = MY_SWAPS.find((m) => m.swapId === id);
  const threadId = thread?.id ?? "";

  const { data: convo, refetch: refetchConvo } = useResource(
    useCallback(
      async (sig: AbortSignal) => (threadId ? await apiExchange(threadId, sig) : null),
      [threadId],
    ),
    null,
  );

  const [draft, setDraft] = useState("");
  const [sessions, setSessions] = useState(2);
  const inputRef = useRef<HTMLInputElement>(null);

  const msgs = convo?.messages ?? [];
  const agreement = convo?.agreement ?? null;
  const agreed = convo?.agreed ?? false;

  /**
   * The two sides, named from HER point of view.
   *
   * The server names a live thread that way already, so its words win. Before
   * a thread exists the swap says it just as plainly: this woman is offering
   * `skill` and asked for `wants` in return, so those are the two halves.
   * Trimmed to what the endpoint accepts rather than sent long and refused.
   */
  const iTeach = (agreement?.i_teach || thread?.youTeach || swap?.wants || "").slice(0, 120);
  const sheTeaches = (agreement?.she_teaches || thread?.youLearn || swap?.skill || "").slice(0, 120);

  const say = useAction(
    async (text: string) => {
      // The first message IS the ask — it is what creates the thread. After
      // that the same box goes to the thread it created.
      if (threadId) await apiSayInExchange(threadId, text);
      else await apiAskSwap(id, text);
    },
    {
      onDone: () => { setDraft(""); refetchConvo(); refetchMine(); inputRef.current?.focus(); },
      fallbackError: "That did not send. Your words are still in the box — try again in a moment.",
    },
  );

  const settle = useAction(
    async () => {
      await apiAgree(threadId, {
        i_teach: iTeach,
        she_teaches: sheTeaches,
        sessions_each: sessions,
      });
    },
    {
      onDone: refetchConvo,
      fallbackError: "That did not go through. Nothing has been agreed — try again in a moment.",
    },
  );

  if (!swap && source === "loading") {
    return (
      <HomeShell skeleton="detail" rail={<RailSkeleton />}>
        <ScreenSkeleton shape="detail" />
      </HomeShell>
    );
  }

  if (!swap) {
    return (
      <HomeShell>
        <Card>
          <EmptyState
            icon="SearchX"
            title={tr("library.thatExchangeIsNotHere")}
            body="She may have taken the offer down."
            action={<Btn href="/app/library" variant="primary" iconEnd="ArrowRight">{tr("library.skillExchange")}</Btn>}
          />
        </Card>
      </HomeShell>
    );
  }

  const send = () => {
    const text = draft.trim();
    if (!text || say.busy) return;
    void say.run(text);
  };

  return (
    <HomeShell
      rail={
        <div className="space-y-[16px]">
          <Card>
            <SectionHead title={tr("library.herOffer")} />
            <div className="flex items-start gap-3">
              <IconTile icon={swap.icon} tint={swap.tint} ink={swap.ink} size={44} radius={12} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{swap.skill}</p>
                <p className="mt-1 text-xs leading-snug" style={{ color: "var(--ux-muted)" }}>{swap.detail}</p>
              </div>
            </div>
            <p className="mt-3.5 rounded-[12px] p-3 text-xs leading-relaxed"
               style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>
              <span style={{ color: "var(--ux-muted)" }}>{tr("library.sheWouldLikeInReturn")}</span>
              <strong style={{ color: "var(--ux-ink)" }}>{swap.wants}</strong>
            </p>
            <p className="mt-3 flex flex-wrap items-center gap-x-3 text-xs" style={{ color: "var(--ux-muted)" }}>
              <span className="inline-flex items-center gap-1"><Icons.MapPin className="h-3.5 w-3.5" /> {swap.place}</span>
              <span className="inline-flex items-center gap-1">
                {swap.online ? <Icons.Video className="h-3.5 w-3.5" /> : <Icons.Users className="h-3.5 w-3.5" />}
                {swap.online ? tr("library.canDoItOnline")
              : tr("library.inPerson")}
              </span>
            </p>
          </Card>

          <Card>
            <SectionHead title={tr("library.keepingItFair")} icon="Info" />
            <ul className="space-y-2.5">
              {[
                "No money changes hands, in either direction.",
                "Agree the number of sessions before the first one.",
                "If one of you cannot continue, say so — nobody owes anything.",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-xsm leading-snug" style={{ color: "var(--ux-ink-2)" }}>
                  <Icons.Check className="mt-[2px] h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-green-ink)" }} strokeWidth={2.6} />
                  {t}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      }
    >
      <Back to="/app/library" label={tr("library.teachAndLearn")} className="mb-4" />

      {/* Pinned above the messages, always. An exchange that lives only in a
          thread is one two women remember differently in a month. */}
      <Card className="mb-[16px]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("library.whatYouHaveAgreed")}<Tag tone={agreed ? "green" : "blue"} size="sm">
                {agreed ? "Agreed" : threadId ? tr("library.stillTalking")
              : tr("library.notStarted")}
              </Tag>
            </h2>
            <p className="mt-1 text-xs" style={{ color: "var(--ux-muted)" }}>
              {agreed
                ? "Both of you see this. It is what you settled on."
                : threadId
                  ? "Both of you see this. Either of you can change it before it is agreed."
                  : `Nothing is agreed until one of you writes. Send ${swap.who.split(" ")[0]} a message below.`}
            </p>
          </div>
          {!agreed && threadId && (
            <Btn variant="primary" size="sm"
                 icon={settle.busy ? "Loader" : "Check"}
                 disabled={settle.busy}
                 onClick={() => void settle.run()}>
              {settle.busy ? "Saving…" : "Agree to this"}
            </Btn>
          )}
        </div>

        <div className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {[["You teach", iTeach, "--ux-tint-violet", "--ux-violet", "GraduationCap"],
            ["You learn", sheTeaches, "--ux-tint-green", "--ux-green", "BookOpen"]].map(([k, v, tint, ink, icon]) => (
            <div key={k} className="ux-sq flex items-center gap-2.5 rounded-[12px] p-3" style={{ background: "var(--ux-surface-2)" }}>
              <IconTile icon={icon} tint={tint} ink={ink} size={34} radius={9} />
              <span className="min-w-0">
                <span className="block text-[13px] uppercase tracking-[0.06em] lg:text-2xs" style={{ color: "var(--ux-faint)" }}>{k}</span>
                <span className="mt-0.5 block truncate text-xsm font-medium" style={{ color: "var(--ux-ink)" }}>{v}</span>
              </span>
            </div>
          ))}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs" style={{ color: "var(--ux-muted)" }}>
          {/* How many sessions is hers to decide, not ours to print. This line
              read "Two sessions each" under every exchange in the app. */}
          {agreement ? (
            <span className="inline-flex items-center gap-1.5">
              <Icons.Repeat className="h-[14px] w-[14px]" />
              {agreement.sessions_each} {agreement.sessions_each === 1 ? "session" : "sessions"} each
            </span>
          ) : threadId ? (
            <label className="inline-flex items-center gap-2">
              <Icons.Repeat className="h-[14px] w-[14px]" />
              <span>{tr("library.sessionsEach")}</span>
              <select
                value={sessions}
                onChange={(ev) => setSessions(Number(ev.target.value))}
                aria-label={tr("library.howManySessionsEach")}
                className="ux-sq h-[30px] rounded-[8px] border px-2 text-xs"
                style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" }}
              >
                {SESSION_CHOICES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          ) : null}
          <span className="inline-flex items-center gap-1.5"><Icons.IndianRupee className="h-[14px] w-[14px]" />{tr("library.noMoneyEitherWay")}</span>
          <span className="inline-flex items-center gap-1.5">
            {swap.online ? <Icons.Video className="h-[14px] w-[14px]" /> : <Icons.MapPin className="h-[14px] w-[14px]" />}
            {swap.online ? tr("library.videoCall")
              : tr("library.inPerson2")}
          </span>
        </div>

        {settle.error && (
          <p role="alert" className="ux-slide-up mt-3 text-xsm leading-relaxed"
             style={{ color: "var(--ux-orange-ink)" }}>
            {settle.error}
          </p>
        )}

        {agreed && (
          <div className="ux-slide-up mt-3.5 flex items-center gap-3 rounded-[12px] p-3.5" style={{ background: "var(--ux-tint-green)" }}>
            <Icons.CheckCheck className="h-[18px] w-[18px] shrink-0" style={{ color: "var(--ux-green-ink)" }} />
            <p className="min-w-0 flex-1 text-xsm" style={{ color: "var(--ux-ink-2)" }}>{tr("library.agreedPickATimeForThe")}</p>
            <NoteBtn label={tr("library.pickATime")} icon="CalendarPlus"
                     title={tr("library.suggestATime")} to={swap.who}
                     placeholder={tr("library.whichDayAndHourSuitsYou")}
                     sent={tr("library.sentSheWillConfirmOne")}
                     sentBody="It is in the conversation below. No money changes hands, in either direction."
                     sentLink={null}
                     send={async ({ text }) => { await apiSayInExchange(threadId, text); refetchConvo(); }} />
          </div>
        )}
      </Card>

      <Card pad={0} className="flex flex-col overflow-hidden" style={{ minHeight: 420 }}>
        <div className="flex items-center gap-3 border-b px-[20px] py-3.5" style={{ borderColor: "var(--ux-line)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img loading="lazy" decoding="async" src={swap.avatar} alt="" className="h-[40px] w-[40px] shrink-0 rounded-full object-cover"
               style={{ background: "var(--ux-brand-tint)" }} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{swap.who}</p>
            {/* "usually replies same day" used to sit here. Nothing measures
                how fast anybody replies, and a woman who waits three days on
                that sentence decides the app lied to her. */}
            <p className="mt-0.5 truncate text-xs" style={{ color: "var(--ux-muted)" }}>{swap.place}</p>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-[20px]">
          {msgs.length ? msgs.map((m, i) => (
            <div key={`${m.at}-${i}`} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
              <div className="ux-sq ux-rise max-w-[76%] rounded-[12px] px-3.5 py-2.5"
                   style={{ background: m.mine ? "var(--ux-fill)" : "var(--ux-surface-2)", color: m.mine ? "var(--ux-on-brand)" : "var(--ux-ink)" }}>
                <p className="text-xsm leading-relaxed">{m.text}</p>
                <p className="mt-1 text-[13px] lg:text-2xs" style={{ color: m.mine ? "rgba(255,255,255,0.75)" : "var(--ux-faint)" }}>{m.at}</p>
              </div>
            </div>
          )) : (
            <p className="px-1 py-6 text-center text-xsm leading-relaxed" style={{ color: "var(--ux-muted)" }}>
              Nothing said yet. Tell {swap.who.split(" ")[0]} what you would like to learn,
              and what you can teach her in return.
            </p>
          )}
        </div>

        {say.error && (
          <p role="alert" className="ux-slide-up px-[20px] pb-1 text-xsm leading-relaxed"
             style={{ color: "var(--ux-orange-ink)" }}>
            {say.error}
          </p>
        )}

        <div className="flex items-center gap-2.5 border-t p-3.5" style={{ borderColor: "var(--ux-line)" }}>
          <input
            ref={inputRef}
            value={draft}
            onChange={(ev) => setDraft(ev.target.value)}
            onKeyDown={(ev) => { if (ev.key === "Enter") { ev.preventDefault(); send(); } }}
            placeholder={msgs.length ? `Reply to ${swap.who.split(" ")[0]}…` : `Write to ${swap.who.split(" ")[0]}…`}
            aria-label={tr("library.writeAReply")}
            className="ux-sq h-[44px] min-w-0 flex-1 rounded-[12px] border px-4 text-xsm outline-none"
            style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" }}
          />
          <button
            onClick={send}
            disabled={!draft.trim() || say.busy}
            aria-label="Send"
            className="ux-press ux-hov ux-clay grid h-[44px] w-[44px] shrink-0 place-items-center rounded-[12px]"
            style={{ background: draft.trim() && !say.busy ? "var(--ux-fill)" : "var(--ux-track)" }}
          >
            {say.busy
              ? <Icons.Loader className="ux-ico h-[18px] w-[18px]" style={{ color: "var(--ux-faint)" }} strokeWidth={1.9} />
              : <Icons.Send className="ux-ico h-[18px] w-[18px]"
                            style={{ color: draft.trim() ? "var(--ux-on-brand)" : "var(--ux-faint)" }} strokeWidth={1.9} />}
          </button>
        </div>
      </Card>
    </HomeShell>
  );
}
