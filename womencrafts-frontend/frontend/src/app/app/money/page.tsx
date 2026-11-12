import { MoneyWorkspace, type MoneyView } from "@/components/ux/money/MoneyWorkspace";

export default async function MoneyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const asked = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const tab: MoneyView = asked === "plans" || asked === "notes" ? asked : "money";
  return <MoneyWorkspace tab={tab} />;
}
