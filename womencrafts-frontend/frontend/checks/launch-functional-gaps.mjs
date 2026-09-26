/** Live persistence checks for the circle, goal and wellbeing gaps closed during launch hardening. */
import { API, seededMemberToken } from "./_shared.mjs";

const token = await seededMemberToken();
const checks = [];
const check = (ok, label, detail = "") => checks.push({ ok: Boolean(ok), label, detail });
const call = async (path, method = "GET", body) => {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Idempotency-Key": `launch-gaps-${Date.now()}-${Math.random()}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json().catch(() => null) };
};

check(Boolean(token), "member signs in");
const name = `Launch gap check ${Date.now()}`;
const made = await call("/community/circles", "POST", {
  name, topic: "Testing", desc: "Temporary launch verification circle", guidelines: "Be kind",
  who_posts: "hosts", tags: ["testing"], is_private: false,
});
check(made.status === 201 && made.data?.id, "host creates a host-only circle", String(made.status));
const circleId = made.data?.id;
if (circleId) {
  const detail = await call(`/community/circles/${circleId}`);
  check(detail.data?.owner === true && detail.data?.can_post === true, "host permissions return from API");
  const members = await call(`/community/circles/${circleId}/members`);
  check(members.status === 200 && members.data?.some((row) => row.you), "real member roster returns the signed-in host");
  const edited = await call(`/community/circles/${circleId}`, "PATCH", {
    name: `${name} edited`, topic: "Business", desc: "Edited and persisted", guidelines: "Kind and useful",
    tags: ["business"], who_posts: "all", review_first: false, tell_me: true,
  });
  check(edited.status === 200 && edited.data?.desc === "Edited and persisted", "circle edit persists");
  const muted = await call(`/community/circles/${circleId}/preferences`, "PATCH", { muted: true });
  check(muted.status === 200 && muted.data?.muted === true, "circle mute persists");
  const report = await call("/safety/reports", "POST", {
    category: "Something in a circle or post", details: "Automated launch check; safe to close.", about: `circle:${circleId}`,
  });
  check(report.status === 201 && report.data?.id, "circle report enters safety queue");
}

const goalLabel = `Launch goal ${Date.now()}`;
const goals = await call("/me/goals", "POST", { label: goalLabel, kind: "count", target: 3, by: "this week", unit: "times" });
const goal = goals.data?.find?.((row) => row.label === goalLabel);
check(goals.status === 201 && goal?.id, "goal creates");
if (goal?.id) {
  const edited = await call(`/me/goals/${goal.id}/details`, "PATCH", {
    label: `${goalLabel} edited`, target: 4, by: "next week", unit: "times", note: "One small step each day",
  });
  const row = edited.data?.find?.((item) => item.id === goal.id);
  check(edited.status === 200 && row?.note === "One small step each day" && row?.target === 4, "goal edit and note persist");
  await call(`/me/goals/${goal.id}`, "DELETE");
}

const activity = await call("/engines/mood/activity");
check(activity.status === 200, "wellbeing activity endpoint responds");
if (activity.data?.activity?.id) {
  const id = activity.data.activity.id;
  check((await call(`/engines/mood/activity/${id}/action`, "POST", { action: "started" })).status === 200, "activity start records");
  check((await call(`/engines/mood/activity/${id}/action`, "POST", { action: "saved" })).status === 200, "activity saves");
  const saved = await call("/engines/mood/activities/saved");
  check(saved.data?.activities?.some((row) => row.id === id), "saved activity can be revisited");
  check((await call(`/engines/mood/activity/${id}/action`, "POST", { action: "completed" })).status === 200, "activity completion records");
  await call(`/engines/mood/activity/${id}/action`, "POST", { action: "unsaved" });
}

const reminderTitle = `launch.reminder.${Date.now()}`;
const due = new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString();
const reminder = await call("/engines/reminders", "POST", {
  title_key: reminderTitle, schedule_type: "once", at: due, tz: "Asia/Kolkata",
  category: "activities", payload: { href: "/app/health/today" },
});
check(reminder.status === 201 && reminder.data?.id, "one-off reminder creates with a deep link");
if (reminder.data?.id) {
  const reminderId = reminder.data.id;
  const listed = await call("/engines/reminders");
  check(listed.data?.reminders?.some((row) => row.id === reminderId), "reminder persists in her list");
  const next = await call(`/engines/reminders/${reminderId}/next`);
  check(next.status === 200 && next.data?.next?.length > 0, "next reminder occurrence is computed");
  const changed = await call(`/engines/reminders/${reminderId}`, "PATCH", {
    payload: { href: "/app/goals" }, category: "goals",
  });
  check(changed.status === 200 && changed.data?.updated === true, "reminder edit persists");
  const stopped = await call(`/engines/reminders/${reminderId}`, "DELETE");
  check(stopped.status === 200 && stopped.data?.stopped === true, "reminder stops safely");
}

for (const row of checks) console.log(`${row.ok ? "PASS" : "FAIL"}: ${row.label}${row.detail ? ` (${row.detail})` : ""}`);
const failed = checks.filter((row) => !row.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} functional gap checks passed`);
if (failed.length) process.exit(1);
