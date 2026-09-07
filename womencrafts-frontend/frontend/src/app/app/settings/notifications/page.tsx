"use client";

import { useCallback, useState } from "react";

import { apiNotificationPrefs, apiSaveNotificationPrefs, type NotificationPrefs } from "@/lib/member-api";
import { useResource } from "@/lib/use-resource";
import { useAction } from "@/lib/use-action";
import * as Icons from "@/components/ux/icons";

import { Btn } from "@/components/ux/kit";
import { Card, SectionHead, SettingsPage, Toggle } from "@/components/ux/settings/Frame";

/**
 * Notifications.
 *
 * Grouped by what is at stake rather than by channel. "Money" and "Somebody is
 * waiting on you" are worth interrupting a day for; "New courses" is not, and
 * putting them in one undifferentiated list is how people turn everything off.
 *
 * Every switch says what SILENCE would mean, because that is the thing she is
 * actually deciding.
 */
export default function NotificationSettings() {
  /**
   * Her switches, as the server has them.
   *
   * They were `useState` with hardcoded defaults, so every visit showed the
   * same eight positions whatever she had chosen, and "Save changes" set a
   * flag that said "Saved." without saving. Three of the eight had no field on
   * the server at all — money, orders and circles — so even a wired button
   * would have discarded them silently. The server carries all nine now.
   */
  const { data: server, refetch } = useResource(
    useCallback(() => apiNotificationPrefs(), []),
    null as NotificationPrefs | null,
  );
  const [edited, setEdited] = useState<Partial<NotificationPrefs>>({});
  const [saved, setSaved] = useState(false);

  const p = {
    money: edited.money ?? server?.money ?? true,
    orders: edited.orders ?? server?.orders ?? true,
    messages: edited.messages ?? server?.messages ?? true,
    bookings: edited.booking_reminders ?? server?.booking_reminders ?? true,
    programs: edited.new_programs ?? server?.new_programs ?? false,
    circles: edited.circles ?? server?.circles ?? true,
    email: edited.email_copies ?? server?.email_copies ?? true,
    sms: edited.sms ?? server?.sms ?? false,
  };

  /** Screen name → server field. Written out so a rename cannot go unnoticed. */
  const FIELD: Record<keyof typeof p, keyof NotificationPrefs> = {
    money: "money", orders: "orders", messages: "messages",
    bookings: "booking_reminders", programs: "new_programs",
    circles: "circles", email: "email_copies", sms: "sms",
  };

  const set = (k: keyof typeof p) => (v: boolean) => {
    setEdited((e) => ({ ...e, [FIELD[k]]: v }));
    setSaved(false);
  };

  const save = useAction(
    async () => {
      const body: NotificationPrefs = {
        booking_reminders: p.bookings,
        program_updates: server?.program_updates ?? true,
        messages: p.messages,
        new_programs: p.programs,
        email_copies: p.email,
        money: p.money,
        orders: p.orders,
        circles: p.circles,
        sms: p.sms,
        // Carried through untouched. This screen does not edit quiet hours —
        // that is /app/settings/quiet-hours — but it PUTs the whole object,
        // so leaving them out would silently reset her window to the defaults
        // every time she changed an unrelated switch here.
        quiet_hours: server?.quiet_hours ?? true,
        quiet_start: server?.quiet_start ?? 1290,
        quiet_end: server?.quiet_end ?? 420,
        quiet_days: server?.quiet_days ?? [true, true, true, true, true, true, true],
        quiet_allow_money: server?.quiet_allow_money ?? true,
        quiet_allow_circle_lead: server?.quiet_allow_circle_lead ?? false,
      };
      await apiSaveNotificationPrefs(body);
    },
    {
      onDone: () => { setSaved(true); setEdited({}); refetch(); },
      fallbackError: "That did not save. Your settings are as they were — try again in a moment.",
    },
  );

  return (
    <SettingsPage
      title="Notifications"
      sub="What reaches you, and how. You can change any of it later."
      footer={
        <div className="flex items-center justify-between gap-4">
          <p className="text-[0.75rem]"
             style={{ color: save.error ? "var(--ux-orange-ink)" : saved ? "var(--ux-green-ink)" : "var(--ux-faint)" }}>
            {save.error ? save.error : saved ? "Saved." : "Nothing is saved until you press the button."}
          </p>
          <Btn variant="primary" icon={save.busy ? "Loader" : "Check"} disabled={save.busy}
               onClick={() => void save.run()}>
            {save.busy ? "Saving…" : "Save changes"}
          </Btn>
        </div>
      }
    >
      <Card>
        <SectionHead title="Worth interrupting your day"
                     sub="We suggest leaving these on — money and people waiting on you" />
        <div className="divide-y" style={{ borderColor: "var(--ux-line)" }}>
          <Toggle on={p.money} onChange={set("money")} label="Money"
                  whenOn="You are told when a payment arrives, or a withdrawal lands."
                  whenOff="You will only find out by opening the wallet yourself." />
          <Toggle on={p.orders} onChange={set("orders")} label="Orders"
                  whenOn="A new order tells you straight away."
                  whenOff="A buyer could wait days before you notice her order." />
          <Toggle on={p.messages} onChange={set("messages")} label="Messages"
                  whenOn="Buyers, mentors and employers reach you when they write."
                  whenOff="You will not know somebody has written until you look." />
          <Toggle on={p.bookings} onChange={set("bookings")} label="Session and event reminders"
                  whenOn="A reminder an hour before anything you booked."
                  whenOff="No reminder — you will need to remember yourself." />
        </div>
      </Card>

      <Card>
        <SectionHead title="Nice to know" sub="Nothing here is urgent" />
        <div className="divide-y" style={{ borderColor: "var(--ux-line)" }}>
          <Toggle on={p.circles} onChange={set("circles")} label="Your circles"
                  whenOn="When a circle you are in posts something."
                  whenOff="You will see it next time you open the circle." />
          <Toggle on={p.programs} onChange={set("programs")} label="New courses and events"
                  whenOn="A message when something new matches what you do."
                  whenOff="You will find them in Discover whenever you look." />
        </div>
      </Card>

      <Card>
        <SectionHead title="How they reach you" />
        <div className="divide-y" style={{ borderColor: "var(--ux-line)" }}>
          <Toggle on={p.email} onChange={set("email")} label="Email"
                  whenOn="A daily summary of anything you missed."
                  whenOff="Nothing by email except password changes." />
          <Toggle on={p.sms} onChange={set("sms")} label="Text message"
                  whenOn="Money and orders also come by SMS. Useful on a weak connection."
                  whenOff="No text messages except your sign-in code." />
        </div>
        <p className="mt-3.5 flex items-start gap-2.5 rounded-[12px] p-3 text-[0.75rem] leading-relaxed"
           style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>
          <Icons.ShieldCheck className="mt-[1px] h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-brand)" }} />
          Safety alerts always reach you, whatever is set here. Those cannot be turned off.
        </p>
      </Card>
    </SettingsPage>
  );
}
