/** Browser-only public model cache. Large weights use OPFS to avoid Cache.put blob limits. */
export async function createSpeechAssetCache() {
  const cache = await caches.open("transformers-cache");
  const directory = await navigator.storage
    ?.getDirectory?.()
    .then((root) =>
      root.getDirectoryHandle("wilo-speech-model-v1", { create: true }),
    )
    .catch(() => null);
  const key = async (url: string) => {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(url),
    );
    return Array.from(new Uint8Array(digest), (value) =>
      value.toString(16).padStart(2, "0"),
    ).join("");
  };
  return {
    async match(url: string): Promise<Response | undefined> {
      const cached = await cache.match(url);
      if (cached) return cached;
      if (!directory) return undefined;
      try {
        const name = await key(url);
        const metadata = JSON.parse(
          await (
            await (await directory.getFileHandle(name + ".json")).getFile()
          ).text(),
        ) as { size: number; type: string };
        const file = await (
          await directory.getFileHandle(name + ".data")
        ).getFile();
        if (
          !Number.isSafeInteger(metadata.size) ||
          metadata.size <= 0 ||
          file.size !== metadata.size
        )
          return undefined;
        return new Response(file, {
          headers: {
            "content-length": String(file.size),
            "content-type": metadata.type,
          },
        });
      } catch {
        return undefined;
      }
    },
    async put(url: string, response: Response): Promise<void> {
      const size = Number(response.headers.get("content-length"));
      if (!directory || !Number.isFinite(size) || size < 32 * 1024 * 1024) {
        await cache.put(url, response);
        return;
      }
      const name = await key(url),
        handle = await directory.getFileHandle(name + ".data", {
          create: true,
        });
      const output = await handle.createWritable(),
        reader = response.body?.getReader();
      if (!reader) {
        await output.abort();
        throw new Error("speech-cache");
      }
      let written = 0;
      try {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          await output.write(chunk.value);
          written += chunk.value.byteLength;
        }
        if (written !== size) throw new Error("speech-cache");
        await output.close();
      } catch (error) {
        await output.abort().catch(() => {});
        throw error;
      } finally {
        reader.releaseLock();
      }
      // Publish the manifest only after the complete file has committed.
      const manifest = await (
        await directory.getFileHandle(name + ".json", { create: true })
      ).createWritable();
      await manifest.write(
        JSON.stringify({
          size: written,
          type:
            response.headers.get("content-type") || "application/octet-stream",
        }),
      );
      await manifest.close();
    },
  };
}
