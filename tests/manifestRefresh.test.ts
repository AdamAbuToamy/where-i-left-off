import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { it, expect, vi } from "vitest";
function worker(fetcher: typeof fetch, cached: Response | undefined) {
  const handlers = new Map<string, (event: unknown) => void>(),
    match = vi.fn(async () => cached);
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    self: {
      location: { origin: "https://wilo.example" },
      addEventListener: (name: string, handler: (event: unknown) => void) =>
        handlers.set(name, handler),
    },
    importScripts: () => {},
    URL,
    Response,
    fetch: fetcher,
    caches: { match },
    console,
  });
  let promise: Promise<Response> | undefined;
  handlers.get("fetch")!({
    request: new Request("https://wilo.example/manifest.webmanifest"),
    respondWith: (value: Promise<Response>) => {
      promise = value;
    },
  });
  return { promise: promise!, match };
}
it("fetches fresh installed-app metadata instead of returning an old shell manifest", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ icons: [{ src: "/new-icon.png" }] }));
  const result = worker(
    fetcher,
    Response.json({ icons: [{ src: "/old-icon.png" }] }),
  );
  expect((await (await result.promise).json()).icons[0].src).toBe(
    "/new-icon.png",
  );
  expect(fetcher).toHaveBeenCalledWith(expect.any(Request), {
    cache: "no-cache",
  });
  expect(result.match).not.toHaveBeenCalled();
});
it("retains offline manifest availability without erasing installed-app data", async () => {
  const result = worker(
    vi.fn<typeof fetch>().mockRejectedValue(new Error("offline")),
    Response.json({ id: "/", icons: [{ src: "/cached-icon.png" }] }),
  );
  expect((await (await result.promise).json()).icons[0].src).toBe(
    "/cached-icon.png",
  );
  expect(result.match).toHaveBeenCalledWith("/manifest.webmanifest");
});
