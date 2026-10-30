"use client";

import { useEffect } from "react";
import { SPLASH_ATTR } from "./open-check";

/** A brief welcome, never a gate that waits for an animation or an API. */
export default function AppSplashController() {
  useEffect(() => {
    const root = document.documentElement;
    if (root.getAttribute(SPLASH_ATTR) !== "on") return;
    let fade: number | undefined;
    const timer = window.setTimeout(() => {
      root.setAttribute(SPLASH_ATTR, "leaving");
      fade = window.setTimeout(() => root.removeAttribute(SPLASH_ATTR), 180);
    }, 350);
    return () => {
      window.clearTimeout(timer);
      if (fade !== undefined) window.clearTimeout(fade);
    };
  }, []);
  return null;
}
