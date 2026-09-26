"use client";

import { Avatar, Badge } from "@/design-system";
import type { Person } from "@/lib/market-admin-api";

/**
 * A member as the market screens show her: avatar, name, member code.
 *
 * That is the whole of it on purpose. The market routes never send an email
 * or a phone number, so there is nothing else this cell could render — and a
 * staff member who needs to reach her goes to People, behind its own
 * permission, where that access is recorded.
 */
export default function PersonCell({
  person,
  note,
  size = "sm",
}: {
  person: Person;
  /** One short line under the name — "seeded, no account", a date. */
  note?: string;
  size?: "xs" | "sm" | "md";
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar name={person.name} src={person.avatar || undefined} size={size} />
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-ink">
          <span className="truncate">{person.name}</span>
          {person.suspended && <Badge tone="rose">Suspended</Badge>}
        </p>
        {(person.member_id || note) && (
          <p className="truncate text-2xs text-ink-subtle">
            {person.member_id}
            {person.member_id && note ? " · " : ""}
            {note}
          </p>
        )}
      </div>
    </div>
  );
}
