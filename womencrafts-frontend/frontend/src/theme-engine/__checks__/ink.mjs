/**
 * The text scale must MEET its contrast target for every preset, in both modes.
 *
 * Run after any change to the token generator. A token that fails here is a
 * caption somebody cannot read, on every screen, in that theme.
 */
import { wcagContrast } from "culori";
import { surfaceVariables } from "../surfaces.ts";
import { PRESETS } from "../presets.ts";

const TARGETS = {
  "--color-ink": 7,
  "--color-ink-muted": 4.5,
  "--color-ink-subtle": 4.5,
  "--color-ink-faint": 3,
};

// Status badges: the ink must read on ITS OWN tint, and the solid variant
// must carry white text — that is how each is actually used.
const STATUS = ["ok", "warn", "danger", "info"];

let pass = 0, fail = 0;
for (const preset of PRESETS) {
  for (const mode of ["light", "dark"]) {
    const v = surfaceVariables(preset.primary, preset.secondary, mode);
    // Every surface text can land on — card, canvas, inset, hover. A token
    // that only passes on the lightest of these fails in real screens.
    const surfaces = ["--surface", "--background", "--surface-inset", "--surface-hover"];
    for (const [token, need] of Object.entries(TARGETS)) {
      const ratio = Math.min(...surfaces.map((s) => wcagContrast(v[token], v[s]) ?? 0));
      const ok = ratio >= need - 0.01;
      if (ok) pass++;
      else {
        fail++;
        console.log(`  \x1b[31m✗\x1b[0m ${preset.name.padEnd(10)} ${mode.padEnd(5)} ${token.padEnd(20)} ${ratio.toFixed(2)}:1 (need ${need})`);
      }
    }

    for (const name of STATUS) {
      const onTint = wcagContrast(v[`--status-${name}-ink`], v[`--status-${name}-bg`]) ?? 0;
      const solidOnWhite = wcagContrast(v[`--status-${name}-solid`], "#ffffff") ?? 0;
      for (const [label, ratio] of [[`${name} ink on tint`, onTint], [`${name} solid on white`, solidOnWhite]]) {
        if (ratio >= 4.49) pass++;
        else {
          fail++;
          console.log(`  \x1b[31m✗\x1b[0m ${preset.name.padEnd(10)} ${mode.padEnd(5)} ${label.padEnd(22)} ${ratio.toFixed(2)}:1 (need 4.5)`);
        }
      }
    }
  }
}
console.log(`\n  ${pass} token/theme/mode combinations pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
