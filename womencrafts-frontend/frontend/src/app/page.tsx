import { redirect } from "next/navigation";

export default function Home() {
  // Admin platform has no public landing — send visitors into the app.
  // Unauthenticated users get bounced to /signin by the auth guard.
  redirect("/dashboard");
}
