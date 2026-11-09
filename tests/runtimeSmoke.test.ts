import { it, expect, vi } from "vitest";
// @ts-expect-error Operator script intentionally runs directly on Node without a frontend adapter.
import { verifyRuntimeHealth } from "../scripts/verify-runtime-health.mjs";
function fixture(fail = "") {
  return vi.fn(async (url: string, options?: RequestInit) => {
    if (options?.method && !["GET", "HEAD"].includes(options.method))
      throw Error("Smoke checks must stay read-only");
    const path = new URL(url).pathname;
    if (path === fail)
      return path.endsWith(".js")
        ? new Response("<html>SPA fallback</html>", {
            headers: { "content-type": "text/html" },
          })
        : new Response("unavailable", { status: 503 });
    if (path === "/healthz") return Response.json({ status: "live" });
    if (path === "/readyz")
      return Response.json({
        status: "ready",
        checks: { storage: "ready", queue: "configured" },
      });
    if (path === "/index.html")
      return new Response(
        '<html><script src="/assets/index-example.js"></script></html>',
      );
    if (path === "/assets/index-example.js")
      return new Response("/* synthetic JS asset */".repeat(10), {
        headers: { "content-type": "application/javascript" },
      });
    if (path === "/openapi-public-api.json")
      return Response.json({
        info: { version: "1.5.1" },
        paths: { "/projects": { get: {} } },
      });
    if (path === "/api/v1/projects")
      return Response.json(
        { error: "unauthenticated", requestId: "synthetic" },
        { status: 401, headers: { "x-wilo-api-version": "1.5.1" } },
      );
    throw Error("Unexpected endpoint");
  });
}
it("read-only smoke checks hosting entry, readiness, published API version and normal auth denial", async () => {
  const fetcher = fixture();
  const result = await verifyRuntimeHealth({ fetcher });
  expect(result.authenticationDenial).toBe(401);
  expect(result.productionWrites).toBe(false);
  expect(
    fetcher.mock.calls.every(([, options]) => options?.redirect === "manual"),
  ).toBe(true);
});
it("a degraded worker fails the deployment smoke gate without writes or automatic rollback", async () => {
  for (const failure of ["/readyz", "/assets/index-example.js"])
    await expect(
      verifyRuntimeHealth({ fetcher: fixture(failure) }),
    ).rejects.toThrow();
});
