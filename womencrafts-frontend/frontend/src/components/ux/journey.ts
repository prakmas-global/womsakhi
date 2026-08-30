"use client";

import { useCallback } from "react";

import { apiProgress, apiReferrals, apiCircles } from "@/lib/me-api";
import { apiShopSummary, apiWalletInsights } from "@/lib/shop-api";
import { useResource, type Resource } from "@/lib/use-resource";

export interface JourneyMilestone {
  id: string;
  title: string;
  body: string;
  when: string;
  icon: string;
  tint: string;
  ink: string;
  done: boolean;
}

export interface JourneyOutcome {
  label: string;
  value: number;
  prefix: string;
  icon: string;
  tint: string;
  ink: string;
  note: string;
}

export interface Journey {
  memberSince: string;
  monthsHere: number;
  /** Twelve months of earnings, in whole rupees, oldest first. */
  earned: number[];
  months: string[];
  lifetimeMinor: number;
  outcomes: JourneyOutcome[];
  milestones: JourneyMilestone[];
}

const EMPTY: Journey = {
  memberSince: "", monthsHere: 0, earned: [], months: [],
  lifetimeMinor: 0, outcomes: [], milestones: [],
};

/**
 * Her journey, assembled from what actually happened.
 *
 * **Every figure on this screen used to be invented**, and they were not small
 * ones. "Earned through WomSakhi: ₹1,48,500 since March 2025" was a constant.
 * So were "87 orders delivered", "62% from repeat buyers", and "Women you
 * brought in: 3" — followed by three names, Meera, Sunita and Farah, who do not
 * exist. The milestone list told her she had opened a shop called Priya's
 * Handloom in January 2026 and joined a circle of twelve women in Jaipur.
 *
 * A woman reading a fabricated ₹1.48 lakh against her own memory concludes one
 * of two things: that the app is broken, or that she has lost track of her own
 * money. Neither is recoverable by a later correction.
 *
 * Five reads, sent together — the screen is one view of one life, and
 * sequencing them would cost five round trips to Atlas before anything drew.
 */
export function useJourney(): Resource<Journey> {
  return useResource<Journey>(
    useCallback(async (signal: AbortSignal) => {
      const [progress, insights, shop, referrals, circles] = await Promise.all([
        apiProgress(signal),
        apiWalletInsights(signal),
        apiShopSummary(signal),
        apiReferrals(signal),
        apiCircles(signal),
      ]);

      const earned = insights.monthly_minor.map((m) => Math.round(m / 100));
      const lifetimeMinor = insights.monthly_minor.reduce((a, b) => a + b, 0);
      const savings = circles.filter((c) => c.joined && c.is_savings);
      const firstEarningIdx = insights.monthly_minor.findIndex((m) => m > 0);

      const outcomes: JourneyOutcome[] = [
        {
          label: "Earned through WomSakhi", value: Math.round(lifetimeMinor / 100), prefix: "₹",
          icon: "BadgeIndianRupee", tint: "--ux-tint-green", ink: "--ux-green",
          note: progress.member_since ? `since ${progress.member_since}` : "",
        },
        {
          label: "Courses finished", value: progress.programs_completed, prefix: "",
          icon: "GraduationCap", tint: "--ux-tint-violet", ink: "--ux-violet",
          // Hours are counted by the server; a certificate count is not, so it
          // is not claimed.
          note: `${progress.learning_hours} hours of learning`,
        },
        {
          label: "Things you sell", value: shop.listings, prefix: "",
          icon: "Package", tint: "--ux-tint-orange", ink: "--ux-orange",
          note: shop.review_count ? `${shop.review_count} reviews` : "No reviews yet",
        },
        {
          label: "Women you brought in", value: referrals.joined, prefix: "",
          icon: "Heart", tint: "--ux-tint-pink", ink: "--ux-pink",
          // The API counts them; it does not name them, and this screen named
          // three women who were never invited.
          note: referrals.invited
            ? `${referrals.invited} invited`
            : "Share your link to bring one in",
        },
      ];

      const milestones: JourneyMilestone[] = [
        {
          id: "joined", title: "Joined WomSakhi",
          body: "You made an account and got verified.",
          when: progress.member_since || "",
          icon: "Sparkles", tint: "--ux-tint-violet", ink: "--ux-violet", done: true,
        },
        {
          id: "course", title: "Finished your first course",
          body: progress.programs_completed
            ? `${progress.programs_completed} finished so far.`
            : "Finish one and it shows up here, with a certificate.",
          when: progress.programs_completed ? "Done" : "Not yet",
          icon: "BookOpen", tint: "--ux-tint-blue", ink: "--ux-blue",
          done: progress.programs_completed > 0,
        },
        {
          id: "earned", title: "Earned your first rupee",
          body: lifetimeMinor
            ? `₹${Math.round(lifetimeMinor / 100).toLocaleString("en-IN")} through the app so far.`
            : "The first payment that reaches your wallet shows up here.",
          when: firstEarningIdx >= 0 ? insights.month_labels[firstEarningIdx] ?? "Done" : "Not yet",
          icon: "BadgeIndianRupee", tint: "--ux-tint-green", ink: "--ux-green",
          done: lifetimeMinor > 0,
        },
        {
          id: "circle", title: "Joined a savings circle",
          body: savings.length
            ? `${savings[0].name} — ₹${Math.round(savings[0].monthly_minor / 100).toLocaleString("en-IN")} a month.`
            : "Saving with other women is how most of them started.",
          when: savings.length ? "Done" : "Not yet",
          icon: "UsersRound", tint: "--ux-tint-pink", ink: "--ux-pink",
          done: savings.length > 0,
        },
        {
          id: "shop", title: "Opened your shop",
          body: shop.listings
            ? `${shop.name} — ${shop.listings} ${shop.listings === 1 ? "thing" : "things"} listed.`
            : "List one thing you make and buyers can find you.",
          when: shop.listings ? "Done" : "Not yet",
          icon: "Store", tint: "--ux-tint-orange", ink: "--ux-orange",
          done: shop.listings > 0,
        },
      ];

      return {
        memberSince: progress.member_since || "",
        monthsHere: monthsSince(progress.member_since),
        earned,
        months: insights.month_labels,
        lifetimeMinor,
        outcomes,
        milestones,
      };
    }, []),
    EMPTY,
  );
}

/**
 * How long she has been here, from the server's "August 2026".
 *
 * The screen said "14 months since you joined" as a literal, to a woman who
 * joined this month.
 */
function monthsSince(memberSince: string): number {
  if (!memberSince) return 0;
  const when = new Date(`1 ${memberSince}`);
  if (Number.isNaN(when.getTime())) return 0;
  const now = new Date();
  return Math.max(0, (now.getFullYear() - when.getFullYear()) * 12 + (now.getMonth() - when.getMonth()));
}
