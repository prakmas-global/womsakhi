"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CircleAlert, CircleCheck, Loader2 } from "lucide-react";

import { LogoWordmark } from "@/components/brand/Logo";
import { apiConfirmEmail, verificationErrorMessage } from "@/lib/verification-api";

/**
 * Where the link in the confirmation email lands.
 *
 * Deliberately public and standalone: she may open it on a different device, or
 * in a browser where she isn't signed in. It confirms the address and then
 * points her onward.
 */

function Confirm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [state, setState] = useState<"working" | "done" | "failed">("working");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setState("failed");
      setMessage("That link is missing its confirmation code.");
      return;
    }
    let cancelled = false;
    apiConfirmEmail(token)
      .then((res) => {
        if (cancelled) return;
        setState("done");
        setMessage(res.message);
      })
      .catch((err) => {
        if (cancelled) return;
        setState("failed");
        setMessage(verificationErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="wc-card w-full max-w-md p-8 text-center">
        <div className="flex justify-center">
          <LogoWordmark className="h-8" />
        </div>

        {state === "working" && (
          <>
            <Loader2 className="mx-auto mt-7 h-9 w-9 animate-spin text-brand-500" />
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink mt-4">
              Confirming your email…
            </h1>
          </>
        )}

        {state === "done" && (
          <>
            <span className="mx-auto mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-status-ok-bg text-status-ok-ink">
              <CircleCheck className="h-7 w-7" />
            </span>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink mt-4">Email confirmed</h1>
            <p className="mt-1.5 text-sm text-ink-subtle">{message}</p>
            <Link href="/app/verify" className="btn btn-primary btn-block mt-6">
              Continue
            </Link>
          </>
        )}

        {state === "failed" && (
          <>
            <span className="mx-auto mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-status-danger-bg text-status-danger-ink">
              <CircleAlert className="h-7 w-7" />
            </span>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink mt-4">
              We couldn&apos;t confirm that link
            </h1>
            <p className="mt-1.5 text-sm text-ink-subtle">{message}</p>
            <Link href="/app/verify" className="btn btn-primary btn-block mt-6">
              Send a new link
            </Link>
            <Link href="/signin" className="mt-3 block text-sm font-semibold text-ink-subtle">
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  // useSearchParams needs a Suspense boundary so the page can still prerender.
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
        </div>
      }
    >
      <Confirm />
    </Suspense>
  );
}
