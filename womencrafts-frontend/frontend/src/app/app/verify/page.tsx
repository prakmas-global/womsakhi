"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, Bell, BookOpen, Camera, Check, Clock, FileText, IdCard, Image as ImageIcon, Loader, RotateCcw, Trash2, UserRound, X,
} from "lucide-react";

import {
  ACCEPTED_DOCUMENT_TYPES,
  apiDeleteMyDocument,
  apiMyDocumentObjectUrl,
  apiMyVerification,
  apiRequestMyVerificationReview,
  apiUploadDocument,
  validateDocument,
  type ApiDocument,
  type VerificationStatus,
} from "@/lib/verification-api";
import { apiGetMe, invalidateReads } from "@/lib/api";
import { authError } from "@/lib/auth-api";
import { useAuth } from "@/context/AuthContext";
import { AuthShell } from "@/components/auth-shell";
import { BackLink, CAMERA_PHOTO, SignOutLink, useBackStep } from "@/components/auth-cards";
import { useI18n } from "@/i18n";

/**
 * Verify — her application, from first photo to "you're in" (approved screens
 * C1–C6, Version 11).
 *
 * Written for a woman on her first smartphone: one thing to do per screen, big
 * buttons, a picture beside the instruction, and never the bare word
 * "pending". Every state says what is happening, who is doing it and when.
 *
 * The server is the only source of truth for where she is (`/verification/status`).
 * The backend moves her to `in_review` on its own the moment both photos are in,
 * so there is no "Submit" button here — adding the second photo IS submitting.
 *
 *   C1 pending_documents   selfie + ID cards
 *   C2 in_review           expected time, progress, "Request activation" locked
 *   C3 in_review, late     "Request activation" unlocked → "Sent. We've reminded the team."
 *   C4 needs_info          the reviewer's note, retake only what she asked for
 *   C5 rejected            the reason, the reapply date, "Start again" once allowed
 *   C6 approved            the lotus, the tour, home
 */

type Slot = "selfie" | "id";

/** The four the approved screen shows; "Other" opens the rest. */
const ID_MAIN = [
  { value: "aadhaar", label: "Aadhaar (masked)" },
  { value: "voter_id", label: "Voter ID" },
  { value: "pan", label: "PAN" },
] as const;
const ID_MORE = [
  { value: "driving_licence", label: "Driving licence" },
  { value: "passport", label: "Passport" },
  { value: "other", label: "Other ID" },
] as const;
const MORE_VALUES: readonly string[] = ID_MORE.map((t) => t.value);

const SUPPORT_EMAIL = "hello@womsakhi.com";
const POLL_MS = 30_000;

const CAPTION = {
  title: "Your application",
  text: "Every account is checked by a real person, usually within a day. You can learn while you wait.",
};

// ── time, in her words ───────────────────────────────────────────────────────

function intlLocale(locale: string) {
  return `${locale || "en"}-IN`;
}

/**
 * The API writes some times without a zone ("2026-09-30T10:37:00"). They are
 * UTC, but `new Date` reads a zoneless string as LOCAL time — 5h30m off in
 * India. So a missing zone is read as UTC.
 */
function parseIso(iso: string): Date {
  if (!iso) return new Date(NaN);
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
}

/** "today, 6:30 pm" · "tomorrow, 6:30 pm" · "Thu 1 Oct, 6:30 pm" — in her language. */
function whenLabel(iso: string, locale: string, now: number): string {
  const at = parseIso(iso);
  if (!iso || Number.isNaN(at.getTime())) return "";
  const loc = intlLocale(locale);
  const time = at.toLocaleTimeString(loc, { hour: "numeric", minute: "2-digit", hour12: true });
  const startOf = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const days = Math.round((startOf(at.getTime()) - startOf(now)) / 86_400_000);
  if (days === 0 || days === 1) {
    const word = new Intl.RelativeTimeFormat(loc, { numeric: "auto" }).format(days, "day");
    return `${word}, ${time}`;
  }
  const date = at.toLocaleDateString(loc, { weekday: "short", day: "numeric", month: "short" });
  return `${date}, ${time}`;
}

function dateLabel(iso: string, locale: string): string {
  const at = parseIso(iso);
  if (!iso || Number.isNaN(at.getTime())) return "";
  return at.toLocaleDateString(intlLocale(locale), { weekday: "long", day: "numeric", month: "long" });
}

const capital = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** A clock that ticks every 30s, so "Request activation" unlocks without a reload. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

// ── the screen ───────────────────────────────────────────────────────────────

export default function VerifyPage() {
  const { user, signOut, updateUser } = useAuth();
  const { locale } = useI18n();
  const router = useRouter();
  const now = useNow();

  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [loadError, setLoadError] = useState("");
  const [restarting, setRestarting] = useState(false);
  const [justSent, setJustSent] = useState(false);
  /** Approved while she was on this screen — the lotus, not a silent jump. */
  const [welcomed, setWelcomed] = useState(false);

  /*
    Kept by hand rather than with `useResource`: that hook resets to its
    fallback on any error, so one dropped poll on a patchy connection would
    blank the screen. Here a failed refresh keeps what she was looking at.
  */
  const load = useCallback(async () => {
    // A refresh must reach the server: the shared client holds GETs for 10s,
    // and uploads go through a separate client that does not clear that hold.
    invalidateReads();
    try {
      const s = await apiMyVerification();
      setStatus(s);
      setLoadError("");
      return s;
    } catch (e) {
      setLoadError(authError(e, "We could not load your application. Check your internet and try again.").message);
      return null;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    apiMyVerification()
      .then((s) => { if (alive) setStatus(s); })
      .catch((e) => { if (alive) setLoadError(authError(e, "We could not load your application. Check your internet and try again.").message); });
    return () => { alive = false; };
  }, []);

  /** After an upload: re-read, and if that photo completed her application, say so. */
  const afterUpload = useCallback(async () => {
    const s = await load();
    if (s?.status === "in_review") setJustSent(true);
  }, [load]);

  // Poll while a person is reviewing her, and check again whenever she comes
  // back to the tab — so approval appears without her pressing anything.
  const state = status?.status;
  useEffect(() => {
    const refresh = () => { if (document.visibilityState !== "hidden") void load(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = state === "in_review" ? window.setInterval(refresh, POLL_MS) : undefined;
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      if (timer) window.clearInterval(timer);
    };
  }, [load, state]);

  /*
    Keep the signed-in user in step with the server. The member-area gate routes
    on `user.verification_status`; if she is approved (or re-applies) while this
    screen is open, the gate has to learn it too, or it bounces her straight
    back here.

    Approved: a member who is already through the tour goes straight home, as
    before. One who has just been let in sees C6 — the lotus and the two ways
    forward — rather than being moved without a word.
  */
  useEffect(() => {
    if (!state || !user) return;
    if (state === "active") {
      if (user.verification_status === "active" && welcomed) return;
      void apiGetMe()
        .then((fresh) => {
          updateUser(fresh);
          if (fresh.onboarding_complete) router.replace("/app");
          else setWelcomed(true);
        })
        .catch(() => router.replace("/app"));
      return;
    }
    if (user.verification_status !== state) updateUser({ ...user, verification_status: state, rejection_reason: status?.rejection_reason ?? "" });
  }, [state, user, updateUser, router, status?.rejection_reason, welcomed]);

  const exit = () => void signOut();

  // "Start again" after a refusal is a step of its own: back (on screen or the
  // phone's button) returns to the refusal, not out of the app.
  const backToStatus = useBackStep(restarting && state === "rejected", () => setRestarting(false), "step", "again");

  // ── C6 · approved ──
  if (state === "active" && welcomed) {
    const first = (user?.full_name || "").trim().split(/\s+/)[0];
    return (
      <AuthShell photo="approved" screen="c6" flow="member-verify">
        <div className="ac ac-lotus">
          <div className="ac-ok-hero">
            {/* eslint-disable-next-line @next/next/no-img-element -- an animated GIF; next/image would flatten it */}
            <img src="/womsakhi-lotus-airflow.gif" alt="" width={455} height={92} />
            <h1 className="ac-t">{first ? `You're in, ${first}!` : "You're in!"}</h1>
            <p className="ac-s">Your account is approved. Welcome to the community.</p>
          </div>
          <a className="ac-btn ac-go" href="/app/welcome">Take the 1-minute tour <ArrowRight aria-hidden /></a>
          <a className="ac-btn ac-line" href="/app">Go to my home</a>
        </div>
      </AuthShell>
    );
  }

  // ── loading, or it could not load ──
  if (!status || state === "active") {
    return (
      <AuthShell photo="upload" caption={CAPTION} screen="c1" flow="member-verify">
        <div className="ac">
          {loadError ? (
            <>
              <h1 className="ac-t">Could not load</h1>
              <p role="alert" className="ac-err">{loadError}</p>
              <button type="button" className="ac-btn ac-go" onClick={() => void load()}><RotateCcw aria-hidden /> Try again</button>
              <SignOutLink onClick={exit} />
            </>
          ) : (
            <div role="status" className="ac-wait">
              <Loader className="ac-spin" aria-hidden />
              <p>{state === "active" ? "You're in! Opening WomSakhi…" : "Loading…"}</p>
            </div>
          )}
        </div>
      </AuthShell>
    );
  }

  // ── suspended ──
  if (state === "suspended") {
    return (
      <AuthShell photo="review" caption={{ title: "We are here to help", text: "If something looks wrong, a real person will review it with care." }} screen="c5" flow="member-verify">
        <div className="ac">
          <h1 className="ac-t">Your account is paused</h1>
          <p className="ac-s">You cannot use WomSakhi right now. If you think this is a mistake, write to us and we will help.</p>
          <div className="ac-card ac-reason">
            <small>CONTACT SUPPORT</small>
            <b>{SUPPORT_EMAIL}</b>
          </div>
          <SignOutLink onClick={exit} />
        </div>
      </AuthShell>
    );
  }

  // ── C5 · rejected ──
  if (state === "rejected" && !restarting) {
    return (
      <AuthShell photo="review" caption={{ title: "A careful second look", text: "You can send clearer photos whenever you are ready. Your previous files stay private." }} screen="c5" flow="member-verify">
        <div className="ac">
          <h1 className="ac-t">We couldn&apos;t approve you this time</h1>
          <div className="ac-card ac-reason">
            <small>REASON</small>
            <b>{status.rejection_reason || "Your photos did not match the details we need."}</b>
          </div>
          {status.can_reapply ? (
            <>
              <p className="ac-s">You can apply again now. Take a new selfie and a new ID photo.</p>
              <button type="button" className="ac-btn ac-go" onClick={() => setRestarting(true)}><Camera aria-hidden /> Start again</button>
            </>
          ) : (
            <div className="ac-eta">
              <div className="ic"><Clock aria-hidden /></div>
              <div><small>You can apply again on</small><b>{capital(dateLabel(status.reapply_after, locale)) || "a later date"}</b></div>
            </div>
          )}
          <p className="ac-link">Questions? {SUPPORT_EMAIL}</p>
          <SignOutLink onClick={exit} />
        </div>
      </AuthShell>
    );
  }

  // ── C2 / C3 · in review ──
  if (state === "in_review") {
    return <InReview status={status} now={now} locale={locale} justSent={justSent} onChanged={load} onExit={exit} />;
  }

  // ── C1 / C4 · pending_email / pending_documents (fresh, or sent back), or a fresh start after a refusal ──
  const fixing = status.needs_info;
  return (
    <AuthShell photo="upload" caption={CAPTION} screen={fixing ? "c4" : "c1"} flow="member-verify">
      <div className="ac">
        {restarting && state === "rejected" && <BackLink onClick={backToStatus} />}
        <Uploader status={status} fixing={fixing} onChanged={afterUpload} />
        {/* The approved "Not now?" line, with the way out beside it rather than under it. */}
        {fixing ? (
          <p className="ac-link">While you wait: <a href="/app/learn">Learn</a> · <span className="ac-nw"><a href="/app/profile">My profile</a> · <button type="button" onClick={exit}>Sign out</button></span></p>
        ) : (
          <p className="ac-link">Not now? <a href="/app/learn">Learn something while you wait</a> <span className="ac-nw">· <button type="button" onClick={exit}>Sign out</button></span></p>
        )}
      </div>
    </AuthShell>
  );
}

// ── in review ────────────────────────────────────────────────────────────────

function InReview({ status, now, locale, justSent, onChanged, onExit }: {
  status: VerificationStatus; now: number; locale: string; justSent: boolean;
  onChanged: () => Promise<unknown>; onExit: () => void;
}) {
  const [asked, setAsked] = useState<{ next: string } | null>(null);
  const [problem, setProblem] = useState("");
  const [sending, setSending] = useState(false);
  const nextAt = asked?.next || status.next_review_request_at;
  const locked = Boolean(nextAt) && parseIso(nextAt).getTime() > now;
  const expected = whenLabel(status.expected_by, locale, now);
  const late = Boolean(status.expected_by) && parseIso(status.expected_by).getTime() < now;

  async function requestActivation() {
    setProblem("");
    setSending(true);
    try {
      const r = await apiRequestMyVerificationReview();
      setAsked({ next: r.next_request_at });
      void onChanged();
    } catch (e) {
      // 429 = asked too recently; the refresh below brings the real unlock time.
      const err = authError(e, "Could not send just now. Try again in a moment.");
      setProblem(err.message);
      void onChanged();
    } finally {
      setSending(false);
    }
  }

  const nextWhen = nextAt ? whenLabel(nextAt, locale, now) : "";

  return (
    <AuthShell photo="review" caption={CAPTION} screen={late ? "c3" : "c2"} flow="member-verify">
      <div className="ac">
        {justSent && (
          <p role="status" className="ac-note ok"><Check aria-hidden /><span>Photos sent! You don&apos;t need to do anything else.</span></p>
        )}
        <h1 className="ac-t">{late ? "Taking a little longer" : "We're checking your details"}</h1>

        {late ? (
          <p className="ac-s">Sorry for the wait. You can remind the team once a day.</p>
        ) : (
          <>
            <div className="ac-eta">
              <div className="ic"><Clock aria-hidden /></div>
              <div><small>Answer expected</small><b>{expected ? `By ${expected}` : "Usually within a day"}</b></div>
            </div>
            <ol className="ac-steps" aria-label="Your progress">
              <li><i className="ok"><Check aria-hidden strokeWidth={3} /></i>Account created</li>
              <li><i className="ok"><Check aria-hidden strokeWidth={3} /></i>Photos sent</li>
              <li aria-current="step"><i className="now" />Our team checks</li>
            </ol>
          </>
        )}

        <button type="button" className={`ac-btn ac-fit ${locked ? "ac-line" : "ac-go"}`} disabled={locked || sending}
                onClick={requestActivation} title={locked && nextWhen ? `Available ${nextWhen}` : undefined}>
          {sending ? <Loader className="ac-spin" aria-hidden /> : <Bell aria-hidden />}
          {locked && !asked ? "Request activation · after 24 h" : "Request activation"}
        </button>
        {asked && (
          <p role="status" className="ac-note ok"><Check aria-hidden />
            <span>Sent. We&apos;ve reminded the team.{nextWhen && ` You can ask again ${nextWhen}.`}</span>
          </p>
        )}
        {problem && <p role="alert" className="ac-err">{problem}</p>}

        <nav className="ac-tiles" aria-label="While you wait">
          <a href="/app/learn"><BookOpen aria-hidden />Learn</a>
          <a href="/app/profile"><UserRound aria-hidden />My profile</a>
        </nav>
        <SignOutLink onClick={onExit} />
      </div>
    </AuthShell>
  );
}

// ── the two photos ───────────────────────────────────────────────────────────

function Uploader({ status, fixing, onChanged }: { status: VerificationStatus; fixing: boolean; onChanged: () => Promise<unknown> }) {
  const docs = status.documents ?? [];
  const pending = (slot: Slot) =>
    docs.find((d) => d.status === "pending" && (slot === "selfie" ? d.doc_type === "selfie" : d.doc_type !== "selfie" && d.doc_type !== "supporting"));
  const refused = (slot: Slot) =>
    docs.find((d) => d.status === "rejected" && (slot === "selfie" ? d.doc_type === "selfie" : d.doc_type !== "selfie"));
  const selfie = pending("selfie");
  const idDoc = pending("id");

  const [idType, setIdType] = useState<string>(idDoc?.doc_type ?? refused("id")?.doc_type ?? "aadhaar");
  const [moreTypes, setMoreTypes] = useState(() => MORE_VALUES.includes(idType));
  const [progress, setProgress] = useState<Partial<Record<Slot, number>>>({});
  const [problem, setProblem] = useState<Partial<Record<Slot, string>>>({});
  const [removing, setRemoving] = useState<string | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [camera, setCamera] = useState<Slot | null>(null);
  // The live camera is a step too: the phone's back button closes it.
  const closeCamera = useBackStep(camera !== null, () => setCamera(null), "step", "camera");

  /*
    `capture` opens the phone's own camera; it is ignored on a laptop, where it
    silently falls back to a file dialog. So on a laptop with a webcam we open a
    live camera ourselves (below), and on a laptop without one we only offer a file.
  */
  const handheld = useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(pointer: coarse)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(pointer: coarse)").matches,
    () => false,
  );
  const webcam = useSyncExternalStore(() => () => {}, () => Boolean(navigator.mediaDevices?.getUserMedia), () => false);

  const inputs = {
    selfieCamera: useRef<HTMLInputElement | null>(null),
    selfieFile: useRef<HTMLInputElement | null>(null),
    idCamera: useRef<HTMLInputElement | null>(null),
    idFile: useRef<HTMLInputElement | null>(null),
  };

  // Her own photos, fetched with her session and shown as thumbnails.
  const thumbKey = [selfie, idDoc].filter(Boolean).map((d) => d!.id).join(",");
  useEffect(() => {
    const wanted = [selfie, idDoc].filter((d): d is ApiDocument => Boolean(d) && d!.content_type.startsWith("image/"));
    let alive = true;
    const made: string[] = [];
    void Promise.all(wanted.map(async (d) => {
      try { const url = await apiMyDocumentObjectUrl(d.id); made.push(url); return [d.id, url] as const; }
      catch { return null; }
    })).then((pairs) => {
      if (!alive) { made.forEach((u) => URL.revokeObjectURL(u)); return; }
      setThumbs(Object.fromEntries(pairs.filter((p): p is readonly [string, string] => p !== null)));
    });
    return () => { alive = false; made.forEach((u) => URL.revokeObjectURL(u)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thumbKey]);

  async function upload(slot: Slot, file: File) {
    const wrong = validateDocument(file);
    if (wrong) { setProblem((p) => ({ ...p, [slot]: wrong })); return; }
    setProblem((p) => ({ ...p, [slot]: "" }));
    setProgress((p) => ({ ...p, [slot]: 0 }));
    try {
      const docType = slot === "selfie" ? "selfie" : idType;
      // Same kind replaces itself on the server; a different kind of ID has to
      // clear the old one first or it counts against the two-file limit.
      if (slot === "id" && idDoc && idDoc.doc_type !== docType) await apiDeleteMyDocument(idDoc.id);
      await apiUploadDocument(file, docType, (pct) => setProgress((p) => ({ ...p, [slot]: pct })));
    } catch (e) {
      setProblem((p) => ({ ...p, [slot]: authError(e, "That did not go through. Please try again.").message }));
    } finally {
      await onChanged();
      setProgress((p) => ({ ...p, [slot]: undefined }));
    }
  }

  async function remove(d: ApiDocument, slot: Slot) {
    setRemoving(d.id);
    try { await apiDeleteMyDocument(d.id); }
    catch (e) { setProblem((p) => ({ ...p, [slot]: authError(e, "Could not remove it. Try again.").message })); }
    finally { await onChanged(); setRemoving(null); }
  }

  const take = (slot: Slot) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // so choosing the same file again still fires
    if (file) void upload(slot, file);
  };

  function openCamera(slot: Slot) {
    if (!handheld && webcam) { setCamera(slot); return; }
    (slot === "selfie" ? inputs.selfieCamera : inputs.idCamera).current?.click();
  }
  const canPhoto = handheld || webcam;
  const pick = (slot: Slot) => () => canPhoto ? openCamera(slot) : (slot === "selfie" ? inputs.selfieFile : inputs.idFile).current?.click();

  /*
    Sent back for more (C4): only the photo the team asked for, retaken
    straight away. A photo that is still in place is not asked for again.
  */
  const both = Boolean(selfie && idDoc);
  const showSelfieCard = !fixing || !selfie || both;
  const showIdCard = !fixing || !idDoc || both;
  const missing = (selfie ? 0 : 1) + (idDoc ? 0 : 1);
  const note = fixing ? status.rejection_reason : "";

  return (
    <>
      {fixing ? (
        <>
          <h1 className="ac-t">{missing === 1 ? "Please fix one photo" : "Please fix your photos"}</h1>
          {note && <p role="alert" className="ac-warn"><b>Our team says:</b> &ldquo;{note}&rdquo;</p>}
        </>
      ) : (
        <h1 className="ac-t ac-t-phone">Show us it&apos;s you</h1>
      )}

      {showSelfieCard && (
        <SlotCard
          n={1}
          title="Live selfie"
          hint={fixing ? "Take it again" : "Your face, in good light"}
          doc={selfie}
          refusedNote={!selfie && !fixing ? refused("selfie")?.review_note : undefined}
          thumb={selfie ? thumbs[selfie.id] : undefined}
          progress={progress.selfie}
          problem={problem.selfie}
          removing={removing === selfie?.id}
          picture={!fixing}
          primary="go"
          primaryIcon={fixing ? "camera" : undefined}
          primaryLabel={fixing ? "Retake selfie" : canPhoto ? "Take selfie" : "Choose a photo"}
          onPrimary={pick("selfie")}
          secondaryLabel={handheld ? "or choose from your gallery" : undefined}
          onSecondary={() => inputs.selfieFile.current?.click()}
          onRemove={selfie ? () => remove(selfie, "selfie") : undefined}
        />
      )}

      {showIdCard && (
        <SlotCard
          n={2}
          title="ID photo"
          hint={fixing ? "Take it again" : "All 4 corners, no glare"}
          doc={idDoc}
          refusedNote={!idDoc && !fixing ? refused("id")?.review_note : undefined}
          thumb={idDoc ? thumbs[idDoc.id] : undefined}
          progress={progress.id}
          problem={problem.id}
          removing={removing === idDoc?.id}
          primary={fixing ? "go" : "soft"}
          primaryIcon={fixing ? "camera" : "id"}
          primaryLabel={fixing ? "Retake ID photo" : canPhoto ? "Take ID photo" : "Choose a photo"}
          onPrimary={pick("id")}
          secondaryLabel={handheld ? "or upload a file" : undefined}
          onSecondary={() => inputs.idFile.current?.click()}
          onRemove={idDoc ? () => remove(idDoc, "id") : undefined}
        >
          {!idDoc && !fixing && (
            <>
              <div className="ac-chips" role="radiogroup" aria-label="Which ID">
                {ID_MAIN.map((t) => (
                  <button key={t.value} type="button" role="radio" aria-checked={idType === t.value}
                          onClick={() => { setIdType(t.value); setMoreTypes(false); }}>{t.label}</button>
                ))}
                <button type="button" role="radio" aria-checked={moreTypes}
                        onClick={() => { setMoreTypes(true); if (!MORE_VALUES.includes(idType)) setIdType("driving_licence"); }}>Other</button>
              </div>
              {moreTypes && (
                <div className="ac-chips" role="radiogroup" aria-label="Other ID">
                  {ID_MORE.map((t) => (
                    <button key={t.value} type="button" role="radio" aria-checked={idType === t.value}
                            onClick={() => setIdType(t.value)}>{t.label}</button>
                  ))}
                </div>
              )}
            </>
          )}
        </SlotCard>
      )}

      {/* The phone's own camera (capture) and its gallery / files (no capture). */}
      <input ref={inputs.selfieCamera} data-slot="selfie" type="file" accept="image/*" capture="user" hidden aria-label="Take a selfie" onChange={take("selfie")} />
      <input ref={inputs.selfieFile} data-slot="selfie-file" type="file" accept="image/*" hidden aria-label="Choose a selfie" onChange={take("selfie")} />
      <input ref={inputs.idCamera} data-slot="id" type="file" accept="image/*" capture="environment" hidden aria-label="Take a photo of your ID" onChange={take("id")} />
      <input ref={inputs.idFile} data-slot="id-file" type="file" accept={ACCEPTED_DOCUMENT_TYPES.join(",")} hidden aria-label="Choose a photo of your ID" onChange={take("id")} />

      {camera && (
        <LiveCamera
          facing={camera === "selfie" ? "user" : "environment"}
          title={camera === "selfie" ? "Take your selfie" : "Photograph your ID"}
          onClose={closeCamera}
          onFallback={() => { const s = camera; setCamera(null); (s === "selfie" ? inputs.selfieFile : inputs.idFile).current?.click(); }}
          onShot={(file) => { const s = camera; setCamera(null); void upload(s, file); }}
        />
      )}
    </>
  );
}

function SlotCard({
  n, title, hint, doc, refusedNote, thumb, progress, problem, removing, picture = false,
  primary, primaryIcon, primaryLabel, onPrimary, secondaryLabel, onSecondary, onRemove, children,
}: {
  n: number; title: string; hint: string;
  doc?: ApiDocument; refusedNote?: string; thumb?: string; progress?: number; problem?: string; removing: boolean;
  picture?: boolean; primary: "go" | "soft"; primaryIcon?: "camera" | "id";
  primaryLabel: string; onPrimary: () => void; secondaryLabel?: string; onSecondary: () => void;
  onRemove?: () => void; children?: React.ReactNode;
}) {
  const done = Boolean(doc);
  const sending = progress !== undefined;
  // A photo the browser cannot draw (HEIC on most desktops) falls back to an icon.
  const [brokenThumb, setBrokenThumb] = useState<string | null>(null);
  const Icon = primaryIcon === "camera" ? Camera : primaryIcon === "id" ? IdCard : null;
  return (
    <section className={`ac-card${done ? " done" : ""}`} aria-label={title}>
      <div className="ac-hd">
        <span className={`ac-num${done ? " ok" : ""}`} aria-hidden>{done ? <Check strokeWidth={3} /> : n}</span>
        <div><b>{title}</b><small>{done ? "Added" : hint}</small></div>
        {done && <span className="ac-pill">Done</span>}
      </div>

      {refusedNote && !done && <p className="ac-warn"><b>Take this one again:</b> {refusedNote}</p>}

      {done ? (
        <div className="ac-done">
          {thumb && brokenThumb !== thumb ? (
            // eslint-disable-next-line @next/next/no-img-element -- her own photo, a blob: URL
            <img src={thumb} alt={`Your ${title.toLowerCase()}`} onError={() => setBrokenThumb(thumb)} />
          ) : (
            <span className="ph" aria-hidden>{doc!.content_type === "application/pdf" ? <FileText /> : <ImageIcon />}</span>
          )}
          <div className="acts">
            <button type="button" className="ac-btn ac-line" disabled={sending || removing} onClick={onPrimary}><RotateCcw aria-hidden /> Retake</button>
            <button type="button" className="ac-btn ac-line" disabled={sending || removing} onClick={onRemove}>
              {removing ? <Loader className="ac-spin" aria-hidden /> : <Trash2 aria-hidden />} Remove
            </button>
          </div>
        </div>
      ) : (
        <>
          {children}
          {picture && (
            <div className="ac-pic">
              {/* eslint-disable-next-line @next/next/no-img-element -- a fixed crop of the "camera" photo (see auth-cards.css) */}
              <img src={CAMERA_PHOTO} alt="A woman taking a photo with her phone" width={700} height={886} decoding="async" />
            </div>
          )}
        </>
      )}

      {sending && (
        <div className="ac-prog-bar" role="status" aria-live="polite">
          <p><span>Sending…</span><span>{progress}%</span></p>
          <span className="track"><span className="fill" style={{ width: `${Math.max(progress ?? 0, 4)}%` }} /></span>
        </div>
      )}

      {!done && !sending && (
        <>
          <button type="button" className={`ac-btn sm ${primary === "go" ? "ac-go" : "ac-soft"}`} onClick={onPrimary}>
            {Icon && <Icon aria-hidden />} {primaryLabel}
          </button>
          {secondaryLabel && (
            <p className="ac-link"><button type="button" onClick={onSecondary}>{secondaryLabel}</button></p>
          )}
        </>
      )}

      {problem && <p role="alert" className="ac-err">{problem}</p>}
    </section>
  );
}

/** A laptop's webcam, for the case where `capture` would only open a file dialog. */
function LiveCamera({ facing, title, onClose, onFallback, onShot }: {
  facing: "user" | "environment"; title: string;
  onClose: () => void; onFallback: () => void; onShot: (file: File) => void;
}) {
  const video = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing } } })
      .then(async (s) => {
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        if (video.current) { video.current.srcObject = s; await video.current.play(); }
      })
      .catch(() => { if (!cancelled) setError("Camera is blocked. Allow the camera, or choose a file."); });
    return () => { cancelled = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [facing]);

  function shoot() {
    const v = video.current;
    if (!v || v.readyState < 2) { setError("The camera is still starting. Try again."); return; }
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) { setError("Could not take that photo. Choose a file instead."); return; }
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) { setError("Could not take that photo. Try again."); return; }
      onShot(new File([blob], `womsakhi-${facing === "user" ? "selfie" : "id"}-${Date.now()}.jpg`, { type: "image/jpeg" }));
    }, "image/jpeg", 0.9);
  }

  return (
    <div className="ac ac-cam" role="dialog" aria-modal="true" aria-label={title}>
      <div className="box">
        <div className="bar">
          <p>{title}</p>
          <button type="button" onClick={onClose} className="x" aria-label="Close camera"><X aria-hidden /></button>
        </div>
        <div className="view">
          <video ref={video} autoPlay playsInline muted style={facing === "user" ? { transform: "scaleX(-1)" } : undefined} />
          <div aria-hidden style={{
            position: "absolute", pointerEvents: "none", border: "2px solid rgba(255,255,255,.7)",
            ...(facing === "user" ? { inset: "14% 22%", borderRadius: "50%" } : { inset: 24, borderRadius: 20 }),
          }} />
        </div>
        <div className="foot">
          {error && <p role="alert" className="ac-err">{error}</p>}
          <div className="row">
            <button type="button" className="ac-btn ac-line" onClick={onFallback}>Choose file</button>
            <button type="button" className="ac-btn ac-go" disabled={!!error} onClick={shoot}><Camera aria-hidden /> Take photo</button>
          </div>
        </div>
      </div>
    </div>
  );
}
