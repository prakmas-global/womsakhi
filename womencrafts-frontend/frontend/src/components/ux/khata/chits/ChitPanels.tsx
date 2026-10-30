"use client";

import { useConfirm } from "@/design-system/feedback/ConfirmProvider";

import { useState } from "react";
import { useRouter } from "next/navigation";

import * as Icons from "@/components/ux/icons";
import { Btn, Card, v } from "@/components/ux/kit";
import { Label, Text } from "@/components/ux/kit/form";
import { Amount } from "@/components/ux/khata/KhataGate";
import {
  apiAddChitMember, apiChitOrder, apiDeleteChit, apiEditChit, apiEditChitMember, apiRemoveChitMember, type Chit,
} from "@/lib/khata-api";
import { METHOD_LOOK, lakhs, monthName } from "./look";
import type { Run } from "./MonthPanel";
import { Initial } from "./parts";

/* ── every month, as a timeline ───────────────────────────────────────────── */

/** All N months, top to bottom; a month that has come opens to manage it. */
export function Timeline({ chit, onPick }: { chit: Chit; onPick: (month: number) => void }) {
  const byId = new Map(chit.members.map((m) => [m.id, m]));
  return (
    <Card>
      <ol className="relative">
        {chit.months.map((mo) => {
          const w = byId.get(mo.winner);
          const open = mo.when !== "later";
          return (
            <li key={mo.month} className="relative ps-10 pb-4 last:pb-0">
              {/* The line down the side, and the dot that says past, now or later. */}
              <span aria-hidden className="absolute start-[15px] top-8 bottom-0 w-[2px]" style={{ background: v("--ux-line") }} />
              <span aria-hidden className="absolute start-0 top-1 grid h-8 w-8 place-items-center rounded-full text-xs font-extrabold"
                    style={mo.when === "now" ? { background: "var(--ux-pic-ground)", color: "#fff", boxShadow: "0 0 0 4px var(--ux-brand-tint)" }
                      : mo.when === "past" ? { background: v("--ux-brand-tint"), color: v("--ux-brand") }
                        : { background: v("--ux-surface"), color: v("--ux-faint"), border: `1.5px dashed ${v("--ux-line-strong")}` }}>
                {mo.month}
              </span>
              <button type="button" disabled={!open} onClick={() => onPick(mo.month)}
                      className={`w-full rounded-[14px] p-2.5 text-start ${open ? "ux-press ux-hov" : ""}`}
                      style={{ background: mo.when === "now" ? v("--ux-brand-tint") : "transparent" }}>
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xsm font-bold" style={{ color: v(open ? "--ux-ink" : "--ux-muted") }}>
                    {monthName(mo.label)}{mo.when === "now" && <span className="ms-2 text-2xs font-bold" style={{ color: v("--ux-brand") }}>THIS MONTH</span>}
                  </span>
                  {open && (
                    <span className="inline-flex items-center gap-1 text-2xs font-semibold" style={{ color: v("--ux-muted") }}>
                      <Icons.CheckCircle2 className="h-3.5 w-3.5" style={{ color: v("--ux-green-ink") }} /> {mo.paid.length}/{chit.members.length} paid
                    </span>
                  )}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: v("--ux-ink-2") }}>
                  {w ? (
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <Icons.Trophy className="h-3.5 w-3.5" style={{ color: "#f5a524" }} /> {w.is_me ? "You" : w.name} · <Amount minor={mo.payout_minor} />
                    </span>
                  ) : (
                    <span style={{ color: v("--ux-faint") }}>{open ? "Pot not given yet" : "Later"}</span>
                  )}
                  <span>Each pays <Amount minor={mo.due_minor} /></span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/* ── members ──────────────────────────────────────────────────────────────── */

export function MembersPanel({ chit, run }: { chit: Chit; run: Run }) {
  const confirm = useConfirm();
  const owner = chit.viewer === "owner";
  const [who, setWho] = useState("");
  const [phone, setPhone] = useState("");
  const [editing, setEditing] = useState("");
  const [eName, setEName] = useState("");
  const [ePhone, setEPhone] = useState("");
  const [order, setOrder] = useState<string[] | null>(null);
  const full = chit.members.length >= chit.members_count;

  const add = async () => {
    const w = who.trim();
    const body = w.startsWith("@") ? { username: w.slice(1) } : { name: w, phone };
    if (await run(() => apiAddChitMember(chit.id, body), "Member added")) { setWho(""); setPhone(""); }
  };
  const move = (i: number, by: -1 | 1) => {
    if (!order) return;
    const j = i + by;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };
  const shown = order ? order.map((id) => chit.members.find((m) => m.id === id)!) : chit.members;

  return (
    <div className="space-y-4">
      {owner && !full && !order && (
        <Card>
          <Label>Add a member</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Text value={who} onChange={setWho} label="Name or @username" max={60} placeholder="Name, or @username" />
            {!who.startsWith("@") && (
              <div className="sm:w-[170px]"><Text value={phone} onChange={(s) => setPhone(s.replace(/\D/g, "").slice(0, 10))} type="tel"
                                                   label="Mobile (optional)" placeholder="Mobile (optional)" /></div>
            )}
            <Btn variant="primary" icon="UserPlus" disabled={!who.trim()} onClick={() => void add()}>Add</Btn>
          </div>
          <p className="mt-1.5 text-2xs" style={{ color: v("--ux-muted") }}>
            {chit.members.length} of {chit.members_count} places filled. Type @username to link a WomSakhi member — she will see this chit.
          </p>
        </Card>
      )}

      {owner && chit.method === "fixed" && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-bold" style={{ color: v("--ux-ink") }}>
              <Icons.ListOrdered className="h-5 w-5" style={{ color: v("--ux-brand") }} /> The order women take the pot
            </p>
            {order ? (
              <span className="flex gap-2">
                <Btn size="sm" variant="ghost" onClick={() => setOrder(null)}>Cancel</Btn>
                <Btn size="sm" variant="primary" icon="Check"
                     onClick={() => void run(() => apiChitOrder(chit.id, order), "Order saved").then((ok) => ok && setOrder(null))}>Save order</Btn>
              </span>
            ) : (
              <Btn size="sm" variant="outline" icon="ArrowUpDown"
                   onClick={() => setOrder([...chit.members].sort((a, b) => (a.order || 999) - (b.order || 999)).map((m) => m.id))}>
                Set the order
              </Btn>
            )}
          </div>
        </Card>
      )}

      <Card>
        <ul className="divide-y" style={{ borderColor: v("--ux-line") }}>
          {shown.map((m, i) => (
            <li key={m.id} className="py-2.5" style={{ borderColor: v("--ux-line") }}>
              <div className="flex items-center gap-3">
                {(order || (chit.method === "fixed" && m.order > 0)) && (
                  <span className="w-6 text-center text-sm font-extrabold" style={{ color: v("--ux-brand") }}>{order ? i + 1 : m.order}</span>
                )}
                <Initial name={m.name} me={m.is_me} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-xsm font-semibold" style={{ color: v("--ux-ink") }}>
                    {m.is_me ? "You" : m.name}
                    {m.linked && !m.is_me && (
                      <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-[1px] text-[10px] font-bold"
                            style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
                        <Icons.AtSign className="h-3 w-3" /> On WomSakhi
                      </span>
                    )}
                  </p>
                  {m.won_month > 0 && (
                    <p className="inline-flex items-center gap-1 text-2xs font-semibold" style={{ color: v("--ux-green-ink") }}>
                      <Icons.Trophy className="h-3 w-3" /> Took the pot in month {m.won_month}
                    </p>
                  )}
                </div>
                {order ? (
                  <span className="flex gap-1">
                    <button type="button" aria-label={`Move ${m.name} up`} disabled={i === 0} onClick={() => move(i, -1)}
                            className="ux-press grid h-9 w-9 place-items-center rounded-full disabled:opacity-30" style={{ background: v("--ux-surface-2") }}>
                      <Icons.ArrowUp className="h-4 w-4" />
                    </button>
                    <button type="button" aria-label={`Move ${m.name} down`} disabled={i === shown.length - 1} onClick={() => move(i, 1)}
                            className="ux-press grid h-9 w-9 place-items-center rounded-full disabled:opacity-30" style={{ background: v("--ux-surface-2") }}>
                      <Icons.ArrowDown className="h-4 w-4" />
                    </button>
                  </span>
                ) : owner ? (
                  <span className="flex gap-1">
                    {m.phone && (
                      <a href={`tel:${m.phone}`} aria-label={`Call ${m.name}`} className="ux-press grid h-9 w-9 place-items-center rounded-full"
                         style={{ background: v("--ux-surface-2"), color: v("--ux-ink") }}><Icons.Phone className="h-4 w-4" /></a>
                    )}
                    {!m.is_me && (
                      <button type="button" aria-label={`Change ${m.name}`} onClick={() => { setEditing(m.id); setEName(m.name); setEPhone(m.phone ?? ""); }}
                              className="ux-press grid h-9 w-9 place-items-center rounded-full" style={{ background: v("--ux-surface-2"), color: v("--ux-ink") }}>
                        <Icons.Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {!m.is_me && (
                      <button type="button" aria-label={`Remove ${m.name}`}
                              onClick={async () => { if (await confirm({ title: `Remove ${m.name} from this chit?`, confirmLabel: "Remove member", danger: true })) await run(() => apiRemoveChitMember(chit.id, m.id), "Removed"); }}
                              className="ux-press grid h-9 w-9 place-items-center rounded-full" style={{ background: v("--ux-surface-2"), color: v("--ux-danger-ink") }}>
                        <Icons.Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </span>
                ) : null}
              </div>
              {editing === m.id && (
                <div className="mt-2 flex flex-col gap-2 ps-[48px] sm:flex-row">
                  <Text value={eName} onChange={setEName} label="Name" max={60} />
                  <div className="sm:w-[160px]"><Text value={ePhone} onChange={(s) => setEPhone(s.replace(/\D/g, "").slice(0, 10))} type="tel" label="Mobile" placeholder="Mobile" /></div>
                  <Btn size="sm" variant="primary" icon="Check" disabled={!eName.trim()}
                       onClick={() => void run(() => apiEditChitMember(chit.id, m.id, { name: eName.trim(), phone: ePhone }), "Saved").then((ok) => ok && setEditing(""))}>
                    Save
                  </Btn>
                  <Btn size="sm" variant="ghost" onClick={() => setEditing("")}>Cancel</Btn>
                </div>
              )}
            </li>
          ))}
        </ul>
        {!chit.members.length && <p className="text-sm" style={{ color: v("--ux-muted") }}>No members yet.</p>}
        {!owner && <p className="mt-2 text-2xs" style={{ color: v("--ux-faint") }}>Phone numbers stay with the organiser.</p>}
      </Card>
    </div>
  );
}

/* ── settings ─────────────────────────────────────────────────────────────── */

export function SettingsPanel({ chit, run }: { chit: Chit; run: Run }) {
  const confirm = useConfirm();
  const router = useRouter();
  const [name, setName] = useState(chit.name);
  const closed = chit.status === "closed";
  return (
    <div className="space-y-4">
      <Card>
        <Label>Name</Label>
        <div className="flex gap-2">
          <Text value={name} onChange={setName} label="Chit name" max={60} />
          <Btn variant="primary" icon="Check" disabled={name.trim().length < 2 || name.trim() === chit.name}
               onClick={() => void run(() => apiEditChit(chit.id, { name: name.trim() }), "Renamed")}>Save</Btn>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          {[["Chit", lakhs(chit.value_minor / 100)], ["Members", String(chit.members_count)],
            ["Pot given by", METHOD_LOOK[chit.method].label], ["Commission", `${chit.commission_pct}%`]].map(([k, val]) => (
            <div key={k} className="rounded-[12px] p-2.5" style={{ background: v("--ux-surface-2") }}>
              <dt style={{ color: v("--ux-muted") }}>{k}</dt><dd className="font-bold" style={{ color: v("--ux-ink") }}>{val}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full" style={{ background: v("--ux-surface-2"), color: v("--ux-ink-2") }}>
            {closed ? <Icons.ArchiveRestore className="h-5 w-5" /> : <Icons.Archive className="h-5 w-5" />}
          </span>
          <p className="min-w-0 flex-1 text-xsm" style={{ color: v("--ux-ink-2") }}>
            {closed ? "This chit is closed. Reopen it to keep recording." : "Finished? Close it — the record stays, under Closed."}
          </p>
          <Btn variant="outline" icon={closed ? "ArchiveRestore" : "Archive"}
               onClick={() => void run(() => apiEditChit(chit.id, { status: closed ? "running" : "closed" }), closed ? "Reopened" : "Closed")}>
            {closed ? "Reopen" : "Close chit"}
          </Btn>
        </div>
      </Card>
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full" style={{ background: v("--ux-danger-tint"), color: v("--ux-danger-ink") }}>
            <Icons.Trash2 className="h-5 w-5" />
          </span>
          <p className="min-w-0 flex-1 text-xsm" style={{ color: v("--ux-ink-2") }}>
            Delete the record — every month, every payment, and its lines in members&rsquo; money books.
          </p>
          <Btn variant="outline" icon="Trash2"
               onClick={async () => {
                 if (!await confirm({ title: `Delete “${chit.name}”?`, description: "Every month, payment and linked money-book entry will be deleted. This cannot be undone.", confirmLabel: "Delete chit", danger: true })) return;
                 void run(async () => { await apiDeleteChit(chit.id); router.push("/app/khata/chits"); return chit; }, "Deleted");
               }}>Delete</Btn>
        </div>
      </Card>
    </div>
  );
}
