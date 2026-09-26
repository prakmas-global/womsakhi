import { apiClient } from "./api";

/**
 * The staff side of Resources: the reference catalogue members read under
 * Schemes / Cover / Health / Rights / Family / Travel, and the wellbeing cards
 * the mood engine hands out after a check-in. Every call is behind the
 * "resources" module key server-side.
 *
 * Uptake numbers are counts over a member's private marks. The server never
 * returns which members; these shapes have nowhere to put a name.
 */

/* ── static reference content ─────────────────────────────────────────── */

export type ReferenceTopic =
  | "scheme" | "cover" | "health" | "rights" | "family" | "travel" | "helpline" | "guidance";
export type ReferenceStatus = "published" | "draft" | "archived";

export const TOPICS: ReferenceTopic[] = [
  "scheme", "cover", "health", "rights", "family", "travel", "helpline", "guidance",
];

export const TOPIC_LABEL: Record<ReferenceTopic, string> = {
  scheme: "Schemes",
  cover: "Insurance & pension",
  health: "Health",
  rights: "Rights",
  family: "Family & childcare",
  travel: "Getting about",
  helpline: "Helplines",
  guidance: "Guidance",
};

/** The payload keys each member screen reads. Help text, not data. */
export const TOPIC_PAYLOAD_HINT: Record<ReferenceTopic, string> = {
  scheme: "body_name, amount, category, deadline, needs (list), where, steps (list)",
  cover: "kind, pays, renews, steps (list)",
  health: "every, where",
  rights: "law, what_to_do",
  family: "ages, hours, meals (true/false), steps (list)",
  travel: "tip, number",
  helpline: "number, context (general | health | legal | family | travel | money | safety), hours",
  guidance: "context (health | legal | family | travel | safety | money), step, icon, mins",
};

export const STATUS_LABEL: Record<ReferenceStatus, string> = {
  published: "Published",
  draft: "Draft",
  archived: "Archived",
};

export const STATUS_TONE: Record<ReferenceStatus, "emerald" | "amber" | "slate"> = {
  published: "emerald",
  draft: "amber",
  archived: "slate",
};

export const MOODS = ["good", "tired", "low", "anxious", "angry", "unwell"] as const;
export const STYLES = ["practical", "gentle", "quiet", "none"] as const;
export const CARD_KINDS = [
  { value: "word", label: "Something to read" },
  { value: "do", label: "Something to do" },
];

/* ── shared ───────────────────────────────────────────────────────────── */

export interface PageMeta {
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

/* ── the catalogue ────────────────────────────────────────────────────── */

export interface ReferenceRow {
  id: string;
  topic: ReferenceTopic | string;
  title: string;
  body: string;
  city: string;
  rank: number;
  free: boolean | null;
  cost_label: string;
  who: string;
  payload: Record<string, unknown>;
  status: ReferenceStatus | string;
  reviewed_by: string;
  reviewed_at: string;
  created_at: string;
  updated_at: string;
  /** Members who marked this entry, in any state. A count only. */
  uptake: number;
  /** saved / applied / active / done / declined → count. Filled on the detail call. */
  uptake_by_state: Record<string, number>;
}

export interface ReferenceInput {
  topic: ReferenceTopic | string;
  title: string;
  body: string;
  city: string;
  rank: number;
  free: boolean | null;
  cost_label: string;
  who: string;
  payload: Record<string, unknown>;
}

export interface ReferencePage {
  items: ReferenceRow[];
  meta: PageMeta;
}

export interface TopicCount {
  topic: string;
  label: string;
  published: number;
  draft: number;
  archived: number;
  total: number;
}

export interface ReviewCounts {
  total: number;
  reviewed: number;
  unreviewed: number;
}

export interface ResourcesSummary {
  catalogue: { published: number; draft: number; archived: number; total: number; marks: number };
  topics: TopicCount[];
  cards: ReviewCounts;
  activities: ReviewCounts;
}

export interface CatalogueParams {
  topic?: string;
  q?: string;
  city?: string;
  free?: "" | "free" | "paid" | "unknown";
  status?: "" | ReferenceStatus;
  page?: number;
  page_size?: number;
}

/** Drop empty strings so the server sees "no filter", not "filter on ''". */
function clean<T extends object>(params: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === "" || v === undefined || v === null) continue;
    (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

export const apiResourcesSummary = () =>
  apiClient.get<ResourcesSummary>("/admin/resources/summary").then((r) => r.data);

export const apiResourceTopics = () =>
  apiClient.get<TopicCount[]>("/admin/resources/topics").then((r) => r.data);

export const apiCatalogue = (params: CatalogueParams = {}) =>
  apiClient
    .get<ReferencePage>("/admin/resources/catalogue", { params: clean(params) })
    .then((r) => r.data);

export const apiCatalogueEntry = (id: string) =>
  apiClient.get<ReferenceRow>(`/admin/resources/catalogue/${id}`).then((r) => r.data);

export const apiCreateEntry = (body: ReferenceInput) =>
  apiClient.post<ReferenceRow>("/admin/resources/catalogue", body).then((r) => r.data);

export const apiUpdateEntry = (id: string, body: ReferenceInput) =>
  apiClient.put<ReferenceRow>(`/admin/resources/catalogue/${id}`, body).then((r) => r.data);

export const apiApproveEntry = (id: string) =>
  apiClient.post<ReferenceRow>(`/admin/resources/catalogue/${id}/approve`).then((r) => r.data);

export const apiUnpublishEntry = (id: string) =>
  apiClient.post<ReferenceRow>(`/admin/resources/catalogue/${id}/unpublish`).then((r) => r.data);

export const apiArchiveEntry = (id: string) =>
  apiClient.post<ReferenceRow>(`/admin/resources/catalogue/${id}/archive`).then((r) => r.data);

export const apiUnarchiveEntry = (id: string) =>
  apiClient.post<ReferenceRow>(`/admin/resources/catalogue/${id}/unarchive`).then((r) => r.data);

/* ── wellbeing: support cards and activities ──────────────────────────── */

export type WellbeingKind = "cards" | "activities";

export interface CardRow {
  id: string;
  title: string;
  body: string;
  kind: "word" | "do" | string;
  moods: string[];
  styles: string[];
  minutes: number;
  reviewed: boolean;
  reviewed_by: string;
  reviewed_at: string;
  /** Came from the engine's seed rather than a person on this screen. */
  seeded: boolean;
  created_at: string;
  updated_at: string;
}

export interface CardInput {
  title: string;
  body: string;
  kind: "word" | "do" | string;
  moods: string[];
  styles: string[];
  minutes: number;
}

export interface CardPage {
  items: CardRow[];
  meta: PageMeta;
}

export interface ActivityRow {
  id: string;
  text: string;
  minutes: number;
  icon: string;
  reviewed: boolean;
  reviewed_by: string;
  reviewed_at: string;
  seeded: boolean;
  created_at: string;
  updated_at: string;
}

export interface ActivityInput {
  text: string;
  minutes: number;
  icon: string;
}

export interface ActivityPage {
  items: ActivityRow[];
  meta: PageMeta;
}

export interface CardParams {
  q?: string;
  reviewed?: "" | "reviewed" | "unreviewed";
  mood?: string;
  style?: string;
  page?: number;
  page_size?: number;
}

export interface ActivityParams {
  q?: string;
  reviewed?: "" | "reviewed" | "unreviewed";
  page?: number;
  page_size?: number;
}

export const apiSupportCards = (params: CardParams = {}) =>
  apiClient
    .get<CardPage>("/admin/resources/wellbeing/cards", { params: clean(params) })
    .then((r) => r.data);

export const apiCreateCard = (body: CardInput) =>
  apiClient.post<CardRow>("/admin/resources/wellbeing/cards", body).then((r) => r.data);

export const apiUpdateCard = (id: string, body: CardInput) =>
  apiClient.put<CardRow>(`/admin/resources/wellbeing/cards/${id}`, body).then((r) => r.data);

export const apiActivities = (params: ActivityParams = {}) =>
  apiClient
    .get<ActivityPage>("/admin/resources/wellbeing/activities", { params: clean(params) })
    .then((r) => r.data);

export const apiCreateActivity = (body: ActivityInput) =>
  apiClient.post<ActivityRow>("/admin/resources/wellbeing/activities", body).then((r) => r.data);

export const apiUpdateActivity = (id: string, body: ActivityInput) =>
  apiClient
    .put<ActivityRow>(`/admin/resources/wellbeing/activities/${id}`, body)
    .then((r) => r.data);

export const apiReviewWellbeing = (kind: WellbeingKind, id: string) =>
  apiClient
    .post<CardRow | ActivityRow>(`/admin/resources/wellbeing/${kind}/${id}/review`)
    .then((r) => r.data);

export const apiUnreviewWellbeing = (kind: WellbeingKind, id: string) =>
  apiClient
    .post<CardRow | ActivityRow>(`/admin/resources/wellbeing/${kind}/${id}/unreview`)
    .then((r) => r.data);

export const apiDeleteWellbeing = (kind: WellbeingKind, id: string) =>
  apiClient
    .delete<{ message: string }>(`/admin/resources/wellbeing/${kind}/${id}`)
    .then((r) => r.data);
