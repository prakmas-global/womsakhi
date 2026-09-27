/** A stable, readable two-character fallback for missing uploaded images. */
export function monogram(label: string, kind: "person" | "label" = "person") {
  const words = label.trim().match(/[\p{L}\p{N}]+/gu) ?? [];
  if (!words.length) return "WS";
  if (kind === "person" && words.length > 1) {
    return `${Array.from(words[0] ?? "")[0] ?? ""}${Array.from(words.at(-1) ?? "")[0] ?? ""}`.toLocaleUpperCase();
  }
  const letters = Array.from(words.join(""));
  return `${letters[0] ?? ""}${letters[1] ?? ""}`.toLocaleUpperCase();
}

/** Keeps a name on the same premium tint across every screen and session. */
export function monogramTone(label: string) {
  let hash = 2166136261;
  for (const char of label.trim().toLocaleLowerCase()) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % 6;
}
