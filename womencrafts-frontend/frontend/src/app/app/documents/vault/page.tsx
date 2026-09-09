"use client";

import { useMemo, useRef, useState } from "react";

import { apiUploadDocument, validateDocument, ACCEPTED_DOC_TYPES } from "@/lib/uploads-api";
import { messageFrom } from "@/lib/use-action";
import * as Icons from "@/components/ux/icons";

import {Back, ActionBtn, Btn, Card, EmptyState, IconTile, Pill,
  Progress, SectionHead, SourceNote, Tabs, escapeHtml, letterhead,
  printDocument
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useMe } from "@/components/ux/me";
import { useDocuments, type UxDocument } from "@/components/ux/live";
import { COPY } from "@/components/ux/copy";
import { useT } from "@/i18n";

type Row = UxDocument;

/**
 * Her papers, in one place she can open them from.
 *
 * The Paperwork tab on My Business answers "is my shop compliant?". This
 * answers a different question — "the office is asking for my Aadhaar and my
 * passbook, where are they?" — which is why it exists separately and why every
 * row can be opened and downloaded rather than merely ticked.
 *
 * Two things are deliberate:
 *
 * - **Where each paper is already being used** is on the row. A woman deleting
 *   a document has no way of knowing it is holding up a Mudra application.
 * - **Nothing here is shown to a buyer or an employer**, said plainly and more
 *   than once. Uploading identity papers to an app is an act of trust, and the
 *   only thing that keeps it is repeating what happens to them.
 */
export default function VaultPage() {
  const tr = useT();
  const ME = useMe();
  const { data: DOCUMENTS, source, refetch } = useDocuments();
  const [tab, setTab] = useState("All");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState("");
  const picker = useRef<HTMLInputElement | null>(null);
  // Which slot the chosen file belongs to. Held in a ref because the picker's
  // change event fires long after the click that opened it, by which time
  // state set alongside would be a render behind.
  const pickingFor = useRef<{ id: string; docType: string }>({ id: "upload", docType: "other" });

  /**
   * Open the file picker for one slot.
   *
   * These three buttons used to set a flag and clear it 1.2 seconds later.
   * Nothing was chosen, nothing was sent, and the row went back to saying the
   * paper was missing — which a woman reads as "it did not work, try again",
   * so she tries again.
   */
  function choose(id: string, docType: string) {
    setProblem("");
    pickingFor.current = { id, docType };
    picker.current?.click();
  }

  async function send(file: File) {
    const { id, docType } = pickingFor.current;
    const wrong = validateDocument(file);
    if (wrong) { setProblem(wrong); return; }
    setBusy(id);
    setProblem("");
    try {
      await apiUploadDocument(file, docType);
      refetch();
    } catch (e) {
      setProblem(messageFrom(e, "That did not go through. The paper has not been sent — try again in a moment."));
    } finally {
      setBusy(null);
    }
  }

  /**
   * The papers, as the server holds them.
   *
   * There used to be three more fields here, all invented: a size picked from
   * a list of three by row position, a page count from another, and a "Used by"
   * list naming Mudra Yojana and Mahila Samman. That last one mattered — the
   * screen says below that deleting a paper "can quietly stop a loan
   * application she is still waiting on", and it was telling her that on the
   * strength of a hardcoded array. The API does not carry which schemes use a
   * document, so the app no longer claims to know.
   */
  const rows = useMemo<Row[]>(() => DOCUMENTS, [DOCUMENTS]);

  const have = rows.filter((r) => r.status === "verified");
  const missing = rows.filter((r) => r.status === "missing");
  const shown = tab === "All" ? rows
    : tab === "With us" ? have
    : tab === "Still needed" ? missing
    : rows.filter((r) => r.status === "optional");

  const needed = rows.filter((r) => r.status !== "optional").length;

  /**
   * What can honestly be produced without a backend.
   *
   * The scan of her Aadhaar lives on a server this app cannot reach yet, so
   * "Download" cannot hand her that file and will not pretend to. What it CAN
   * hand her is the record: which papers WomSakhi holds, when each was checked,
   * and where each is being used. That is a real document — it is what an
   * office wants stapled to a photocopy — and when the API lands it gains the
   * scan rather than replacing a lie.
   */
  const coverSheet = (only?: Row) => {
    const list = only ? [only] : rows;
    const line = (d: Row) => `<tr>
      <td>${escapeHtml(d.name)}</td>
      <td>${d.status === "verified" ? "Held and checked" : d.status === "missing" ? "Not given to us" : "Optional"}</td>
      <td>${escapeHtml(d.when)}</td>
    </tr>`;
    return printDocument(only ? `Record — ${only.name}` : "Your papers", `
      ${letterhead(only ? tr("documentsVault.documentRecord")
              : tr("documentsVault.yourPapers3"), `${ME.name} · ${have.length} of ${needed} held`)}
      <table>
        <thead><tr><th scope="col">Paper</th><th scope="col">Status</th><th scope="col">Checked</th></tr></thead>
        <tbody>${list.map(line).join("")}</tbody>
      </table>
      ${missing.length && !only ? `<h2>${tr("documentsVault.stillToGiveUs")}</h2><p>${escapeHtml(missing.map((x) => x.name).join(", "))}. Schemes that ask for ${missing.length > 1 ? "them" : "it"} cannot go through until ${missing.length > 1 ? tr("documentsVault.theyAre")
              : tr("documentsVault.itIs")} added.</p>` : ""}
      <p class="foot">
        This is a record of what WomSakhi holds, not a copy of the papers
        themselves. An office asking to see the originals still needs the
        originals. Verify this record at womsakhi.in/verify.
      </p>`);
  };

  return (
    <HomeShell
      skeleton="list"
      loadFailed="your papers"
      rail={
        <div className="space-y-[16px]">
          <Card>
            <SectionHead title={tr("documentsVault.yourPapers2")}
                         sub={needed ? `${have.length} of ${needed} with us` : "None added yet"} />
            {/* 0 of 0 is not 0% — it is NaN, and a NaN width is a bar that
                vanishes. An account with nothing uploaded gets no bar at all. */}
            {needed > 0 && (
              <div className="mb-3.5">
                <Progress pct={(have.length / needed) * 100} track="--ux-track" />
              </div>
            )}
            {!needed ? (
              <p className="text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
                You have not given us any papers yet. Aadhaar and a bank passbook are what almost every
                scheme asks for first.
              </p>
            ) : missing.length ? (
              <p className="text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
                {missing.map((m) => m.name).join(" and ")} {missing.length > 1 ? "are" : "is"} still missing. Schemes that ask for {missing.length > 1 ? "them" : "it"} cannot go through until
                {missing.length > 1 ? tr("documentsVault.theyAre2")
              : tr("documentsVault.itIs2")} added.
              </p>
            ) : (
              <p className="text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{tr("documentsVault.everythingASchemeOrABank")}</p>
            )}
            <div className="mt-4 space-y-2.5">
              <Btn variant="primary" full icon="Upload" disabled={busy === "upload"}
                   onClick={() => choose("upload", "other")}>
                {busy === "upload" ? "Sending…" : "Add a paper"}
              </Btn>
              <ActionBtn variant="outline" full icon="Printer" doneIcon="Printer"
                         done={COPY.saveAsPdf} act={() => coverSheet()}>{tr("documentsVault.printTheList")}</ActionBtn>
            </div>

            {/* One picker for every button on the screen. `capture` is left
                off deliberately: on a phone this offers the camera *and* the
                files she already has, and most of these papers were
                photographed once and kept. */}
            <input
              // Visually hidden, but still in the accessibility tree — without
              // a name a screen reader announces only "file upload, button".
              aria-label={tr("documentsVault.chooseADocumentToUpload")}
              ref={picker}
              type="file"
              accept={ACCEPTED_DOC_TYPES.join(",")}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                // Cleared so choosing the same file twice still fires a change.
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
            <p className="mt-2.5 text-xs leading-relaxed" style={{ color: "var(--ux-faint)" }}>
              The printed list says what we hold and when each was checked. It is not a copy of the papers
              themselves — an office wanting the originals still needs the originals.
            </p>
          </Card>

          <Card>
            {/* Repeated on purpose. Uploading identity papers is an act of trust. */}
            <SectionHead title={tr("documentsVault.whoCanSeeThese")} icon="Lock" />
            <ul className="space-y-2.5">
              {[
                ["You", "Any time, on any phone you sign in on.", true],
                ["The WomSakhi review team", "Only to tick a paper as checked. Nothing else.", true],
                ["Buyers and employers", "Never. They see your profile, not your papers.", false],
                ["Anyone you send them to", "Only if you download and send them yourself.", false],
              ].map(([who, what, yes]) => (
                <li key={who as string} className="flex items-start gap-2.5">
                  {yes
                    ? <Icons.Check className="mt-[2px] h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-green-ink)" }} strokeWidth={2.6} />
                    : <Icons.X className="mt-[2px] h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-faint)" }} strokeWidth={2.6} />}
                  <span>
                    <span className="block text-xsm font-medium" style={{ color: "var(--ux-ink)" }}>{who as string}</span>
                    <span className="block text-xs leading-snug" style={{ color: "var(--ux-muted)" }}>{what as string}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      }
    >
      <Back to="/app/documents" label={tr("documentsVault.yourShop")} className="mb-4" />

      <div className="mb-[20px] flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--ux-ink)" }}>{tr("documentsVault.yourPapers")}</h1>
          <p className="mt-1.5 text-xsm" style={{ color: "var(--ux-muted)" }}>{tr("documentsVault.openDownloadOrReplaceAnythingYou")}</p>

      <SourceNote source={source} what="papers" />
        </div>
        <Tabs items={["All", "With us", "Still needed", "Optional"]} active={tab} onChange={setTab} />
      </div>

      {shown.length ? (
        <ul className="ux-deck space-y-2.5">
          {shown.map((d, i) => {
            const open = preview === d.id;
            return (
              <li key={d.id} className="ux-i ux-sq rounded-[12px] border p-3.5"
                  style={{ borderColor: open ? "var(--ux-brand)" : "var(--ux-line)",
                           background: "var(--ux-surface)", ["--i" as string]: i }}>
                <div className="flex items-center gap-3.5">
                  <IconTile icon={d.icon} tint={d.tint} ink={d.ink} size={46} radius={12} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{d.name}</p>
                      {d.status === "verified" && <Pill tone="green" size="sm">Checked</Pill>}
                      {d.status === "missing" && <Pill tone="orange" size="sm">{tr("documentsVault.notAdded")}</Pill>}
                      {d.status === "optional" && <Pill tone="neutral" size="sm">Optional</Pill>}
                    </div>
                    <p className="mt-0.5 truncate text-xs" style={{ color: "var(--ux-muted)" }}>
                      {d.when}{d.size ? ` · ${d.size}` : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {d.status === "missing" ? (
                      <Btn variant="primary" size="sm" icon="Upload" disabled={busy === d.id}
                           onClick={() => choose(d.id, d.docType ?? "other")}>
                        {busy === d.id ? "Sending…" : "Add it"}
                      </Btn>
                    ) : d.status === "optional" ? (
                      <Btn variant="outline" size="sm" icon="Plus" disabled={busy === d.id}
                           onClick={() => choose(d.id, d.docType ?? "other")}>
                        {busy === d.id ? "Sending…" : "Add if you have it"}
                      </Btn>
                    ) : (
                      <>
                        <Btn variant="outline" size="sm" icon={open ? "EyeOff" : "Eye"}
                             onClick={() => setPreview(open ? null : d.id)}>
                          {open ? "Hide" : "View"}
                        </Btn>
                        <ActionBtn variant="ghost" size="sm" icon="Printer" doneIcon="Printer"
                                   done={COPY.saveAsPdf} act={() => coverSheet(d)}>{tr("documentsVault.printItsRecord")}</ActionBtn>
                      </>
                    )}
                  </div>
                </div>


                {open && (
                  <div className="ux-slide-up mt-3 border-t pt-3.5" style={{ borderColor: "var(--ux-line)" }}>
                    <div className="ux-sq grid h-[190px] place-items-center rounded-[12px] border"
                         style={{ borderColor: "var(--ux-line)", background: "var(--ux-surface-2)" }}>
                      <div className="text-center">
                        <Icons.FileText className="mx-auto h-[34px] w-[34px]" style={{ color: "var(--ux-faint)" }} strokeWidth={1.5} />
                        <p className="mt-2 text-xsm font-medium" style={{ color: "var(--ux-ink-2)" }}>{d.name}</p>
                        <p className="mt-0.5 text-xs" style={{ color: "var(--ux-faint)" }}>
                          {d.size ?? "Held with us"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {/* Replacing is adding another of the same kind — the
                          newest is what a scheme office is shown. */}
                      <Btn variant="outline" size="sm" icon="RefreshCw" disabled={busy === d.id}
                           onClick={() => choose(d.id, d.docType ?? "other")}>
                        {busy === d.id ? "Sending…" : "Replace it"}
                      </Btn>
                      <Btn variant="ghost" size="sm" icon="Share2" href="/app/support-fund">{tr("documentsVault.useItForAScheme")}</Btn>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <Card>
          <EmptyState icon="FolderOpen" title={`Nothing under ${tab}`}
                      body="Try another tab, or add a paper and it will show up here."
                      action={<Btn onClick={() => setTab("All")} variant="soft">{tr("documentsVault.showEverything")}</Btn>} />
        </Card>
      )}
    </HomeShell>
  );
}
