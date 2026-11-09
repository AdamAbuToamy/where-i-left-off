import { createHash } from "node:crypto";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const source = await loadImage(
  root + "assets/branding/wilo-document-tracker-source.png",
);
if (source.width !== 1536 || source.height !== 1024)
  throw Error("Review crop coordinates for a changed source image");
// Extract the supplied symbol exactly, excluding the wordmark. Extend only the
// empty background edge rows to square the crop, without stretching the artwork.
const base = createCanvas(625, 625),
  ctx = base.getContext("2d");
ctx.drawImage(source, 450, 65, 625, 1, 0, 0, 625, 25);
ctx.drawImage(source, 450, 65, 625, 575, 0, 25, 625, 575);
ctx.drawImage(source, 450, 639, 625, 1, 0, 600, 625, 25);
function icon(size, maskable = false) {
  const canvas = createCanvas(size, size),
    c = canvas.getContext("2d");
  c.fillStyle = "#fff8f2";
  c.fillRect(0, 0, size, size);
  const inset = maskable ? size * 0.1 : 0;
  c.drawImage(base, inset, inset, size - 2 * inset, size - 2 * inset);
  return canvas.toBuffer("image/png");
}
for (const [name, size, mask] of [
  ["app-icon-192.png", 192, false],
  ["app-icon-512.png", 512, false],
  ["app-icon-maskable-512.png", 512, true],
  ["apple-touch-icon.png", 180, false],
  ["favicon.png", 96, false],
])
  await writeFile(root + "public/" + name, icon(size, mask));
const sizes = [16, 32, 48, 96],
  images = sizes.map((size) => icon(size)),
  header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
for (let i = 0; i < sizes.length; i++) {
  const pos = 6 + i * 16;
  header[pos] = sizes[i];
  header[pos + 1] = sizes[i];
  header.writeUInt16LE(1, pos + 4);
  header.writeUInt16LE(32, pos + 6);
  header.writeUInt32LE(images[i].length, pos + 8);
  header.writeUInt32LE(offset, pos + 12);
  offset += images[i].length;
}
await writeFile(
  root + "public/favicon.ico",
  Buffer.concat([header, ...images]),
);
// Keep the old SVG URL consistent for bookmarks/crawlers using that address.
const png = (await readFile(root + "public/app-icon-192.png")).toString(
  "base64",
);
await writeFile(
  root + "public/favicon.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192"><image width="192" height="192" href="data:image/png;base64,${png}"/></svg>\n`,
);
console.log(
  "Generated favicon, Apple touch and standard/maskable PWA icons from the supplied original symbol.",
);

// Installed Chrome apps compare manifest icon URLs, not just image bytes.
// Keep the manifest/app ID stable, while making changed icon content explicit.
const manifestPath = root + "public/manifest.webmanifest";
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
for (const entry of manifest.icons) {
  const stable = entry.src.replace(/\.[a-f0-9]{12}(?=\.png$)/, "");
  const bytes = await readFile(root + "public" + stable);
  const version = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
  entry.src = stable.replace(/\.png$/, "." + version + ".png");
  await writeFile(root + "public" + entry.src, bytes);
}
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

// Chrome extension toolbar and management icons share the exact supplied symbol.
for (const size of [16, 32, 48, 128])
  await writeFile(
    root + `browser-extension/icons/icon-${size}.png`,
    icon(size),
  );
