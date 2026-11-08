import { it, expect } from "vitest";
// @ts-expect-error Pure deployment adapter is JavaScript, executed directly by Node.
import { productionBrowserConfig } from "../scripts/lib/productionBrowserConfig.mjs";
const config = {
  projectId: "where-i-left-off-b5683",
  apiKey: "public-synthetic-key",
  authDomain: "example.test",
  appId: "synthetic-app",
};
it("preserves App Check when Vite moves configuration from entry into preloaded Firebase chunk", async () => {
  const reads: string[] = [];
  const env = await productionBrowserConfig(async (path: string) => {
    reads.push(path);
    if (path === "/__/firebase/init.json") return config;
    if (path === "/")
      return '<script src="/assets/index-abc.js"></script><link rel="modulepreload" href="/assets/firebase-def.js">';
    if (path === "/assets/index-abc.js") return "entry();";
    return 'VITE_RECAPTCHA_ENTERPRISE_SITE_KEY:"public_test_site_key_123456789",VITE_APP_CHECK_PROVIDER:"recaptcha-enterprise"';
  });
  expect(env.VITE_REQUIRE_APP_CHECK).toBe("true");
  expect(env.VITE_TEST_OFFLINE).toBe("false");
  expect(env.VITE_FIREBASE_PROJECT_ID).toBe(config.projectId);
  expect(reads).toContain("/assets/firebase-def.js");
});
it("fails closed instead of disabling App Check when the public key cannot be found", async () => {
  await expect(
    productionBrowserConfig(async (path: string) =>
      path === "/__/firebase/init.json"
        ? config
        : path === "/"
          ? '<script src="/assets/index.js"></script>'
          : "no configuration",
    ),
  ).rejects.toThrow("App Check");
});
