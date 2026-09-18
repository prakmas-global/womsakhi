"use client";

import { useCallback, useRef, useState } from "react";

import {
  ACCEPTED_DOCUMENT_TYPES, apiMyVerification, apiResendVerificationEmail,
  apiUploadDocument, validateDocument, type VerificationStatus,
} from "@/lib/verification-api";
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
  // `docType` is the server's own kind, sent with the file.
  { id: "d1", docType: "aadhaar", label: "A photo ID", note: "Aadhaar, voter card or driving licence — any one",
    icon: "IdCard", tint: "--ux-tint-violet", ink: "--ux-violet", required: true },
  { id: "d2", docType: "other", label: "A photo of you", note: "Holding the same ID, so we know it is yours",
    icon: "Camera", tint: "--ux-tint-blue", ink: "--ux-blue", required: true },
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
  const { signOut } = useAuth();
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
  const picker = useRef<HTMLInputElement | null>(null);
  const pickingFor = useRef<string>("aadhaar");
  const [busy, setBusy] = useState<string | null>(null);

  /** The server's word, unless she has stepped forward within this visit. */
  const stage: Stage = advanced ?? (
    status?.status === "pending_email" ? "email"
    : status?.status === "rejected" ? "rejected"
    : status?.status === "in_review" || status?.status === "active" ? "review"
    : "documents"
  );

  // Her documents, as the server holds them — not a list of ids she clicked.
  const sent = status?.documents ?? [];
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

  function choose(docType: string) {
    setProblem("");
    pickingFor.current = docType;
    picker.current?.click();
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

  /** One picker for both rows; `pickingFor` says which kind it is. */
  const filePicker = (
    <>
      <input
        ref={picker}
        type="file"
        accept={ACCEPTED_DOCUMENT_TYPES.join(",")}
        className="hidden"
        // Visually hidden, but still in the accessibility tree — without a name
        // a screen reader announces only "file upload, button".
        aria-label={tr("verify.chooseAPhotoOfYourId")}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void send(file);
        }}
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
      title={
        stage === "email" ? "Confirm your email"
        : stage === "documents" ? "Show us it is you"
        : stage === "review" ? tr("verify.aPersonIsLookingAtThis")
              : tr("verify.weCouldNotConfirmThat")
      }
      sub={
        stage === "email" ? "We sent a link to priya.sharma@example.com. Open it and come back here."
        : stage === "documents" ? "WomSakhi is for women only, and a person checks every account by hand. This is the part that keeps it that way."
        : stage === "review" ? undefined
        : "The photo was too blurred to read. It happens — try once more."
      }
      aside={
        <OnboardAside
          art="/ux/art/icon-padlock.webp"
          title={tr("verify.whatHappensToYourId")}
          body="It is seen by the two people who review accounts, and by nobody else — not employers, not buyers, not other members."
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
                The link is good for 24 hours. If it is not there, look in spam — it arrives from
                hello@womsakhi.in.
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
              const done = uploaded.includes(d.id);
              return (
                <PhoneRow key={d.id} icon={done ? "CheckCircle2" : d.icon}
                          tint={done ? "--ux-tint-green" : d.tint} ink={done ? "--ux-green" : d.ink}
                          title={
                            <span className="flex flex-wrap items-center gap-2">
                              {d.label}
                              {done && <Pill tone="green" size="sm">Added</Pill>}
                            </span>
                          }
                          meta={d.note}
                          trailing={
                            <Btn variant={done ? "outline" : "primary"} size="sm"
                                 icon={done ? "RotateCcw" : "Upload"}
                                 disabled={busy === d.docType}
                                 onClick={() => choose(d.docType)}>
                              {busy === d.docType ? "Sending…" : done ? "Replace" : "Add photo"}
                            </Btn>
                          } />
              );
            })}
          </ListGroup>
          <div className="ux-deck hidden space-y-[12px] lg:block">
            {DOCS.map((d, i) => {
              const done = uploaded.includes(d.id);
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
                    <Btn variant={done ? "outline" : "primary"} size="sm"
                         icon={done ? "RotateCcw" : "Upload"}
                         disabled={busy === d.docType}
                         onClick={() => choose(d.docType)}>
                      {busy === d.docType ? "Sending…" : done ? "Replace" : "Add photo"}
                    </Btn>
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
