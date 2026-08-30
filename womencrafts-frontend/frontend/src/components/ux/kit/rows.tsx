"use client";

import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * A list that stops rendering what nobody is looking at.
 *
 * A woman running a stall through a festival season can have four hundred
 * transactions. Four hundred rows is four hundred DOM nodes, four hundred
 * hover listeners and four hundred squircle clips, on a phone with 2GB of RAM —
 * and the cost is not the scroll, it is the first paint: the ledger is the
 * screen she opens to check one figure, and it should not take a second to
 * appear.
 *
 * **Below the threshold it does nothing at all.** Most lists in this app are
 * eight rows. Virtualising eight rows adds a scroll listener, a measurement
 * pass and a class of bug for no gain, so under `threshold` this renders the
 * plain list and gets out of the way.
 *
 * **It does not fix the row height.** Rows here wrap — a long programme title
 * is two lines — so a fixed-height window would clip them. Instead it renders
 * a window of items with a spacer above and below sized from the *measured*
 * average, which is stable enough to scroll smoothly and cannot clip.
 *
 * **Keyboard and find-in-page.** Anything not rendered cannot be found with
 * ⌘F, which is a real loss on a statement. So the window is generous, and
 * `renderAll` forces the plain list for printing.
 */
export function Rows<T>({
  items,
  render,
  keyOf,
  threshold = 50,
  overscan = 8,
  renderAll = false,
  className = "",
}: {
  items: T[];
  render: (item: T, index: number) => React.ReactNode;
  keyOf: (item: T, index: number) => string;
  /** Below this many, render everything. Most lists never reach it. */
  threshold?: number;
  /** Extra rows above and below the viewport, so a fast scroll finds them drawn. */
  overscan?: number;
  /** Force the plain list — printing, or a screen that must be searchable. */
  renderAll?: boolean;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState({ start: 0, end: threshold });
  const [rowHeight, setRowHeight] = useState(72);

  const virtual = !renderAll && items.length > threshold;

  useEffect(() => {
    if (!virtual) return;
    const el = host.current;
    if (!el) return;

    // The scroller is the app's own column, not the window — this shell scrolls
    // a div. Walking up to find it beats assuming.
    const scroller: HTMLElement | Window =
      (el.closest("#ux-scroll") as HTMLElement) ?? window;

    const measure = () => {
      const first = el.firstElementChild as HTMLElement | null;
      if (first?.offsetHeight) setRowHeight((h) => (Math.abs(h - first.offsetHeight) > 4
        ? first.offsetHeight : h));

      const top = scroller instanceof Window ? window.scrollY : scroller.scrollTop;
      const view = scroller instanceof Window ? window.innerHeight : scroller.clientHeight;
      const above = Math.max(0, el.offsetTop - top);
      const h = rowHeight || 72;

      const start = Math.max(0, Math.floor((top - el.offsetTop) / h) - overscan);
      const visible = Math.ceil((view - Math.min(above, view)) / h) + overscan * 2;
      setRange({ start, end: Math.min(items.length, start + Math.max(visible, threshold)) });
    };

    measure();
    scroller.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      scroller.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [virtual, items.length, rowHeight, overscan, threshold]);

  const window_ = useMemo(
    () => (virtual ? items.slice(range.start, range.end) : items),
    [virtual, items, range.start, range.end],
  );

  if (!virtual) {
    return (
      <div ref={host} className={className}>
        {items.map((item, i) => (
          <Row key={keyOf(item, i)}>{render(item, i)}</Row>
        ))}
      </div>
    );
  }

  return (
    <div ref={host} className={className}>
      {/* Spacers rather than absolute positioning: the scrollbar stays honest
          about how long the list is, which matters on a statement she is
          scrolling through looking for one entry. */}
      <div style={{ height: range.start * rowHeight }} aria-hidden />
      {window_.map((item, i) => (
        <Row key={keyOf(item, range.start + i)}>{render(item, range.start + i)}</Row>
      ))}
      <div style={{ height: Math.max(0, items.length - range.end) * rowHeight }} aria-hidden />
    </div>
  );
}

/**
 * A keyed wrapper, and nothing more.
 *
 * An earlier version of this claimed to be memoised. It could not have been:
 * `render(item, i)` has already run by the time its result is passed here, so
 * wrapping it in `React.memo` would memoise a fragment around work that was
 * already done. Memoising a row is the caller's job, and `rowMemo` below makes
 * it a one-liner.
 */
const Row = ({ children }: { children: React.ReactNode }) => <>{children}</>;

/**
 * Memoise a row component by its item.
 *
 * The gain is real and easy to miss: changing a filter chip re-renders the
 * list, and without this every row re-renders even though only the set changed.
 * On a two-hundred-row ledger that is the difference between a chip feeling
 * instant and feeling stuck.
 *
 *     const TxnRow = rowMemo(function TxnRow({ item }: { item: Txn }) { … });
 *     <Rows items={txns} keyOf={(t) => t.id} render={(t) => <TxnRow item={t} />} />
 *
 * Compares by identity, which is correct here because every adapter in this
 * app builds fresh objects from the server's answer: a row's object changes
 * exactly when its data does.
 */
export function rowMemo<P extends { item: unknown }>(
  Component: React.FunctionComponent<P>,
): React.FunctionComponent<P> {
  return React.memo(Component, (a, b) => a.item === b.item) as React.FunctionComponent<P>;
}
