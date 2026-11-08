import { createRequire } from "node:module";
import { readFile, readdir, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
const root = fileURLToPath(new URL("..", import.meta.url)),
  require = createRequire(
    new URL("../push-worker/package.json", import.meta.url),
  ),
  { build } = require("esbuild");
// Isolated actual React component, mocked account port. No login, no Wilo network or real credentials.
const source = `import React from 'react';import {createRoot} from 'react-dom/client';import ApiKeySettings from './src/components/ApiKeySettings';createRoot(document.getElementById('root')).render(<ApiKeySettings user={{uid:'synthetic'}} language="ar"/>);`;
const { outputFiles } = await build({
  stdin: { contents: source, loader: "tsx", resolveDir: root },
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  jsx: "automatic",
  loader: { ".css": "empty" },
  plugins: [
    {
      name: "synthetic-account-port",
      setup(b) {
        b.onResolve({ filter: /lib\/apiKeys$/ }, () => ({
          path: "synthetic-api",
          namespace: "synthetic",
        }));
        b.onLoad({ filter: /.*/, namespace: "synthetic" }, () => ({
          contents: `export async function accountApiKeys(user,data){return data.action==='list'?{keys:[{id:'synthetic',name:'My automation',scopes:['courses:read','tasks:write'],createdAt:Date.now(),expiresAt:null,lastUsedAt:null,status:'active'}]}:{key:'synthetic-preview-not-a-valid-credential'};}`,
          loader: "js",
        }));
      },
    },
  ],
});
const assets = await readdir(root + "/dist/assets"),
  css = (
    await Promise.all(
      assets
        .filter((n) => n.endsWith(".css"))
        .map((n) => readFile(root + "/dist/assets/" + n, "utf8")),
    )
  ).join("\n");
const browser = await chromium.launch({ headless: true });
await mkdir(root + "/.wrangler/api-ui", { recursive: true });
try {
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.route("**/*", (route) => route.abort());
    await page.setContent(
      '<html lang="ar" dir="rtl"><body><main id="root" class="page-panel settings-page"></main></body></html>',
    );
    await page.addStyleTag({
      content:
        css +
        "\n" +
        (await readFile(root + "/src/components/apiKeys.css", "utf8")),
    });
    await page.addScriptTag({ content: outputFiles[0].text });
    await page.getByRole("heading", { name: "API Keys" }).waitFor();
    await page.screenshot({
      path: root + "/.wrangler/api-ui/settings-" + width + ".png",
      fullPage: true,
    });
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
    )
      throw Error("Horizontal overflow at " + width);
    if (await page.locator("form").count())
      throw Error("Creation form visible by default");
    await page
      .getByRole("button", { name: "إضافة مفتاح", exact: true })
      .click();
    await page.getByLabel("اسم المفتاح", { exact: true }).fill("Synthetic");
    await page.locator("input[type=checkbox]").first().check();
    await page.getByRole("button", { name: "إنشاء API Key" }).click();
    await page.locator("dialog[open]").waitFor();
    await page.screenshot({
      path: root + "/.wrangler/api-ui/secret-" + width + ".png",
    });
    await page.getByRole("button", { name: "حفظت المفتاح، إغلاق" }).click();
    if (await page.locator("textarea").count())
      throw Error("Secret retained after close");
    await page.close();
  }
  console.log(
    "Synthetic component checks passed: desktop/mobile layout, dialog, close. No authentication or upstream calls.",
  );
} finally {
  await browser.close();
}
