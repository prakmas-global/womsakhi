"use client";

import Link from "next/link";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Card, I, IconTile, v } from "@/components/ux/kit";
import { useNavLabel } from "@/components/ux/use-nav-label";
import { SECTIONS, type NavNode, type Section } from "@/components/ux/nav-tree";

/**
 * A section's landing page, which IS its navigation.
 *
 * ── Why a page and not a menu ───────────────────────────────────────────────
 * A section holds around seventeen screens. Above fifteen, Nielsen Norman stop
 * recommending a persistent sub-menu and start recommending a landing page
 * that carries the branch — because a seventeen-item list in the chrome is a
 * wall on a laptop and, on a phone, does not fit at all.
 *
 * So this is a page: full-width cards, real labels, a line under each saying
 * what it is for, and nothing hidden behind a tap. Before this the app had no
 * map on a phone whatsoever — no rail below `lg`, no drawer, and the "More
 * sheet holding the entire map" described in `MobileNav`'s own comment had
 * never been written. Sixty-four routes could only be reached if some page
 * happened to link to them.
 *
 * ── Two levels, never three ─────────────────────────────────────────────────
 * A card's own children are listed beneath it as plain links rather than
 * becoming a third level to drill through. GitLab's rule, and the reason is
 * that a nested menu is where people mistake its back button for the phone's
 * and leave the flow entirely.
 */
export function Hub({ id }: { id: string }) {
  const nav = useNavLabel();
  const section = SECTIONS.find((s) => s.id === id) as Section | undefined;
  if (!section) return null;

  const kids = (section.children ?? []).filter((c) => !c.unlisted);

  return (
    <HomeShell active={section.href} bare loadFailed={section.label.toLowerCase()}>
      <div className="flex flex-col">
        <header className="mb-5 flex items-start gap-3.5">
          <IconTile icon={section.icon} tint="--ux-brand-tint-2" ink="--ux-brand" size={46} radius={14} />
          <div className="min-w-0">
            <h1 className="text-3xl font-extrabold leading-tight tracking-[-0.025em]"
                style={{ color: v("--ux-ink") }}>
              {nav.label(section)}
            </h1>
            {section.note && (
              <p className="mt-1 text-smd" style={{ color: v("--ux-ink-2") }}>{section.note}</p>
            )}
            <p className="mt-1.5 text-xs" style={{ color: v("--ux-muted") }}>
              {kids.length} places, nothing hidden.
            </p>
          </div>
        </header>

        <div className="grid items-start gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(268px, 1fr))" }}>
          {kids.map((c) => <HubCard key={c.id} node={c} />)}
        </div>
      </div>
    </HomeShell>
  );
}

function HubCard({ node }: { node: NavNode }) {
  const nav = useNavLabel();
  const kids = (node.children ?? []).filter((c) => !c.unlisted);
  return (
    <Card pad={18} className="flex flex-col">
      <Link href={node.href} className="ux-sq flex items-start gap-3">
        <IconTile icon={node.icon} tint="--ux-brand-tint-2" ink="--ux-brand" size={42} radius={12} />
        <span className="min-w-0 flex-1">
          <span className="block text-xsm font-bold" style={{ color: v("--ux-ink") }}>
            {nav.label(node)}
          </span>
          {nav.note(node) && (
            <span className="mt-1 block text-xs leading-snug" style={{ color: v("--ux-muted") }}>
              {nav.note(node)}
            </span>
          )}
        </span>
        <I name="ChevronRight" className="mt-2.5 h-[15px] w-[15px] shrink-0" style={{ color: v("--ux-faint") }} />
      </Link>

      {kids.length > 0 && (
        /* Listed here rather than made into a third level to drill through:
           a nested menu is where a woman mistakes its back for the phone's. */
        <ul className="mt-3 flex flex-wrap gap-1.5 border-t pt-3" style={{ borderColor: v("--ux-line") }}>
          {kids.map((k) => (
            <li key={k.id}>
              <Link href={k.href}
                    className="ux-press ux-sq flex min-h-[32px] items-center rounded-full px-2.5 text-2xs font-semibold"
                    style={{ background: v("--ux-surface-2"), color: v("--ux-ink-2") }}>
                {nav.label(k)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
