import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const origin = "https://where-i-left-off.web.app";
const paths = { en: "/about.html", ar: "/about-ar.html", he: "/about-he.html" };
const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");
const content = JSON.parse(await read("scripts/about/content.json"));
assert.deepEqual(Object.keys(content), Object.keys(paths), "All three guide languages are required");
for (const locale of Object.values(content)) assert.deepEqual(Object.keys(locale).sort(), Object.keys(content.en).sort(), "Guide translations must expose the same information fields");
const escape = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const hash = value => createHash("sha256").update(value).digest("hex").slice(0, 12);
const css = (await read("scripts/about/layout.css")) + "\n" + (await read("scripts/about/card.css"));
const script = await read("scripts/about/demo.js");
const stylesheet = `/about-guide-${hash(css)}.css`;
const scriptPath = `/about-demo-${hash(script)}.js`;
const check = process.argv.includes("--check");
async function output(path, value) {
  if (check) assert.equal(await readFile(new URL("../public" + path, import.meta.url), "utf8"), value, `Regenerate public guides: npm run generate:about (${path})`);
  else await writeFile(new URL("../public" + path, import.meta.url), value);
}

// SSR the existing presentation component with fictional props. No Firebase or account services.
const server = await createServer({ root: fileURLToPath(new URL("../", import.meta.url)), configFile: false, logLevel: "error", optimizeDeps: { noDiscovery: true }, plugins: [react()], server: { middlewareMode: true }, appType: "custom" });
try {
  const { default: CompactCardShell } = await server.ssrLoadModule("/src/components/CompactCardShell.tsx");
  const { DesignPreviewContext } = await server.ssrLoadModule("/src/components/designPreviewContext.ts");
  const { recallText } = await server.ssrLoadModule("/src/recallTranslations.ts");
  await output(stylesheet, css);
  await output(scriptPath, script);
  for (const [lang, c] of Object.entries(content)) {
    const path = paths[lang];
    const project = { id: "public-week-example", name: c.sampleTitle, nextStep: c.sampleNext, checkpoint: c.sampleState, status: "active", sectionId: "public-personal", rank: 0, revision: 0 };
    const sections = [{ id: "public-personal", name: c.sampleSection }];
    function renderCard(expanded) {
      const details = h("div", null, h("h2", { dir: "auto" }, c.sampleTitle), h("p", { className: "label" }, c.state), h("p", { className: "checkpoint-copy", dir: "auto" }, c.sampleState), h("p", { className: "label" }, c.next), h("p", { className: "next-step", dir: "auto" }, c.sampleNext));
      return renderToStaticMarkup(h(DesignPreviewContext.Provider, { value: { enabled: true } }, h("article", { className: "project-card is-active" }, h("span", { className: "status status-active" }, recallText[lang].active), h(CompactCardShell, { project, sections, language: lang, expanded }, details))), { identifierPrefix: `about-${lang}-` });
    }
    const card = new JSDOM(renderCard(false)).window.document;
    const expanded = new JSDOM(renderCard(true)).window.document;
    card.querySelector(".envelope-content").innerHTML = expanded.querySelector(".envelope-content").innerHTML;
    const cardHtml = card.body.innerHTML;
    const alternatives = Object.entries(paths).map(([key, value]) => `<link rel="alternate" hreflang="${key}" href="${origin}${value}">`).join("\n");
    const switches = Object.entries(paths).map(([key, value]) => `<a href="${value}" lang="${key}" hreflang="${key}"${key === lang ? ' aria-current="page"' : ""}${key === "ar" ? ' id="arabic"' : key === "he" ? ' id="hebrew"' : ""}>${({ en: "English", ar: "العربية", he: "עברית" })[key]}</a>`).join("");
    const steps = c.steps.map(([title, text]) => `<li><h3>${escape(title)}</h3><p>${escape(text)}</p></li>`).join("");
    const examples = c.examples.map(([title, state, next, resources]) => `<article class="example"><h3>${escape(title)}</h3><dl><dt>${escape(c.state)}</dt><dd>${escape(state)}</dd><dt>${escape(c.next)}</dt><dd>${escape(next)}</dd><dt>${escape(c.resources)}</dt><dd>${escape(resources)}</dd></dl></article>`).join("");
    const questions = c.questions.map(([question, answer]) => `<details><summary>${escape(question)}</summary><p>${escape(answer)}</p></details>`).join("");
    const schema = { "@context": "https://schema.org", "@type": "AboutPage", "@id": origin + path + "#page", url: origin + path, name: c.title, description: c.description, inLanguage: lang, isPartOf: { "@id": origin + "/#website" }, about: { "@type": "WebApplication", "@id": origin + "/#app", name: "Where I Left Off", alternateName: ["WILO", "ويلو", "أين وصلت", "לאן הגעתי"], url: origin + "/", applicationCategory: "ProductivityApplication", operatingSystem: "Web browser" } };
    await output(path, `<!doctype html>
<html lang="${lang}" dir="${lang === "en" ? "ltr" : "rtl"}">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(c.title)}</title><meta name="description" content="${escape(c.description)}"><meta name="robots" content="index,follow">
<link rel="canonical" href="${origin}${path}">
${alternatives}
<link rel="alternate" hreflang="x-default" href="${origin}/about.html">
<link rel="icon" type="image/png" sizes="96x96" href="/favicon.png"><link rel="icon" type="image/x-icon" href="/favicon.ico"><link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="stylesheet" href="${stylesheet}"><script src="${scriptPath}" defer></script>
<meta property="og:site_name" content="Where I Left Off"><meta property="og:type" content="website"><meta property="og:title" content="${escape(c.title)}"><meta property="og:description" content="${escape(c.description)}"><meta property="og:url" content="${origin}${path}"><meta property="og:image" content="${origin}/app-icon-512.png"><meta name="twitter:card" content="summary">
<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script>
</head>
<body>
<header class="site-header shell"><a class="brand" href="/"><img src="/app-icon-192.png" width="40" height="40" alt=""><bdi>Where I Left Off</bdi></a><nav class="language-switch" aria-label="${escape(c.languageLabel)}">${switches}</nav></header>
<main class="shell">
<section class="hero"><div><p class="eyebrow">${escape(c.eyebrow)}</p><h1>${escape(c.heading)}</h1><p class="lead">${escape(c.intro)}</p><div class="actions"><a class="button primary" href="/">${escape(c.open)}</a><a class="button" href="#project-checkpoint">${escape(c.guide)}</a></div><p class="small">${escape(c.public)}</p></div><div class="about-card-example"><p class="sample-label">${escape(c.sampleLabel)} · ${escape(c.sample)}</p>${cardHtml}<p class="caption">${escape(c.sampleNote)}</p><noscript><style>.about-card-example .envelope-expand { display:none }</style></noscript></div></section>
<section class="section" id="project-checkpoint"><h2>${escape(c.stepsTitle)}</h2><p class="section-intro">${escape(c.stepsIntro)}</p><ol class="steps">${steps}</ol></section>
<section class="section" id="examples"><h2>${escape(c.examplesTitle)}</h2><p class="section-intro">${escape(c.examplesIntro)}</p><div class="examples">${examples}</div></section>
<section class="section two-column" id="features"><h2>${escape(c.featuresTitle)}</h2><div>${c.features.map(text => `<p>${escape(text)}</p>`).join("")}</div></section>
<section class="section" id="questions"><h2>${escape(c.questionsTitle)}</h2><div class="faq">${questions}</div></section>
<section class="closing"><h2>${escape(c.closing)}</h2><a class="button primary" href="/">${escape(c.open)}</a></section>
</main>
<footer class="site-footer"><div class="shell"><div class="footer-row"><a href="https://github.com/AdamAbuToamy/where-i-left-off">${escape(c.author)}</a><nav class="footer-links" aria-label="${escape(c.support)}"><a href="/privacy.html?lang=${lang}">${escape(c.privacy)}</a><a href="/terms.html?lang=${lang}">${escape(c.terms)}</a><a href="/support.html?lang=${lang}">${escape(c.support)}</a></nav></div><p class="aliases"><bdi>Where I Left Off · WILO</bdi> · <bdi lang="ar">ويلو · أين وصلت</bdi> · <bdi lang="he">לאן הגעתי</bdi></p></div></footer>
</body></html>
`);
  }
  console.log(`Public guides ${check ? "verified" : "generated"}: one template, three locales, real CompactCardShell, ${stylesheet}, ${scriptPath}`);
} finally { await server.close(); }
