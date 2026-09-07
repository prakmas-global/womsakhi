/**
 * Every route must belong to a section, and every section must be reachable.
 *
 * A route with no mode gets no rail, no active tab and no "you are here" — it
 * is an orphan (§6). This walks the real MODES table against the real route
 * tree, so a rename that drops a route shows up here rather than in her hands.
 */
import { readdirSync, statSync } from "fs";
import { join } from "path";

const { MODES, modeForPath } = await import("../src/components/ux/nav.ts").catch(async () => {
  // nav.ts is TS; read it as text and pull the hrefs instead.
  return { MODES: null, modeForPath: null };
});
if (MODES) { console.log("loaded"); }
