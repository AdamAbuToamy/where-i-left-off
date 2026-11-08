/** Read only already-published browser identifiers; no IAM mutation or credentials. */
export async function productionBrowserConfig(read) {
  const config = await read("/__/firebase/init.json", true);
  if (config.projectId !== "where-i-left-off-b5683")
    throw Error("Unexpected Firebase project");
  const html = await read("/"),
    paths = [
      ...new Set(
        [
          ...html.matchAll(/(?:src|href)="(\/assets\/[A-Za-z0-9_-]+\.js)"/g),
        ].map((m) => m[1]),
      ),
    ];
  if (!paths.length || paths.length > 32)
    throw Error("Invalid production entry/preload graph");
  let key, provider;
  for (const path of paths) {
    const bundle = await read(path);
    key = bundle.match(
      /VITE_RECAPTCHA_ENTERPRISE_SITE_KEY\s*:\s*[`"']([A-Za-z0-9_-]{20,200})[`"']/,
    )?.[1];
    if (key) {
      provider =
        bundle.match(
          /VITE_APP_CHECK_PROVIDER\s*:\s*[`"'](recaptcha-enterprise|recaptcha-v3)[`"']/,
        )?.[1] || "recaptcha-enterprise";
      break;
    }
  }
  if (!key) throw Error("Cannot preserve the current App Check site key");
  const env = {
    VITE_FIREBASE_API_KEY: config.apiKey,
    VITE_FIREBASE_AUTH_DOMAIN: config.authDomain,
    VITE_FIREBASE_PROJECT_ID: config.projectId,
    VITE_FIREBASE_APP_ID: config.appId,
    VITE_RECAPTCHA_ENTERPRISE_SITE_KEY: key,
    VITE_APP_CHECK_PROVIDER: provider,
    VITE_USE_EMULATORS: "false",
    VITE_TEST_OFFLINE: "false",
    VITE_ASSISTANT_ENABLED: "true",
    VITE_REQUIRE_APP_CHECK: "true",
    VITE_REQUIRE_FIREBASE_CONFIG: "true",
  };
  if (
    Object.values(env).some(
      (v) =>
        typeof v !== "string" ||
        !v ||
        v.includes(String.fromCharCode(10)) ||
        v.includes(String.fromCharCode(13)),
    )
  )
    throw Error("Invalid browser configuration");
  return env;
}
