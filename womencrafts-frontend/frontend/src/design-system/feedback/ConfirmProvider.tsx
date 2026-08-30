"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";

import Modal from "../primitives/Modal";

/**
 * "Are you sure?" — as a promise.
 *
 * ── Why not window.confirm ──────────────────────────────────────────────────
 * The native dialog cannot be styled, cannot be themed, cannot show what is
 * about to be deleted, and renders in the browser's language rather than the
 * app's — which matters here, where a member may be reading in Hindi, Marathi,
 * Tamil or Bengali. It also blocks the main thread outright: every animation,
 * timer and pending render in the app stops until it is answered.
 *
 * ── Why a promise rather than a component ───────────────────────────────────
 * The alternative is a `confirmOpen` boolean, a `pendingId`, and a handler
 * split across three places — which is what 14 screens in this app were
 * already doing, each slightly differently. As a promise the whole thing stays
 * where the decision is made:
 *
 *   if (await confirm({ title: "Delete this service?", danger: true })) {
 *     await remove(id);
 *   }
 *
 * ── Accessibility comes from Modal ──────────────────────────────────────────
 * Focus moves into the dialog, Tab is trapped inside it, Escape closes it, and
 * focus returns to whatever opened it. Escape and the backdrop both resolve
 * FALSE — dismissing a destructive question must never be read as agreeing to
 * it.
 */

export interface ConfirmOptions {
  title: string;
  /** What exactly is about to happen. Name the thing, not the category. */
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red button and warning icon, for anything that destroys data. */
  danger?: boolean;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

export function useConfirm(): Confirm {
  const fn = useContext(ConfirmContext);
  if (!fn) {
    throw new Error("useConfirm must be used inside <ConfirmProvider>. It is mounted in app/layout.tsx.");
  }
  return fn;
}

export default function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback<Confirm>((options) => {
    setPending(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((ok: boolean) => {
    // Resolve BEFORE clearing, and null the ref immediately: closing the modal
    // triggers onClose, which would otherwise resolve a second time with false
    // and turn a confirmed delete into a cancelled one.
    const resolve = resolver.current;
    resolver.current = null;
    setPending(null);
    resolve?.(ok);
  }, []);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        open={pending !== null}
        onClose={() => settle(false)}
        title={pending?.title ?? ""}
        description={pending?.description}
        icon={pending?.danger ? AlertTriangle : undefined}
        iconTone={pending?.danger ? "rose" : "brand"}
        size="sm"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => settle(false)}>
              {pending?.cancelLabel ?? "Cancel"}
            </button>
            <button
              className={`btn ${pending?.danger ? "btn-danger" : "btn-primary"}`}
              onClick={() => settle(true)}
            >
              {pending?.confirmLabel ?? "Confirm"}
            </button>
          </>
        }
      >
        {/*
          The question lives in the title and description. A body repeating it
          would be read out twice by a screen reader — once as the dialog's
          accessible name, once as its content.
        */}
        <p className="sr-only">{pending?.description ?? pending?.title}</p>
      </Modal>
    </ConfirmContext.Provider>
  );
}
