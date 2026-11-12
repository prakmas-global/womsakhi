import { redirect } from "next/navigation";

/** Keep saved links and calculator handoffs; existing records stay in their collections. */
export default async function LegacyKhataPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const tab = first(params.tab);
  if (tab === "chits") redirect("/app/khata/chits");
  const next = new URLSearchParams({ tab: tab === "notes" || tab === "plans" ? tab : "money" });
  const add = first(params.add);
  const amount = first(params.amount);
  if (add === "in" || add === "out") next.set("add", add);
  if (amount && /^\d{1,9}(\.\d{1,2})?$/.test(amount)) next.set("amount", amount);
  redirect(`/app/money?${next}`);
}
