"use client";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { ScreenHead } from "@/components/ux/learning/native";
import { ItemForm } from "@/components/ux/rent/form/ItemForm";

/**
 * Rent something out (backend: routes/rentals.py). The form is shared with
 * changing a listing — components/ux/rent/form/ItemForm.tsx.
 */
export default function RentNewPage() {
  return (
    <HomeShell wide>
      <ScreenHead title="Rent something out"
                  sub="Photos, a rent a day and a deposit. Women near you ask for dates; you say yes or no." />
      <ItemForm />
    </HomeShell>
  );
}
