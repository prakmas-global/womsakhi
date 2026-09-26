/**
 * Guard the generated app art against blurry replacements.
 *
 * The member app paints these files into cards, hero panels and Retina phone
 * slots. A 300px illustration can look fine in a source diff and soft in the
 * product. This check keeps the invariant close to the assets: app art must
 * have enough natural pixels for 2x displays, and it must not be a tiny
 * over-compressed placeholder.
 *
 * Run: node checks/image-quality.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("public");
const ART = path.join(ROOT, "ux/art");
const EXTRA = [path.join(ROOT, "ux/brand/auth-hero.png")];
const fails = [];

function sourceText(dir = path.resolve("src")) {
  let out = "";
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) out += sourceText(file);
    else if (/\.(tsx?|css|json)$/i.test(entry.name)) out += fs.readFileSync(file, "utf8");
  }
  return out;
}
const sources = sourceText();

function pngSize(buf) {
  if (buf.toString("ascii", 1, 4) !== "PNG") return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function webpSize(buf) {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
  let at = 12;
  while (at + 8 <= buf.length) {
    const fourcc = buf.toString("ascii", at, at + 4);
    const len = buf.readUInt32LE(at + 4);
    const data = at + 8;
    if (fourcc === "VP8X" && data + 10 <= buf.length) {
      return {
        w: 1 + buf.readUIntLE(data + 4, 3),
        h: 1 + buf.readUIntLE(data + 7, 3),
      };
    }
    if (fourcc === "VP8 " && data + 10 <= buf.length) {
      return {
        w: buf.readUInt16LE(data + 6) & 0x3fff,
        h: buf.readUInt16LE(data + 8) & 0x3fff,
      };
    }
    if (fourcc === "VP8L" && data + 5 <= buf.length) {
      const b0 = buf[data + 1], b1 = buf[data + 2], b2 = buf[data + 3], b3 = buf[data + 4];
      return {
        w: 1 + (((b1 & 0x3f) << 8) | b0),
        h: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
      };
    }
    at = data + len + (len % 2);
  }
  return null;
}

function imageSize(file) {
  const buf = fs.readFileSync(file);
  return file.endsWith(".png") ? pngSize(buf) : file.endsWith(".webp") ? webpSize(buf) : null;
}

function minAreaFor(name) {
  if (name === "auth-hero.png") return 1200 * 900;
  if (name.startsWith("course-")) return 1000 * 1000;
  if (name.startsWith("circle-")) return 1000 * 750;
  if (name.startsWith("scene-")) return 700 * 700;
  if (name.startsWith("learn-") || name.startsWith("earn-")) return 640 * 420;
  if (name.startsWith("avatar-") || name.startsWith("icon-") || name.startsWith("empty-")) return 500 * 500;
  return 360 * 360;
}

function minBytesFor(name) {
  if (name === "banner-abstract-gradient.webp") return 20 * 1024;
  if (name === "auth-hero.png") return 200 * 1024;
  return 24 * 1024;
}

const files = fs.readdirSync(ART)
  .filter((name) => /\.(png|webp)$/i.test(name))
  // Obsolete variants may remain for design history. Launch quality concerns
  // the assets the app can actually render.
  .filter((name) => sources.includes(`/ux/art/${name}`))
  .map((name) => path.join(ART, name))
  .concat(EXTRA);

for (const file of files) {
  const name = path.basename(file);
  const size = imageSize(file);
  const bytes = fs.statSync(file).size;
  if (!size) {
    fails.push(`${name}: could not read dimensions`);
    continue;
  }
  const area = size.w * size.h;
  const minArea = minAreaFor(name);
  const minBytes = minBytesFor(name);
  if (area < minArea) {
    fails.push(`${name}: ${size.w}x${size.h} is too small; expected at least ${Math.round(minArea / 1000)}k pixels`);
  }
  if (bytes < minBytes) {
    fails.push(`${name}: ${Math.round(bytes / 1024)}KB is too compressed; expected at least ${Math.round(minBytes / 1024)}KB`);
  }
}

if (!fails.length) {
  console.log(`  \x1b[32m${files.length} app art assets have enough natural pixels\x1b[0m`);
  process.exit(0);
}

console.log(`  \x1b[31m${fails.length} image quality failure(s)\x1b[0m\n`);
for (const fail of fails) console.log("    " + fail);
console.log();
process.exit(1);
