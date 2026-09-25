"use client";

import { useT } from "@/i18n";
import { Card, I, v } from "@/components/ux/kit";
import { TransitionLink } from "@/components/ux/TransitionLink";

/**
 * A way to reach a person, on the screens where being stuck costs her money.
 *
 * The helplines exist and are correct — 181, 112, NCW, Childline, Tele-MANAS —
 * but they live on the safety screen alone. A woman looking at a payment that
 * has not arrived, a buyer who has not paid, or a dispute she does not
 * understand is not going to go looking under Safety for them, and the money
 * screens offered her nothing at all: no number, no message box, no name.
 *
 * Deliberately two routes and not one. "Write to us" is the right answer for
 * an ordinary problem and the wrong one for a woman being pressured over money
 * by somebody she knows, which is a safety matter and needs a number she can
 * ring now.
 */
export function NeedAHuman({ about }: { about?: string }) {
  const tr = useT();
  return (
    <Card pad={14}>
      <div className="flex items-start gap-2.5">
        <I name="Headphones" className="mt-0.5 h-[18px] w-[18px] shrink-0" style={{ color: v("--ux-brand") }} />
        <div className="min-w-0 flex-1">
          <p className="text-xsm font-semibold" style={{ color: v("--ux-ink") }}>
            {tr("support.stuckTitle")}
          </p>
          <p className="mt-1 text-2xs leading-relaxed" style={{ color: v("--ux-muted") }}>
            {about || tr("support.stuckBody")}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <TransitionLink href="/app/help"
                            className="ux-sq inline-flex items-center gap-1.5 text-xsm font-semibold"
                            style={{ color: v("--ux-brand") }}>
              <I name="MessageCircle" className="h-[15px] w-[15px]" />
              {tr("support.writeToUs")}
            </TransitionLink>
            {/*
              A real `tel:` — it dials. 181 is the all-India women's helpline
              and it is free; she should not have to find it herself while
              somebody is standing over her about money.
            */}
            <a href="tel:181"
               className="ux-sq inline-flex items-center gap-1.5 text-xsm font-semibold"
               style={{ color: v("--ux-brand") }}>
              <I name="Phone" className="h-[15px] w-[15px]" />
              {tr("support.callHelpline")}
            </a>
          </div>
        </div>
      </div>
    </Card>
  );
}
