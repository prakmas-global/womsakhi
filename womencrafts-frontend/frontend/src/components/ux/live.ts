"use client";

import { useCallback } from "react";

import { useResource, type Resource } from "@/lib/use-resource";
import {
  apiMarket, apiMarketListing,
  type MarketListing, type MarketListingDetail,
} from "@/lib/market-api";
import {
  apiSummary, apiHome,
  type ApiSummary, type ApiHome,
  apiBookings, apiCertificates, apiCircles, apiDocuments, apiMentors,
  apiNotifications, apiProgress, apiReferrals, apiStories,
  type ApiBooking, type ApiCertificate, type ApiCircle, type ApiDocument,
  type ApiMentor, type ApiNotification, type ApiStory,
} from "@/lib/me-api";

import {
  BOOKINGS, CERTIFICATES, REFERRALS, REFER,
  type Booking, type BookingKind, type BookingState, type Certificate,
} from "./account/data";
import { MY_CIRCLES, type Circle } from "./circles/data";
import { NOTIFICATIONS } from "./home/data";
import { MENTORS, type Mentor } from "./mentors/data";

import { DOCUMENTS } from "./shop/data";
import { useTranslated } from "@/i18n/data";

/**
 * Every module that has a real endpoint behind it, in one place.
 *
 * The adapters are all shaped the same way and they all do the same small job:
 * take what Mongo stores and add what a screen needs to draw it. The server
 * has no business knowing that a mentor's card is tinted orange, and a screen
 * has no business parsing an ISO date — so the seam between them is here.
 *
 * Where the server sends fewer fields than the mock had, the missing ones are
 * **derived, never invented**. A tint comes from a stable hash of the id so it
 * is the same on every load; a "free first session" flag that the API does not
 * carry defaults to false rather than to the flattering answer.
 */

/** Same input, same colour, every load. Deterministic beats random here. */
const TINTS = ["orange", "violet", "green", "blue", "pink", "amber"] as const;
function tintFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const t = TINTS[Math.abs(h) % TINTS.length];
  return { tint: `--ux-tint-${t}`, ink: `--ux-${t}` };
}

/** "2026-05-18T09:12:00Z" → "18 May 2026". Never the raw ISO string. */
const onDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

/* ── Notifications ─────────────────────────────────────────────────────── */

const NOTIF_LOOK: Record<string, { icon: string; tint: string; ink: string }> = {
  mentor:  { icon: "Users", tint: "--ux-tint-orange", ink: "--ux-orange" },
  program: { icon: "BookOpen", tint: "--ux-tint-violet", ink: "--ux-violet" },
  course:  { icon: "BookOpen", tint: "--ux-tint-violet", ink: "--ux-violet" },
  booking: { icon: "CalendarDays", tint: "--ux-tint-violet", ink: "--ux-violet" },
  payment: { icon: "BadgeIndianRupee", tint: "--ux-tint-green", ink: "--ux-green" },
  wallet:  { icon: "BadgeIndianRupee", tint: "--ux-tint-green", ink: "--ux-green" },
  circle:  { icon: "UsersRound", tint: "--ux-tint-pink", ink: "--ux-pink" },
  story:   { icon: "MessageCircle", tint: "--ux-tint-pink", ink: "--ux-pink" },
  safety:  { icon: "ShieldAlert", tint: "--ux-tint-orange", ink: "--ux-orange" },
  system:  { icon: "Bell", tint: "--ux-surface-2", ink: "--ux-muted" },
};

export type UxNotification = (typeof NOTIFICATIONS)[number] & {
  /** Where tapping it goes, and when it happened — both from the server. */
  href?: string;
  createdAt?: string;
  /** Present on reminder-engine rows: what makes the four quick actions possible. */
  occurrenceId?: string;
  intentId?: string;
};

const toNotification = (n: ApiNotification): UxNotification => ({
  id: n.id,
  kind: n.type,
  title: n.title,
  // `n.desc` and `n.time` for a long time, which the server has never sent —
  // so every notification in the app arrived with an empty body and no
  // timestamp. The fields are `body` and `when`.
  body: n.body,
  when: n.when,
  href: n.href,
  createdAt: n.created_at,
  occurrenceId: n.occurrence_id || undefined,
  intentId: n.intent_id || undefined,
  unread: n.unread,
  // The look supplies icon/tint/ink; the server's own icon name wins when the
  // type is one the look does not know.
  ...(NOTIF_LOOK[n.type] ?? { ...NOTIF_LOOK.system, icon: n.icon || "Bell" }),
});

export const useNotifications = (): Resource<UxNotification[]> =>
  useResource(
    useCallback(async (s: AbortSignal) => (await apiNotifications(s)).map(toNotification), []),
    useTranslated(NOTIFICATIONS),
  );

/* ── Bookings ──────────────────────────────────────────────────────────── */

export type UxBooking = Booking;

const BOOKING_KIND = (mode: string, name: string): BookingKind =>
  /mentor/i.test(name) ? "Mentor"
  : /workshop/i.test(name) ? "Workshop"
  : /online|video|call/i.test(mode) ? "Workshop"
  : "Event";

const BOOKING_STATE = (s: string): BookingState =>
  s === "cancelled" ? "Cancelled"
  : s === "completed" || s === "done" ? "Finished"
  : s === "waitlisted" ? "Waitlisted"
  : "Confirmed";

const toBooking = (b: ApiBooking): UxBooking => ({
  id: b.id,
  what: b.service_name,
  kind: BOOKING_KIND(b.mode, b.service_name),
  when: `${onDate(b.date)}, ${b.time}`,
  where: b.mode || b.with_whom || "—",
  state: BOOKING_STATE(b.status),
  // A reference a woman can read out on the phone, not a slice of a Mongo id.
  // The prefix is what tells a support agent what kind of thing it is before
  // they have looked it up.
  ref: `WS-B-${b.id.slice(-6).toUpperCase()}`,
  art: BOOKINGS[0].art,
  cost: b.price ? `₹${Number(b.price).toLocaleString("en-IN")}` : "Free",
});

export const useBookings = (): Resource<UxBooking[]> =>
  useResource(
    useCallback(async (s: AbortSignal) => (await apiBookings(s)).map(toBooking), []),
    useTranslated(BOOKINGS),
  );

/* ── Certificates ──────────────────────────────────────────────────────── */

export type UxCertificate = Certificate;

const toCertificate = (c: ApiCertificate): UxCertificate => ({
  id: c.id,
  title: c.program_name,
  issued: onDate(c.issued_on),
  code: c.code,
  hours: Number(c.hours) || 0,
  // Two different things, kept apart: the subject decides the card's tint and
  // its filter; the grade is printed on the certificate itself. Sharing one
  // field is how "awarded with Trade" gets onto a legal document.
  skill: c.program_name.split(/[&·-]/)[0].trim() || "Course",
  grade: c.grade || undefined,
  ...tintFor(c.code),
  // A revoked certificate is not "unverified" — it is withdrawn, and the
  // screen must be able to tell those apart.
  verified: !c.revoked,
});

export const useCertificates = (): Resource<UxCertificate[]> =>
  useResource(
    useCallback(async (s: AbortSignal) => (await apiCertificates(s)).map(toCertificate), []),
    useTranslated(CERTIFICATES),
  );

/* ── Documents ─────────────────────────────────────────────────────────── */

/**
 * A paper in her vault.
 *
 * Written out rather than derived from the mock with `(typeof DOCUMENTS)[number]`.
 * Deriving it meant the type could never carry a field the mock did not have,
 * so real values from the server — the file's actual size, its kind — had
 * nowhere to go, and the screen filled the gap with a hardcoded array indexed
 * by row position.
 */
export interface UxDocument {
  id: string;
  name: string;
  status: "verified" | "missing" | "optional";
  when: string;
  icon: string;
  tint: string;
  ink: string;
  /** The real file size, when we hold the file. */
  size?: string;
  /** The server's kind, so an upload can replace the right slot. */
  docType?: string;
}

const DOC_LOOK: Record<string, string> = {
  aadhaar: "IdCard", pan: "CreditCard", bank: "Landmark",
  udyam: "Building2", gst: "FileText", photo: "Image",
};

const toDocument = (d: ApiDocument): UxDocument => {
  const key = Object.keys(DOC_LOOK).find((k) => d.doc_kind?.toLowerCase().includes(k));
  // "stored" is a paper she keeps herself — nobody reviews it, and it is not
  // waiting on anything, so it counts as held.
  const ok = d.status === "approved" || d.status === "verified" || d.status === "stored";
  return {
    id: d.id,
    name: d.doc_type || d.filename,
    status: (ok ? "verified" : d.status === "rejected" ? "missing" : "optional") as UxDocument["status"],
    when: d.status === "stored"
      ? `Added ${d.uploaded_on}`
      : ok ? `Verified ${d.uploaded_on}`
      : d.note || `Sent ${d.uploaded_on}`,
    icon: key ? DOC_LOOK[key] : "FileText",
    tint: ok ? "--ux-tint-green" : "--ux-tint-orange",
    ink: ok ? "--ux-green" : "--ux-orange",
    // The real file size, from the server. The vault used to pick one out of
    // ["1.2 MB", "820 KB", "2.1 MB"] by row position.
    size: d.size ? readableSize(d.size) : undefined,
    docType: d.doc_kind || "other",
  };
};

/** Bytes as a person reads them. */
function readableSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/**
 * One request for the home screen — bookings, programmes and her money.
 *
 * `/me/summary` was built for exactly this and then never wired up: the home
 * screen went on reading a constants file for months while the endpoint that
 * would have replaced it sat there, gathered and fast.
 */
export const useSummary = (): Resource<ApiSummary | null> =>
  useResource(useCallback((s: AbortSignal) => apiSummary(s).catch(() => null), []), null);

/* ── Home ──────────────────────────────────────────────────────────────────

   Returns `null` while loading and on failure, and every consumer must handle
   that — Home is the first screen after sign-in, so a thrown error here is a
   woman staring at a blank app. `useResource` keeps the last good value across
   a refetch, which is what stops the whole screen flashing when she comes back
   to the tab. */
export const useHome = (): Resource<ApiHome | null> =>
  useResource(useCallback((s: AbortSignal) => apiHome(s).catch(() => null), []), null);

export const useDocuments = (): Resource<UxDocument[]> =>
  useResource(
    useCallback(async (s: AbortSignal) => (await apiDocuments(s)).map(toDocument), []),
    useTranslated(DOCUMENTS),
  );

/* ── Referrals ─────────────────────────────────────────────────────────── */

export interface UxReferrals { refer: typeof REFER; people: typeof REFERRALS }

export const useReferrals = (): Resource<UxReferrals> =>
  useResource(
    useCallback(async (s: AbortSignal) => {
      const r = await apiReferrals(s);
      return {
        refer: { ...REFER, code: r.code, link: r.link.replace(/^https?:\/\//, "") },
        // The server counts referrals; it does not name them. Slicing the mock
        // list to the count was worse than either honest option — it showed
        // invented women when she had referred someone, and hid the mock's
        // whole point when she had not. The list is empty until the API can
        // name them, and the screen's own empty state says so.
        people: [] as typeof REFERRALS,
      };
    }, []),
    { refer: useTranslated(REFER), people: useTranslated(REFERRALS) },
  );

/* ── Circles ───────────────────────────────────────────────────────────── */

const toCircle = (c: ApiCircle): Circle => ({
  id: c.id,
  name: c.name,
  // The server says whether a circle collects money. This used to be a regex
  // on the name, which gave a Pay button to "Savings tips" and withheld one
  // from a bachat gat called "Ladies Group".
  kind: c.is_savings ? "Savings"
      : /trade|sell|craft|market/i.test(`${c.topic} ${c.name}`) ? "Trade"
      : "Community",
  members: c.member_count,
  place: c.topic || "Everywhere",
  art: c.cover || MY_CIRCLES[0].art,
  ...tintFor(c.id),
  icon: c.is_private ? "Lock" : "UsersRound",
  blurb: c.desc,
  activity: `${c.post_count} ${c.post_count === 1 ? "post" : "posts"}`,
  joined: c.joined,
  monthly_minor: c.monthly_minor,
  // The pot is what the circle is worth when everyone has paid: the share
  // times the number of women in it.
  pot_minor: c.monthly_minor * c.member_count,
  currentMonth: c.round,
});

export interface UxCircles { mine: Circle[]; discover: Circle[] }

export const useCircles = (): Resource<UxCircles> =>
  useResource(
    useCallback(async (s: AbortSignal) => {
      const all = (await apiCircles(s)).map(toCircle);
      return { mine: all.filter((c) => c.joined), discover: all.filter((c) => !c.joined) };
    }, []),
    { mine: useTranslated(MY_CIRCLES), discover: [] },
  );

/* ── Stories ───────────────────────────────────────────────────────────── */

/**
 * A story as the screens need it — written out, not derived from the mock.
 *
 * Deriving it from `STORIES[0]` is what made the spread above look reasonable:
 * the type demanded a trade, a place, a distance and an income, so the mapper
 * borrowed them from a fixture. A type that describes the mock forces the
 * adapter to fabricate.
 */
export interface UxStory {
  id: string;
  name: string;
  avatar: string;
  cover: string;
  quote: string;
  body: string;
  likes: number;
  liked_by_me: boolean;
  since: string;
  /** The course she credits, when she named one. */
  program: string;
}

/**
 * One woman's story.
 *
 * **The spread is gone, and it was the worst kind of bug in this app.**
 * `...STORIES[0]` handed every story Sunita Devi's trade, her address, "1.2 km
 * away" and "₹18,000 a month" — so a woman reading another woman's story was
 * shown a stranger's income and neighbourhood as though they were hers. The
 * comment two lines below it worried, correctly, about inventing a pull-quote;
 * the line above it was inventing an entire life.
 *
 * Fields the API does not carry — trade, place, distance, earnings — are now
 * absent rather than borrowed. A story with no figure attached is still a
 * story; one with somebody else's figure is a lie about two people at once.
 */
const toStory = (st: ApiStory): UxStory => ({
  id: st.id,
  name: st.author_name,
  avatar: st.author_avatar || "",
  cover: st.cover || "",
  // The API has one body. The mock had a pull-quote as well, and inventing one
  // by slicing the first sentence would put words in her mouth — so the quote
  // is her own title when she wrote one, and empty otherwise.
  quote: st.title || "",
  body: st.body,
  likes: st.likes,
  liked_by_me: st.liked_by_me,
  since: st.when,
  program: st.program || "",
});

/**
 * Other women's stories.
 *
 * The fallback is empty, not `STORIES`. `useResource` shows its fallback while
 * the request is in flight AND when it fails — and a fixture here means a
 * woman reading a story sees a named stranger's trade and income presented as
 * that stranger's own. An empty list is the honest thing to hold: the screen
 * shows nothing for a moment, rather than something untrue.
 */
export const useStories = (): Resource<UxStory[]> =>
  useResource(
    useCallback(async (s: AbortSignal) => (await apiStories(s)).map(toStory), []),
    [],
  );

/* ── Mentors ───────────────────────────────────────────────────────────── */

const toMentor = (m: ApiMentor): Mentor => ({
  ...m,
  photo: m.photo || MENTORS[0].photo,
  ...tintFor(m.id),
  // Neither of these is in the API yet. Defaulted to the UNflattering answer:
  // promising a free first session the server never agreed to is a promise
  // made in her name.
  free_first: false,
  fee_minor: 0,
});

export const useMentors = (): Resource<Mentor[]> =>
  useResource(
    useCallback(async (s: AbortSignal) => (await apiMentors(s)).map(toMentor), []),
    useTranslated(MENTORS),
  );

/* ── Progress ──────────────────────────────────────────────────────────── */

export const useProgress = () =>
  useResource(
    useCallback(async (s: AbortSignal) => await apiProgress(s), []),
    null as Awaited<ReturnType<typeof apiProgress>> | null,
  );

/* ── The market ────────────────────────────────────────────────────────────

   **The fallback is empty, and that is the whole point of this batch.**

   `useResource` shows its fallback while the request is in flight AND when it
   fails. Every other module here can fall back to a fixture safely — a mock
   course is a course nobody is being asked to act on. A mock LISTING is a named
   woman, a price and a Buy button: falling back to one would show a buyer
   "Sunita Devi · ₹420 · 6 women you know bought this" about a woman who does
   not exist, and let her order it.

   That is exactly what `/app/market` did before this. So there is no fixture
   behind these two hooks, and the screens read `source` and `error` to say
   plainly that nothing could be loaded.

   No adapter, either. The server already sends `price_label` with the rate in
   it, the seller, her tie to the buyer and whether the thing is saved — all of
   it derived from real rows. There is nothing left for a screen to add that
   would not be invented. */

export const useMarket = (): Resource<MarketListing[]> =>
  useResource(useCallback((s: AbortSignal) => apiMarket(s), []), []);

/**
 * One listing.
 *
 * `null` while loading and on failure — a market item is a woman's name and a
 * price, and a half-loaded one is worse than none.
 */
export const useMarketListing = (id: string): Resource<MarketListingDetail | null> =>
  useResource(
    useCallback((s: AbortSignal) => apiMarketListing(id, s), [id]),
    null,
  );
