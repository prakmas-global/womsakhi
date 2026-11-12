"use client";

import { use, useCallback } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, ScreenSkeleton, v } from "@/components/ux/kit";
import { ScreenHead } from "@/components/ux/learning/native";
import { ItemForm } from "@/components/ux/rent/form/ItemForm";
import { apiRental, type RentalItem } from "@/lib/rentals-api";
import { useResource } from "@/lib/use-resource";

/** Change one of her listings — the same form as renting something out. */
export default function RentEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const item = useResource(useCallback((s: AbortSignal) => apiRental(id, s), [id]), null as RentalItem | null);

  if (item.source === "loading") return <HomeShell wide><ScreenSkeleton shape="list" /></HomeShell>;
  if (!item.data || !item.data.mine) {
    return (
      <HomeShell wide>
        <ScreenHead title="Change your listing" />
        <Card>
          <p className="text-sm" style={{ color: v("--ux-muted") }}>
            {item.data ? "Only the woman who listed this can change it." : "This listing could not load. Check your connection and try again."}
          </p>
          <div className="mt-3"><Btn size="sm" variant="outline" href="/app/rent/mine">My things for rent</Btn></div>
        </Card>
      </HomeShell>
    );
  }
  return (
    <HomeShell wide>
      <ScreenHead title="Change your listing" sub={item.data.title} />
      {/* Keyed by id: a different listing starts a fresh form. */}
      <ItemForm key={item.data.id} initial={item.data} />
    </HomeShell>
  );
}
