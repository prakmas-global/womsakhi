import { redirect } from "next/navigation";
import { RemindersWorkspace } from "./reminders-workspace";

export default async function RemindersPage({ searchParams }: { searchParams: Promise<{ preset?: string | string[] }> }) {
  const params = await searchParams;
  const preset = typeof params.preset === "string" ? params.preset : "";
  if (preset === "rem.preset.water") redirect("/app/health/reminders/water");
  return <RemindersWorkspace key={preset} presetKey={preset} />;
}
