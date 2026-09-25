"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * The page her people open.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * A woman raises an alert and her trusted contacts are two phone numbers.
 * Nothing in this product can reach a phone number: there is no SMS provider,
 * no WhatsApp and no voice line, and `contacts_notified` only ever counted how
 * many people she had named. Her cousin was never told anything.
 *
 * What CAN reach her cousin is her own phone. She forwards a link from
 * whichever app she already uses, and this is what opens at the other end.
 *
 * ── Every decision here follows from who reads it ───────────────────────────
 * Her sister, on a borrowed phone, with no account, in a hurry, possibly at
 * night. So:
 *
 *   · No sign-in, no app, no install. The link is the whole permission.
 *   · Her own words first, in the largest type on the page.
 *   · Two buttons, both real: "I've got it" tells her somebody is coming;
 *     "Call 112" dials, because sometimes the right answer is not this app.
 *   · It says who else has answered, so the fourth person to open it does not
 *     think nobody has, and the second does not assume somebody has.
 *   · Its own styles, inline. It must render on a stale cache, a blocked CDN
 *     or a 2G connection, so nothing here waits on the design system.
 *   · No address, no phone number, no documents. A link forwarded in a hurry
 *     can end up anywhere; this one carries only what somebody needs to help.
 */

interface Shared {
  name: string;
  note: string;
  raised_at: string;
  status: string;
  acknowledged_by: string[];
  acknowledged: boolean;
}

export default function SharedAlert({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const token = useSearchParams().get("t") ?? "";

  const [data, setData] = useState<Shared | null>(null);
  const [gone, setGone] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [who, setWho] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/v1/public/safety/alert/${id}?t=${encodeURIComponent(token)}`);
      if (!r.ok) { setGone(true); return; }
      setData(await r.json());
    } catch {
      setGone(true);
    }
  }, [id, token]);

  useEffect(() => { void load(); }, [load]);

  const ack = async () => {
    setSending(true);
    try {
      await fetch(`/api/v1/public/safety/alert/${id}/ack?t=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: who.trim() }),
      });
      setSent(true);
      void load();
    } finally {
      setSending(false);
    }
  };

  const when = data?.raised_at
    ? new Date(data.raised_at).toLocaleString(undefined, {
        day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
      })
    : "";

  return (
    <main style={S.page}>
      <div style={S.card}>
        {gone ? (
          <>
            <h1 style={S.h1}>This link does not work</h1>
            <p style={S.p}>
              It may have been mistyped, or it may be very old. If you are worried about
              someone, call 112.
            </p>
            <a href="tel:112" style={S.call}>Call 112</a>
          </>
        ) : !data ? (
          <p style={S.p}>Opening…</p>
        ) : (
          <>
            <p style={S.eyebrow}>Someone asked for help</p>
            <h1 style={S.h1}>
              {data.name ? `${data.name} raised an alert` : "An alert was raised"}
            </h1>
            {when && <p style={S.when}>{when}</p>}

            {/* Her own words, largest on the page. */}
            {data.note && <blockquote style={S.note}>{data.note}</blockquote>}

            {sent || data.acknowledged ? (
              <div style={S.done}>
                <p style={{ ...S.p, margin: 0, fontWeight: 600 }}>
                  {sent ? "She has been told you are coming." : "Someone has already answered."}
                </p>
                {data.acknowledged_by.length > 0 && (
                  <p style={{ ...S.p, margin: "6px 0 0", fontSize: 14 }}>
                    {data.acknowledged_by.join(", ")}
                  </p>
                )}
              </div>
            ) : (
              <>
                <label style={S.label}>
                  Your name, so she knows who is coming
                  <input
                    value={who}
                    onChange={(e) => setWho(e.target.value.slice(0, 60))}
                    placeholder="e.g. Meera"
                    style={S.input}
                  />
                </label>
                <button onClick={() => void ack()} disabled={sending} style={S.primary}>
                  {sending ? "Sending…" : "I've got it"}
                </button>
              </>
            )}

            {/* Always offered, answered or not: this app is not always the
                right answer, and it should never be in the way of the one
                that is. */}
            <a href="tel:112" style={S.call}>Call 112</a>
            <p style={S.foot}>
              Sent from WomSakhi. You do not need an account to answer this.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

/** Inline, so this renders with no stylesheet, no fonts and no design system. */
const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh", margin: 0, display: "grid", placeItems: "center", padding: 20,
    background: "#fdf7f9", color: "#1d1220",
    font: '400 16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',
  },
  card: { width: "100%", maxWidth: 420 },
  eyebrow: { margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: ".08em",
             textTransform: "uppercase", color: "#a4306e" },
  h1: { margin: "8px 0 0", fontSize: 26, lineHeight: 1.2, fontWeight: 700 },
  when: { margin: "6px 0 0", fontSize: 14, color: "#6d5c68" },
  note: {
    margin: "18px 0 0", padding: "14px 16px", borderRadius: 14,
    background: "#fff", border: "1px solid #f0dbe5",
    fontSize: 19, lineHeight: 1.45, fontWeight: 600,
  },
  label: { display: "block", margin: "22px 0 0", fontSize: 14, color: "#6d5c68" },
  input: {
    display: "block", width: "100%", marginTop: 8, padding: "13px 14px",
    minHeight: 48, borderRadius: 12, border: "1px solid #e6d3dd",
    font: "inherit", color: "#1d1220", background: "#fff", boxSizing: "border-box",
  },
  primary: {
    display: "block", width: "100%", marginTop: 14, padding: "15px 20px", minHeight: 52,
    border: 0, borderRadius: 14, background: "#a4306e", color: "#fff",
    font: "inherit", fontSize: 17, fontWeight: 700, cursor: "pointer",
  },
  call: {
    display: "block", marginTop: 12, padding: "15px 20px", minHeight: 52,
    borderRadius: 14, border: "1.5px solid #a4306e", background: "transparent",
    color: "#a4306e", fontSize: 17, fontWeight: 700, textAlign: "center",
    textDecoration: "none", boxSizing: "border-box",
  },
  done: {
    marginTop: 20, padding: "14px 16px", borderRadius: 14,
    background: "#e9f7ef", border: "1px solid #c6ead6",
  },
  p: { margin: "12px 0 0", color: "#4a3c46" },
  foot: { margin: "20px 0 0", fontSize: 13, color: "#8a7783", textAlign: "center" },
};
