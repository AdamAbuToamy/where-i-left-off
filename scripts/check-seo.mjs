import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const origin = "https://where-i-left-off.web.app";
const read = (path) => readFile(resolve(root, path), "utf8");
const xml = await read("public/sitemap.xml");
assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
assert.match(
  xml,
  /<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/,
);
assert.doesNotMatch(xml, /<!DOCTYPE|<!ENTITY|<html/i);
const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  (match) => match[1],
);
assert.equal(
  locations.length,
  2,
  "Only canonical public pages belong in this sitemap",
);
assert.equal(new Set(locations).size, locations.length);
for (const location of locations) {
  const url = new URL(location);
  assert.equal(url.origin, origin);
  assert.equal(url.hash + url.search, "");
  const html = await read(
    url.pathname === "/" ? "index.html" : `public${url.pathname}`,
  );
  assert.ok(html.includes(`rel="canonical" href="${location}"`));
  assert.doesNotMatch(
    html,
    /<meta[^>]+(?:name="robots"[^>]+content="[^"]*noindex|content="[^"]*noindex[^>]+name="robots")/i,
  );
}
const textLocations = (await read("public/sitemap.txt")).trim().split(/\r?\n/);
assert.deepEqual(
  textLocations,
  locations,
  "Legacy text sitemap must stay consistent",
);
const robots = await read("public/robots.txt");
assert.match(robots, /User-agent: \*\r?\nAllow: \//);
assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`));
assert.doesNotMatch(robots, /Disallow:\s*\/\s*$/m);
const firebase = JSON.parse(await read("firebase.json"));
for (const path of ["/sitemap.xml", "/sitemap.txt", "/robots.txt"]) {
  const rule = firebase.hosting.headers.find((item) => item.source === path);
  assert.ok(rule?.headers.some((header) => header.key === "Content-Type"));
}
console.log(
  `SEO delivery checks passed: ${locations.length} canonical public URLs, XML/text/robots and Hosting types.`,
);
