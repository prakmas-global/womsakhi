import { apiBase } from "@/lib/api-base";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const response = await fetch(new URL("/health/ready", apiBase()), {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    const body = await response.json();
    if (response.ok && body.status === "ready") {
      return Response.json({ status: "ready" }, { headers: { "Cache-Control": "no-store" } });
    }
  } catch {
    // Expose availability, never internal URLs, credentials or exception text.
  }
  return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
