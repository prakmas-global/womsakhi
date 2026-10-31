"use client";

import { PlaceMark } from "@/components/ux/nav/Place";
import { artFor } from "@/components/ux/media/art";
import { useCallback, useMemo, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { SectionLabel, Tag } from "@/components/ux/work/native";
import { Btn, Card, EmptyState, I, Skeleton, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import { apiApply, apiOpportunities, type Opportunity } from "@/lib/growth-api";
import { useAction } from "@/lib/use-action";
import { useResource } from "@/lib/use-resource";
import { useT } from "@/i18n";
import { apiMyWorkProfile, type WorkProfile } from "@/lib/work-api";

/** Bulk product requests. Nearby is an explicit town/area match, not GPS distance. */
export default function ContractsPage() {
  const tr = useT();

  const profile = useResource<WorkProfile|null>(useCallback(sig=>apiMyWorkProfile(sig),[]),null);
  const [cityDraft,setCityDraft]=useState<string|null>(null);
  const [areaDraft,setAreaDraft]=useState("");
  const [chosen,setChosen]=useState<{city:string;area:string}|null>(null);
  const city=chosen?.city ?? profile.data?.city ?? "";
  const area=chosen?.area ?? "";
  const { data: orders, source, error, refetch } = useResource<Opportunity[]>(
    useCallback((sig: AbortSignal) => city.trim() ? apiOpportunities(sig, { kind: "Craft order",city:city.trim(),area:area.trim() }) : Promise.resolve([]), [city,area]),
    [],
  );

  const [note, setNote] = useState<string | null>(null);

  /**
   * Apply, for real.
   *
   * `onDone: refetch` so the screen ends on server truth — `applied` comes back
   * `true` and the button changes because the database changed, not because a
   * local array did. The note is set only after the server has agreed.
   */
  const apply = useAction(
    async (id: string) => {
      await apiApply(id, "");
      const o = orders.find((x) => x.id === id);
      setNote(
        o && o.openings > 1
          ? `Your application is in for ${o.title}. ${o.org} sees it now, and you can follow it in Your applications.`
          : "Your application is in. You can follow it in Your applications.",
      );
    },
    {
      onDone: refetch,
      fallbackError: "That did not go through. You have NOT applied — try again in a moment.",
    },
  );

  const today = useMemo(() => new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Kolkata"}), []);
  const open = useMemo(
    () => orders.filter((o) => o.status === "open" && (!o.deadline || o.deadline >= today)),
    [orders, today],
  );
  const closed = useMemo(
    () => orders.filter((o) => !(o.status === "open" && (!o.deadline || o.deadline >= today))),
    [orders, today],
  );

  return (
    <HomeShell active="/app/contracts">
      <div className="flex flex-col gap-6 lg:gap-5">

        <header>
          <p className="text-[12px] font-extrabold uppercase tracking-[0.2em] lg:text-2xs" style={{ color: v("--ux-brand") }}>{tr("contracts.bigOrders")}</p>
          <div className="mt-1 lg:mt-2 flex min-w-0 items-center gap-3">
            <PlaceMark size={44} />
            <h1 className="ux-screen-title text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em] min-w-0"
                style={{ color: v("--ux-ink") }}>{tr("contracts.ordersTooBigForOneWoman")}</h1>
          </div>
          <p className="mt-2 max-w-[58ch] text-[15px] leading-snug lg:mt-1.5 lg:text-sm lg:leading-relaxed" style={{ color: v("--ux-muted") }}>
            One buyer wants hundreds of pieces, and several of you make them between you. Everything
            below is a buyer’s request for products, not a job vacancy. Apply to discuss your share;
            the buyer chooses the makers and agrees the work before it starts.
          </p>
        </header>

        <div className="flex flex-wrap gap-2">
          <Btn href="/app/work/post?kind=Craft%20order" icon="Plus">Post a big order</Btn>
          <Btn href="/app/work/posts" variant="outline" icon="ClipboardList">My posts & applicants</Btn>
          <Btn href="/app/applications" variant="ghost">My applications</Btn>
        </div>
        <Card>
          <h2 className="text-base font-bold">Orders near you</h2>
          <p className="mt-1 text-sm" style={{color:v("--ux-muted")}}>Starts with the town in your work profile. Choose an area to narrow it down. This matches place names, not kilometre distance; orders without a matching location stay out.</p>
          <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={event=>{event.preventDefault();setChosen({city:(cityDraft??city).trim(),area:areaDraft.trim()});}}>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-semibold">Town or city<input aria-label="Nearby town or city" required maxLength={80} value={cityDraft??city} onChange={e=>setCityDraft(e.target.value)} placeholder="e.g. Hyderabad" className="min-h-[44px] min-w-0 rounded-xl border px-3" style={{background:v("--ux-surface"),borderColor:v("--ux-line-strong"),color:v("--ux-ink")}}/></label>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-semibold">Area (optional)<input aria-label="Nearby area" maxLength={80} value={areaDraft} onChange={e=>setAreaDraft(e.target.value)} placeholder="e.g. Kukatpally" className="min-h-[44px] min-w-0 rounded-xl border px-3" style={{background:v("--ux-surface"),borderColor:v("--ux-line-strong"),color:v("--ux-ink")}}/></label>
            <button type="submit" className="min-h-[44px] rounded-xl px-4 text-sm font-bold" style={{background:v("--ux-fill"),color:"white"}}>Show nearby orders</button>
          </form>
          <p className="mt-3 text-sm" role="status">{city.trim()?`Showing ${area?`${area}, `:""}${city} only.`:"Choose your town to see nearby orders."}</p>
          {profile.error&&<p className="mt-2 text-sm" role="alert">Your work-profile town could not load. Enter it above or <button onClick={()=>profile.refetch()} className="underline">try again</button>.</p>}
        </Card>

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}

        {apply.error && (
          <Card pad={16} style={{ background: v("--ux-danger-tint"), borderColor: "transparent" }}>
            <p role="alert" className="flex items-start gap-2 text-xsm font-semibold" style={{ color: v("--ux-ink") }}>
              <I name="AlertTriangle" className="mt-[2px] h-[16px] w-[16px] shrink-0" />{apply.error}
            </p>
          </Card>
        )}

        {/*
          A failed read says so. `useResource` hands back the fallback — an
          empty array here, deliberately, because a fixture row on this screen
          is the bug that was just removed — so without this she would read an
          empty board as "there is no work", which is a different lie.
        */}
        {error && (
          <Card pad={16} style={{ background: v("--ux-tint-amber"), borderColor: "transparent" }}>
            <p role="status" className="flex items-start gap-2 text-xsm leading-relaxed" style={{ color: v("--ux-amber-ink") }}>
              <I name="Info" className="mt-[2px] h-[16px] w-[16px] shrink-0" />
              We could not reach WomSakhi just now, so this list is not showing. It is not empty —
              try again in a moment.
            </p>
          </Card>
        )}

        <div>
          <SectionLabel title={tr("contracts.openRightNow")} sub={tr("contracts.placedByABuyerStillTaking")}
                        icon="Briefcase" chip={source === "loading" ? undefined : String(open.length)} />

          {source === "loading" ? (
            <div className="flex flex-col gap-4">
              {[0, 1].map((i) => (
                <Card key={i} pad={18}>
                  <Skeleton w="62%" h={19} />
                  <Skeleton w="38%" h={13} className="mt-3" />
                  <Skeleton w="100%" h={40} className="mt-4" r={12} />
                </Card>
              ))}
            </div>
          ) : open.length === 0 && !error ? (
            <EmptyState
              icon="Briefcase"
              title={city.trim()?"No open orders in this location":"Choose a town to get started"}
              body="Try another area in your town, check back later, or post an order you need help making."
              action={<Btn href="/app/opportunities" icon="Search">{tr("contracts.seeAllTheWork")}</Btn>}
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {open.map((o) => (
                <OrderCard key={o.id} o={o} closed={false}
                           busy={apply.busyWith === o.id}
                           onApply={() => apply.run(o.id)} />
              ))}
            </div>
          )}
        </div>

        {closed.length > 0 && (
          <div>
            <SectionLabel title="Closed" sub={tr("contracts.keptHereSoYouCanSee")}
                          icon="Archive" chip={String(closed.length)} />
            <div className="grid gap-4 lg:grid-cols-2">
              {closed.map((o) => (
                <OrderCard key={o.id} o={o} closed onApply={() => {}} busy={false} />
              ))}
            </div>
          </div>
        )}

        {/*
          Guidance, not a claim about her. This was a tick-list with `done`
          flags baked into a fixture — it told a woman her business was
          registered and her bank account was in the business name, having never
          asked her either question. Nothing here records anything about her, so
          nothing here ticks.
        */}
        <div>
          <SectionLabel title={tr("contracts.whatBuyersAskFor")}
                        sub={tr("contracts.theThingsThatActuallyLoseBids")} icon="ClipboardCheck" />
          <Card pad={0} style={{ overflow: "hidden" }}>
            {READINESS.map((r, i) => (
              <div key={r.what} className="flex items-start gap-3 px-4 py-4 lg:gap-3.5 lg:px-5"
                   style={{ borderTop: i === 0 ? "none" : `1px solid ${v("--ux-line")}` }}>
                <I name="Dot" className="mt-[3px] h-[18px] w-[18px] shrink-0"
                   style={{ color: v("--ux-line-strong") }} sw={2.2} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{r.what}</p>
                  <p className="mt-0.5 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>{r.why}</p>
                </div>
                {r.cost && (
                  <span className="shrink-0 text-xsm font-bold" style={{ color: v("--ux-ink-2") }}>
                    {r.cost}
                  </span>
                )}
              </div>
            ))}
          </Card>
          <p className="mt-2 px-4 text-xs leading-relaxed lg:px-1" style={{ color: v("--ux-muted") }}>
            We do not yet keep a record of which of these you have. Nothing above is ticked because
            nothing above has been asked of you.
          </p>
        </div>

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Info" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              We do not lend you the cloth money and we do not buy your invoice — both of those turn
              a good month into a debt. The buyer pays you directly; no money for these orders passes
              through WomSakhi, and we are not a party to what you agree with them.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}

/** What buyers ask a small supplier for. General guidance, not her record. */
const READINESS: { what: string; why: string; cost?: string }[] = [
  { what: "Business registered", why: "Udyam. Free, and online" },
  { what: "Bank account in the business name", why: "Buyers will not pay a personal account" },
  { what: "Proof you can make the quantity", why: "The thing that loses most bids" },
  { what: "Basic insurance", why: "Bigger buyers ask for it", cost: "around ₹2,000/yr" },
  { what: "GST, if you cross the limit", why: "Only if you have to. Do not register early" },
];

/** "piece" → "per piece". Empty when the listing did not say. */
function perWhat(period: string): string {
  return period ? ` per ${period}` : "";
}

/**
 * The one-line facts under the title — only the ones the server actually sent.
 *
 * Built by pushing rather than by filtering a list of nullables, so nothing
 * here needs a non-null assertion to convince the compiler of something it
 * cannot check.
 */
function factsOf(o: Opportunity, closed: boolean): { icon: string; text: string }[] {
  const out: { icon: string; text: string }[] = [
    { icon: "Users", text: `${o.applicant_count} applied so far` },
  ];
  if (o.deadline_label) {
    out.push({
      icon: "CalendarClock",
      text: closed ? `Closed ${o.deadline_label}` : `Apply by ${o.deadline_label}`,
    });
  }
  if (o.experience) out.push({ icon: "Wrench", text: o.experience });
  if (o.mode) out.push({ icon: "MapPin", text: o.mode });
  return out;
}

/**
 * One real bulk order.
 *
 * Every figure on this card is a field the server sent. There is no derived
 * money here at all: no total, no materials estimate, no per-woman share — the
 * server knows none of those, and the previous version of this card computed
 * all three.
 */
function OrderCard({ o, closed, busy, onApply }: {
  o: Opportunity; closed: boolean; busy: boolean; onApply: () => void;
}) {
  const tr = useT();
  const [terms, setTerms] = useState(false);

  // Minor units, straight from the server. `pay_low_minor` is paise — ₹180 per
  // piece is 18000 — and `formatRupees` is the only thing in this codebase that
  // divides by 100.
  const band = o.pay_high_minor > o.pay_low_minor
    ? `${formatRupees(o.pay_low_minor)} – ${formatRupees(o.pay_high_minor)}`
    : formatRupees(o.pay_low_minor);
  const hasPay = o.pay_low_minor > 0;

  return (
    <Card pad={0} style={{ overflow: "hidden", opacity: closed ? 0.72 : 1 }}>
      {/* The work itself, big — what the order is, before a word of it. */}
      <div className="relative h-[170px] w-full overflow-hidden sm:h-[200px]" style={{ background: v("--ux-surface-2") }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={artFor([o.title, o.skills.join(" "), o.desc], "product", undefined, o.id)} alt={o.title}
             loading="lazy" decoding="async" className="h-full w-full object-cover"
             style={{ filter: closed ? "grayscale(.85)" : undefined }} />
        <span aria-hidden className="absolute inset-0"
              style={{ background: "linear-gradient(180deg, rgba(16,6,24,.12), rgba(16,6,24,0) 40%, rgba(16,6,24,.55))" }} />
        <span className="absolute start-3 top-3 rounded-full px-2.5 py-1 text-2xs font-bold shadow-sm"
              style={{ background: "rgba(255,255,255,.92)", color: "#2a1a24" }}>
          {o.openings > 1 ? `${o.openings} women needed` : "One woman"}
        </span>
        {(o.applied || closed) && (
          <span className="absolute end-3 top-3 rounded-full px-2.5 py-1 text-2xs font-bold shadow-sm"
                style={closed ? { background: "rgba(24,10,34,.8)", color: "#fff" } : { background: "#0f7a43", color: "#fff" }}>
            {closed ? "Closed" : "You applied"}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-start gap-4 px-4 pt-4 lg:px-5 lg:pt-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-extrabold leading-tight tracking-[-0.02em]" style={{ color: v("--ux-ink") }}>
              {o.title}
            </p>
            {o.applied && <Tag tone="green" size="sm">{tr("contracts.youApplied")}</Tag>}
            {closed && <Tag tone="neutral" size="sm">Closed</Tag>}
          </div>
          <p className="mt-1 text-xsm" style={{ color: v("--ux-muted") }}>
            {o.org}
            {o.openings > 1 ? ` · ${o.openings} women needed` : " · one woman"}
            {o.location ? ` · ${o.location}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-end">
          {hasPay ? (
            <>
              <p className="text-xl font-extrabold leading-none tabular-nums" style={{ color: v("--ux-ink") }}>
                {band}
              </p>
              <p className="mt-1 text-2xs" style={{ color: v("--ux-muted") }}>
                {perWhat(o.pay_period).trim() || "as agreed"}
              </p>
            </>
          ) : (
            <p className="text-sm font-bold" style={{ color: v("--ux-muted") }}>
              {o.pay || "Pay not stated"}
            </p>
          )}
        </div>
      </div>

      {/* The facts the server holds, said plainly. Nothing drawn to scale. */}
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 px-4 lg:px-5">
        {factsOf(o, closed).map((f) => (
          <span key={f.text} className="flex items-center gap-1.5 text-[13px] lg:text-xs" style={{ color: v("--ux-ink-2") }}>
            <I name={f.icon} className="h-[13px] w-[13px] shrink-0" style={{ color: v("--ux-muted") }} />
            {f.text}
          </span>
        ))}
      </div>

      {o.order_details && <dl className="mx-4 mt-4 grid gap-3 rounded-xl p-4 text-sm lg:mx-5" style={{background:v("--ux-surface-2")}}>
        <div><dt className="font-semibold">Quantity & delivery</dt><dd>{o.order_details.quantity.toLocaleString("en-IN")} {o.order_details.unit} · by {new Date(`${o.order_details.delivery_date}T12:00:00`).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</dd></div>
        <div><dt className="font-semibold">Materials</dt><dd>{o.order_details.materials}</dd></div>
        <div><dt className="font-semibold">Payment terms</dt><dd>{o.order_details.payment_terms}</dd></div>
      </dl>}

      {o.skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 px-4 lg:px-5">
          {o.skills.map((s) => <Tag key={s} tone="brand" size="sm">{s}</Tag>)}
        </div>
      )}

      {/*
        The buyer's own words about the work and the money, quoted rather than
        parsed. "Payment within 7 days of delivery" is a sentence a buyer wrote;
        turning it into a bar chart means guessing, and the guess was wrong.
      */}
      {terms && (
        <div className="mx-4 mt-4 rounded-[12px] p-4 lg:mx-5" style={{ background: v("--ux-surface-2") }}>
          <p className="text-[12px] font-extrabold uppercase lg:text-2xs tracking-[0.14em]" style={{ color: v("--ux-muted") }}>
            {tr("contracts.whatTheBuyerSays")}
          </p>
          <p className="mt-2 whitespace-pre-line text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
            {o.desc || "This buyer wrote no description."}
          </p>
          {o.contact_note && (
            <p className="mt-3 border-t pt-3 text-xs leading-relaxed"
               style={{ borderColor: v("--ux-line"), color: v("--ux-muted") }}>
              {o.contact_note}
            </p>
          )}
          <p className="mt-3 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>
            When the buyer pays, and what happens if a piece comes back, is between you and them.
            WomSakhi holds none of this money and is not a party to it. Ask for the payment terms in
            writing before you buy any material.
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 border-t px-4 py-4 lg:flex-row lg:flex-wrap lg:px-5" style={{ borderColor: v("--ux-line") }}>
        {o.is_mine ? <Btn href={`/app/work/posts?job=${o.id}`} icon="Users">Manage applicants</Btn> : o.applied ? (
          <Btn className="ux-action-primary" variant="outline" icon="Check" href="/app/applications">
            {tr("contracts.youAppliedSeeIt")}
          </Btn>
        ) : closed ? (
          <Btn className="ux-action-primary" disabled icon="Lock">
            {tr("work.closed")}
          </Btn>
        ) : (
          <Btn className="ux-action-primary" loading={busy} disabled={busy} onClick={onApply}>
            {o.openings > 1 ? "Apply to join this order" : "Apply for this"}
          </Btn>
        )}
        <Btn className="ux-action-primary" variant="ghost" icon="FileText" onClick={() => setTerms(!terms)}>
          {terms ? tr("contracts.hideTheTerms") : tr("contracts.readTheFullTerms")}
        </Btn>
        {o.openings > 1 && (
          <Btn className="ux-action-primary" variant="ghost" icon="FileSignature" href="/app/contracts/together">
            {tr("contracts.whoSignsIt")}
          </Btn>
        )}
      </div>
    </Card>
  );
}
