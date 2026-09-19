import { HomeShell } from "@/components/ux/home/HomeShell";
import { ScreenSkeleton } from "@/components/ux/kit";

export default function Loading() {
  return (
    <HomeShell wide bare skeleton="grid">
      <ScreenSkeleton shape="grid" />
    </HomeShell>
  );
}
