"use client";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn, Card, I, v } from "@/components/ux/kit";

/**
 * Legacy destination from the old seller-side quote preview.
 * Real quote questions start on a market listing and are delivered to the
 * seller's inbox by the backend. This route can no longer claim a request was
 * sent merely because a browser had a draft in sessionStorage.
 */
export default function QuoteSentPage() {
  return (
    <HomeShell active="/app/documents">
      <div className="flex flex-col gap-5">
        <Back to="/app/documents/new" label="Back to your listing" />
        <Card pad={24}>
          <div className="grid place-items-center gap-4 py-8 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl" style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
              <I name="MessageSquare" className="h-7 w-7" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold" style={{ color: v("--ux-ink") }}>Quote requests are in the market</h1>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
                A buyer opens a listing, asks for a quote, and the question arrives in the seller&apos;s WomSakhi inbox. No request was sent from this listing preview.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Btn href="/app/market" icon="Store">Open the market</Btn>
              <Btn href="/app/messages" variant="outline" icon="MessageCircle">Open messages</Btn>
            </div>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}
