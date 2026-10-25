"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import * as Icons from "@/components/ux/icons";
import { Avatar } from "@/components/ux/kit";
import { apiSearchPeople, type PersonRow } from "@/lib/people-api";
import { profileHref } from "@/lib/social-api";
import { FriendButton } from "./FriendButton";

/**
 * Find a woman by her username. Results arrive as she types (after a short
 * pause); each row opens her page, and carries the friend button in the state
 * it is really in.
 */
export function PeopleSearch({ autoFocus, withActions = true, compact }: {
  autoFocus?: boolean;
  withActions?: boolean;
  compact?: boolean;
}) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<PersonRow[] | null>(null);
  const term = q.trim().replace(/^@/, "");

  useEffect(() => {
    if (term.length < 2) return;
    const ctl = new AbortController();
    const t = window.setTimeout(() => {
      apiSearchPeople(term, ctl.signal).then(setRows).catch(() => { /* typing on */ });
    }, 250);
    return () => { window.clearTimeout(t); ctl.abort(); };
  }, [term]);

  const shown = term.length < 2 ? null : rows;

  return (
    <div>
      <label className="flex min-h-[44px] items-center gap-2 rounded-full border px-3.5"
             style={{ borderColor: "var(--ux-line)", background: "var(--ux-surface)" }}>
        <Icons.Search className="h-4 w-4 shrink-0" style={{ color: "var(--ux-muted)" }} />
        <input value={q} onChange={(e) => setQ(e.target.value.replace(/\s/g, ""))} autoFocus={autoFocus}
               aria-label="Search people by username" placeholder="Search by @username"
               className="min-w-0 flex-1 bg-transparent text-xsm outline-none" style={{ color: "var(--ux-ink)" }} />
        {q && (
          <button type="button" aria-label="Clear" onClick={() => { setQ(""); setRows(null); }}
                  className="ux-press grid h-7 w-7 place-items-center rounded-full" style={{ color: "var(--ux-muted)" }}>
            <Icons.X className="h-4 w-4" />
          </button>
        )}
      </label>
      {shown && (
        <ul className={`mt-2 space-y-1 ${compact ? "max-h-[300px] overflow-y-auto" : ""}`}>
          {shown.length === 0 && (
            <li className="px-2 py-3 text-xs" style={{ color: "var(--ux-muted)" }}>
              Nobody with a username starting “{term}”.
            </li>
          )}
          {shown.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-[12px] p-2" style={{ background: "var(--ux-surface-2)" }}>
              <Link href={profileHref(p)} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar src={p.avatar} name={p.name} size={40} />
                <span className="min-w-0">
                  <span className="flex items-center gap-1 truncate text-xsm font-bold" style={{ color: "var(--ux-ink)" }}>
                    {p.name}{p.verified && <Icons.BadgeCheck className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--ux-blue)" }} />}
                  </span>
                  <span className="block truncate text-2xs" style={{ color: "var(--ux-muted)" }}>
                    {[p.username !== p.name ? `@${p.username}` : "", p.location || "WomSakhi member"].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </Link>
              {withActions && <FriendButton key={p.relation} userId={p.id} relation={p.relation} name={p.name} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
