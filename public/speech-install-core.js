/** Public model installer shared by browser-owned transfers and the page worker.
 * Parts are pinned by SHA-256. Only complete verified files receive an OPFS manifest.
 * No account content, audio, credentials or inference is handled here.
 */
(() => {
  const PARTS_CACHE = "wilo-speech-parts-v1";
  const digest = async (bytes) =>
    Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      (value) => value.toString(16).padStart(2, "0"),
    ).join("");
  const fileKey = (url) => digest(new TextEncoder().encode(url));
  const directory = async () =>
    (await navigator.storage.getDirectory()).getDirectoryHandle(
      "wilo-speech-model-v1",
      { create: true },
    );
  function validate(files) {
    if (!Array.isArray(files) || !files.length || files.length > 4)
      throw Error("speech-install-assets");
    for (const asset of files) {
      if (
        !Number.isSafeInteger(asset.size) ||
        asset.size <= 0 ||
        asset.size > 512 * 1024 * 1024 ||
        !["http:", "https:"].includes(new URL(asset.url).protocol) ||
        !Array.isArray(asset.parts) ||
        asset.parts.length > 64
      )
        throw Error("speech-install-assets");
      let cursor = 0;
      for (const part of asset.parts) {
        const url = new URL(asset.url);
        url.searchParams.set("wilo-part", String(cursor));
        if (
          part.start !== cursor ||
          part.size <= 0 ||
          part.size > 16 * 1024 * 1024 ||
          part.end !== part.start + part.size - 1 ||
          part.range !== `bytes=${part.start}-${part.end}` ||
          part.url !== url.href ||
          !/^[a-f0-9]{64}$/.test(part.sha256)
        )
          throw Error("speech-install-part");
        cursor += part.size;
      }
      if (cursor !== asset.size) throw Error("speech-install-part");
    }
  }
  async function installed(asset) {
    const legacy = await (
      await caches.open("transformers-cache")
    ).match(asset.url);
    if (Number(legacy?.headers.get("content-length")) === asset.size)
      return true;
    try {
      const dir = await directory(),
        key = await fileKey(asset.url);
      const metadata = JSON.parse(
        await (await (await dir.getFileHandle(key + ".json")).getFile()).text(),
      );
      return (
        metadata.size === asset.size &&
        (await (await dir.getFileHandle(key + ".data")).getFile()).size ===
          asset.size
      );
    } catch {
      return false;
    }
  }
  async function cachedPart(part) {
    const cache = await caches.open(PARTS_CACHE),
      response = await cache.match(part.url);
    return response &&
      Number(response.headers.get("content-length")) === part.size &&
      response.headers.get("x-wilo-sha256") === part.sha256
      ? response
      : undefined;
  }
  async function savePart(asset, part, response) {
    if (await cachedPart(part)) return;
    const range = response.headers.get("content-range");
    if (
      !response.ok ||
      !response.body ||
      (response.status !== 206 && part.size !== asset.size) ||
      (range && range !== `bytes ${part.start}-${part.end}/${asset.size}`)
    ) {
      await response.body?.cancel().catch(() => {});
      throw Error("speech-download-range");
    }
    const reader = response.body.getReader(),
      bytes = new Uint8Array(part.size);
    let size = 0;
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        if (size + chunk.value.byteLength > part.size)
          throw Error("speech-download-size");
        bytes.set(chunk.value, size);
        size += chunk.value.byteLength;
      }
    } catch (error) {
      await reader.cancel().catch(() => {});
      throw error;
    } finally {
      reader.releaseLock();
    }
    if (size !== part.size || (await digest(bytes)) !== part.sha256)
      throw Error("speech-download-integrity");
    await (
      await caches.open(PARTS_CACHE)
    ).put(
      part.url,
      new Response(bytes, {
        headers: {
          "content-length": String(size),
          "x-wilo-sha256": part.sha256,
        },
      }),
    );
  }
  async function assemble(asset) {
    const work = () => assembleUnlocked(asset);
    return navigator.locks
      ? navigator.locks.request(
          "wilo-speech-file:" + (await fileKey(asset.url)),
          work,
        )
      : work();
  }
  async function assembleUnlocked(asset) {
    const cache = await caches.open(PARTS_CACHE);
    if (await installed(asset)) {
      for (const part of asset.parts) await cache.delete(part.url);
      return true;
    }
    for (const part of asset.parts) if (!(await cachedPart(part))) return false;
    const dir = await directory(),
      key = await fileKey(asset.url),
      output = await (
        await dir.getFileHandle(key + ".data", { create: true })
      ).createWritable();
    let size = 0;
    try {
      for (const part of asset.parts) {
        const response = await cachedPart(part);
        if (!response) throw Error("speech-cache");
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (
          bytes.byteLength !== part.size ||
          (await digest(bytes)) !== part.sha256
        ) {
          await cache.delete(part.url);
          throw Error("speech-download-integrity");
        }
        await output.write(bytes);
        size += bytes.byteLength;
      }
      if (size !== asset.size) throw Error("speech-download-size");
      await output.close();
    } catch (error) {
      await output.abort().catch(() => {});
      throw error;
    }
    const metadata = await (
      await dir.getFileHandle(key + ".json", { create: true })
    ).createWritable();
    try {
      await metadata.write(
        JSON.stringify({ size, type: "application/octet-stream" }),
      );
      await metadata.close();
    } catch (error) {
      await metadata.abort().catch(() => {});
      throw error;
    }
    for (const part of asset.parts) await cache.delete(part.url);
    return true;
  }
  async function foreground(files, report) {
    const work = () => foregroundUnlocked(files, report);
    return navigator.locks
      ? navigator.locks.request("wilo-speech-foreground-download", work)
      : work();
  }
  async function foregroundUnlocked(files, report) {
    validate(files);
    const pending = [];
    let loaded = 0;
    for (const asset of files) {
      if (await installed(asset)) {
        loaded += asset.size;
        continue;
      }
      for (const part of asset.parts) {
        if (await cachedPart(part)) loaded += part.size;
        else pending.push({ asset, part });
      }
    }
    report("downloading", loaded);
    let cursor = 0,
      failure;
    await Promise.all(
      Array.from({ length: Math.min(4, pending.length) }, async () => {
        while (!failure && cursor < pending.length) {
          const { asset, part } = pending[cursor++];
          try {
            const response = await fetch(part.url, {
              credentials: "omit",
              headers: { Range: part.range },
              signal: AbortSignal.timeout(300000),
            });
            await savePart(asset, part, response);
            loaded += part.size;
            report("downloading", loaded);
          } catch (error) {
            failure = error;
          }
        }
      }),
    );
    if (failure) throw failure;
    report("saving", loaded);
    for (const asset of files)
      if (!(await assemble(asset))) throw Error("speech-cache");
  }
  async function acceptBackground(files, records) {
    validate(files);
    for (const record of records) {
      const asset = files.find((file) =>
        file.parts.some((part) => part.url === record.request.url),
      );
      const part = asset?.parts.find((part) => part.url === record.request.url);
      if (!part || record.request.headers.get("range") !== part.range) continue;
      try {
        await savePart(asset, part, await record.responseReady);
      } catch {
        /* Keep other completed ranges, including on a failed or aborted transfer. */
      }
    }
    let complete = true;
    for (const asset of files) if (!(await assemble(asset))) complete = false;
    return complete;
  }
  globalThis.wiloSpeechInstaller = Object.freeze({
    foreground,
    acceptBackground,
  });
})();
