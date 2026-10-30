import { apiClient } from "./api";

/**
 * My Khata — notes, money in and out, and chits (backend: routes/khata.py,
 * rules and chit maths: app/core/khata.py).
 *
 * The PIN: when she has set one, every call needs the key the PIN minted, in
 * `X-Khata-Key`. The key lives in sessionStorage — gone when the tab closes —
 * and the server refuses with 423 (`isLocked`) once it lapses, which is the
 * screen's cue to ask for the PIN again. Amounts are paise everywhere.
 */

const KEY = "ws.khata.key";

export function khataKey(): string {
  try { return window.sessionStorage.getItem(KEY) || ""; } catch { return ""; }
}
export function setKhataKey(key: string) {
  try { if (key) window.sessionStorage.setItem(KEY, key); else window.sessionStorage.removeItem(KEY); } catch { /* private mode: asks again */ }
}

const opts = (signal?: AbortSignal) => ({ signal, headers: khataKey() ? { "X-Khata-Key": khataKey() } : {} });
const get = <T,>(url: string, signal?: AbortSignal, params?: object) =>
  apiClient.get<T>(url, { ...opts(signal), params }).then((r) => r.data);
const post = <T,>(url: string, body?: unknown) => apiClient.post<T>(url, body ?? {}, opts()).then((r) => r.data);
const patch = <T,>(url: string, body: unknown) => apiClient.patch<T>(url, body, opts()).then((r) => r.data);
const put = <T,>(url: string, body: unknown) => apiClient.put<T>(url, body, opts()).then((r) => r.data);
const del = <T,>(url: string, body?: unknown) => apiClient.delete<T>(url, { ...opts(), data: body }).then((r) => r.data);

/** The server refused because her khata is locked — ask for the PIN. */
export const isLocked = (e: unknown) => (e as { response?: { status?: number } })?.response?.status === 423;

/* ── lock ───────────────────────────────────────────────────────────── */

export interface KhataSettings { pin_set: boolean; hide_amounts: boolean }
export interface KhataKey { key: string; expires_at: string }

export const apiKhataSettings = (s?: AbortSignal) => get<KhataSettings>("/me/khata/settings", s);
export const apiKhataHideAmounts = (hide_amounts: boolean) => patch<KhataSettings>("/me/khata/settings", { hide_amounts });
/** Set a 4-digit PIN (pass the current one to change it). Returns a fresh key. */
export const apiKhataSetPin = (pin: string, current_pin = "") => put<KhataKey>("/me/khata/pin", { pin, current_pin });
export const apiKhataUnlock = (pin: string) => post<KhataKey>("/me/khata/unlock", { pin });
export const apiKhataRemovePin = (pin: string) => del<{ pin_set: false }>("/me/khata/pin", { pin });
/** Only works within 15 minutes of signing in (403 `sign_in_again` otherwise). */
export const apiKhataForgotPin = () => post<{ pin_set: false }>("/me/khata/forgot-pin");

/* ── notes ──────────────────────────────────────────────────────────── */

export const NOTE_COLOURS = ["plain", "pink", "yellow", "green", "blue", "violet"] as const;
export type NoteColour = (typeof NOTE_COLOURS)[number];

export interface KhataNote {
  id: string; text: string; colour: NoteColour; pinned: boolean;
  amount_minor: number | null;
  /** YYYY-MM-DD, or null. */
  remind_on: string | null;
  updated_at: string;
}
export interface NoteInput { text: string; colour?: NoteColour; pinned?: boolean; amount_minor?: number | null; remind_on?: string | null }

export const apiKhataNotes = (q = "", s?: AbortSignal) => get<KhataNote[]>("/me/khata/notes", s, q ? { q } : undefined);
export const apiKhataAddNote = (n: NoteInput) => post<KhataNote>("/me/khata/notes", n);
export const apiKhataEditNote = (id: string, p: Partial<NoteInput> & { clear_amount?: boolean; clear_reminder?: boolean }) =>
  patch<KhataNote>(`/me/khata/notes/${id}`, p);
export const apiKhataDeleteNote = (id: string) => del<{ ok: boolean }>(`/me/khata/notes/${id}`);

/* ── money in and out ───────────────────────────────────────────────── */

export const IN_CATEGORIES = ["wages", "sales", "chit_payout", "chit_commission", "rent_earned", "gift", "family", "loan_taken", "other_in"] as const;
export const OUT_CATEGORIES = ["food", "home", "children", "health", "travel", "phone", "chit_payment", "rent_paid", "loan_repaid", "other_out"] as const;
/** Words and pictures for each category (icon names from components/ux/icons). */
export const CATEGORY_LOOK: Record<string, { label: string; icon: string }> = {
  wages: { label: "Wages", icon: "Briefcase" }, sales: { label: "Sales", icon: "Store" },
  chit_payout: { label: "Chit pot", icon: "Coins" }, chit_commission: { label: "Chit commission", icon: "Coins" },
  gift: { label: "Gift", icon: "Gift" }, family: { label: "From family", icon: "Users" },
  loan_taken: { label: "Loan taken", icon: "Landmark" }, other_in: { label: "Other", icon: "Plus" },
  food: { label: "Food & groceries", icon: "ShoppingBasket" }, home: { label: "Home & rent", icon: "Home" },
  children: { label: "Children & school", icon: "GraduationCap" }, health: { label: "Health", icon: "HeartPulse" },
  travel: { label: "Travel", icon: "Bus" }, phone: { label: "Phone & recharge", icon: "Smartphone" },
  chit_payment: { label: "Chit payment", icon: "Coins" },
  rent_earned: { label: "Rented out", icon: "KeyRound" }, rent_paid: { label: "Rented", icon: "KeyRound" }, loan_repaid: { label: "Loan repaid", icon: "Landmark" },
  other_out: { label: "Other", icon: "Minus" },
};

export interface KhataEntry {
  id: string; kind: "in" | "out"; amount_minor: number; note: string; category: string;
  /** YYYY-MM-DD. */
  on: string;
  /** "chit": written by a chit — read-only here, changed in the chit. */
  /** "chit" / "rental": written by a chit or a rental — read-only here. */
  source: "me" | "chit" | "rental" | "bill";
  commitment_id?: string;
  chit_id: string;
  /** The rental it came from (Rent & borrow). */
  booking_id?: string;
}
export interface KhataMonth {
  month: string; items: KhataEntry[]; in_minor: number; out_minor: number; left_minor: number;
  by_category: Record<string, number>;
}
export interface EntryInput { kind: "in" | "out"; amount_minor: number; note?: string; category?: string; on?: string }

export const apiKhataMonth = (month = "", s?: AbortSignal) => get<KhataMonth>("/me/khata/entries", s, month ? { month } : undefined);
export const apiKhataAddEntry = (e: EntryInput) => post<KhataEntry>("/me/khata/entries", e);
export const apiKhataEditEntry = (id: string, p: Partial<Omit<EntryInput, "kind">>) => patch<KhataEntry>(`/me/khata/entries/${id}`, p);
export const apiKhataDeleteEntry = (id: string) => del<{ ok: boolean }>(`/me/khata/entries/${id}`);

/* ── chits ──────────────────────────────────────────────────────────── */

export type ChitMethod = "auction" | "draw" | "fixed";

export interface ChitSummary {
  id: string; name: string;
  /** owner — she keeps this record; member — someone linked her to theirs. */
  viewer: "owner" | "member";
  /** The organiser's first name — who keeps the record. */
  owner_name: string;
  my_role: "organiser" | "member";
  value_minor: number; members_count: number; monthly_minor: number;
  /** YYYY-MM. */
  start_month: string; end_month: string;
  method: ChitMethod; commission_pct: number; status: "running" | "closed";
  /** 1-based; 0 before it starts; > members_count once it has ended. */
  month_now: number; members_added: number;
  collected_minor: number;
  /** Owner only (0 for a member). */
  owed_minor: number;
  my_member_id: string; my_due_minor: number; i_won: boolean; my_turn_month: number;
}
export interface ChitMonth {
  month: number; label: string; when: "past" | "now" | "later";
  winner: string; how: "" | "auction" | "draw" | "fixed" | "picked";
  bid_minor: number; payout_minor: number; dividend_minor: number; due_minor: number; commission_minor: number;
  /** Member ids who have paid; and who said they paid, waiting for the organiser. */
  paid: string[]; claimed: string[];
}
export interface ChitMember {
  id: string; name: string; order: number; linked: boolean; is_me: boolean; won_month: number;
  /** Only sent to the owner. */
  phone?: string;
}
export interface Chit extends ChitSummary {
  months: ChitMonth[]; members: ChitMember[]; max_bid_minor: number; min_bid_minor: number;
}
export interface MemberInput { name?: string; phone?: string; username?: string }
export interface ChitInput {
  name: string; value_rupees: number; members_count: number; start_month: string; method: ChitMethod;
  commission_pct: number; my_role: "organiser" | "member"; i_am_member: boolean; members: MemberInput[];
}

export const CHIT_VALUES = [100000, 200000, 500000, 1000000];
export const MAX_COMMISSION_PCT = 5;
export const MAX_BID_PCT = 40;

export const apiChits = (s?: AbortSignal) => get<ChitSummary[]>("/me/khata/chits", s);
export const apiChit = (id: string, s?: AbortSignal) => get<Chit>(`/me/khata/chits/${id}`, s);
export const apiAddChit = (c: ChitInput) => post<Chit>("/me/khata/chits", c);
export const apiEditChit = (id: string, p: { name?: string; status?: "running" | "closed" }) => patch<Chit>(`/me/khata/chits/${id}`, p);
export const apiDeleteChit = (id: string) => del<{ ok: boolean }>(`/me/khata/chits/${id}`);
export const apiAddChitMember = (id: string, m: MemberInput) => post<Chit>(`/me/khata/chits/${id}/members`, m);
export const apiEditChitMember = (id: string, mid: string, p: { name?: string; phone?: string }) =>
  patch<Chit>(`/me/khata/chits/${id}/members/${mid}`, p);
export const apiRemoveChitMember = (id: string, mid: string) => del<Chit>(`/me/khata/chits/${id}/members/${mid}`);
export const apiChitOrder = (id: string, member_ids: string[]) => put<Chit>(`/me/khata/chits/${id}/order`, { member_ids });
/** auction: member_id + bid_rupees; draw: { draw: true } or a member_id drawn offline; fixed: {} uses the order. */
export const apiChitDecide = (id: string, month: number, body: { member_id?: string; bid_rupees?: number; draw?: boolean }) =>
  post<Chit>(`/me/khata/chits/${id}/months/${month}/decide`, body);
export const apiChitPaid = (id: string, month: number, member_id: string, paid: boolean) =>
  post<Chit>(`/me/khata/chits/${id}/months/${month}/payments`, { member_id, paid });
export const apiChitIPaid = (id: string, month: number) => post<Chit>(`/me/khata/chits/${id}/months/${month}/i-paid`);

/** The chit maths, mirrored from app/core/khata.py, for the live preview while she types a bid. */
export function settlePreview(c: Pick<Chit, "value_minor" | "members_count" | "monthly_minor" | "method" | "commission_pct">, bidMinor: number) {
  const commission = Math.round((c.value_minor * c.commission_pct) / 100);
  if (c.method === "auction") {
    const dividend = Math.floor((bidMinor - commission) / c.members_count);
    return { payout: c.value_minor - bidMinor, dividend, due: c.monthly_minor - dividend, commission };
  }
  return { payout: c.value_minor - commission, dividend: 0, due: c.monthly_minor, commission };
}
