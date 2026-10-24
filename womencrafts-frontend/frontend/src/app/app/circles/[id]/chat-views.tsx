"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import * as Icons from "@/components/ux/icons";
import { Avatar, Btn, Pill, Sheet } from "@/components/ux/kit";
import { Text, Toggle } from "@/components/ux/kit/form";
import { formatMoney } from "@/components/ux/kit/money";
import { useConfirm, useToast } from "@/design-system";
import { apiErrorMessage } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import { apiCirclePosts, apiCircleSavings, apiSetCircleMuted, type ApiCircleSavings, type CirclePost } from "@/lib/growth-api";
import { apiLeaveCircle } from "@/lib/community-api";
import { apiCircleInviteCode } from "@/lib/share-api";
import { apiFileReport } from "@/lib/safety-api";
import { apiSearchPeople, handleOf, type PersonRow } from "@/lib/people-api";
import { apiUploadImage, uploadErrorMessage, validateImage } from "@/lib/uploads-api";
import {
  apiCancelGroupInvite, apiInviteToGroup, apiRemoveGroupMember, apiResetInviteLink, apiSetGroupAdmin,
  apiUpdateGroup, type ChatMessage, type GroupInfo, type GroupMember,
} from "@/lib/circle-chat-api";
import { PotCard, ResourcesRail } from "./detail-views";
import s from "./chat.module.css";

/* ── one message ─────────────────────────────────────────────────────────── */

const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

export function MessageItem({ m, first, selected, flash, fresh, canDelete, onSelect, onReply, onDelete, onJump }: {
  m: ChatMessage;
  /** First of a run from the same woman — shows her name and face. */
  first: boolean;
  selected: boolean;
  flash: boolean;
  fresh: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onReply: () => void;
  onDelete: () => void;
  onJump: (id: string) => void;
}) {
  const toast = useToast();
  if (m.kind === "system") {
    return <li className={s.system} data-system>{m.text}</li>;
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(m.text); toast.info("Copied"); } catch { /* nothing to copy into */ }
  };
  return (
    <li id={`m-${m.id}`} data-msg={m.id}
        className={`flex items-end gap-2 ${first ? "mt-3" : "mt-[3px]"} ${m.mine ? "flex-row-reverse" : ""} ${fresh ? s.fresh : ""}`}>
      {!m.mine && (
        <span className="w-[28px] shrink-0" style={{ visibility: first ? "visible" : "hidden" }}>
          <Avatar src={m.avatar} name={m.name || "Member"} size={28} />
        </span>
      )}
      {/* flex-1: the bubble's 78% is of the whole row, not of its own text. */}
      <div className={`flex min-w-0 flex-1 flex-col ${m.mine ? "items-end" : "items-start"}`}>
        <div role="button" tabIndex={0} aria-expanded={selected}
             onClick={onSelect} onKeyDown={(e) => { if (e.key === "Enter") onSelect(); }}
             className={`${s.bubble} ${m.mine ? s.out : s.in} ${flash ? s.flash : ""}`}>
          {!m.mine && first && (
            <span className="mb-0.5 block text-[12.5px] font-bold" style={{ color: "var(--ux-brand)" }}>
              {m.name}{m.username && m.name !== m.username ? <span className="font-medium opacity-70"> · @{m.username}</span> : null}
            </span>
          )}
          {m.deleted ? (
            <span className="inline-flex items-center gap-1.5 italic opacity-75">
              <Icons.Ban className="h-3.5 w-3.5" /> This message was deleted
            </span>
          ) : (
            <>
              {m.reply_to && (
                <button type="button" className={s.quote} onClick={(e) => { e.stopPropagation(); onJump(m.reply_to!.id); }}>
                  <b className="block">{m.reply_to.name}</b>
                  <span className="line-clamp-2">{m.reply_to.photo && !m.reply_to.text ? "📷 Photo" : m.reply_to.text}</span>
                </button>
              )}
              {m.photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.photo} alt="" loading="lazy" decoding="async" className={s.photo} />
              )}
              {m.text}
            </>
          )}
          <span className={s.meta}>{time(m.at)}</span>
        </div>
        {selected && !m.deleted && (
          <div className="mt-1 flex gap-1.5" data-actions>
            <ActionChip icon="Reply" label="Reply" onClick={onReply} />
            {m.text && <ActionChip icon="Copy" label="Copy" onClick={copy} />}
            {canDelete && <ActionChip icon="Trash2" label="Delete" danger onClick={onDelete} />}
          </div>
        )}
      </div>
    </li>
  );
}

function ActionChip({ icon, label, onClick, danger }: { icon: string; label: string; onClick: () => void; danger?: boolean }) {
  const C = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[icon] ?? Icons.Circle;
  return (
    <button type="button" onClick={onClick}
            className="ux-press inline-flex min-h-[32px] items-center gap-1 rounded-full px-3 text-xs font-bold"
            style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)",
                     color: danger ? "var(--ux-danger-ink)" : "var(--ux-ink-2)" }}>
      <C className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

/* ── the composer ────────────────────────────────────────────────────────── */

/** Tap to send — most messages in a group are one of these. */
export const QUICK = ["Hi all 👋", "Thank you! 🙏", "On my way", "Count me in ✋", "Congratulations 🎉", "See you there"];

export function Composer({ canSend, sending, replyTo, onCancelReply, onSend }: {
  canSend: boolean;
  sending: boolean;
  replyTo: ChatMessage | null;
  onCancelReply: () => void;
  onSend: (text: string, photo?: string) => Promise<boolean>;
}) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState("");
  const [uploading, setUploading] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (replyTo) box.current?.focus(); }, [replyTo]);

  if (!canSend) {
    return (
      <div className={s.composer}>
        <p className="flex items-center justify-center gap-2 py-2 text-xsm" style={{ color: "var(--ux-muted)" }}>
          <Icons.Megaphone className="h-4 w-4" /> Only admins can send messages in this group
        </p>
      </div>
    );
  }

  const send = async (t = text) => {
    if ((!t.trim() && !photo) || sending) return;
    const ok = await onSend(t.trim(), photo || undefined);
    if (ok) { setText(""); setPhoto(""); }
  };
  const pick = async (file?: File) => {
    if (!file) return;
    const bad = validateImage(file);
    if (bad) { toast.error(bad); return; }
    setUploading(true);
    try { setPhoto((await apiUploadImage(file, "attachment")).url); }
    catch (e) { toast.error(uploadErrorMessage(e)); }
    finally { setUploading(false); }
  };

  return (
    <div className={s.composer}>
      {!text && !photo && !replyTo && (
        <div className={s.chips} aria-label="Quick replies">
          {QUICK.map((q) => (
            <button key={q} type="button" disabled={sending} onClick={() => send(q)} data-quick
                    className="ux-press shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold"
                    style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>
              {q}
            </button>
          ))}
        </div>
      )}
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-[12px] px-3 py-2"
             style={{ background: "var(--ux-surface-2)", borderLeft: "3px solid var(--ux-brand)" }}>
          <Icons.Reply className="h-4 w-4 shrink-0" style={{ color: "var(--ux-brand)" }} />
          <span className="min-w-0 flex-1 text-xs">
            <b className="block" style={{ color: "var(--ux-brand)" }}>{replyTo.mine ? "You" : replyTo.name}</b>
            <span className="block truncate" style={{ color: "var(--ux-muted)" }}>{replyTo.text || "📷 Photo"}</span>
          </span>
          <button type="button" aria-label="Cancel reply" onClick={onCancelReply} className="ux-press grid h-8 w-8 place-items-center rounded-full">
            <Icons.X className="h-4 w-4" />
          </button>
        </div>
      )}
      {photo && (
        <div className="relative mb-2 w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="Photo to send" className="h-[84px] w-[84px] rounded-[12px] object-cover" />
          <button type="button" aria-label="Remove photo" onClick={() => setPhoto("")}
                  className="absolute -end-2 -top-2 grid h-7 w-7 place-items-center rounded-full"
                  style={{ background: "var(--ux-ink)", color: "var(--ux-surface)" }}>
            <Icons.X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <label className="ux-press grid h-[44px] w-[44px] shrink-0 cursor-pointer place-items-center rounded-full"
               aria-label="Add a photo" style={{ color: "var(--ux-brand)", background: "var(--ux-brand-tint)" }}>
          {uploading ? <Icons.Loader2 className="h-5 w-5 animate-spin" /> : <Icons.ImagePlus className="h-5 w-5" />}
          <input type="file" accept="image/*" className="sr-only" disabled={uploading}
                 onChange={(e) => { void pick(e.target.files?.[0]); e.currentTarget.value = ""; }} />
        </label>
        <textarea ref={box} value={text} rows={1} maxLength={2000} aria-label="Message"
                  placeholder="Message" className={s.input}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(min-width: 1024px)").matches) { e.preventDefault(); void send(); } }} />
        <button type="button" aria-label="Send" onClick={() => send()} disabled={sending || uploading || (!text.trim() && !photo)}
                data-send
                className="ux-press grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full disabled:opacity-50"
                style={{ background: "var(--ux-brand)", color: "var(--ux-ink-on-brand)" }}>
          {sending ? <Icons.Loader2 className="h-5 w-5 animate-spin" /> : <Icons.SendHorizontal className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}

/* ── group info ──────────────────────────────────────────────────────────── */

export function GroupInfoPanel({ info, onChanged, onEarlier }: {
  info: GroupInfo;
  onChanged: (next?: GroupInfo) => void;
  onEarlier: () => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(info.name);
  const [desc, setDesc] = useState(info.desc);
  const [adding, setAdding] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const savings = useResource(
    useCallback((sig?: AbortSignal) => info.is_savings ? apiCircleSavings(info.id, sig).catch(() => null) : Promise.resolve(null), [info.id, info.is_savings]),
    null as ApiCircleSavings | null);

  const run = async (key: string, fn: () => Promise<GroupInfo | void>, ok?: string) => {
    setBusy(key);
    try {
      const next = await fn();
      if (ok) toast.success(ok);
      onChanged(next || undefined);
      return true;
    } catch (e) { toast.error(apiErrorMessage(e)); return false; }
    finally { setBusy(null); }
  };

  const link = (code: string) => `${window.location.origin}/join/${code}`;
  // A phone opens its share sheet (WhatsApp is one tap from there); a laptop
  // copies. If the browser refuses the clipboard, the link is shown instead
  // of a "copied" that did not happen.
  const copyLink = async () => {
    await run("link", async () => {
      const code = info.invite_code || (await apiCircleInviteCode(info.id)).code;
      const url = link(code);
      if (navigator.share && window.matchMedia("(max-width: 1023px)").matches) {
        try { await navigator.share({ title: info.name, text: `Join ${info.name} on WomSakhi`, url }); return; }
        catch { /* she closed the share sheet — fall through to copying */ }
      }
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Invite link copied — send it on WhatsApp or SMS");
      } catch {
        toast.info(`Your invite link: ${url}`, { duration: 12000 });
      }
    });
  };
  const resetLink = async () => {
    const yes = await confirm({ title: "Make a new invite link?", description: "The old link will stop working. Anyone already in the group stays in.", confirmLabel: "New link" });
    if (yes) await run("reset", async () => { await apiResetInviteLink(info.id); }, "New invite link made");
  };
  const leave = async () => {
    const yes = await confirm({
      title: `Leave ${info.name}?`,
      description: info.is_savings ? "This is a savings circle. Talk to the group about your turn and your payments before you leave." : "You will stop getting its messages. You can join again with an invite.",
      confirmLabel: "Leave group", danger: true,
    });
    if (!yes) return;
    try { await apiLeaveCircle(info.id); toast.info("You left the group"); router.push("/app/circles"); }
    catch (e) { toast.error(apiErrorMessage(e)); }
  };
  const report = async () => {
    const yes = await confirm({ title: `Report ${info.name}?`, description: "This goes privately to the WomSakhi safety team. Nobody in the group is told who reported it.", confirmLabel: "Send report", danger: true });
    if (!yes) return;
    try {
      await apiFileReport({ category: "Something in a circle or post", details: `Please review the group chat “${info.name}”.`, about: `circle:${info.id}` });
      toast.success("Report sent privately to the safety team");
    } catch { toast.error("The report could not be sent. Please try again."); }
  };
  const memberAction = async (m: GroupMember, what: "admin" | "unadmin" | "remove") => {
    setMenuFor(null);
    if (what === "remove") {
      const yes = await confirm({ title: `Remove ${m.name}?`, description: "She will stop getting this group's messages. She can come back only with a new invite.", confirmLabel: "Remove", danger: true });
      if (!yes) return;
      await run(m.id, () => apiRemoveGroupMember(info.id, m.id), `${m.name} was removed`);
    } else {
      await run(m.id, () => apiSetGroupAdmin(info.id, m.id, what === "admin"), what === "admin" ? `${m.name} is now an admin` : `${m.name} is no longer an admin`);
    }
  };

  return (
    <div className="space-y-4 p-4" data-group-info>
      <div className="flex flex-col items-center text-center">
        <Avatar src={info.cover || info.icon} name={info.name} size={88} />
        {editing ? (
          <div className="mt-3 w-full space-y-2 text-start">
            <Text label="Group name" value={name} onChange={setName} max={80} />
            <Text label="Description" value={desc} onChange={setDesc} max={600} placeholder="What this group is for" />
            <div className="flex gap-2">
              <Btn size="sm" icon="Check" loading={busy === "edit"} disabled={name.trim().length < 2}
                   onClick={async () => { if (await run("edit", () => apiUpdateGroup(info.id, { name: name.trim(), desc: desc.trim() }), "Group updated")) setEditing(false); }}>Save</Btn>
              <Btn size="sm" variant="outline" onClick={() => { setEditing(false); setName(info.name); setDesc(info.desc); }}>Cancel</Btn>
            </div>
          </div>
        ) : (
          <>
            <h2 className="mt-3 text-lg font-extrabold" style={{ color: "var(--ux-ink)" }}>{info.name}</h2>
            <p className="text-xs" style={{ color: "var(--ux-muted)" }}>
              {info.is_private ? "Private group" : "Open group"} · {info.member_count} {info.member_count === 1 ? "member" : "members"}
            </p>
            {info.desc && <p className="mt-2 text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{info.desc}</p>}
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {info.is_savings && <Pill tone="orange" size="sm">Savings circle</Pill>}
              {info.topic && !(info.is_savings && /saving/i.test(info.topic)) && <Pill tone="neutral" size="sm">{info.topic}</Pill>}
            </div>
            {info.is_admin && (
              <button type="button" onClick={() => setEditing(true)} className="ux-press mt-2 inline-flex min-h-[32px] items-center gap-1 rounded-full px-3 text-xs font-bold"
                      style={{ color: "var(--ux-brand)" }}>
                <Icons.Pencil className="h-3.5 w-3.5" /> Edit name and description
              </button>
            )}
          </>
        )}
      </div>

      {info.is_savings && savings.data?.is_savings && (
        <PotCard id={info.id} monthlyLabel={formatMoney(savings.data.monthly_minor)} round={savings.data.round}
                 paid={savings.data.members_paid} total={savings.data.members_total}
                 youPaid={savings.data.you_paid} whoseTurn={savings.data.whose_turn} />
      )}

      <Section title="Invite people">
        {info.is_admin ? (
          <div className="grid grid-cols-2 gap-2">
            <Btn size="sm" icon="UserPlus" onClick={() => setAdding(true)}>Add people</Btn>
            <Btn size="sm" variant="soft" icon="Link" loading={busy === "link"} onClick={copyLink}>Copy invite link</Btn>
            <button type="button" onClick={resetLink} className="col-span-2 text-start text-xs font-semibold underline-offset-2 hover:underline" style={{ color: "var(--ux-muted)" }}>
              Make a new link (the old one stops working)
            </button>
          </div>
        ) : (
          <p className="text-xs" style={{ color: "var(--ux-muted)" }}>Ask a group admin for the invite link, or to add someone by username.</p>
        )}
        {info.pending.length > 0 && (
          <ul className="mt-3 space-y-2">
            {info.pending.map((p) => (
              <li key={p.id} className="flex items-center gap-2.5">
                <Avatar src={p.avatar} name={p.name} size={32} />
                <span className="min-w-0 flex-1 truncate text-xsm" style={{ color: "var(--ux-ink)" }}>
                  {p.name} <span className="text-2xs" style={{ color: "var(--ux-muted)" }}>· invited</span>
                </span>
                <button type="button" onClick={() => run(p.id, () => apiCancelGroupInvite(info.id, p.id), "Invite taken back")}
                        className="text-xs font-bold" style={{ color: "var(--ux-muted)" }}>Cancel</button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`${info.member_count} ${info.member_count === 1 ? "member" : "members"}`}>
        <ul className="space-y-1" data-members>
          {info.members.map((m) => (
            <li key={m.id} className="relative">
              <div className="flex items-center gap-2.5 py-1.5">
                <Avatar src={m.avatar} name={m.name} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xsm font-semibold" style={{ color: "var(--ux-ink)" }}>{m.you ? "You" : m.name}</span>
                  {m.username && m.username !== m.name && <span className="block truncate text-2xs" style={{ color: "var(--ux-muted)" }}>@{m.username}</span>}
                </span>
                {m.admin && <Pill tone="green" size="sm">{m.founder ? "Founder" : "Admin"}</Pill>}
                {info.is_admin && !m.you && !m.founder && (
                  <button type="button" aria-label={`Options for ${m.name}`} aria-expanded={menuFor === m.id}
                          onClick={() => setMenuFor(menuFor === m.id ? null : m.id)}
                          className="ux-press grid h-8 w-8 place-items-center rounded-full" disabled={busy === m.id}>
                    {busy === m.id ? <Icons.Loader2 className="h-4 w-4 animate-spin" /> : <Icons.MoreVertical className="h-4 w-4" />}
                  </button>
                )}
              </div>
              {menuFor === m.id && (
                <div className="mb-2 ms-[46px] flex flex-wrap gap-1.5">
                  {m.admin
                    ? <ActionChip icon="ShieldOff" label="Remove as admin" onClick={() => memberAction(m, "unadmin")} />
                    : <ActionChip icon="ShieldCheck" label="Make admin" onClick={() => memberAction(m, "admin")} />}
                  <ActionChip icon="UserMinus" label="Remove from group" danger onClick={() => memberAction(m, "remove")} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Settings">
        <div className="space-y-2">
          <Toggle on={info.muted} label="Mute notifications" sub="You still get the messages; your phone stays quiet."
                  onChange={(on) => run("mute", async () => { await apiSetCircleMuted(info.id, on); }, on ? "Muted" : "Notifications on")} />
          {info.is_admin && (
            <Toggle on={info.only_admins} label="Only admins can send" sub="Turns the group into announcements."
                    onChange={(on) => run("only", () => apiUpdateGroup(info.id, { only_admins: on }))} />
          )}
        </div>
      </Section>

      {info.earlier_posts > 0 && (
        <button type="button" onClick={onEarlier} data-earlier
                className="ux-press ux-hov flex w-full items-center gap-3 rounded-[14px] p-3 text-start"
                style={{ background: "var(--ux-surface-2)" }}>
          <Icons.History className="h-5 w-5 shrink-0" style={{ color: "var(--ux-brand)" }} />
          <span className="min-w-0 flex-1">
            <span className="block text-xsm font-bold" style={{ color: "var(--ux-ink)" }}>Earlier posts</span>
            <span className="block text-2xs" style={{ color: "var(--ux-muted)" }}>{info.earlier_posts} from before the chat · read only</span>
          </span>
          <Icons.ChevronRight className="h-4 w-4" style={{ color: "var(--ux-muted)" }} />
        </button>
      )}

      <ResourcesRail circleId={info.id} />

      <div className="space-y-1 pt-1">
        <button type="button" onClick={report} className="ux-press flex min-h-[44px] w-full items-center gap-2 rounded-[12px] px-3 text-xsm font-bold"
                style={{ color: "var(--ux-danger-ink)" }}>
          <Icons.Flag className="h-4 w-4" /> Report group
        </button>
        <button type="button" onClick={leave} data-leave className="ux-press flex min-h-[44px] w-full items-center gap-2 rounded-[12px] px-3 text-xsm font-bold"
                style={{ color: "var(--ux-danger-ink)" }}>
          <Icons.LogOut className="h-4 w-4" /> Leave group
        </button>
      </div>

      <AddPeople open={adding} onClose={() => setAdding(false)} info={info}
                 onInvited={(next) => onChanged(next)} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t pt-3" style={{ borderColor: "var(--ux-line)" }}>
      <h3 className="mb-2 text-2xs font-bold uppercase tracking-[0.08em]" style={{ color: "var(--ux-muted)" }}>{title}</h3>
      {children}
    </section>
  );
}

/* ── add by username ─────────────────────────────────────────────────────── */

function AddPeople({ open, onClose, info, onInvited }: {
  open: boolean; onClose: () => void; info: GroupInfo; onInvited: (next: GroupInfo) => void;
}) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<PersonRow[]>([]);
  const [searched, setSearched] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const inGroup = new Set(info.members.map((m) => m.id));
  const invited = new Set(info.pending.map((p) => p.to_id));

  useEffect(() => {
    const term = q.trim().replace(/^@/, "");
    if (term.length < 2) return;
    const ctl = new AbortController();
    const t = window.setTimeout(() => {
      apiSearchPeople(term, ctl.signal).then((r) => { setRows(r); setSearched(term); }).catch(() => {});
    }, 300);
    return () => { window.clearTimeout(t); ctl.abort(); };
  }, [q]);
  const term = q.trim().replace(/^@/, "");
  const shown = term.length >= 2 ? rows : [];

  const send = async (p: PersonRow) => {
    setBusy(p.id);
    try {
      const next = await apiInviteToGroup(info.id, p.id);
      toast.success(`Invite sent to ${handleOf(p)} — she chooses to join`);
      onInvited(next);
    } catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setBusy(null); }
  };

  return (
    <Sheet open={open} onClose={onClose} icon="UserPlus" title="Add by username"
           description="Search her WomSakhi username. She gets an invite and decides whether to join.">
      <Text label="Username" prefix="@" value={q} onChange={(v) => setQ(v.replace(/\s/g, "").toLowerCase())} placeholder="priya.sews" />
      <ul className="mt-3 space-y-1" data-people>
        {shown.map((p) => {
          const state = inGroup.has(p.id) ? "In the group" : invited.has(p.id) ? "Invited" : "";
          return (
            <li key={p.id} className="flex items-center gap-3 rounded-[12px] p-2">
              <Avatar src={p.avatar} name={p.name} size={40} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 truncate text-xsm font-bold" style={{ color: "var(--ux-ink)" }}>
                  @{p.username} {p.verified && <Icons.BadgeCheck className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--ux-blue)" }} />}
                </span>
                {p.location && <span className="block truncate text-2xs" style={{ color: "var(--ux-muted)" }}>{p.location}</span>}
              </span>
              {state
                ? <span className="text-xs font-semibold" style={{ color: "var(--ux-muted)" }}>{state}</span>
                : <Btn size="sm" icon="Send" loading={busy === p.id} onClick={() => send(p)}>Invite</Btn>}
            </li>
          );
        })}
      </ul>
      {term.length >= 2 && searched === term && !rows.length && (
        <p className="mt-3 text-xs" style={{ color: "var(--ux-muted)" }}>Nobody with a username starting “{term}”. Check the spelling, or send her the invite link instead.</p>
      )}
      {term.length < 2 && (
        <p className="mt-3 text-xs" style={{ color: "var(--ux-muted)" }}>Type at least two letters of her username.</p>
      )}
    </Sheet>
  );
}

/* ── earlier posts (the old discussion, read-only) ───────────────────────── */

export function EarlierPosts({ open, onClose, circleId }: { open: boolean; onClose: () => void; circleId: string }) {
  const posts = useResource(
    useCallback((sig?: AbortSignal) => open ? apiCirclePosts(circleId, sig).catch(() => []) : Promise.resolve([]), [circleId, open]),
    [] as CirclePost[]);
  return (
    <Sheet open={open} onClose={onClose} icon="History" title="Earlier posts" width={520}
           description="What was posted here before the group chat. Read only.">
      <ul className="space-y-3" data-earlier-list>
        {posts.data.map((p) => (
          <li key={p.id} className="rounded-[14px] p-3" style={{ background: "var(--ux-surface-2)" }}>
            <div className="flex items-center gap-2">
              <Avatar src={p.author_avatar} name={p.author_name} size={30} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xsm font-bold" style={{ color: "var(--ux-ink)" }}>{p.author_name}</span>
                <span className="block text-2xs" style={{ color: "var(--ux-muted)" }}>{p.when}</span>
              </span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{p.body}</p>
            <p className="mt-2 flex gap-3 text-2xs" style={{ color: "var(--ux-muted)" }}>
              <span className="inline-flex items-center gap-1"><Icons.Heart className="h-3 w-3" />{p.likes}</span>
              <span className="inline-flex items-center gap-1"><Icons.MessageCircle className="h-3 w-3" />{p.reply_count}</span>
            </p>
          </li>
        ))}
        {!posts.data.length && posts.source !== "loading" && (
          <li className="text-xs" style={{ color: "var(--ux-muted)" }}>Nothing was posted here before the chat.</li>
        )}
      </ul>
    </Sheet>
  );
}
