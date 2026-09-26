/** Prevent live member adapters from silently reviving demo rows on failure. */
import { readFileSync } from "fs";

const files = [
  "src/lib/use-resource.ts",
  "src/components/ux/business.ts",
  "src/components/ux/entitlements.ts",
  "src/components/ux/growth.ts",
  "src/components/ux/live.ts",
  "src/components/ux/me.ts",
  "src/components/ux/money/live.ts",
];

const failures = [];
for (const file of files) {
  const source = readFileSync(file, "utf8");
  if (/source:\s*["']mock["']/.test(source)) failures.push(`${file}: emits source=mock`);
  if (/useTranslated\((?:JOBS|APPLICATIONS|EVENTS|CONTINUING|TOP_PICKS|FINDS|NOTIFICATIONS|BOOKINGS|CERTIFICATES|DOCUMENTS|MENTORS|SCHEMES|HEALTH_CHECKS|RIGHTS|CRECHES|ROUTES|GROUP_BUYS|ASSESSMENTS|DIGITAL_STEPS|SWAPS)\)/.test(source)) {
    failures.push(`${file}: passes translated fixture rows to a live adapter`);
  }
}

if (failures.length) {
  console.error(`FAIL\n${failures.map((x) => `  - ${x}`).join("\n")}`);
  process.exit(1);
}
console.log(`PASS: ${files.length} live adapter files contain no silent demo-data fallback`);
