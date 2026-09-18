"use client";

import { useCallback, useState } from "react";
import { COPY } from "@/components/ux/copy";

import { apiNotificationPrefs, apiSaveNotificationPrefs, type NotificationPrefs } from "@/lib/member-api";
import { useResource } from "@/lib/use-resource";
import { useAction } from "@/lib/use-action";

import { Btn } from "@/components/ux/kit";
import { SettingsPage, Toggle } from "@/components/ux/settings/Frame";
import { useT } from "@/i18n";
import { phonePrimary } from "@/components/ux/PhoneParts";
import { Group, SaveBar } from "../_parts/Group";

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
  const tr = useT();
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
      sub={tr("settingsNotifications.whatReachesYouAndHowYou")}
      footer={
        <SaveBar tone={save.error ? "--ux-orange-ink" : saved ? "--ux-green-ink" : "--ux-faint"}
                 status={save.error ? save.error : saved ? "Saved." : COPY.nothingSavedYet}>
          <Btn variant="primary" icon={save.busy ? "Loader" : "Check"} disabled={save.busy}
               className={phonePrimary} onClick={() => void save.run()}>
            {save.busy ? "Saving…" : "Save changes"}
          </Btn>
        </SaveBar>
      }
    >
      <Group title={tr("settingsNotifications.worthInterruptingYourDay")}
             sub={tr("settingsNotifications.weSuggestLeavingTheseOnMoney")}>
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
          <Toggle on={p.bookings} onChange={set("bookings")} label={tr("settingsNotifications.sessionAndEventReminders")}
                  whenOn="A reminder an hour before anything you booked."
                  whenOff="No reminder — you will need to remember yourself." />
        </div>
      </Group>

      <Group title={tr("settingsNotifications.niceToKnow")} sub={tr("settingsNotifications.nothingHereIsUrgent")}>
        <div className="divide-y" style={{ borderColor: "var(--ux-line)" }}>
          <Toggle on={p.circles} onChange={set("circles")} label={tr("settingsNotifications.yourCircles")}
                  whenOn="When a circle you are in posts something."
                  whenOff="You will see it next time you open the circle." />
          <Toggle on={p.programs} onChange={set("programs")} label={tr("settingsNotifications.newCoursesAndEvents")}
                  whenOn="A message when something new matches what you do."
                  whenOff="You will find them in Discover whenever you look." />
        </div>
      </Group>

      <Group title={tr("settingsNotifications.howTheyReachYou")} noteIcon="ShieldCheck"
             note={tr("settingsNotifications.safetyAlertsAlwaysReachYouWhatever")}>
        <div className="divide-y" style={{ borderColor: "var(--ux-line)" }}>
          <Toggle on={p.email} onChange={set("email")} label="Email"
                  whenOn="A daily summary of anything you missed."
                  whenOff="Nothing by email except password changes." />
          <Toggle on={p.sms} onChange={set("sms")} label={tr("settingsNotifications.textMessage")}
                  whenOn="Money and orders also come by SMS. Useful on a weak connection."
                  whenOff="No text messages except your sign-in code." />
        </div>
      </Group>
    </SettingsPage>
  );
}
