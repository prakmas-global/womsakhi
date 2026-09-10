"use client";

import { useCallback } from "react";

import { useT } from "@/i18n";
import type { MessageKey } from "@/i18n";
import type { NavNode } from "./nav-tree";

/**
 * Reads a nav entry's label and hint in the reader's language.
 *
 * `nav.ts` keeps the English text inline and a message key beside it. That is
 * on purpose: the English stays readable where the IA is defined, and it is
 * also the fallback, so a language that has not been through native review
 * shows a word she can ask someone about rather than a machine-made one.
 */
export function useNavLabel() {
  const t = useT();

  // `k` is always a BASE — the label lives at `${k}.label` and the hint at
  // `${k}.note`. Modes used to carry a complete key instead, so this looked up
  // "ch.today" (which does not exist), and `t()` fell through to returning the
  // key itself: every rail item rendered the string "ch.today" on screen.
  const label = useCallback(
    (n: Pick<NavNode, "label" | "k">) =>
      n.k ? t(`${n.k}.label` as MessageKey) : n.label,
    [t],
  );

  const note = useCallback(
    (n: { note?: string; k?: string }) =>
      n.k && n.note ? t(`${n.k}.note` as MessageKey) : n.note,
    [t],
  );

  return { label, note };
}
