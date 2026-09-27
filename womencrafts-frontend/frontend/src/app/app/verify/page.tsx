"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { ACCEPTED_DOCUMENT_TYPES, MAX_DOCUMENT_MB, MAX_VERIFICATION_DOCUMENTS, apiDeleteMyDocument, apiMyDocumentObjectUrl, apiMyVerification, apiRequestMyVerificationReview, apiResendVerificationEmail, apiUploadDocument, validateDocument, type ApiDocument, type VerificationStatus } from "@/lib/verification-api";
import { useAuth } from "@/context/AuthContext";
import { useResource } from "@/lib/use-resource";
import { messageFrom, useAction } from "@/lib/use-action";
import * as Icons from "@/components/ux/icons";

import { Btn, Card, IconTile, Pill } from "@/components/ux/kit";
import { OnboardAside, OnboardFrame } from "@/components/ux/onboard/Frame";
import { useT } from "@/i18n";
import { phonePrimary, phoneSecondary } from "@/components/ux/PhoneParts";

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
  { id: "d2", docType: "selfie", label: "A photo of you", note: "Holding the same ID, so we know it is yours",
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
  const liveVideo = useRef<HTMLVideoElement | null>(null);
  const liveStream = useRef<MediaStream | null>(null);
  const pickingFor = useRef<string>("aadhaar");
  const pickingMultiple = useRef(false);
  const [cameraFor, setCameraFor] = useState<{ docType: string; facing: string } | null>(null);
  const [cameraError, setCameraError] = useState("");
  const cameraCapable = useSyncExternalStore(
    () => () => {},
    () => Boolean(navigator.mediaDevices?.getUserMedia),
    () => false,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ document: ApiDocument; url: string } | null>(null);
  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url); }, [preview]);
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

  const closeLiveCamera = useCallback(() => {
    liveStream.current?.getTracks().forEach((track) => track.stop());
    liveStream.current = null;
    if (liveVideo.current) liveVideo.current.srcObject = null;
    setCameraFor(null);
    setCameraError("");
  }, []);

  useEffect(() => {
    if (!cameraFor) return;
    let cancelled = false;
    void navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: cameraFor.facing } },
    }).then(async (stream) => {
      if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return; }
      liveStream.current = stream;
      if (liveVideo.current) {
        liveVideo.current.srcObject = stream;
        await liveVideo.current.play();
      }
    }).catch(() => {
      if (!cancelled) setCameraError("Camera access is unavailable. Allow camera permission, or choose a file instead.");
    });
    return () => {
      cancelled = true;
      liveStream.current?.getTracks().forEach((track) => track.stop());
      liveStream.current = null;
    };
  }, [cameraFor]);

  /** The server's word, unless she has stepped forward within this visit. */
  const stage: Stage = advanced ?? (
    status?.status === "pending_email" ? "email"
    : status?.status === "rejected" ? "rejected"
    : status?.status === "in_review" || status?.status === "active" ? "review"
    : "documents"
  );

  // Her documents, as the server holds them — not a list of ids she clicked.
  const sent = status?.documents ?? [];
  const currentDocuments = sent.filter((document) => document.status === "pending");
  /*
    The server's kinds — "aadhaar", "other" — NOT the row ids above.

    This read `d.id` at both call sites, so `uploaded.includes(...)` compared
    "d1" against "aadhaar" and was false for every row: a woman who had already
    sent both photographs was still shown two empty rows saying "Add photo",
    with no Added tick and no way to tell the upload had worked.
  */
  const uploaded = currentDocuments.map((d) => d.doc_type);
  const allUploaded = DOCS.every((item) => uploaded.includes(item.docType) || (item.docType === "selfie" && uploaded.includes("other")));
  const requiredAdded = DOCS.filter((item) => uploaded.includes(item.docType) || (item.docType === "selfie" && uploaded.includes("other"))).length;

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
  const requestReview = useAction(
    () => apiRequestMyVerificationReview(),
    {
      onDone: () => { setAdvanced("review"); void refetch(); },
      fallbackError: "Could not notify the verification team just now. Try again in a moment.",
    },
  );
  const nextRequestAt = status?.next_review_request_at
    ? new Date(status.next_review_request_at)
    : null;
  const canRequestReview = !nextRequestAt || Number.isNaN(nextRequestAt.getTime()) || nextRequestAt <= new Date();

  /**
   * Open the camera, or the files, for one of the two documents.
   *
   * `facing` is written onto the node here rather than passed as a React prop
   * on purpose. The attribute has to be correct at the instant `.click()`
   * runs, and a `setState` would not have landed yet — the camera would open
   * on whichever side the previous row asked for. React never rendered a
   * `capture` prop on that input, so it has no value of its own to put back.
   */
  function choose(docType: string, how: "camera" | "files", facing = "environment", multiple = false) {
    setProblem("");
    pickingFor.current = docType;
    pickingMultiple.current = multiple;
    if (how === "files") { files.current?.click(); return; }
    if (!handheld && cameraCapable) {
      setCameraError("");
      setCameraFor({ docType, facing });
      return;
    }
    camera.current?.setAttribute("capture", facing);
    camera.current?.click();
  }

  function captureLivePhoto() {
    const video = liveVideo.current;
    if (!video || video.readyState < 2 || !cameraFor) {
      setCameraError("The camera is still starting. Wait a moment and try again.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) { setCameraError("Could not capture that photo. Choose a file instead."); return; }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) { setCameraError("Could not capture that photo. Try again."); return; }
      pickingFor.current = cameraFor.docType;
      const file = new File([blob], `womsakhi-${cameraFor.docType}-${Date.now()}.jpg`, { type: "image/jpeg" });
      closeLiveCamera();
      void sendMany([file]);
    }, "image/jpeg", 0.9);
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

  async function sendMany(selected: File[]) {
    const room = MAX_VERIFICATION_DOCUMENTS - currentDocuments.length;
    if (selected.length > room) {
      setProblem(`You can add ${room} more ${room === 1 ? "document" : "documents"}. The limit is ${MAX_VERIFICATION_DOCUMENTS}.`);
      return;
    }
    for (const file of selected) await send(file);
    await refetch();
  }

  async function openPreview(document: ApiDocument) {
    setBusy(`preview-${document.id}`);
    setProblem("");
    try {
      const url = await apiMyDocumentObjectUrl(document.id);
      setPreview((current) => {
        if (current?.url) URL.revokeObjectURL(current.url);
        return { document, url };
      });
    } catch (e) {
      setProblem(messageFrom(e, "We could not open that document. Try again."));
    } finally { setBusy(null); }
  }

  async function removeDocument(document: ApiDocument) {
    setDeleting(document.id);
    setProblem("");
    try {
      await apiDeleteMyDocument(document.id);
      if (preview?.document.id === document.id) setPreview(null);
      await refetch();
    } catch (e) {
      setProblem(messageFrom(e, "We could not delete that document. Try again."));
    } finally { setDeleting(null); }
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
    const selected = Array.from(e.target.files ?? []).slice(0, pickingMultiple.current ? undefined : 1);
    // Cleared before we do anything with it, so choosing the SAME file again —
    // after a rejection, or a retake she was not happy with — still fires.
    e.target.value = "";
    if (selected.length) void sendMany(selected);
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
        multiple
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

          <Card className="mb-3 overflow-hidden p-0">
            <div className="grid items-center gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_150px] sm:p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--ux-brand)" }}>Secure identity check</p>
                <h2 className="mt-1.5 text-lg font-bold" style={{ color: "var(--ux-ink)" }}>Two clear photos, then a person reviews them</h2>
                <p className="mt-2 text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
                  JPG, PNG, WEBP, HEIC or PDF · up to {MAX_DOCUMENT_MB} MB each · maximum {MAX_VERIFICATION_DOCUMENTS} files. Your files stay private and never appear on your profile.
                </p>
                <div className="mt-3 flex items-center gap-2" aria-label={`${Math.min(currentDocuments.length, DOCS.length)} of ${DOCS.length} items added`}>
                  {DOCS.map((d) => <span key={d.id} className="h-2 flex-1 rounded-full" style={{ background: uploaded.includes(d.docType) || (d.docType === "selfie" && uploaded.includes("other")) ? "var(--ux-green)" : "var(--ux-track)" }} />)}
                  <span className="shrink-0 text-xs font-semibold" style={{ color: "var(--ux-muted)" }}>{Math.min(currentDocuments.length, DOCS.length)}/{DOCS.length}</span>
                </div>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ux/art/scene-woman-reading-document.webp" alt="" className="mx-auto h-[118px] w-[150px] object-contain max-sm:hidden" decoding="async" />
            </div>
          </Card>

          <div className="ux-deck grid gap-3 sm:grid-cols-2">
            {DOCS.map((d, i) => {
              const done = uploaded.includes(d.docType);
              return (
                <Card key={d.id} className="ux-i relative overflow-hidden" style={{ ["--i" as string]: i, borderColor: done ? "var(--ux-green)" : "var(--ux-line)" }}>
                  <div className="flex items-start gap-3.5">
                    <div className="relative">
                      <IconTile icon={done ? "CheckCircle2" : d.icon} tint={done ? "--ux-tint-green" : d.tint} ink={done ? "--ux-green" : d.ink} size={48} radius={13} />
                      <span className="absolute -start-1 -top-1 grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: "var(--ux-brand)" }}>{i + 1}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{d.label}{done && <Pill tone="green" size="sm">Added</Pill>}</p>
                      <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>{d.note}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {(handheld || cameraCapable) && (
                      <Btn variant={done ? "outline" : "primary"} size="sm" icon="Camera" disabled={busy === d.docType} className="min-h-[44px]" onClick={() => choose(d.docType, "camera", d.facing)}>
                        {busy === d.docType ? "Sending…" : done ? "Retake" : "Take photo"}
                      </Btn>
                    )}
                    <Btn variant={done || handheld ? "outline" : "primary"} size="sm" icon={done ? "RotateCcw" : "Upload"} disabled={busy === d.docType} className="min-h-[44px]" onClick={() => choose(d.docType, "files")}>
                      {busy === d.docType && !handheld ? "Sending…" : done ? "Replace" : "Choose file"}
                    </Btn>
                  </div>
                </Card>
              );
            })}
          </div>

          {currentDocuments.length > 0 && (
            <Card className="mt-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>Your uploaded documents</h2>
                  <p className="mt-0.5 text-xs" style={{ color: "var(--ux-muted)" }}>{currentDocuments.length} of {MAX_VERIFICATION_DOCUMENTS} files used</p>
                </div>
                <Pill tone="green" size="sm">Private</Pill>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {currentDocuments.map((document) => (
                  <div key={document.id} className="flex min-w-0 items-center gap-3 rounded-[14px] border p-3" style={{ borderColor: "var(--ux-line)", background: "var(--ux-surface-2)" }}>
                    <IconTile icon={document.content_type === "application/pdf" ? "FileText" : "Image"} tint="--ux-tint-violet" ink="--ux-violet" size={40} radius={11} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold" style={{ color: "var(--ux-ink)" }}>{document.original_name}</p>
                      <p className="mt-0.5 text-[11px]" style={{ color: "var(--ux-muted)" }}>{(document.size / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                    <button type="button" onClick={() => void openPreview(document)} disabled={busy === `preview-${document.id}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ color: "var(--ux-violet)", background: "var(--ux-tint-violet)" }} aria-label={`Preview ${document.original_name}`}>
                      <Icons.Eye className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => void removeDocument(document)} disabled={deleting === document.id} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ color: "var(--ux-orange-ink)", background: "var(--ux-tint-orange)" }} aria-label={`Delete ${document.original_name}`}>
                      {deleting === document.id ? <Icons.Loader className="h-4 w-4 animate-spin" /> : <Icons.Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                ))}
              </div>
              {currentDocuments.length < MAX_VERIFICATION_DOCUMENTS && (
                <Btn variant="outline" icon="Files" className="mt-3 min-h-[44px] w-full sm:w-auto" onClick={() => choose("supporting", "files", "environment", true)}>Add supporting documents</Btn>
              )}
            </Card>
          )}

          <div className="mt-[24px] flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
            <p className="text-[13px] lg:text-xs" style={{ color: "var(--ux-faint)" }}>
              {allUploaded ? "That is everything we need." : `${DOCS.length - requiredAdded} still to add.`}
            </p>
            <Btn variant="primary" iconEnd="ArrowRight"
                 disabled={!allUploaded || requestReview.busy}
                 className={phonePrimary}
                 onClick={() => allUploaded && void requestReview.run()}>{requestReview.busy ? "Sending securely…" : tr("verify.sendForReview")}</Btn>
          </div>
          {filePicker}
          {cameraFor && (
            <div className="fixed inset-0 z-[90] grid place-items-end p-0 sm:place-items-center sm:p-6"
                 style={{ background: "var(--ux-scrim)" }} role="dialog" aria-modal="true" aria-label="Take a verification photo">
              <div className="w-full overflow-hidden rounded-t-[24px] border bg-black shadow-2xl sm:max-w-xl sm:rounded-[24px]"
                   style={{ borderColor: "var(--ux-line)" }}>
                <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ background: "var(--ux-surface)" }}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>
                      {cameraFor.docType === "selfie" ? "Take your selfie" : "Photograph your ID"}
                    </p>
                    <p className="text-xs" style={{ color: "var(--ux-muted)" }}>
                      {cameraFor.docType === "selfie" ? "Keep your face and the ID clearly inside the frame." : "Keep all four corners visible and avoid glare."}
                    </p>
                  </div>
                  <button type="button" onClick={closeLiveCamera} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
                          style={{ color: "var(--ux-ink)", background: "var(--ux-surface-2)" }} aria-label="Close camera">
                    <Icons.X className="h-5 w-5" />
                  </button>
                </div>
                <div className="relative aspect-[3/4] max-h-[68dvh] bg-black sm:aspect-[4/3]">
                  <video ref={liveVideo} autoPlay playsInline muted className={`h-full w-full object-cover ${cameraFor.facing === "user" ? "-scale-x-100" : ""}`} />
                  <div aria-hidden className="pointer-events-none absolute inset-5 rounded-[24px] border-2 border-white/70 shadow-[0_0_0_999px_rgba(0,0,0,.12)]" />
                </div>
                <div className="p-4" style={{ background: "var(--ux-surface)" }}>
                  {cameraError && <p role="alert" className="mb-3 text-center text-xs" style={{ color: "var(--ux-orange-ink)" }}>{cameraError}</p>}
                  <div className="flex gap-2">
                    <Btn variant="outline" className="min-h-[48px] flex-1" onClick={() => { closeLiveCamera(); choose(cameraFor.docType, "files"); }}>Choose file</Btn>
                    <Btn variant="primary" icon="Camera" className="min-h-[48px] flex-1" disabled={!!cameraError} onClick={captureLivePhoto}>Use photo</Btn>
                  </div>
                </div>
              </div>
            </div>
          )}
          {preview && (
            <div className="fixed inset-0 z-[80] grid place-items-center p-3 sm:p-6" style={{ background: "var(--ux-scrim)" }} role="dialog" aria-modal="true" aria-label={`Preview ${preview.document.original_name}`} onClick={() => setPreview(null)}>
              <div className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-[20px] bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
                <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                  <p className="min-w-0 truncate text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{preview.document.original_name}</p>
                  <button type="button" onClick={() => setPreview(null)} className="grid h-10 w-10 place-items-center rounded-xl" aria-label="Close preview"><Icons.X className="h-5 w-5" /></button>
                </div>
                {preview.document.content_type === "application/pdf" ? (
                  <iframe src={preview.url} title={preview.document.original_name} className="min-h-[65dvh] w-full flex-1" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview.url} alt={`Preview of ${preview.document.original_name}`} className="min-h-0 w-full flex-1 object-contain p-3" />
                )}
              </div>
            </div>
          )}
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
                <Btn
                  variant="primary"
                  icon={requestReview.busy ? "Loader" : "BellRing"}
                  className={phonePrimary}
                  disabled={requestReview.busy || !canRequestReview}
                  onClick={() => void requestReview.run()}
                >
                  {requestReview.busy
                    ? "Notifying the team…"
                    : !canRequestReview
                      ? `Request #${status?.review_request_count || 1} is with the team`
                      : status?.review_request_count
                        ? "Send another follow-up"
                        : "Ask the team to review now"}
                </Btn>
                <Btn variant="outline" icon="Files" className={phoneSecondary} onClick={() => setAdvanced("documents")}>Review or replace documents</Btn>
                <Btn variant="outline" icon="LogOut" className={phoneSecondary} onClick={() => signOut()}>{tr("verify.signOutForNow")}</Btn>
                <Btn variant="ghost" className={phoneSecondary} onClick={() => setAdvanced("rejected")}>{tr("verify.seeWhatHappensIfSomethingIs")}</Btn>
              </div>
              {requestReview.error && (
                <p role="alert" className="mt-3 text-xsm leading-relaxed" style={{ color: "var(--ux-orange-ink)" }}>
                  {requestReview.error}
                </p>
              )}
              {!canRequestReview && nextRequestAt && (
                <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>
                  The team has been notified. You can send another follow-up after {nextRequestAt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}.
                </p>
              )}
            </div>
          </div>
        </Card>
      )}
    </OnboardFrame>
  );
}
