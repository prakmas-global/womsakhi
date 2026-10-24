import type { Metadata } from "next";

import { Card } from "@/components/ux/kit";
import * as Icons from "@/components/ux/icons";
import { apiBase } from "@/lib/api-base";

/**
 * "Is this certificate real?" — for an employer or a buyer with no account.
 *
 * A course certificate or a verified skill carries a code; this page checks it
 * against `GET /public/certificates/{code}`. It shows only what that endpoint
 * gives a stranger: her first name, what the certificate is for, the date,
 * and whether it still stands. No member number, no score, no contact.
 */

export const metadata: Metadata = { title: "Check a certificate" };
export const revalidate = 60;

type Checked = { code: string; holder_first: string; programme: string; issued_on: string; valid: boolean };

export default async function VerifyCertificatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let cert: Checked | null = null;
  try {
    const res = await fetch(`${apiBase()}/public/certificates/${encodeURIComponent(code)}`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) cert = (await res.json()) as Checked;
  } catch {
    cert = null;
  }

  if (!cert) {
    return (
      <Card>
        <div className="flex flex-col items-center py-6 text-center">
          <span className="grid h-[60px] w-[60px] place-items-center rounded-full" style={{ background: "var(--ux-tint-amber, #f6efdf)" }}>
            <Icons.SearchX className="h-7 w-7" style={{ color: "var(--ux-amber-ink, #856200)" }} />
          </span>
          <h1 className="mt-4 text-xl font-bold" style={{ color: "var(--ux-ink)" }}>No certificate has this number</h1>
          <p className="mt-2 max-w-[42ch] text-sm leading-relaxed" style={{ color: "var(--ux-muted)" }}>
            Check the code <b>{code.toUpperCase()}</b> letter by letter. WomSakhi never issued a certificate with it.
          </p>
        </div>
      </Card>
    );
  }

  const skill = cert.programme.startsWith("Verified skill");
  return (
    <Card>
      <div className="flex flex-col items-center py-6 text-center">
        <span className="grid h-[64px] w-[64px] place-items-center rounded-full"
              style={{ background: cert.valid ? "var(--ux-tint-green, #e8f4ec)" : "var(--ux-danger-soft, #fbe9e7)" }}>
          {cert.valid
            ? <Icons.BadgeCheck className="h-8 w-8" style={{ color: "var(--ux-green-ink, #007d38)" }} />
            : <Icons.X className="h-8 w-8" style={{ color: "var(--ux-danger-ink, #b3261e)" }} />}
        </span>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--ux-faint)" }}>
          WomSakhi {skill ? "verified skill" : "certificate"} · {cert.code}
        </p>
        <h1 className="mt-1.5 text-xl font-bold" style={{ color: "var(--ux-ink)" }}>
          {cert.valid ? "This certificate is real" : "This certificate was withdrawn"}
        </h1>
        <p className="mt-3 max-w-[44ch] text-sm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
          {cert.holder_first ? <b>{cert.holder_first}</b> : "This member"}{" "}
          {skill ? "passed WomSakhi's skill test for" : "completed"} <b>{cert.programme.replace(/^Verified skill: (?:[^—]+ — )?/, "")}</b>
          {cert.issued_on ? <> on {cert.issued_on}</> : null}.
        </p>
        {!cert.valid && (
          <p className="mt-2 text-xs" style={{ color: "var(--ux-danger-ink, #b3261e)" }}>It no longer stands. Do not rely on it.</p>
        )}
      </div>
    </Card>
  );
}
