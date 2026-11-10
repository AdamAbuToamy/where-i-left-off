// Public, read-only production delivery checks; this does not establish Google's index state.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

const origin = "https://where-i-left-off.web.app";
async function get(path) {
  const response = await fetch(origin + path, {
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  assert.equal(response.status, 200, `Public URL must return 200 directly: ${path}`);
  assert.ok(!response.headers.get("x-robots-tag")?.includes("noindex"), `Blocked by response header: ${path}`);
  return response;
}
const paths = ["/", "/about.html", "/about-ar.html", "/about-he.html"];
const documents = new Map();
await Promise.all(paths.map(async (path) => {
  const response = await get(path);
  assert.match(response.headers.get("content-type") || "", /text\/html/i);
  assert.match(response.headers.get("cache-control") || "", /max-age=0/);
  assert.match(response.headers.get("cache-control") || "", /must-revalidate/);
  const html = await response.text();
  const document = new JSDOM(html, { url: origin + path }).window.document;
  documents.set(path, document);
  const source = new JSDOM(await readFile(new URL(path === "/" ? "../index.html" : `../public${path}`, import.meta.url), "utf8")).window.document;
  assert.equal(document.title, source.title, `Stale published title: ${path}`);
  assert.equal(document.querySelector('meta[name="description"]')?.content, source.querySelector('meta[name="description"]')?.content, `Stale published description: ${path}`);
  assert.equal(document.querySelectorAll('link[rel="canonical"]').length, 1);
  assert.equal(document.querySelector('link[rel="canonical"]').href, origin + path);
  assert.equal(document.querySelector('meta[http-equiv="refresh" i]'), null);
  assert.ok(!document.querySelector('meta[name="robots"]')?.content.includes("noindex"));
}));
assert.notEqual(documents.get("/").title, documents.get("/about.html").title);
const home = documents.get("/");
const about = documents.get("/about.html");
let guideStructure;
let guideStylesheet;
function structure(element) {
  return [element.tagName, element.getAttribute("class") || "", ...[...element.children].filter(child => !["SCRIPT", "STYLE", "NOSCRIPT"].includes(child.tagName)).map(structure)];
}
const site = JSON.parse(home.querySelector('script[type="application/ld+json"]').textContent);
for (const name of ["WILO", "ويلو", "أين وصلت", "לאן הגעתי"]) {
  assert.ok(site.alternateName.includes(name));
  assert.ok(home.getElementById("wilo-site-identity")?.textContent.includes(name));
  assert.ok(about.body.textContent.includes(name));
}
for (const [language, path] of Object.entries({ en: "/about.html", ar: "/about-ar.html", he: "/about-he.html" })) {
  const document = documents.get(path);
  assert.equal(document.documentElement.lang, language);
  assert.equal(document.documentElement.dir, language === "en" ? "ltr" : "rtl");
  const stylesheet = document.querySelector('link[rel="stylesheet"]').getAttribute("href");
  const currentStructure = structure(document.querySelector("main"));
  if (guideStructure) assert.deepEqual(currentStructure, guideStructure, "Published guide structures differ across languages");
  else guideStructure = currentStructure;
  if (guideStylesheet) assert.equal(stylesheet, guideStylesheet, "Published language stylesheets differ");
  else guideStylesheet = stylesheet;
  assert.ok(document.querySelector(".about-card-example .project-card .envelope-summary"));
  assert.doesNotMatch(document.body.textContent, /robotic arm|shoulder motor|ذراع روبوت|זרוע רובוט/i);
  assert.match(stylesheet, /^\/about-guide-[a-f0-9]{12}\.css$/);
  const cssResponse = await get(stylesheet);
  assert.match(cssResponse.headers.get("content-type") || "", /text\/css/);
  assert.equal(await cssResponse.text(), await readFile(new URL(`../public${stylesheet}`, import.meta.url), "utf8"));
  const previewScript = document.querySelector("script[src]")?.getAttribute("src");
  assert.match(previewScript, /^\/about-demo-[a-f0-9]{12}\.js$/);
  const scriptResponse = await get(previewScript);
  assert.match(scriptResponse.headers.get("content-type") || "", /javascript/);
  assert.equal(await scriptResponse.text(), await readFile(new URL(`../public${previewScript}`, import.meta.url), "utf8"));
  for (const [targetLanguage, target] of Object.entries({ en: "/about.html", ar: "/about-ar.html", he: "/about-he.html" })) {
    assert.equal(document.querySelector(`link[hreflang="${targetLanguage}"]`)?.href, origin + target);
  }
  for (const id of ["project-checkpoint", "examples", "questions"]) {
    assert.ok(home.querySelector(`a[href="${path}#${id}"]`));
    assert.ok(document.getElementById(id));
  }
}
const xmlResponse = await get("/sitemap.xml");
assert.match(xmlResponse.headers.get("content-type") || "", /application\/xml/i);
const xml = await xmlResponse.text();
assert.equal(xml.trim(), (await readFile(new URL("../public/sitemap.xml", import.meta.url), "utf8")).trim());
const sitemap = new JSDOM(xml, { contentType: "text/xml" }).window.document;
assert.deepEqual([...sitemap.querySelectorAll("loc")].map(node => node.textContent), paths.map(path => origin + path));
const robots = await (await get("/robots.txt")).text();
assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`));
assert.doesNotMatch(robots, /Disallow:\s*\/\s*$/m);
for (const path of ["/favicon.png", "/favicon.ico", "/app-icon-192.png", "/app-icon-512.png"]) {
  const bytes = Buffer.from(await (await get(path)).arrayBuffer());
  assert.deepEqual(bytes, await readFile(new URL(`../public${path}`, import.meta.url)), `Published logo differs from source: ${path}`);
}
console.log("Production SEO delivery passed: direct public 200s, distinct current metadata, canonicals, crawlable guide links, revalidated HTML, matching sitemap and logo. Google indexing not asserted.");
