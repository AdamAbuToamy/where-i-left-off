import { importPKCS8, SignJWT } from "jose";
import { ApiError, validId } from "../../shared/universityApiPlan.mjs";
const cache = new WeakMap();
const readers = new WeakMap();
async function readerToken(env, fetchImpl, signal) {
  const cached = readers.get(env);
  if (cached?.expires > Date.now() + 60000) return cached.token;
  let c;
  try {
    c = JSON.parse(env.FIREBASE_READER);
  } catch {
    throw new ApiError("integration-unconfigured");
  }
  if (
    c.project_id !== env.FIREBASE_PROJECT_ID ||
    typeof c.client_email !== "string"
  )
    throw new ApiError("integration-unconfigured");
  const key = await importPKCS8(c.private_key, "RS256");
  const assertion = await new SignJWT({
    scope: "https://www.googleapis.com/auth/cloud-platform",
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(c.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);
  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    signal,
    redirect: "manual",
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) throw new ApiError("dependency-unavailable");
  const result = await response.json();
  if (typeof result.access_token !== "string")
    throw new ApiError("dependency-unavailable");
  readers.set(env, {
    token: result.access_token,
    expires:
      Date.now() + Math.min(Number(result.expires_in) || 3600, 3600) * 1000,
  });
  return result.access_token;
}
/** No new private key: impersonate a dedicated, minimally privileged data writer using the existing protected signer. */
async function writerToken(env, fetchImpl, signal) {
  const previous = cache.get(env);
  if (previous?.expires > Date.now() + 60000) return previous.token;
  const target = env.API_WRITER_SERVICE_ACCOUNT,
    project = env.FIREBASE_PROJECT_ID;
  if (
    typeof target !== "string" ||
    !target.endsWith("@" + project + ".iam.gserviceaccount.com") ||
    !/^[a-z][a-z0-9-]{4,62}@/.test(target)
  )
    throw new ApiError("integration-unconfigured");
  const token = await readerToken(env, fetchImpl, signal);
  const response = await fetchImpl(
    "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/" +
      encodeURIComponent(target) +
      ":generateAccessToken",
    {
      method: "POST",
      signal,
      redirect: "manual",
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        scope: ["https://www.googleapis.com/auth/datastore"],
        lifetime: "600s",
      }),
    },
  );
  if (!response.ok) throw new ApiError("dependency-unavailable");
  const data = await response.json();
  if (
    typeof data.accessToken !== "string" ||
    !Number.isFinite(Date.parse(data.expireTime))
  )
    throw new ApiError("dependency-unavailable");
  cache.set(env, {
    token: data.accessToken,
    expires: Date.parse(data.expireTime),
  });
  return data.accessToken;
}
export async function assertApiAccount(
  env,
  uid,
  { fetchImpl = fetch, signal = AbortSignal.timeout(15000) } = {},
) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid || ""))
    throw new ApiError("account-unavailable");
  const token = await readerToken(env, fetchImpl, signal);
  const response = await fetchImpl(
    `https://identitytoolkit.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/accounts:lookup`,
    {
      method: "POST",
      signal,
      redirect: "manual",
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json",
      },
      body: JSON.stringify({ localId: [uid] }),
    },
  );
  if (!response.ok) throw new ApiError("dependency-unavailable");
  const account = (await response.json()).users?.[0];
  if (
    !account ||
    account.localId !== uid ||
    account.disabled ||
    !account.emailVerified
  )
    throw new ApiError("account-unavailable");
  const base = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/`;
  for (const path of ["appMetrics/" + uid, "accountDeletions/" + uid]) {
    const r = await fetchImpl(base + path, {
      signal,
      redirect: "manual",
      headers: { authorization: "Bearer " + token },
    });
    if (r.status === 404) continue;
    if (!r.ok) throw new ApiError("dependency-unavailable");
    const value = decodeFields((await r.json()).fields);
    if (path.startsWith("accountDeletions/") || value.suspended === true)
      throw new ApiError("account-unavailable");
  }
}
export function decodeFields(fields = {}) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, decode(value)]),
  );
}
function decode(v) {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(decode);
  if ("mapValue" in v) return decodeFields(v.mapValue.fields);
  throw new ApiError("invalid-stored-record");
}
function encode(v) {
  if (v === null) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number" && Number.isFinite(v))
    return Number.isInteger(v)
      ? { integerValue: String(v) }
      : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  if (v && typeof v === "object")
    return { mapValue: { fields: encodeFields(v) } };
  throw new ApiError("invalid-stored-record");
}
const encodeFields = (value) =>
  Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)]));
async function boundedFirestoreJson(response) {
  const reader = response.body?.getReader();
  if (!reader) throw new ApiError("dependency-unavailable");
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4 * 1024 * 1024) {
        await reader.cancel();
        throw new ApiError("account-plan-too-large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new ApiError("dependency-unavailable");
  }
}
/** Firestore outer boundary: only the authenticated owner's allowlisted collections are reachable. */
export function createApiRepository(
  env,
  uid,
  {
    fetchImpl = fetch,
    signal = AbortSignal.timeout(25000),
    endpoint,
    token,
  } = {},
) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid || ""))
    throw new ApiError("integration-unconfigured");
  const database = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)`;
  const base =
    endpoint || `https://firestore.googleapis.com/v1/${database}/documents`;

  const request = async (path, body, allow404 = false) => {
    const auth = token || (await writerToken(env, fetchImpl, signal));
    const res = await fetchImpl(base + path, {
      method: body === undefined ? "GET" : "POST",
      signal,
      redirect: "manual",
      headers: {
        authorization: "Bearer " + auth,
        "content-type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (allow404 && res.status === 404) return null;
    if (!res.ok) {
      let code;
      try {
        code = (await res.json()).error?.status;
      } catch {
        /* Only whitelisted statuses cross this boundary. */
      }
      if (
        code === "ABORTED" ||
        code === "FAILED_PRECONDITION" ||
        code === "ALREADY_EXISTS"
      )
        throw new ApiError("transaction-conflict");
      throw new ApiError("dependency-unavailable");
    }
    return boundedFirestoreJson(res);
  };
  const path = (collection, id) => {
    if (
      ![
        "studyRecords",
        "apiOperations",
        "projects",
        "sections",
        "planningBoards",
      ].includes(collection) ||
      !validId(id) ||
      (collection === "planningBoards" && id !== "personal")
    )
      throw new ApiError("invalid-input");
    return "users/" + uid + "/" + collection + "/" + id;
  };
  async function transact(callback) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const { transaction } = await request(":beginTransaction", {
        options: { readWrite: {} },
      });
      const writes = [];
      let writing = false;
      const getNamed = async (name) => {
        if (writing) throw new ApiError("invalid-transaction");
        const rows = await request(":batchGet", {
          documents: [name],
          transaction,
        });
        const found = rows.find((row) => row.found)?.found;
        return found ? decodeFields(found.fields) : null;
      };
      const get = async (collection, id) =>
        getNamed(database + "/documents/" + path(collection, id));
      const set = (collection, id, value, merge = false) => {
        writing = true;
        const relative = path(collection, id);
        const fields = encodeFields(
          Object.fromEntries(
            Object.entries(value).filter(
              ([k]) =>
                k !== "updatedAt" && !(collection === "projects" && k === "id"),
            ),
          ),
        );
        writes.push({
          update: { name: database + "/documents/" + relative, fields },
          ...(merge ? { updateMask: { fieldPaths: Object.keys(fields) } } : {}),
          updateTransforms: [
            { fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" },
          ],
        });
      };
      const list = async (collection) => {
        if (writing) throw new ApiError("invalid-transaction");
        const data = await request("/users/" + uid + ":runQuery", {
          structuredQuery: {
            from: [{ collectionId: collection }],
            limit: 2001,
          },
          transaction,
        });
        const records = data
          .filter((row) => row.document)
          .map((row) => ({
            key: row.document.name.split("/").at(-1),
            value: decodeFields(row.document.fields),
          }));
        if (records.length > 2000) throw new ApiError("account-plan-too-large");
        return records;
      };
      const tx = {
        getStudy: (id) => get("studyRecords", id),
        getMeta: (id) => get("apiOperations", id),
        getProject: (id) => get("projects", id),
        listStudy: () => list("studyRecords"),
        listProjects: () => list("projects"),
        listSections: () => list("sections"),
        getBoard: () => get("planningBoards", "personal"),
        setBoard: (v) => set("planningBoards", "personal", v),
        setSection: (id, v) => set("sections", id, v, true),
        setStudy: (id, v) => set("studyRecords", id, v),
        setMeta: (id, v) => set("apiOperations", id, v),
        setProject: (id, v) => set("projects", id, v, true),
      };
      try {
        for (const accountPath of [
          "appMetrics/" + uid,
          "accountDeletions/" + uid,
        ]) {
          const snapshot = await getNamed(
            database + "/documents/" + accountPath,
          );
          if (
            snapshot &&
            (accountPath.startsWith("accountDeletions/") ||
              snapshot.suspended === true)
          )
            throw new ApiError("account-unavailable");
        }
        const result = await callback(tx);
        await request(":commit", { transaction, writes });
        return result;
      } catch (error) {
        try {
          await request(":rollback", { transaction });
        } catch {
          /* Best effort: transactions also expire on the service. */
        }
        if (error.code !== "transaction-conflict" || attempt === 3) throw error;
      }
    }
  }
  return {
    uid,
    transact,
    async pendingReminders() {
      const data = await request("/users/" + uid + ":runQuery", {
        structuredQuery: {
          from: [{ collectionId: "apiOperations" }],
          where: {
            compositeFilter: {
              op: "AND",
              filters: [
                {
                  fieldFilter: {
                    field: { fieldPath: "kind" },
                    op: "EQUAL",
                    value: { stringValue: "reminder-outbox" },
                  },
                },
                {
                  fieldFilter: {
                    field: { fieldPath: "pending" },
                    op: "EQUAL",
                    value: { booleanValue: true },
                  },
                },
              ],
            },
          },
          limit: 10,
        },
      });
      return data
        .filter((r) => r.document)
        .map((r) => decodeFields(r.document.fields).taskId);
    },
  };
}
