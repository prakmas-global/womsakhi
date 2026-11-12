"use client";

import * as Icons from "@/components/ux/icons";
import { formatMoney } from "@/components/ux/kit/money";
import { Fact, MediaCard } from "@/components/ux/media/MediaCard";
import { CONDITION_LOOK, type RentalCard } from "@/lib/rentals-api";
import { itemArt, place } from "./look";

/**
 * One thing on the board. The price a day is what she compares first, so it
 * is the overlay on the photo; the deposit is on the card too, because a
 * deposit she did not expect is the surprise that sours a rental.
 */
export function RentCard({ item }: { item: RentalCard }) {
  return (
    <MediaCard
      href={`/app/rent/${item.id}`}
      image={item.photo || itemArt(item.title, item.category, item.id)}
      alt={item.title}
      ratio="4/3"
      topLeft={{ text: item.category, tone: "light" }}
      topRight={item.condition === "like_new" ? { text: CONDITION_LOOK.like_new, tone: "green" } : null}
      overlay={<><Icons.KeyRound className="h-[13px] w-[13px]" /> {formatMoney(item.price_day_minor)} / day</>}
      title={item.title}
      subtitle={item.owner.first_name + (item.owner.stars ? ` · ★ ${item.owner.stars} (${item.owner.reviews})` : "")}
      avatar={{ src: item.owner.avatar || undefined, name: item.owner.first_name }}
      meta={<>
        {(item.area || item.city) && <Fact icon="MapPin">{place(item.area, item.city)}</Fact>}
        <Fact icon="ShieldCheck">{item.deposit_minor ? `${formatMoney(item.deposit_minor)} deposit` : "No deposit"}</Fact>
        {item.times_rented > 0 && <Fact icon="Repeat">Rented {item.times_rented} {item.times_rented === 1 ? "time" : "times"}</Fact>}
      </>}
    />
  );
}
