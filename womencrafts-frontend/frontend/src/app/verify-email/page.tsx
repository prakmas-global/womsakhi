"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CircleAlert, CircleCheck, Loader2 } from "lucide-react";

import { LogoWordmark } from "@/components/brand/Logo";
import { Btn } from "@/components/ux/kit";
import { apiConfirmEmail, verificationErrorMessage } from "@/lib/verification-api";

/**
 * Where the link in the confirmation email lands.
 *
 * Deliberately public and standalone: she may open it on a different device, or
 * in a browser where she isn't signed in. It confirms the address and then
 * points her onward.
 *
 * This page sits outside the `(auth)` group, so it gets no layout above it but
 * the root one — which means it has to open its own `.ux` scope. Without that
 * every `var(--ux-*)` below resolves to nothing and the page renders unstyled.
 */

/** One frame: the card is the same shape in all three states, only its face changes. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="ux flex min-h-screen items-center justify-center px-4 py-10"
      style={{ background: "var(--ux-canvas)" }}
    >
      <div
        className="w-full max-w-[400px] rounded-[20px] p-8 text-center"
        style={{
          background: "var(--ux-surface)",
          border: "1px solid var(--ux-line)",
          boxShadow: "var(--ux-shadow-pop)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** The round status badge above the heading. */
function Badge({ tint, ink, children }: { tint: string; ink: string; children: React.ReactNode }) {
  return (
    <span
      className="mx-auto mt-7 flex h-14 w-14 items-center justify-center rounded-full"
      style={{ background: `var(${tint})`, color: `var(${ink})` }}
    >
      {children}
    </span>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="mt-4 text-xl font-bold tracking-tight" style={{ color: "var(--ux-ink)" }}>
      {children}
    </h1>
  );
}

function Sub({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1.5 text-xsm leading-relaxed" style={{ color: "var(--ux-muted)" }}>
      {children}
    </p>
  );
}

function Confirm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    // A link with no token never reaches the server — that verdict is derived
    // below rather than set here, so the effect has nothing to do.
    if (!token) return;
    let cancelled = false;
    apiConfirmEmail(token)
      .then((res) => {
        if (!cancelled) setResult({ ok: true, message: res.message });
      })
      .catch((err) => {
        if (!cancelled) setResult({ ok: false, message: verificationErrorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const { state, message }: { state: "working" | "done" | "failed"; message: string } = !token
    ? { state: "failed", message: "That link is missing its confirmation code." }
    : result
      ? { state: result.ok ? "done" : "failed", message: result.message }
      : { state: "working", message: "" };

  return (
    <Shell>
      <div className="flex justify-center">
        <LogoWordmark className="h-8" />
      </div>

      {state === "working" && (
        <>
          <Badge tint="--ux-tint-violet" ink="--ux-violet">
            <Loader2 className="h-7 w-7 animate-spin" aria-hidden />
          </Badge>
          <Heading>Confirming your email…</Heading>
          <Sub>This takes a moment.</Sub>
        </>
      )}

      {state === "done" && (
        <>
          <Badge tint="--ux-tint-green" ink="--ux-green">
            <CircleCheck className="h-7 w-7" aria-hidden />
          </Badge>
          <Heading>Email confirmed</Heading>
          <Sub>{message}</Sub>
          <div className="mt-6">
            <Btn href="/app/verify" full iconEnd="ArrowRight">
              Continue
            </Btn>
          </div>
        </>
      )}

      {state === "failed" && (
        <>
          <Badge tint="--ux-tint-orange" ink="--ux-orange-ink">
            <CircleAlert className="h-7 w-7" aria-hidden />
          </Badge>
          <Heading>We couldn&apos;t confirm that link</Heading>
          <Sub>{message}</Sub>
          <div className="mt-6">
            <Btn href="/app/verify" full>
              Send a new link
            </Btn>
          </div>
          <Link
            href="/signin"
            className="ux-hov mt-3.5 inline-block text-xsm font-semibold"
            style={{ color: "var(--ux-brand)" }}
          >
            Back to sign in
          </Link>
        </>
      )}
    </Shell>
  );
}

export default function VerifyEmailPage() {
  // useSearchParams needs a Suspense boundary so the page can still prerender.
  return (
    <Suspense
      fallback={
        <Shell>
          <div className="flex justify-center">
            <LogoWordmark className="h-8" />
          </div>
          <Badge tint="--ux-tint-violet" ink="--ux-violet">
            <Loader2 className="h-7 w-7 animate-spin" aria-hidden />
          </Badge>
          <Heading>Confirming your email…</Heading>
        </Shell>
      }
    >
      <Confirm />
    </Suspense>
  );
}
