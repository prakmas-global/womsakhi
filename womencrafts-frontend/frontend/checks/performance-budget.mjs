/** Launch performance guardrails. Run after `next build`. */
import fs from "node:fs";
import path from "node:path";

const dist = process.env.NEXT_DIST_DIR || ".next";
const chunkRoot = path.join(dist, "static", "chunks");
const failures = [];

function walk(dir, accept) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file, accept) : accept(file) ? [file] : [];
  });
}

const chunks = walk(chunkRoot, (file) => file.endsWith(".js"));
if (!chunks.length) failures.push(`no production chunks found in ${chunkRoot}; run next build first`);
const largestChunk = chunks.reduce(
  (largest, file) => fs.statSync(file).size > fs.statSync(largest).size ? file : largest,
  chunks[0] || import.meta.filename,
);
const largestChunkBytes = chunks.length ? fs.statSync(largestChunk).size : 0;
if (largestChunkBytes > 750 * 1024) {
  failures.push(`largest JS chunk is ${(largestChunkBytes / 1024).toFixed(0)} KiB (budget: 750 KiB)`);
}

const images = walk("public", (file) => /\.(png|jpe?g|webp|avif)$/i.test(file));
const oversizedImages = images.filter((file) => fs.statSync(file).size > 750 * 1024);
if (oversizedImages.length) {
  failures.push(`${oversizedImages.length} public image(s) exceed 750 KiB: ${oversizedImages.slice(0, 5).join(", ")}`);
}

const i18n = fs.readFileSync("src/i18n/index.tsx", "utf8");
const extraCatalogues = [...i18n.matchAll(/messages\/(?!en(?:["']))[^"']+/g)].map((match) => match[0]);
if (extraCatalogues.length) failures.push(`launch bundle statically imports non-English catalogues: ${extraCatalogues.join(", ")}`);

console.log(`largest JS chunk: ${(largestChunkBytes / 1024).toFixed(0)} KiB`);
console.log(`public images: ${images.length}; over 750 KiB: ${oversizedImages.length}`);
if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL ${failure}`));
  process.exit(1);
}
console.log("PASS performance budgets");
