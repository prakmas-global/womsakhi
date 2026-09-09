"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import * as Icons from "@/components/ux/icons";
import { Btn, I, IconTile, Rating, Sheet, v } from "@/components/ux/kit";
import { QUOTE_ASK, type QuoteDraft } from "@/components/ux/earn/data";

import { Area, Check, Label, Text } from "./wizard-views";

/**
 * The other side of "let buyers ask for a price".
 *
 * ── Why the seller sees her own buyer's form ────────────────────────────────
 * She is being asked to choose what to demand of a stranger before that
 * stranger has committed to anything. That is a judgement she cannot make from
 * a list of checkbox labels — she has to see the wall of questions she is
 * putting in front of someone who might have bought. So the wizard's "Ask for
 * a price" preview is not a picture of a button; it opens the real form, with
 * her own choices already applied, and she can feel how long it is.
 *
 * ── Nothing is sent ─────────────────────────────────────────────────────────
 * There is no quote endpoint yet. "Send request" carries the draft to the
 * confirmation screen and no further, and the screen says so.
 */

export function QuoteSheet({ open, onClose, listing, ask, message, respondIn }: {
  open: boolean;
  onClose: () => void;
  /** Title and photo of the thing being priced, as far as she has typed it. */
  listing: { title: string; photo?: string; seller: string };
  /** Ids from `QUOTE_FIELDS` she has switched on. */
  ask: string[];
  /** The line she wrote to greet a buyer with. */
  message?: string;
  respondIn?: string;
}) {
  const router = useRouter();

  const [needs, setNeeds] = useState("");
  const [qty, setQty] = useState("");
  const [budgetLow, setBudgetLow] = useState("");
  const [budgetHigh, setBudgetHigh] = useState("");
  const [by, setBy] = useState("");
  const [place, setPlace] = useState("");
  const [extras, setExtras] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [remember, setRemember] = useState(true);

  const wants = useMemo(() => new Set(ask), [ask]);

  /** She cannot send until every field the seller marked required is answered. */
  const ready = (!wants.has("needs") || needs.trim().length > 0)
             && (!wants.has("where") || place.trim().length > 0);

  const send = () => {
    const draft: QuoteDraft = {
      title: listing.title || "Your listing",
      photo: listing.photo,
      seller: listing.seller,
      needs, quantity: qty, budgetLow, budgetHigh, by, place,
      extras, name, email, phone,
    };
    try { sessionStorage.setItem("ws.quote.draft", JSON.stringify(draft)); }
    catch { /* private window — the confirmation falls back to its own example */ }
    onClose();
    router.push("/app/documents/new/sent");
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      icon="FileText"
      width={480}
      title="Request a quote"
      description={`Share your requirements and get a price from ${listing.seller}.`}
      footer={
        <>
          <div className="flex items-center justify-end gap-2.5">
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
            <Btn icon="Send" onClick={send} disabled={!ready}>Send request</Btn>
          </div>
          <p className="mt-2.5 flex items-center justify-center gap-1.5 text-2xs"
             style={{ color: v("--ux-muted") }}>
            <Icons.ShieldCheck className="h-[13px] w-[13px]" style={{ color: v("--ux-green-ink") }} />
            Your details go to the seller and nobody else.
          </p>
        </>
      }
    >
      {/* What is being priced */}
      <div className="flex items-center gap-3 rounded-[14px] p-3"
           style={{ border: "1px solid var(--ux-line)" }}>
        {listing.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.photo} alt="" aria-hidden loading="lazy" decoding="async"
               className="h-[58px] w-[58px] shrink-0 rounded-[11px] object-cover"
               style={{ background: v("--ux-media-bed") }} />
        ) : (
          <IconTile icon="Package" tint="--ux-tint-pink" ink="--ux-pink-ink" size={58} radius={11} />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xsm font-bold" style={{ color: v("--ux-ink") }}>
            {listing.title || "Your listing"}
          </p>
          <p className="mt-0.5 truncate text-xs" style={{ color: v("--ux-muted") }}>By {listing.seller}</p>
          <span className="mt-1 block">
            <Rating value="4.7" count="3 reviews" />
          </span>
        </div>
      </div>

      {/* Her own greeting, where a buyer would read it */}
      <div className="mt-3 flex items-start gap-2.5 rounded-[12px] p-3.5"
           style={{ background: v("--ux-brand-tint") }}>
        <I name="Gift" className="mt-[1px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-brand") }} />
        <span className="min-w-0">
          <span className="block text-xs font-bold" style={{ color: v("--ux-brand") }}>
            Get a price for exactly what you need
          </span>
          <span className="mt-0.5 block text-2xs leading-relaxed" style={{ color: v("--ux-ink-2") }}>
            {message?.trim()
              || `Tell ${listing.seller} what you need below. She will look at it and send you a price${
                   respondIn ? ` — usually ${respondIn.toLowerCase()}` : ""}.`}
          </span>
        </span>
      </div>

      <Numbered n={1} title="Your requirements" />

      {wants.has("needs") && (
        <div className="mb-4">
          <Label need>What do you need?</Label>
          <Area value={needs} onChange={setNeeds} max={500} rows={4} label="What do you need"
                placeholder="e.g. 20 kurtas for my boutique. Please share pricing, available designs and delivery timeline." />
        </div>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label need>How many</Label>
          <Text value={qty} onChange={setQty} type="number" label="Quantity" placeholder="e.g. 20" />
        </div>
        {wants.has("when") && (
          <div>
            <Label hint="(optional)">When you need it by</Label>
            <Text value={by} onChange={setBy} type="date" label="Preferred delivery date" />
          </div>
        )}
      </div>

      {wants.has("budget") && (
        <div className="mb-4">
          <Label hint="(optional)">What you can spend</Label>
          <div className="flex items-center gap-2.5">
            <Text value={budgetLow} onChange={setBudgetLow} type="number"
                  prefix="₹" label="Lowest you can spend" placeholder="1,000" />
            <span className="shrink-0 text-xs" style={{ color: v("--ux-faint") }}>to</span>
            <Text value={budgetHigh} onChange={setBudgetHigh} type="number"
                  prefix="₹" label="Most you can spend" placeholder="2,500" />
          </div>
        </div>
      )}

      {wants.has("where") && (
        <div className="mb-4">
          <Label need>Where it has to reach</Label>
          <Text value={place} onChange={setPlace} label="Delivery location"
                placeholder="City or pincode" />
        </div>
      )}

      <Numbered n={2} title="Anything else" hint="(optional)" />
      <div className="mb-4">
        {QUOTE_ASK.map((x) => (
          <Check key={x} label={x} on={extras.includes(x)}
                 onChange={() => setExtras((p) => p.includes(x) ? p.filter((y) => y !== x) : [...p, x])} />
        ))}
      </div>

      <Numbered n={3} title="Pictures of what you want" hint="(optional)" />
      <label className="mb-4 flex cursor-pointer flex-col items-center gap-1 rounded-[14px] px-4 py-6 text-center"
             style={{ border: "1.5px dashed var(--ux-brand)", background: v("--ux-brand-tint") }}>
        <input type="file" accept="image/*,application/pdf" multiple className="sr-only"
               aria-label="Pictures of what you want" />
        <Icons.Upload className="h-[19px] w-[19px]" style={{ color: v("--ux-brand") }} />
        <span className="text-xs font-bold" style={{ color: v("--ux-brand") }}>
          Add a photo of what you have in mind
        </span>
        <span className="text-2xs" style={{ color: v("--ux-muted") }}>
          JPG, PNG or PDF — up to 5 files, 10MB each
        </span>
      </label>

      <Numbered n={4} title="How she can reach you" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Your name</Label>
          <Text value={name} onChange={setName} label="Your name" placeholder="Priya" />
        </div>
        <div>
          <Label>Phone</Label>
          <Text value={phone} onChange={setPhone} type="tel" label="Phone" placeholder="+91 98765 43210" />
        </div>
        <div className="sm:col-span-2">
          <Label hint="(optional)">Email</Label>
          <Text value={email} onChange={setEmail} type="email" label="Email" placeholder="priya@email.com" />
        </div>
      </div>
      <div className="mt-1.5">
        <Check on={remember} onChange={setRemember} label="Remember these for next time" />
      </div>
    </Sheet>
  );
}

/**
 * A numbered section heading.
 *
 * The numbers are real: this form is filled from the top down, and a buyer who
 * abandons it half way has abandoned it at a number the seller can name.
 */
function Numbered({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="mb-2.5 mt-5 flex items-center gap-2.5">
      <span className="grid h-[24px] w-[24px] shrink-0 place-items-center rounded-full text-2xs font-extrabold"
            style={{ background: v("--ux-fill"), color: v("--ux-on-brand") }}>
        {n}
      </span>
      <h3 className="text-xsm font-extrabold" style={{ color: v("--ux-ink") }}>
        {title}
        {hint && <span className="ms-1.5 font-semibold" style={{ color: v("--ux-muted") }}>{hint}</span>}
      </h3>
    </div>
  );
}
