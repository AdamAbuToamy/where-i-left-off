import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { createHash } from "node:crypto";

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
  4,
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
const home = await read("index.html");
const site = JSON.parse(home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] || "null");
assert.equal(site?.["@type"], "WebSite");
assert.equal(site.name, "Where I Left Off");
assert.equal(site.url, `${origin}/`);
const publicIdentity = home.match(/<footer id="wilo-site-identity"[\s\S]*?<\/footer>/)?.[0];
assert.ok(publicIdentity, "Product names must be visible outside the React loading shell");
const about = await read("public/about.html");
const documents = new Map([
  ["/", new JSDOM(home, { url: `${origin}/` }).window.document],
  ["/about.html", new JSDOM(about, { url: `${origin}/about.html` }).window.document],
  ["/about-ar.html", new JSDOM(await read("public/about-ar.html"), { url: `${origin}/about-ar.html` }).window.document],
  ["/about-he.html", new JSDOM(await read("public/about-he.html"), { url: `${origin}/about-he.html` }).window.document],
]);
const titles = new Set();
const descriptions = new Set();
for (const [path, document] of documents) {
  const title = document.title.trim();
  const description = document.querySelector('meta[name="description"]')?.content;
  assert.ok(title && description, `Missing metadata: ${path}`);
  assert.ok(!titles.has(title), "Public pages need distinct titles");
  assert.ok(!descriptions.has(description), "Public pages need distinct descriptions");
  titles.add(title);
  descriptions.add(description);
  assert.equal(document.querySelectorAll('link[rel="canonical"]').length, 1);
  assert.equal(document.querySelector('link[rel="canonical"]').href, origin + path);
  assert.equal(document.querySelectorAll("h1").length, 1, `One primary heading: ${path}`);
  assert.ok(document.querySelector("h1").textContent.trim());
  assert.equal(document.querySelector('meta[http-equiv="refresh" i]'), null, "Public pages must not redirect through meta refresh");
  for (const link of document.querySelectorAll("a[href]")) {
    const url = new URL(link.href);
    if (url.origin !== origin) continue;
    const target = documents.get(url.pathname) || new JSDOM(await read(`public${url.pathname}`)).window.document;
    if (url.hash) assert.ok(target.getElementById(decodeURIComponent(url.hash.slice(1))), `Broken public fragment: ${url.href}`);
  }
}
for (const id of ["project-checkpoint", "examples", "questions"]) {
  assert.ok(documents.get("/").querySelector(`a[href="/about.html#${id}"]`), `Homepage must link to the public guide: ${id}`);
}
const aboutPage = JSON.parse(documents.get("/about.html").querySelector('script[type="application/ld+json"]').textContent);
assert.equal(aboutPage["@type"], "AboutPage");
assert.equal(aboutPage.url, `${origin}/about.html`);
const translations = { en: "/about.html", ar: "/about-ar.html", he: "/about-he.html" };
let guideStructure;
let guideStylesheet;
function structure(element) {
  return [element.tagName, element.getAttribute("class") || "", ...[...element.children].filter(child => !["SCRIPT", "STYLE", "NOSCRIPT"].includes(child.tagName)).map(structure)];
}
for (const [language, path] of Object.entries(translations)) {
  const document = documents.get(path);
  assert.equal(document.documentElement.lang, language);
  assert.equal(document.documentElement.dir, language === "en" ? "ltr" : "rtl");
  assert.equal(JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent).inLanguage, language);
  assert.equal(document.querySelectorAll('nav.language-switch a[aria-current="page"]').length, 1);
  for (const [targetLanguage, targetPath] of Object.entries(translations)) {
    assert.equal(document.querySelector(`link[hreflang="${targetLanguage}"]`)?.href, origin + targetPath, "Localized guides need reciprocal language alternates");
    assert.ok(document.querySelector(`nav.language-switch a[href="${targetPath}"]`));
    for (const id of ["project-checkpoint", "examples", "questions"]) {
      assert.ok(documents.get("/").querySelector(`a[href="${targetPath}#${id}"]`));
    }
  }
  assert.equal(document.querySelector('link[hreflang="x-default"]')?.href, origin + "/about.html");
  const stylesheet = document.querySelector('link[rel="stylesheet"]')?.getAttribute("href");
  const currentStructure = structure(document.querySelector("main"));
  if (guideStructure) assert.deepEqual(currentStructure, guideStructure, "All guide languages must use the same page/card structure");
  else guideStructure = currentStructure;
  if (guideStylesheet) assert.equal(stylesheet, guideStylesheet, "All guide languages must share the same stylesheet");
  else guideStylesheet = stylesheet;
  assert.ok(document.querySelector(".about-card-example .project-card .envelope-summary"));
  assert.doesNotMatch(document.body.textContent, /robotic arm|shoulder motor|ذراع روبوت|זרוע רובוט/i, "Public examples must not contain the user's personal robotics project");
  assert.match(stylesheet, /^\/about-guide-[a-f0-9]{12}\.css$/);
  const css = await readFile(resolve(root, `public${stylesheet}`));
  assert.ok(stylesheet.includes(createHash("sha256").update(css).digest("hex").slice(0, 12)), "Public guide CSS URL must match its contents");
  const previewScript = document.querySelector("script[src]")?.getAttribute("src");
  assert.match(previewScript, /^\/about-demo-[a-f0-9]{12}\.js$/);
  assert.ok(previewScript.includes(createHash("sha256").update(await readFile(resolve(root, `public${previewScript}`))).digest("hex").slice(0, 12)));
}
for (const entry of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
  const date = entry[1].match(/<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/)?.[1];
  assert.ok(date, "Updated public pages need an actual modification date");
  assert.ok(Number.isFinite(Date.parse(date)) && date <= new Date().toISOString().slice(0, 10), "Invalid or future lastmod");
}
for (const name of ["WILO", "ويلو", "أين وصلت", "לאן הגעתי"]) {
  assert.ok(site.alternateName.includes(name), `Missing alternate site name: ${name}`);
  assert.ok(publicIdentity.includes(name), `Missing visible product name: ${name}`);
  assert.ok(about.slice(about.indexOf("<body>")).includes(name), `Missing public explanation: ${name}`);
}
for (const [path, size] of [["favicon.png", 96], ["app-icon-192.png", 192], ["app-icon-512.png", 512], ["apple-touch-icon.png", 180]]) {
  const png = await readFile(resolve(root, "public", path));
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(png.readUInt32BE(16), size, `${path} width`);
  assert.equal(png.readUInt32BE(20), size, `${path} height`);
}
assert.ok(home.includes('href="/favicon.png"'));
assert.ok(home.includes('href="/favicon.ico"'));
assert.ok(about.includes('href="/favicon.png"'));
const ico = await readFile(resolve(root, "public/favicon.ico"));
assert.equal(ico.readUInt16LE(2), 1, "ICO resource type");
assert.ok(ico.readUInt16LE(4) > 0, "ICO must contain an icon");
const firebase = JSON.parse(await read("firebase.json"));
for (const path of ["/sitemap.xml", "/sitemap.txt", "/robots.txt"]) {
  const rule = firebase.hosting.headers.find((item) => item.source === path);
  assert.ok(rule?.headers.some((header) => header.key === "Content-Type"));
}
for (const path of ["/", ...Object.values(translations), "/marketing.css"]) {
  const rule = firebase.hosting.headers.find((item) => item.source === path);
  assert.ok(rule?.headers.some((header) => header.key === "Cache-Control" && header.value.includes("max-age=0") && header.value.includes("must-revalidate")), `Public HTML must revalidate: ${path}`);
}
console.log(
  `SEO delivery checks passed: ${locations.length} canonical public URLs, XML/text/robots and Hosting types.`,
);
