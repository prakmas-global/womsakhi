"use client";

import { useEffect, useState } from "react";

import * as Icons from "@/components/ux/icons";
import { Btn, Sheet } from "@/components/ux/kit";
import { Text } from "@/components/ux/kit/form";
import { toast } from "@/components/ux/mobile/Toast";
import { apiErrorMessage } from "@/lib/api";
import { apiCheckUsername, apiSetUsername, usernameProblem, type UsernameCheck } from "@/lib/people-api";
import { useAuth } from "@/context/AuthContext";

/**
 * Pick or change her username.
 *
 * It is checked as she types (after a short pause) and shows free names built
 * from her own, so most women tap one instead of typing. Saving warns her
 * plainly that the next change opens in 90 days — the one rule she cannot undo.
 *
 * The parent remounts it on each open (a `key`), so it always starts from her
 * current name.
 */
export function UsernameSheet({ open, onClose, current, fullName, onSaved }: {
  open: boolean;
  onClose: () => void;
  current: string;
  fullName: string;
  onSaved: () => void;
}) {
  const { user, updateUser } = useAuth();
  const [value, setValue] = useState(current);
  const [check, setCheck] = useState<UsernameCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const name = value.trim().replace(/^@/, "").toLowerCase();
  const local = name ? usernameProblem(name) : "";
  const same = name === current;

  // Ask the server once she stops typing. An empty box asks too, so the
  // suggestions from her own name show before she types anything.
  useEffect(() => {
    if (!open || local || same) return;
    const ctl = new AbortController();
    const t = window.setTimeout(() => {
      apiCheckUsername(name || fullName.split(" ")[0] || "sakhi", ctl.signal)
        .then((c) => { if (!name) setCheck({ ...c, available: false, reason: "" }); else setCheck(c); })
        .catch(() => { /* the save will say it */ });
    }, 350);
    return () => { window.clearTimeout(t); ctl.abort(); };
  }, [name, open, local, same, fullName]);

  const live = check && check.username === name ? check : null;
  const ok = !!name && !local && !same && !!live?.available;
  const reason = local || (live && !live.available ? live.reason : "");
  const ideas = check?.suggestions ?? [];

  const save = async () => {
    setBusy(true); setError("");
    try {
      const s = await apiSetUsername(name);
      if (user) updateUser({ ...user, username: s.username, display_name: s.display_name });
      toast(`You are now @${s.username}`, { tone: "success" });
      onSaved();
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} icon="AtSign" title={current ? "Change your username" : "Pick a username"}
           description="Other women see this name on your posts, in circles and when they search for you."
           footer={
             <div className="space-y-2">
               {ok && (
                 <p className="flex items-start gap-1.5 text-xs" style={{ color: "var(--ux-muted)" }}>
                   <Icons.Info className="mt-px h-3.5 w-3.5 shrink-0" />
                   After you save, you can change it again in 90 days.
                 </p>
               )}
               <Btn full icon="Check" disabled={!ok} loading={busy} onClick={save}>
                 {ok ? `Save @${name}` : "Save"}
               </Btn>
             </div>
           }>
      <Text label="Username" prefix="@" value={value} max={20} placeholder="priya.sews"
            onChange={(s) => setValue(s.replace(/\s/g, "").toLowerCase())} />
      <p className="mt-2 min-h-[20px] text-xs font-semibold"
         style={{ color: ok ? "var(--ux-green-ink)" : reason ? "var(--ux-danger-ink)" : "var(--ux-muted)" }}>
        {ok ? <><Icons.CircleCheck className="me-1 inline h-3.5 w-3.5" />@{name} is free</>
          : reason || (same && current ? "This is your username now." : "Small letters, numbers, dots and underscores.")}
      </p>
      {error && <p role="alert" className="mt-1 text-xs font-semibold" style={{ color: "var(--ux-danger-ink)" }}>{error}</p>}

      {ideas.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-bold" style={{ color: "var(--ux-ink-2)" }}>Free names — tap one</p>
          <div className="flex flex-wrap gap-2">
            {ideas.map((s) => (
              <button key={s} type="button" onClick={() => setValue(s)}
                      className="ux-press min-h-[38px] rounded-full px-3.5 text-xsm font-semibold"
                      style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>
                @{s}
              </button>
            ))}
          </div>
        </div>
      )}

      <ul className="mt-5 space-y-2 rounded-[14px] p-3.5 text-xs leading-relaxed"
          style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>
        <li className="flex gap-2"><Icons.Users className="h-4 w-4 shrink-0" style={{ color: "var(--ux-brand)" }} /><span>No two women can have the same username.</span></li>
        <li className="flex gap-2"><Icons.CalendarClock className="h-4 w-4 shrink-0" style={{ color: "var(--ux-brand)" }} /><span>You can change it once every 90 days.</span></li>
        <li className="flex gap-2"><Icons.ShieldCheck className="h-4 w-4 shrink-0" style={{ color: "var(--ux-brand)" }} /><span>Until you pick one, others see your verified name: <b>{fullName || "your name"}</b>.</span></li>
      </ul>
    </Sheet>
  );
}
