// Recover only existing public configuration; credentials never enter this file.
import { writeFile } from "node:fs/promises";
import { productionBrowserConfig } from "./lib/productionBrowserConfig.mjs";
const origin = "https://where-i-left-off.web.app";
async function read(path, json = false) {
  const response = await fetch(new URL(path, origin), {
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw Error("Production configuration request failed: " + response.status);
  return json ? response.json() : response.text();
}
const env = await productionBrowserConfig(read);
await writeFile(
  ".env.production.local",
  Object.entries(env)
    .map(([name, value]) => name + "=" + JSON.stringify(value))
    .join(String.fromCharCode(10)) + String.fromCharCode(10),
  { mode: 0o600 },
);
console.log(
  "Production browser configuration verified; existing App Check preserved.",
);
