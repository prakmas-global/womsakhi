import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { authSans } from "@/components/auth-shell/fonts";

import { Gallery } from "./Gallery";

/**
 * The local preview switch (see lib/auth-preview), written out here rather
 * than imported: the build replaces NODE_ENV in this file, so every branch it
 * guards is stripped from production. An imported constant is not.
 */
const AUTH_PREVIEW = process.env.NODE_ENV !== "production";

/**
 * Local-only gallery of every auth screen state (see lib/auth-preview).
 * Not in a production build: `AUTH_PREVIEW` is false there, so this 404s.
 */


export const metadata: Metadata = {
  title: "Auth screens (local preview)",
  robots: { index: false, follow: false },
};

export default function AuthScreensPage() {
  if (!AUTH_PREVIEW) notFound();
  return (
    <div className={authSans.variable}>
      <Gallery />
    </div>
  );
}
