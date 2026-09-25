"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";

import { ACCEPTED_DOCUMENT_TYPES, apiMyVerification, apiResendVerificationEmail, apiUploadDocument, validateDocument, type VerificationStatus } from "@/lib/verification-api";
import { useAuth } from "@/context/AuthContext";
import { useResource } from "@/lib/use-resource";
import { messageFrom, useAction } from "@/lib/use-action";
import * as Icons from "@/components/ux/icons";

import { Btn, Card, IconTile, Pill } from "@/components/ux/kit";
import { OnboardAside, OnboardFrame } from "@/components/ux/onboard/Frame";
import { useT } from "@/i18n";
import { ListGroup } from "@/components/ux/mobile/ListRow";
import { PhoneRow, phonePrimary, phoneSecondary } from "@/components/ux/PhoneParts";

type Stage = "email" | "documents" | "review" | "rejected";

const DOCS = [
  /*
    `docType` is the server's own kind, sent with the file.

    `facing` is which camera opens when she taps Take photo. The ID wants the
    back camera, which is the sharp one and the one she can aim at a card on a
    table; the picture of her holding it wants the front camera, because she
    has to be able to see that both her face and the card are in the frame.
  */
  { id: "d1", docType: "aadhaar", label: "A photo ID", note: "Aadhaar, voter card or driving licence — any one",
    icon: "IdCard", tint: "--ux-tint-violet", ink: "--ux-violet", facing: "environment", required: true },
  { id: "d2", docType: "other", label: "A photo of you", note: "Holding the same ID, so we know it is yours",
    icon: "Camera", tint: "--ux-tint-blue", ink: "--ux-blue", facing: "user", required: true },
];

/**
 * Verify — the gate, explained.
 *
 * WomSakhi is women-only and human-reviewed, which means a real wait. The worst
 * version of this screen is a spinner and the word "pending": she has handed
 * over an ID and has no idea what happens next or when. So every state says
 * what is happening, who is doing it, and roughly how long.
 */
export default function VerifyPage() {
  // Her own address, from the session. This line used to read
  // "We sent a link to priya.sharma@example.com" for every woman in the
  // product — the one screen where getting the address wrong means she
  // watches the wrong inbox and never gets in.
  const { signOut, user } = useAuth();
  const tr = useT();
  /**
   * Where she actually is, from the server.
   *
   * The stage was local state starting at "email", so every visit began by
   * asking a verified woman to confirm her email again, and the whole flow —
   * resending the link, adding photographs, sending for review — moved her
   * through four screens without one request leaving the browser.
   */
  const { data: status, refetch } = useResource(
    useCallback(() => apiMyVerification(), []),
    null as VerificationStatus | null,
  );
  const [advanced, setAdvanced] = useState<Stage | null>(null);
  const [problem, setProblem] = useState("");
  /*
    Two inputs, because they are two different questions to the phone.

    `camera` carries the `capture` attribute, which is what makes Android and
    iOS open the camera itself instead of a file browser. `files` deliberately
    does not: the same attribute on one shared input would take away the woman
    who photographed her ID last week, or scanned it, or has it in her
    downloads — and on a laptop `capture` is ignored anyway, so one input could
    not have honestly offered both.
  */
  const camera = useRef<HTMLInputElement | null>(null);
  const files = useRef<HTMLInputElement | null>(null);
  const pickingFor = useRef<string>("aadhaar");
  const [busy, setBusy] = useState<string | null>(null);
  /*
    Does this device have a camera the browser will open?

    `capture` is ignored on a desktop browser — it silently falls back to the
    file dialog — so a "Take photo" button there would open a file browser
    under a name that promises a camera. Below `lg` the button is always drawn
    (that branch only renders on a phone-width screen); at desktop widths it
    waits for this, which is what puts it on a tablet and keeps it off a
    laptop. It starts false so the server render and the first client render
    agree, and a real desktop never changes.
  */
  const handheld = useSyncExternalStore(
    // Subscribing means the layout also follows a device that changes pointer
    // mid-session — a tablet with a keyboard attached, say.
    (cb) => {
      const mq = window.matchMedia("(pointer: coarse)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(pointer: coarse)").matches,
    // The server has no pointer, so it renders the desktop layout and the
    // first client render agrees with it.
    () => false,
  );

  /** The server's word, unless she has stepped forward within this visit. */
  const stage: Stage = advanced ?? (
    status?.status === "pending_email" ? "email"
    : status?.status === "rejected" ? "rejected"
    : status?.status === "in_review" || status?.status === "active" ? "review"
    : "documents"
  );

  // Her documents, as the server holds them — not a list of ids she clicked.
  const sent = status?.documents ?? [];
  /*
    The server's kinds — "aadhaar", "other" — NOT the row ids above.

    This read `d.id` at both call sites, so `uploaded.includes(...)` compared
    "d1" against "aadhaar" and was false for every row: a woman who had already
    sent both photographs was still shown two empty rows saying "Add photo",
    with no Added tick and no way to tell the upload had worked.
  */
  const uploaded = sent.map((d) => d.doc_type);
  const allUploaded = sent.length >= DOCS.length;

  const [resent, setResent] = useState(false);
  const resend = useAction(
    async () => { await apiResendVerificationEmail(); },
    {
      // The tick goes back to "Send it again" after a few seconds, so a woman
      // who still has no email can ask a second time.
      onDone: () => { setResent(true); window.setTimeout(() => setResent(false), 6000); },
      fallbackError: "Could not send it again just now. Try in a moment.",
    },
  );

  /**
   * Open the camera, or the files, for one of the two documents.
   *
   * `facing` is written onto the node here rather than passed as a React prop
   * on purpose. The attribute has to be correct at the instant `.click()`
   * runs, and a `setState` would not have landed yet — the camera would open
   * on whichever side the previous row asked for. React never rendered a
   * `capture` prop on that input, so it has no value of its own to put back.
   */
  function choose(docType: string, how: "camera" | "files", facing = "environment") {
    setProblem("");
    pickingFor.current = docType;
    if (how === "files") { files.current?.click(); return; }
    camera.current?.setAttribute("capture", facing);
    camera.current?.click();
  }

  async function send(file: File) {
    const wrong = validateDocument(file);
    if (wrong) { setProblem(wrong); return; }
    setBusy(pickingFor.current);
    setProblem("");
    try {
      await apiUploadDocument(file, pickingFor.current);
      refetch();
    } catch (e) {
      setProblem(messageFrom(e, "That did not go through. Nothing has been sent — try again in a moment."));
    } finally {
      setBusy(null);
    }
  }
  const stepOf: Record<Stage, number> = { email: 1, documents: 2, review: 3, rejected: 2 };

  /*
    The way back, from step 2 onwards.

    Step 2 asks for an ID, and the step behind it is the one holding her email
    — which is exactly where a woman goes when the link has not arrived, or
    when she wants to check she confirmed the right address before handing over
    a document. Without this she could only get there by signing out.

    It moves the stage rather than calling `history.back()`: she may have
    arrived on this screen straight from the confirmation email, with no
    history in the tab for a back to pop.

    Step 3 gets one only when she reached it in this visit — `advanced` is set
    and the server has not yet said `in_review`. Once the review has actually
    begun there is nothing to go back and change, so no control is drawn.
  */
  const back =
    stage === "documents" || stage === "rejected"
      ? { to: "Your email", go: () => setAdvanced("email") }
      : stage === "review" && advanced === "review"
        ? { to: "Your photos", go: () => setAdvanced("documents") }
        : null;

  /** Both ways in. `pickingFor` says which of the two documents it is for. */
  const take = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Cleared before we do anything with it, so choosing the SAME file again —
    // after a rejection, or a retake she was not happy with — still fires.
    e.target.value = "";
    if (file) void send(file);
  };
  const filePicker = (
    <>
      <input
        ref={camera}
        type="file"
        // Photographs only on this one: it is the camera, and no camera
        // returns a PDF.
        accept="image/*"
        className="hidden"
        // Visually hidden, but still in the accessibility tree — without a name
        // a screen reader announces only "file upload, button".
        aria-label={tr("verify.takeAPhotoWithTheCamera")}
        onChange={take}
      />
      <input
        ref={files}
        type="file"
        accept={ACCEPTED_DOCUMENT_TYPES.join(",")}
        className="hidden"
        aria-label={tr("verify.chooseAPhotoOfYourId")}
        onChange={take}
      />
      {problem && (
        <p role="alert" className="ux-slide-up mt-3 text-xsm leading-relaxed"
           style={{ color: "var(--ux-orange-ink)" }}>
          {problem}
        </p>
      )}
    </>
  );

  return (
    <OnboardFrame
      step={stepOf[stage]}
      total={3}
      onBack={back?.go}
      backTo={back?.to}
      title={
        stage === "email" ? "Confirm your email"
        : stage === "documents" ? "Show us it is you"
        : stage === "review" ? tr("verify.aPersonIsLookingAtThis")
              : tr("verify.weCouldNotConfirmThat")
      }
      sub={
        stage === "email" ? tr("verify.weSentALinkTo", { email: user?.email ?? "" })
        : stage === "documents" ? "WomSakhi is for women only, and a person checks every account by hand. This is the part that keeps it that way."
        : stage === "review" ? undefined
        : "The photo was too blurred to read. It happens — try once more."
      }
      aside={
        <OnboardAside
          art="/ux/art/icon-padlock.webp"
          title={tr("verify.whatHappensToYourId")}
          body={tr("verify.itIsSeenByTheTwo")}
          points={[
            "Stored encrypted, never shown on your profile",
            "Deleted if you close your account",
            "Never used for anything except this check",
          ]}
        />
      }
    >
      {stage === "email" && (
        <Card>
          {/* On a phone the picture sits above the words, so the buttons get
              the card's full width rather than what is left beside it. */}
          <div className="flex items-start gap-4 max-lg:flex-col">
            <IconTile icon="Mail" tint="--ux-tint-violet" ink="--ux-violet" size={52} radius={14} />
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("verify.checkYourInbox")}</h2>
              <p className="mt-1.5 text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
                {tr("verify.theLinkIsGoodFor24Hours")}
              </p>
              <div className="mt-4 flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center">
                <Btn variant="primary" iconEnd="ArrowRight" className={phonePrimary} onClick={() => setAdvanced("documents")}>{tr("verify.iHaveConfirmedIt")}</Btn>
                <Btn variant="outline" icon={resent ? "Check" : "RotateCcw"} disabled={resend.busy} className={phoneSecondary}
                     onClick={() => void resend.run()}>
                  {resend.busy ? "Sending…" : resent ? tr("verify.sentAgain")
              : tr("verify.sendItAgain")}
                </Btn>
              </div>
            </div>
          </div>
        </Card>
      )}

      {(stage === "documents" || stage === "rejected") && (
        <>
          {stage === "rejected" && (
            <Card className="mb-[16px]" style={{ borderColor: "var(--ux-orange)" }}>
              <div className="flex items-start gap-3.5">
                <Icons.AlertTriangle className="mt-[2px] h-[20px] w-[20px] shrink-0" style={{ color: "var(--ux-orange-ink)" }} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("verify.thePhotoWasTooBlurredTo")}</p>
                  <p className="mt-1 text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
                    Take it in daylight, flat on a table, with all four corners in the frame. Nothing else
                    about your account has changed.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* The papers as one grouped list on a phone, the button on each row. */}
          <ListGroup className="lg:hidden">
            {DOCS.map((d) => {
              const done = uploaded.includes(d.docType);
              return (
                <PhoneRow key={d.id} icon={done ? "CheckCircle2" : d.icon}
                          tint={done ? "--ux-tint-green" : d.tint} ink={done ? "--ux-green" : d.ink}
                          title={
                            <span className="flex flex-wrap items-center gap-2">
                              {d.label}
                              {done && <Pill tone="green" size="sm">Added</Pill>}
                            </span>
                          }
                          meta={d.note}>
                  {/* The two ways in, side by side on their own line rather
                      than squeezed into the end of the row: at 390px the row
                      has about 96px left after the tile and the words, which
                      is one small button — and it was the wrong one, because
                      the phone in her hand IS the scanner. */}
                  <span className="mt-2.5 flex gap-2">
                    <Btn variant={done ? "outline" : "primary"} size="sm"
                         icon="Camera"
                         disabled={busy === d.docType}
                         className="flex-1 max-lg:min-h-[44px] max-lg:text-[15px]"
                         onClick={() => choose(d.docType, "camera", d.facing)}>
                      {busy === d.docType ? "Sending…" : done ? "Take again" : "Take photo"}
                    </Btn>
                    <Btn variant="outline" size="sm"
                         icon="Upload"
                         disabled={busy === d.docType}
                         className="flex-1 max-lg:min-h-[44px] max-lg:text-[15px]"
                         onClick={() => choose(d.docType, "files")}>
                      {done ? "Choose another" : "Choose a photo"}
                    </Btn>
                  </span>
                </PhoneRow>
              );
            })}
          </ListGroup>
          <div className="ux-deck hidden space-y-[12px] lg:block">
            {DOCS.map((d, i) => {
              const done = uploaded.includes(d.docType);
              return (
                <Card key={d.id} className="ux-i" style={{ ["--i" as string]: i }}>
                  <div className="flex items-center gap-3.5">
                    <IconTile icon={done ? "CheckCircle2" : d.icon}
                              tint={done ? "--ux-tint-green" : d.tint}
                              ink={done ? "--ux-green" : d.ink} size={46} radius={12} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>
                        {d.label}
                        {done && <Pill tone="green" size="sm">Added</Pill>}
                      </p>
                      <p className="mt-0.5 text-xs" style={{ color: "var(--ux-muted)" }}>{d.note}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {/* Only where a camera will actually open — see `handheld`. */}
                      {handheld && (
                        <Btn variant={done ? "outline" : "primary"} size="sm" icon="Camera"
                             disabled={busy === d.docType}
                             onClick={() => choose(d.docType, "camera", d.facing)}>
                          {busy === d.docType ? "Sending…" : done ? "Take again" : "Take photo"}
                        </Btn>
                      )}
                      <Btn variant={done || handheld ? "outline" : "primary"} size="sm"
                           icon={done ? "RotateCcw" : "Upload"}
                           disabled={busy === d.docType}
                           onClick={() => choose(d.docType, "files")}>
                        {busy === d.docType && !handheld ? "Sending…"
                          : done ? "Choose another" : "Choose a photo"}
                      </Btn>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="mt-[24px] flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
            <p className="text-[13px] lg:text-xs" style={{ color: "var(--ux-faint)" }}>
              {allUploaded ? "That is everything we need." : `${Math.max(0, DOCS.length - sent.length)} still to add.`}
            </p>
            <Btn variant="primary" iconEnd="ArrowRight"
                 className={`${phonePrimary} ${allUploaded ? "" : "pointer-events-none opacity-50"}`}
                 onClick={() => allUploaded && setAdvanced("review")}>{tr("verify.sendForReview")}</Btn>
          </div>
          {filePicker}
        </>
      )}

      {stage === "review" && (
        <Card>
          {/* On a phone the picture sits above the words, so the buttons get
              the card's full width rather than what is left beside it. */}
          <div className="flex items-start gap-4 max-lg:flex-col">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" decoding="async" src="/ux/art/scene-woman-reading-document.webp" alt=""
                 className="h-[92px] w-[92px] shrink-0 object-contain" />
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("verify.usuallyDoneWithinADay")}</h2>
              {/* Never a bare "pending". Say who, and roughly how long. */}
              <p className="mt-2 text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
                Two people review new accounts, Monday to Saturday. You will get an email the moment it is
                done — you do not need to keep this open.
              </p>
              <div className="mt-4 flex flex-col gap-2.5 lg:flex-row lg:flex-wrap">
                <Btn variant="outline" icon="LogOut" className={phoneSecondary} onClick={() => signOut()}>{tr("verify.signOutForNow")}</Btn>
                <Btn variant="ghost" className={phoneSecondary} onClick={() => setAdvanced("rejected")}>{tr("verify.seeWhatHappensIfSomethingIs")}</Btn>
              </div>
            </div>
          </div>
        </Card>
      )}
    </OnboardFrame>
  );
}
