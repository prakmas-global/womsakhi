"use client";

import { use, useCallback, useEffect, useState } from "react";

import { Btn, Card, EmptyState, I, formatRupees, v } from "@/components/ux/kit";
import { fetchPublicListing, type PublicListing } from "@/lib/public-api";

/**
 * One thing she sells, on the open web.
 *
 * ── Why this route exists ───────────────────────────────────────────────────
 * "Share" on a listing in My Shop copied `<origin>/shop/<id>` and told her
 * *"Link copied — send it on WhatsApp"*. `curl` on one of those returned **404**:
 * the route did not exist. Five buttons, each one putting a dead link into a
 * customer's chat under her name, after telling her it had worked. A broken
 * link that a seller sent herself is the worst version of this bug, because she
 * finds out from the buyer.
 *
 * The per-listing part was already right — each button targeted its own
 * listing. Only the destination was missing, so this is the destination rather
 * than a change to the button.
 *
 * ── Why not `/s/[handle]` ───────────────────────────────────────────────────
 * That route already exists and serves her whole shop — but it is served from
 * `shopFrom()`, which answers for exactly one hardcoded handle
 * (`priya-tailoring`) and `null` for everybody else. Pointing the share at it
 * would have swapped a 404 for "This shop is not here", which is not better.
 * This one reads `GET /public/listings/{id}`, so it works for every woman and
 * every listing.
 *
 * ── What a buyer is shown, and what she is not ──────────────────────────────
 * The thing, its price, whether it can be had today, and the seller's first
 * name. No phone number, no email, no address — the server does not send them.
 * The buyer already has a way to reach her: this link arrived in a chat.
 */
export default function OpenListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [row, setRow] = useState<PublicListing | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "gone">("loading");

  useEffect(() => {
    let alive = true;
    fetchPublicListing(id)
      .then((got) => {
        if (!alive) return;
        setRow(got);
        setState(got ? "ready" : "gone");
      })
      .catch(() => { if (alive) setState("gone"); });
    return () => { alive = false; };
  }, [id]);

  /**
   * Hand off to the chat this link arrived in.
   *
   * `wa.me` with no number opens WhatsApp's own contact picker, which is right:
   * the platform does not hold her phone number for this page and must not
   * publish it. The buyer picks the conversation she already has with her —
   * the same pattern `/s/[handle]` uses.
   */
  const ask = useCallback(() => {
    if (!row) return;
    const who = row.seller_first ? `Hello ${row.seller_first}, ` : "Hello, ";
    const text = `${who}I saw "${row.title}" on your WomSakhi page and wanted to ask about it.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }, [row]);

  if (state === "loading") {
    return (
      <Card>
        <div className="ux-skeleton h-[180px] w-full rounded-[14px]" />
        <div className="ux-skeleton mt-4 h-[22px] w-2/3 rounded-[8px]" />
        <div className="ux-skeleton mt-2.5 h-[16px] w-1/3 rounded-[8px]" />
      </Card>
    );
  }

  if (state === "gone" || !row) {
    return (
      <Card>
        <EmptyState
          icon="SearchX"
          title="This is not here any more"
          body="She may have sold it or taken it down. Ask her for what she has now — the link she sent you before will still reach her."
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card pad={0} style={{ overflow: "hidden" }}>
        {row.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.photo} alt={row.title}
               className="block max-h-[320px] w-full object-cover" />
        ) : (
          <div className="grid h-[160px] w-full place-items-center"
               style={{ background: v("--ux-surface-2"), color: v("--ux-faint") }}>
            <I name={row.kind === "service" ? "Sparkles" : "Package"} className="h-[30px] w-[30px]" />
          </div>
        )}

        <div className="px-5 pb-5 pt-4">
          {/* Not `Pill`: it is `text-2xs`, which is 11px, and this page is read
              on a phone by someone who was sent a link. 12px is the floor. */}
          <div className="flex flex-wrap items-center gap-2">
            {[row.kind === "service" ? "A service" : "Handmade", row.category]
              .filter(Boolean)
              .map((label) => (
                <span key={label}
                      className="inline-flex items-center rounded-full px-2.5 py-[3px] text-[12px] font-semibold lg:text-2xs"
                      style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
                  {label}
                </span>
              ))}
          </div>

          <h1 className="mt-3 text-2xl font-extrabold leading-tight tracking-[-0.03em]"
              style={{ color: v("--ux-ink") }}>
            {row.title}
          </h1>

          {/* Minor units in, rupees out. Never a local formatter — that bug has
              shipped twice in this codebase and rendered 100x the real price. */}
          <p className="mt-2 text-xl font-extrabold" style={{ color: v("--ux-ink") }}>
            {formatRupees(row.price_minor)}
            {row.rate && (
              <span className="ms-1.5 text-xsm font-semibold" style={{ color: v("--ux-muted") }}>
                {row.rate}
              </span>
            )}
          </p>

          {/* Stock, said plainly. A "Buy" button here would be a lie — nothing
              on this page takes money; she and the buyer settle it between
              themselves, which is how these sales already happen. */}
          {row.kind === "product" && row.out_of_stock && (
            <p className="mt-2 text-xsm font-bold" style={{ color: v("--ux-amber-ink") }}>
              Sold out just now — ask her when the next lot is ready
            </p>
          )}
          {row.kind === "product" && row.low_stock && !row.out_of_stock && (
            <p className="mt-2 text-xsm font-bold" style={{ color: v("--ux-amber-ink") }}>
              Only a few left
            </p>
          )}

          {row.desc && (
            <p className="mt-3 text-sm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              {row.desc}
            </p>
          )}

          {(row.seller_first || row.place) && (
            <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold"
               style={{ color: v("--ux-muted") }}>
              {row.seller_first && (
                <span className="inline-flex items-center gap-1.5">
                  <I name="UserRound" className="h-[13px] w-[13px]" sw={2.4} />
                  Made by {row.seller_first}
                </span>
              )}
              {row.place && (
                <span className="inline-flex items-center gap-1.5">
                  <I name="MapPin" className="h-[13px] w-[13px]" sw={2.4} />
                  {row.place}
                </span>
              )}
            </p>
          )}
        </div>

        <div className="border-t px-5 py-3.5" style={{ borderColor: v("--ux-line") }}>
          <Btn icon="MessageCircle" full onClick={ask}>
            {row.seller_first ? `Message ${row.seller_first}` : "Message her"}
          </Btn>
        </div>
      </Card>
    </div>
  );
}
