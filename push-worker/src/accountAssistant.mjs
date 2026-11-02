import {allowConnectionRequest} from './connectionRateLimit.mjs';
const encoder = new TextEncoder();
const decode = (value) =>
  Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
const encode = (value) => btoa(String.fromCharCode(...new Uint8Array(value)));
async function encryptionKey(env) {
  const raw = decode(env.ASSISTANT_CONNECTION_KEY || "");
  if (raw.length !== 32) throw new Error("connection-not-configured");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
export async function sealConnection(env, uid, token) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(uid) },
    await encryptionKey(env),
    encoder.encode(token),
  );
  return JSON.stringify({ v: 1, iv: encode(iv), data: encode(ciphertext) });
}
export async function openConnection(env, uid, value) {
  const record = JSON.parse(value);
  if (record.v !== 1) throw new Error("connection-invalid");
  return new TextDecoder().decode(
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: decode(record.iv),
        additionalData: encoder.encode(uid),
      },
      await encryptionKey(env),
      decode(record.data),
    ),
  );
}
const json = (value, headers, status = 200) =>
  Response.json(value, { status, headers });
/** Identity and active-account checks must be performed by the HTTP composition root. */
export async function accountAssistant(
  request,
  env,
  uid,
  data,
  headers,
  upstream = fetch,
) {
  const reply = (result) => json({ result }, headers);
  if(!['connection-status','connection-save','connection-delete','completion'].includes(data.action))return json({error:'invalid-action'},headers,400);
  if(!await allowConnectionRequest(env,uid,data.action)){
   console.warn('security.http.denied',{reason:'account-rate-limit',status:429});
   return json({error:'assistant-rate-limit'},{...headers,'retry-after':'60'},429);
  }
  if (data.action === "connection-status") {
    const row = await env.DB.prepare(
      "SELECT uid FROM assistant_connections WHERE uid=?",
    )
      .bind(uid)
      .first();
    return reply({ connected: !!row });
  }
  if (data.action === "connection-save") {
    if (
      typeof data.key !== "string" ||
      !/^sk_[A-Za-z0-9_-]{8,512}$/.test(data.key)
    )
      return json({ error: "invalid-connection" }, headers, 400);
    const ciphertext = await sealConnection(env, uid, data.key);
    await env.DB.prepare(
      "INSERT INTO assistant_connections(uid,ciphertext) VALUES(?,?) ON CONFLICT(uid) DO UPDATE SET ciphertext=excluded.ciphertext",
    )
      .bind(uid, ciphertext)
      .run();
    return reply({ connected: true });
  }
  if (data.action === "connection-delete") {
    await env.DB.prepare("DELETE FROM assistant_connections WHERE uid=?")
      .bind(uid)
      .run();
    return reply({ connected: false });
  }
  if (data.action !== "completion")
    return json({ error: "invalid-action" }, headers, 400);
  const input = data.input;
  if (
    !input ||
    !Array.isArray(input.messages) ||
    !input.messages.length ||
    input.messages.length > 100 ||
    (input.tools !== undefined &&
      (!Array.isArray(input.tools) || input.tools.length > 100))
  )
    return json({ error: "invalid-input" }, headers, 400);
  const row = await env.DB.prepare(
    "SELECT ciphertext FROM assistant_connections WHERE uid=?",
  )
    .bind(uid)
    .first();
  if (!row) return json({ error: "assistant-connect-required" }, headers, 409);
  const token = await openConnection(env, uid, row.ciphertext);
  const now = Date.now(),
    lease = now + 70000;
  const claimed = await env.DB.prepare(
    "UPDATE assistant_connections SET lease_until=? WHERE uid=? AND lease_until<=?",
  )
    .bind(lease, uid, now)
    .run();
  if (!claimed.meta.changes)
    return json({ error: "assistant-busy" }, headers, 429);
  const release = () =>
    env.DB.prepare(
      "UPDATE assistant_connections SET lease_until=0 WHERE uid=? AND lease_until=?",
    )
      .bind(uid, lease)
      .run();
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 60000);
  const abort = () => controller.abort();
  request.signal.addEventListener("abort", abort, { once: true });
  let handedOff = false;
  const finish = async () => {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", abort);
    await release();
  };
  try {
    const response = await upstream(
      "https://gen.pollinations.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: env.POLLINATIONS_MODEL || "deepseek/deepseek-v4.1-flash",
          messages: input.messages,
          tools: input.tools,
          tool_choice: "auto",
          parallel_tool_calls: true,
          reasoning_effort: "none",
          stream: true,
          stream_options: { include_usage: true },
          max_tokens: Number.isSafeInteger(input.max_tokens)
            ? Math.max(1, Math.min(input.max_tokens, 8192))
            : 2048,
          temperature: 0,
        }),
        signal: controller.signal,
      },
    );
    if (response.status === 401)
      await env.DB.prepare(
        "DELETE FROM assistant_connections WHERE uid=? AND ciphertext=?",
      )
        .bind(uid, row.ciphertext)
        .run();
    if (!response.ok)
      return json(
        {
          error:
            response.status === 401
              ? "ai-provider-access"
              : response.status === 402 || response.status === 429
                ? "ai-provider-limit"
                : "assistant-network",
        },
        headers,
        [401, 402, 408, 422, 429, 500, 502, 503, 504].includes(response.status)
          ? response.status
          : 502,
      );
    if (!response.body)
      return json({ error: "assistant-network" }, headers, 502);
    const reader = response.body.getReader();
    const stream = new ReadableStream({
      async pull(sink) {
        try {
          const item = await reader.read();
          if (item.done) {
            sink.close();
            await finish();
          } else sink.enqueue(item.value);
        } catch {
          sink.error(new Error("assistant-network"));
          await finish();
        }
      },
      async cancel() {
        controller.abort();
        try {
          await reader.cancel();
        } finally {
          await finish();
        }
      },
    });
    handedOff = true;
    return new Response(stream, {
      headers: {
        ...headers,
        "content-type": response.headers
          .get("content-type")
          ?.includes("text/event-stream")
          ? "text/event-stream"
          : "application/json",
      },
    });
  } finally {
    if (!handedOff) await finish();
  }
}
