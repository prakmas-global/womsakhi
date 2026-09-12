/**
 * Real files, with no backend.
 *
 * Every download in this app used to confirm and produce nothing, which is
 * worse than a dead button: a dead button teaches her the app is broken, a
 * lying one teaches her the file is somewhere she cannot find.
 *
 * Two ways out, and neither needs an API:
 *
 * - **`printDocument`** opens a clean, self-contained page and asks the browser
 *   to print it. Save as PDF is in every print dialogue on every platform, so
 *   she gets a genuine PDF with selectable text that a bank can read — better
 *   than anything a client-side PDF library would produce, and about 200 bytes
 *   of code instead of 300KB.
 * - **`downloadCsv`** writes an actual file to her Downloads folder through a
 *   Blob. A spreadsheet is what an accountant or a loan officer asks for second,
 *   after the PDF.
 *
 * Both are replaced by the API's own signed documents later. Until then they
 * are real, and that is the whole difference.
 */

/** Escape for HTML text content. The values come from her own records. */
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Open a printable document and bring up the print dialogue.
 *
 * Printed black-on-white regardless of her theme: a dark-mode statement wastes
 * a cartridge and is refused at a counter for being unreadable.
 */
export function printDocument(title: string, bodyHtml: string, page = PAGE_DOCUMENT): string {
  const w = window.open("", "_blank", "width=820,height=1000");
  if (!w) return "Allow pop-ups to save it";

  w.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  ${page}
  * { box-sizing: border-box; }
  body { font: 13px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
         color: #16181f; background: #fff; margin: 0; padding: 28px; }
  /* A certificate is full-bleed and draws its own frame. */
  body:has(.c-sheet) { padding: 0; }
  h1 { font-size: 21px; margin: 0 0 2px; letter-spacing: -0.01em; }
  h2 { font-size: 13px; margin: 26px 0 8px; text-transform: uppercase;
       letter-spacing: 0.07em; color: #5b6070; }
  .sub { color: #5b6070; margin: 0 0 22px; }
  .brand { font-weight: 700; color: #742a4f; letter-spacing: -0.01em; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em;
       color: #5b6070; border-bottom: 1.5px solid #16181f; padding: 0 8px 6px 0; }
  td { padding: 7px 8px 7px 0; border-bottom: 1px solid #e4e6ec; vertical-align: top; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .total td { border-top: 1.5px solid #16181f; border-bottom: none; font-weight: 700; padding-top: 10px; }
  .muted { color: #5b6070; }
  .foot { margin-top: 30px; padding-top: 12px; border-top: 1px solid #e4e6ec;
          font-size: 11px; color: #5b6070; }

  /* ── the certificate ──────────────────────────────────────────────────
     A book serif, ink on white, letterspaced capitals and a double rule.
     None of the app's violet, roundness or friendliness: this page is read
     by a bank officer or a government clerk, and it has to sit convincingly
     among the other papers on their desk. */
  .c-sheet {
    width: 297mm; height: 210mm; padding: 11mm; margin: 0;
    background: #fff; color: #14161c;
    font-family: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua",
                 Georgia, "Times New Roman", serif;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  /* The classic double rule. Two elements, not a doubled border, so the gap
     between them is exact at any printer resolution. */
  .c-rule-outer { height: 100%; border: 2.4px solid #14161c; padding: 3.2mm; }
  .c-rule-inner {
    height: 100%; border: 0.8px solid #14161c;
    padding: 12mm 20mm 9mm; text-align: center;
    display: flex; flex-direction: column;
  }

  .c-head { margin-bottom: 7mm; }
  .c-issuer {
    margin: 0; font-size: 17pt; font-weight: 700;
    letter-spacing: 0.32em; text-transform: uppercase; text-indent: 0.32em;
  }
  .c-issuer-sub {
    margin: 2.5mm 0 0; font-size: 8pt; letter-spacing: 0.19em;
    text-transform: uppercase; text-indent: 0.19em; color: #4a4f5c;
  }

  /* Centred between the masthead and the foot, so a two-word programme and a
     twelve-word one both sit on a balanced page. */
  .c-body { flex: 1; display: flex; flex-direction: column; justify-content: center; }

  .c-kind {
    margin: 0 0 8mm; font-size: 12.5pt; letter-spacing: 0.42em;
    text-transform: uppercase; text-indent: 0.42em; color: #14161c;
  }

  .c-lead { margin: 0; font-size: 11pt; font-style: italic; color: #3a3f4a; }

  /* The name is the largest thing on the page, and the rule under it is what
     makes the eye read it as an entry on a register rather than a headline. */
  .c-name {
    margin: 4mm auto 3mm; padding: 0 8mm 4mm;
    font-size: 34pt; font-weight: 400; line-height: 1.1;
    border-bottom: 0.8px solid #9aa0ad; display: inline-block; max-width: 200mm;
  }

  .c-programme {
    margin: 4mm 0 0; font-size: 17pt; font-weight: 700; line-height: 1.25;
  }
  .c-detail { margin: 2.5mm 0 0; font-size: 10pt; color: #3a3f4a; }
  .c-grade  { margin: 2mm 0 0; font-size: 10.5pt; color: #14161c; }
  .c-grade strong { letter-spacing: 0.06em; }

  .c-void {
    margin: 5mm auto 0; padding: 2mm 6mm; font-size: 10pt; font-weight: 700;
    letter-spacing: 0.12em; text-transform: uppercase;
    border: 1.2px solid #14161c;
  }

  /* Pushed to the foot of the sheet so the block sits on the same line on
     every certificate, however long the programme title runs. */
  .c-foot {
    margin-top: auto; padding-top: 9mm;
    display: flex; justify-content: space-between; align-items: flex-end; gap: 12mm;
  }
  .c-col { flex: 1; }
  .c-col-mid { flex: 1.15; }
  .c-value {
    margin: 0 0 2mm; padding-bottom: 2.5mm; font-size: 11pt;
    border-bottom: 0.8px solid #14161c;
  }
  .c-sig { font-style: italic; color: #3a3f4a; }
  .c-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10.5pt; letter-spacing: 0.09em; }
  .c-label {
    margin: 0; font-size: 7.5pt; letter-spacing: 0.16em;
    text-transform: uppercase; text-indent: 0.16em; color: #4a4f5c;
  }

  /* The security band. 3pt type, letterspaced, clipped to one line: legible
     under a glass, a grey smear to a photocopier, and unique to this
     certificate because it carries its number. */
  .c-micro {
    margin: 4mm 0 0; height: 1.6mm; overflow: hidden; white-space: nowrap;
    font-size: 3pt; letter-spacing: 0.14em; color: #6b7280; user-select: none;
  }

  .c-verify {
    margin: 3mm 0 0; font-size: 7.5pt; line-height: 1.5; color: #4a4f5c;
  }
  .c-verify strong { color: #14161c; }

  @media print { body { padding: 0; } .noprint { display: none; } }
</style></head><body>${bodyHtml}</body></html>`);
  w.document.close();
  // Let the document lay out before the dialogue freezes it, or the first page
  // prints blank in Safari.
  w.setTimeout(() => { w.focus(); w.print(); }, 250);
  return "Choose “Save as PDF” in the print box";
}

/** Write a real .csv to her Downloads folder. */
export function downloadCsv(filename: string, rows: (string | number)[][]): string {
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // The BOM is what makes Excel read ₹ and Devanagari correctly instead of
  // showing mojibake — the single most common complaint about exported CSVs.
  const csv = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "Saved to your downloads";
}

/** The masthead every printed document carries. */
export function letterhead(title: string, sub: string) {
  return `<p class="brand">WomSakhi</p><h1>${esc(title)}</h1><p class="sub">${esc(sub)}</p>`;
}

export const escapeHtml = esc;

/* ── page setups ────────────────────────────────────────────────────────── */

/** A statement or a receipt: portrait, with room for the binder. */
const PAGE_DOCUMENT = "@page { margin: 18mm; }";

/**
 * A certificate: landscape, and **zero margin on purpose**.
 *
 * Chrome only prints its own header and footer if the page reserves margin for
 * them. With none, they are dropped — which is the difference between a formal
 * document and one with `about:blank` and a timestamp printed across it. The
 * certificate draws its own frame inside instead.
 */
const PAGE_CERTIFICATE = "@page { size: A4 landscape; margin: 0; }";

/* ── the certificate ────────────────────────────────────────────────────── */

export interface CertificateFields {
  /** Whose it is. */
  name: string;
  /** What she completed. */
  programme: string;
  /** When, already in words — "7 August 2026". */
  issued: string;
  /** The number an employer quotes back. */
  code: string;
  /** Hours of instruction, if the issuer recorded them. */
  hours?: number | string;
  /** "Distinction", "Merit", "Pass" — omitted entirely when not awarded. */
  grade?: string;
  /** Set when the record has been withdrawn. */
  revoked?: boolean;
}

/**
 * One certificate template. Every certificate in WomSakhi prints from here.
 *
 * It existed twice before — once on the Certificates screen, once on Learning —
 * and two copies of a legal document is one document too many: they drift, and
 * the day they drift is the day an employer holds two WomSakhi certificates
 * that do not look like each other and believes neither.
 *
 * **The design is deliberately not the app's.** The app is violet, round and
 * friendly; a certificate is read by a bank officer, an employer or a
 * government clerk, and it has to look like the other papers on their desk.
 * So: landscape, a book serif, a double rule, letterspaced capitals, ink on
 * white, and no emblem — the issuer is named in type, the way a degree names a
 * university.
 *
 * Everything except the five values below is fixed. Nothing about the layout
 * responds to the content, because a certificate that reflows around a long
 * name is a certificate that looks forged.
 */
export function certificateHtml(c: CertificateFields): string {
  const grade = c.grade && !/^pass$/i.test(c.grade)
    ? `<p class="c-grade">awarded with <strong>${esc(c.grade)}</strong></p>` : "";
  const hours = c.hours ? `comprising ${esc(String(c.hours))} hours of instruction` : "";

  return `<div class="c-sheet">
  <div class="c-rule-outer"><div class="c-rule-inner">
    <header class="c-head">
      <p class="c-issuer">WomSakhi</p>
      <p class="c-issuer-sub">Livelihood &amp; Skills Programme &middot; India</p>
    </header>

    <p class="c-kind">Certificate of Completion</p>

    <div class="c-body">
      <p class="c-lead">This is to certify that</p>
      <p class="c-name">${esc(c.name)}</p>
      <p class="c-lead">has satisfactorily completed the programme of study in</p>
      <p class="c-programme">${esc(c.programme)}</p>
      ${hours ? `<p class="c-detail">${hours}</p>` : ""}
      ${grade}
      ${c.revoked ? '<p class="c-void">This certificate has been withdrawn and is no longer valid.</p>' : ""}
    </div>

    <div class="c-foot">
      <div class="c-col">
        <p class="c-value">${esc(c.issued)}</p>
        <p class="c-label">Date of issue</p>
      </div>
      <div class="c-col c-col-mid">
        <p class="c-value c-mono">${esc(c.code)}</p>
        <p class="c-label">Certificate number</p>
      </div>
      <div class="c-col">
        <p class="c-value c-sig">Authorised Signatory</p>
        <p class="c-label">for WomSakhi</p>
      </div>
    </div>

    <p class="c-micro" aria-hidden="true">${
      ("WOMSAKHI \u00b7 " + (c.revoked ? "WITHDRAWN" : "AUTHENTIC RECORD")
        + " \u00b7 " + esc(c.code) + " \u00b7 ").repeat(9)
    }</p>

    <p class="c-verify">
      ${c.revoked
        ? `This record has been withdrawn. Checking the certificate number at
           <strong>womsakhi.in/verify</strong> will show it as withdrawn.`
        : `Issued electronically and valid without signature.
           Authenticity may be verified at <strong>womsakhi.in/verify</strong> using the certificate number above.`}
    </p>
  </div></div>
</div>`;
}

/** Print one certificate. The only entry point any screen should use. */
export function printCertificate(c: CertificateFields): string {
  return printDocument(`Certificate — ${c.programme}`, certificateHtml(c), PAGE_CERTIFICATE);
}
