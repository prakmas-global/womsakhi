"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Eye, EyeOff, KeyRound, MessageSquareWarning, Package, Search } from "lucide-react";

import { Badge, Card, ErrorState, NoResults, SkeletonTable, StatCard, Tabs, useToast } from "@/design-system";
import type { Tone } from "@/design-system/primitives/Badge";
import { useAuth } from "@/context/AuthContext";
import ReasonModal from "@/components/admin/community/ReasonModal";
import { formatMoney } from "@/components/ux/kit/money";
import { apiMarketPermissions, shortDate, type MarketAction } from "@/lib/market-admin-api";
import { memberError } from "@/lib/member-api";
import {
  apiAdminHideRental, apiAdminRentalBookings, apiAdminRentalItems, apiAdminSettleRental,
  type AdminRentalBooking, type AdminRentalItem,
} from "@/lib/rentals-admin-api";

/**
 * Rent & borrow, for staff.
 *
 * Two jobs. Problems: a renter or owner raised one (a deduction she thinks
 * unfair, a deposit not returned, damage she says was there before) — read
 * the history and both sets of photos' notes, then write the answer; both
 * women are notified with it. WomSakhi holds no money, so the answer is
 * the settlement. Listings: hide one that should not be on the board,
 * with a reason the owner is told.
 */

type Tab = "problems" | "bookings" | "listings";
type Dialog = { kind: "hide" | "show"; item: AdminRentalItem } | { kind: "settle"; booking: AdminRentalBooking } | null;

const STATUS_TONE: Record<string, Tone> = {
  requested: "sky", accepted: "violet", active: "brand", returned: "amber", closed: "emerald",
  declined: "slate", cancelled: "slate", expired: "slate",
};

export default function RentalsAdminPage() {
  const { isSuperAdmin } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("problems");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [items, setItems] = useState<AdminRentalItem[]>([]);
  const [bookings, setBookings] = useState<AdminRentalBooking[]>([]);
  const [perms, setPerms] = useState<Set<MarketAction>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const latest = useRef(0);

  const load = useCallback(async () => {
    const n = ++latest.current;
    try {
      const [it, bk] = await Promise.all([apiAdminRentalItems(term), apiAdminRentalBookings(false)]);
      if (n !== latest.current) return;
      setItems(it); setBookings(bk); setError(""); setLoaded(true);
    } catch (e) {
      if (n === latest.current) { setError(memberError(e)); setLoaded(true); }
    }
  }, [term]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let alive = true;
    apiMarketPermissions(isSuperAdmin)
      .then((p) => { if (alive) setPerms(p); })
      .catch(() => { if (alive) setPerms(new Set()); });
    return () => { alive = false; };
  }, [isSuperAdmin]);

  const open = bookings.filter((b) => b.problem && !b.problem_settled);
  const problems = bookings.filter((b) => b.problem);
  const live = items.filter((i) => i.status === "live" && !i.hidden).length;
  const hidden = items.filter((i) => i.hidden).length;
  const running = bookings.filter((b) => ["accepted", "active", "returned"].includes(b.status)).length;

  const confirm = useCallback(async (text: string) => {
    if (!dialog) return;
    setBusy(true);
    try {
      if (dialog.kind === "settle") {
        await apiAdminSettleRental(dialog.booking.id, text);
        toast.success("Answer sent", { description: "Both women have been told, and it is in the booking's history." });
      } else {
        await apiAdminHideRental(dialog.item.id, dialog.kind === "hide", text);
        toast.success(dialog.kind === "hide" ? "Listing hidden" : "Listing back on the board", { description: "The owner has been told." });
      }
      setDialog(null);
      await load();
    } catch (e) {
      toast.error("That didn't go through", { description: memberError(e) });
    } finally { setBusy(false); }
  }, [dialog, load, toast]);

  const bookingRow = (b: AdminRentalBooking) => (
    <li key={b.id} className="py-3.5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-semibold text-ink">{b.item_title}</p>
            <Badge tone={STATUS_TONE[b.status] ?? "slate"}>{b.status}</Badge>
            {b.problem && !b.problem_settled && <Badge tone="rose">Problem open</Badge>}
            {b.problem_settled && <Badge tone="emerald">Settled</Badge>}
          </div>
          <p className="mt-1 text-xs text-ink-subtle">
            {b.owner || "Owner"} → {b.renter || "Renter"} · {shortDate(b.start)} – {shortDate(b.end)} · rent {formatMoney(b.rent_minor)}
            {b.deposit_minor ? ` · deposit ${formatMoney(b.deposit_minor)}` : ""}
            {b.deduction_minor ? ` · kept ${formatMoney(b.deduction_minor)}` : ""}
          </p>
          {b.problem && (
            <p className="mt-2 rounded-lg bg-status-danger-tint px-3 py-2 text-sm text-ink">
              <b>Raised by the {b.problem.split(":")[0]}:</b> {b.problem.split(":").slice(1).join(":").trim()}
            </p>
          )}
          {b.problem_settled && (
            <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-muted"><b className="text-ink">Our answer:</b> {b.problem_settled}</p>
          )}
          {b.problem && (
            <details className="mt-2 text-xs text-ink-muted">
              <summary className="cursor-pointer font-semibold text-ink">What happened ({b.history.length})</summary>
              <ol className="mt-2 space-y-1 border-l border-line pl-3">
                {b.history.map((h, i) => (
                  <li key={i}><b className="text-ink">{h.note || h.status}</b> · {h.by || "system"} · {new Date(h.at).toLocaleString("en-IN")}</li>
                ))}
              </ol>
            </details>
          )}
        </div>
        {b.problem && !b.problem_settled && perms.has("approve") && (
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setDialog({ kind: "settle", booking: b })}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Write the answer
          </button>
        )}
      </div>
    </li>
  );

  const shownBookings = tab === "problems" ? problems : bookings;

  return (
    <div className="wc-page-enter">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <KeyRound className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Rent &amp; borrow</h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-subtle">
              Members renting their things to each other. Rent and deposit pass between them at pickup — WomSakhi holds no money,
              so a raised problem is settled with a written answer both women receive.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Open problems" value={loaded ? String(open.length) : "—"} icon={MessageSquareWarning}
                  tone={open.length ? "rose" : "slate"} deltaNote={open.length ? "Waiting for an answer" : "Nothing waiting"} />
        <StatCard label="Rentals running" value={loaded ? String(running) : "—"} icon={KeyRound} tone="brand" deltaNote="Confirmed, out, or back" />
        <StatCard label="On the board" value={loaded ? String(live) : "—"} icon={Package} tone="emerald" deltaNote="Live listings" />
        <StatCard label="Hidden" value={loaded ? String(hidden) : "—"} icon={EyeOff} tone={hidden ? "amber" : "slate"} deltaNote="By staff, with a reason" />
      </div>

      <Card className="mt-6">
        <Tabs className="mb-4" value={tab} onChange={(t) => setTab(t as Tab)}
              tabs={[
                { value: "problems", label: "Problems", count: open.length },
                { value: "bookings", label: "All bookings", count: bookings.length },
                { value: "listings", label: "Listings", count: items.length },
              ]} />

        {tab === "listings" && (
          <div className="mb-4 relative max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input placeholder="Search listings by title…" value={q} onChange={(e) => setQ(e.target.value)}
                   className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-tint" />
          </div>
        )}

        {error ? (
          <ErrorState title="Could not load rentals" description={error} onRetry={() => void load()} />
        ) : !loaded ? (
          <div className="px-5 py-4"><SkeletonTable rows={6} cols={4} /></div>
        ) : tab === "listings" ? (
          items.length === 0 ? (
            <NoResults icon={Package} filtered={!!term} thing="listings" onClear={term ? () => { setQ(""); setTerm(""); } : undefined}
                       description={term ? "Try another word." : "Listings appear here as members rent things out."} />
          ) : (
            <ul className="divide-y divide-line">
              {items.map((i) => (
                <li key={i.id} className={`flex items-start gap-3 py-3.5 ${i.hidden ? "opacity-80" : ""}`}>
                  <span className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                    {i.photo && <img src={i.photo} alt="" className="h-full w-full object-cover" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-semibold text-ink">{i.title}</p>
                      <Badge tone="slate">{i.category}</Badge>
                      {i.hidden ? <Badge tone="rose">Hidden</Badge> : i.status === "paused" ? <Badge tone="amber">Paused</Badge> : <Badge tone="emerald">Live</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-ink-subtle">
                      {i.owner_name || i.owner.first_name} · {[i.area, i.city].filter(Boolean).join(", ")} · {formatMoney(i.price_day_minor)}/day
                      {i.deposit_minor ? ` · deposit ${formatMoney(i.deposit_minor)}` : ""} · rented {i.times_rented}×
                    </p>
                    {i.hidden && i.hidden_reason && <p className="mt-1.5 text-xs text-ink-muted"><b className="text-ink">Why hidden:</b> {i.hidden_reason}</p>}
                  </div>
                  {perms.has("edit") && (
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => setDialog({ kind: i.hidden ? "show" : "hide", item: i })}>
                      {i.hidden ? <><Eye className="h-3.5 w-3.5" /> Show</> : <><EyeOff className="h-3.5 w-3.5" /> Hide</>}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )
        ) : shownBookings.length === 0 ? (
          <NoResults icon={tab === "problems" ? CheckCircle2 : AlertTriangle} filtered={false} thing={tab === "problems" ? "problems" : "bookings"}
                     description={tab === "problems" ? "No one has raised a problem. Raised ones appear here first." : "Bookings appear here as members rent from each other."} />
        ) : (
          <ul className="divide-y divide-line">
            {[...shownBookings].sort((a, b) => Number(!!b.problem && !b.problem_settled) - Number(!!a.problem && !a.problem_settled)).map(bookingRow)}
          </ul>
        )}
      </Card>

      <ReasonModal
        open={dialog?.kind === "settle"}
        title={dialog?.kind === "settle" ? `Answer about the ${dialog.booking.item_title}` : ""}
        description="Both women receive this as a notification, and it is added to the booking's history. Say what you found and what each should do."
        label="Your answer"
        placeholder="We looked at the photos from pickup and return…"
        confirmLabel="Send to both"
        busy={busy}
        icon={CheckCircle2}
        onClose={() => setDialog(null)}
        onConfirm={confirm}
      />
      <ReasonModal
        open={dialog?.kind === "hide"}
        title={dialog?.kind === "hide" ? `Hide ${dialog.item.title}` : ""}
        description="It leaves the board. She is told with your reason and can change the listing."
        label="Why it is being hidden"
        confirmLabel="Hide it"
        danger
        busy={busy}
        icon={EyeOff}
        onClose={() => setDialog(null)}
        onConfirm={confirm}
      />
      <ReasonModal
        open={dialog?.kind === "show"}
        title={dialog?.kind === "show" ? `Put ${dialog.item.title} back` : ""}
        description="It goes back on the board, and she is told."
        label="A note for her"
        placeholder="Optional."
        required={false}
        confirmLabel="Show it"
        busy={busy}
        icon={Eye}
        onClose={() => setDialog(null)}
        onConfirm={confirm}
      />
    </div>
  );
}
