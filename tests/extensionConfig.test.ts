import { afterEach, expect, it, vi } from "vitest";
import { loadExtensionConfig } from "../src/lib/extensionConfig";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("shares simultaneous public reads and refreshes after they settle", async () => {
  let finish!: (response: Response) => void;
  const fetcher = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  vi.stubGlobal("fetch", fetcher);
  const first = loadExtensionConfig(),
    second = loadExtensionConfig();
  expect(fetcher).toHaveBeenCalledTimes(1);
  finish(Response.json({ extensionId: "a".repeat(32), published: true }));
  expect(await first).toEqual(await second);
  fetcher.mockImplementation(() =>
    Promise.resolve(
      Response.json({ extensionId: "b".repeat(32), published: false }),
    ),
  );
  expect(await loadExtensionConfig()).toEqual({
    extensionId: "b".repeat(32),
    published: false,
  });
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("rejects untrusted configuration and allows retry after failure", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ extensionId: "https://untrusted", published: true }),
      )
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(
        Response.json({ extensionId: "a".repeat(32), published: "true" }),
      ),
  );
  expect(await loadExtensionConfig()).toBeNull();
  expect(await loadExtensionConfig()).toBeNull();
  expect(await loadExtensionConfig()).toEqual({
    extensionId: "a".repeat(32),
    published: false,
  });
});
it("bounds a stalled shared request and releases it for retry", async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_url, options) =>
        new Promise((_resolve, reject) =>
          options.signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          ),
        ),
    ),
  );
  const first = loadExtensionConfig();
  await vi.advanceTimersByTimeAsync(5000);
  expect(await first).toBeNull();
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ extensionId: "a".repeat(32), published: true }),
      ),
  );
  expect(await loadExtensionConfig()).not.toBeNull();
});
