/**
 * Local preview fixtures for the onboarding flow (`/app/onboarding?preview=`).
 *
 * Loaded only with a dynamic `import()` inside an `AUTH_PREVIEW` branch, so a
 * production build never emits this module at all (see lib/auth-preview).
 * The names and items are the approved mockup's, so a preview can be laid
 * beside it.
 */
import type { Answers, CircleInfo, OnboardingState, PreparedItem, Skill } from "@/lib/onboarding-api";
import type { OnboardingPreview } from "@/lib/auth-preview";

const EMPTY: Answers = {
  goals: null, skills: null, learn_topics: null, meet: null, free_times: null,
  minutes_per_day: null, voice_prompts: null, helper_mode: null, shared_phone: null,
};

const LAKSHMI: Answers = {
  goals: ["learn", "earn_home"], skills: ["tailoring"], learn_topics: ["digital", "money"], meet: null,
  free_times: ["evening"], minutes_per_day: 20, voice_prompts: false, helper_mode: false, shared_phone: false,
};

function state(answers: Answers, over: Partial<OnboardingState> = {}): OnboardingState {
  const granted = { granted: true, at: "2026-09-30T09:00:00Z", notice_version: "onboarding-v1", language: "en" };
  const none = { granted: null, at: null, notice_version: null, language: null };
  return {
    answers,
    answered: (Object.keys(answers) as (keyof Answers)[]).filter((k) => answers[k] !== null),
    consents: { setup: granted, job_updates: none, employer_visibility: none },
    notice_version: "onboarding-v1", version: 1, offered: true, completed: false,
    answered_at: null, updated_at: null, skipped_at: null, last_reviewed_at: null,
    checkin_due: false, make_it_yours: false,
    setup: { ready: false, last_run_at: null, items: 0 },
    ...over,
  };
}

const ANSWERS_BY_STATE: Record<Exclude<OnboardingPreview, "invite">, Answers> = {
  welcome: EMPTY,
  language: { ...EMPTY },
  goals: { ...EMPTY, voice_prompts: false, helper_mode: false, goals: ["learn", "earn_home"] },
  skills: { ...EMPTY, voice_prompts: false, helper_mode: false, goals: ["learn", "earn_home"], skills: ["tailoring"] },
  learn: { ...EMPTY, voice_prompts: false, helper_mode: false, goals: ["learn", "earn_home"], skills: ["tailoring"], learn_topics: ["digital", "money"] },
  meet: { ...EMPTY, voice_prompts: false, helper_mode: false, goals: ["meet"], meet: ["women_near_me"] },
  time: { ...LAKSHMI, shared_phone: null },
  phone: { ...LAKSHMI, shared_phone: null },
  "thanks-waiting": LAKSHMI,
  "setting-up": LAKSHMI,
  review: LAKSHMI,
  "circle-sheet": { ...LAKSHMI, goals: ["learn", "earn_home", "meet"], meet: ["women_near_me"] },
  "helper-handback": { ...LAKSHMI, helper_mode: true, shared_phone: null },
};

export function previewOnboarding(s: Exclude<OnboardingPreview, "invite">): OnboardingState {
  const a = ANSWERS_BY_STATE[s];
  if (s === "welcome") {
    const fresh = state(a);
    return { ...fresh, consents: { ...fresh.consents, setup: { granted: null, at: null, notice_version: null, language: null } } };
  }
  const done = s === "thanks-waiting" || s === "setting-up" || s === "review" || s === "circle-sheet";
  return state(a, { completed: done, setup: { ready: done, last_run_at: s === "review" || s === "circle-sheet" ? "2026-09-30T09:10:00Z" : null, items: 0 } });
}

const item = (key: string, type: PreparedItem["type"], title: string, st: string, reason: string, extra: Partial<PreparedItem> = {}): PreparedItem => ({
  key, type, id: key.split(":").pop() ?? key, title, state: st, visibility: "only_you", reason, source: "", created_at: "2026-09-30T09:10:00Z", still_chosen: true, ...extra,
});

export const PREVIEW_ITEMS: PreparedItem[] = [
  item("listing:skill=tailoring", "listing", "Tailoring, blouse stitching", "draft", "Because you chose Earn · Tailoring", { id: "preview-listing" }),
  item("programme:p1", "programme", "Phone basics", "suggested", "Because you chose Learn · Digital", { id: "p1" }),
  item("programme:p2", "programme", "Pricing your work", "suggested", "Because you chose Learn · Money", { id: "p2" }),
  item("programme:p3", "programme", "UPI safely", "suggested", "Because you chose Learn · Money", { id: "p3" }),
  item("circle:c1", "circle", "Tailors of Hyderabad", "suggested", "Because you chose Meet · Near you", { id: "c1" }),
  item("circle:c2", "circle", "New sellers", "suggested", "Because you chose Meet", { id: "c2" }),
  item("circle:c3", "circle", "Evening learners", "suggested", "Because you chose Meet", { id: "c3" }),
  item("saved_search:jobs", "saved_search", "New jobs for Tailoring", "saved", "Because you chose Earn · Tailoring", { id: "s1" }),
  item("goal:earn", "goal", "Earn my first ₹1,000 from tailoring", "proposed", "Because you chose Earn · Tailoring", { id: "earn" }),
  item("reminder:evening", "reminder", "20 minutes for you, every evening at 19:30", "proposed", "Because you said you are free in the evening",
    { id: "evening", proposal: { local_time: "19:30", days: [], minutes: 20 } }),
  item("welcome", "welcome", "Welcome to WomSakhi", "joined", "Everyone starts here — only the team posts", { id: "w1" }),
];

export const PREVIEW_CIRCLE: CircleInfo = {
  id: "c1", name: "Tailors of Hyderabad", topic: "Tailoring", desc: "", is_private: false, member_count: 128, joined: false,
};

const S = (key: string, label: string, popular = false): Skill => ({ key, label, group: "", group_label: "", service_category: "", popular });

export const PREVIEW_SKILLS: Skill[] = [
  S("tailoring", "Tailoring", true), S("hand_embroidery", "Hand embroidery", true), S("mehendi", "Mehendi", true),
  S("beauty_makeup", "Beauty & makeup", true), S("tiffin", "Tiffin & cooking", true), S("baking", "Cakes & baking", true),
  S("tuition", "Tuition", true), S("handicrafts", "Handicrafts", true), S("jewellery", "Jewellery making", true),
  S("pickles", "Pickles & papads", true), S("yoga", "Yoga", true), S("data_entry", "Data entry", true),
  S("blouse_stitching", "Blouse stitching"), S("aari_work", "Aari work"), S("crochet", "Crochet"), S("knitting", "Knitting"),
];
