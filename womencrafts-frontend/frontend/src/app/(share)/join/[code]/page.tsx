import type { Metadata } from "next";

import { Btn, Card, EmptyState, IconTile } from "@/components/ux/kit";
import { apiBase } from "@/lib/api-base";
import type { PublicInvite } from "@/lib/share-api";

/**
 * A circle invite, from the link a host shared — `/join/<code>`.
 *
 * The code is the invitation: it lets her into the circle even when it is
 * private. This page shows what she is being asked into — name, purpose, how
 * many women — and sends her through sign-in to `/app/circles/join/<code>`,
 * which joins her. The app used to copy `womsakhi.com/join/<circle id>`, which
 * was a 404.
 */

export const metadata: Metadata = { title: "You are invited to a circle" };
export const dynamic = "force-dynamic";

export default async function JoinCirclePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let c: PublicInvite | null = null;
  try {
    const res = await fetch(`${apiBase()}/public/circles/invite/${encodeURIComponent(code)}`, {
      cache: "no-store", signal: AbortSignal.timeout(6000),
    });
    if (res.ok) c = (await res.json()) as PublicInvite;
  } catch {
    c = null;
  }
  if (!c) {
    return (
      <Card>
        <EmptyState icon="Link2Off" title="This invite has expired"
                    body="Ask the woman who sent it for a new link."
                    action={<Btn href="/signin?next=/app/circles" variant="outline">See circles on WomSakhi</Btn>} />
      </Card>
    );
  }
  const next = `/app/circles/join/${encodeURIComponent(code)}`;
  return (
    <Card>
      <div className="flex flex-col items-center py-3 text-center">
        <IconTile icon={c.is_savings ? "PiggyBank" : "Users"} tint="--ux-tint-pink" ink="--ux-pink-ink" size={64} radius={20} />
        <p className="mt-4 text-2xs font-bold uppercase tracking-[0.12em]" style={{ color: "var(--ux-brand)" }}>You are invited</p>
        <h1 className="mt-1.5 text-2xl font-extrabold leading-tight" style={{ color: "var(--ux-ink)" }}>{c.name}</h1>
        <p className="mt-1 text-xs font-semibold" style={{ color: "var(--ux-muted)" }}>
          {c.member_count} {c.member_count === 1 ? "woman" : "women"} in it
          {c.is_savings && c.monthly_minor ? ` · saves ₹${(c.monthly_minor / 100).toLocaleString("en-IN")} a month each` : ""}
          {c.is_private ? " · private" : ""}
        </p>
        {c.desc && <p className="mt-3 max-w-[46ch] text-sm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{c.desc}</p>}
        <div className="mt-5 w-full max-w-[340px]">
          <Btn href={`/signin?next=${encodeURIComponent(next)}`} variant="primary" full iconEnd="ArrowRight">Join the circle</Btn>
          <p className="mt-2 text-2xs" style={{ color: "var(--ux-faint)" }}>
            Sign in with your mobile number, or join WomSakhi — you come straight back here.
            {c.is_savings ? " Nobody pays anything until the circle has agreed its order." : ""}
          </p>
        </div>
      </div>
    </Card>
  );
}
