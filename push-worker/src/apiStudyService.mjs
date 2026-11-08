import { ApiError, object } from "../../shared/universityApiPlan.mjs";
import {
  planAssistantChanges,
  blankAssistantData,
  parsePlanBackup,
  parsePlanningState,
} from "../../shared/wiloApiDomain.mjs";
import {
  sameImportedStudyTask,
  sameStudySourceLink,
} from "../../shared/studyIdentity.mjs";
import { sha256, stableJson } from "../../shared/apiHash.mjs";
const fail = (code) => {
  throw new ApiError(code);
};
const studyKinds = ["courses", "tasks", "lessons"];
export function hydrateStudy(rows) {
  const data = blankAssistantData(),
    records = new Map();
  for (const { key, value: r } of rows) {
    if (
      !studyKinds.includes(r.kind) ||
      key !== r.kind + "_" + r.id ||
      !Number.isSafeInteger(r.revision) ||
      r.revision < 0 ||
      typeof r.deleted !== "boolean" ||
      typeof r.payload !== "string"
    )
      fail("invalid-stored-record");
    records.set(key, r);
    if (r.deleted) continue;
    let item;
    try {
      item = JSON.parse(r.payload);
    } catch {
      fail("invalid-stored-record");
    }
    if (item.id !== r.id) fail("invalid-stored-record");
    data.study[r.kind].push(item);
  }
  try {
    parsePlanBackup(data.study);
  } catch {
    fail("invalid-stored-record");
  }
  return { data, records };
}
/** The public application boundary uses the same validated planner as reviewed UI operations.
 * No model execution, no shared scopes, no account settings, no arbitrary database paths. */
export function createApiStudyService({
  repository,
  ownerUid,
  now = () => Date.now(),
  uuid = () => crypto.randomUUID().replaceAll("-", "").slice(0, 20),
}) {
  if (repository.uid !== ownerUid) fail("account-unavailable");
  async function snapshot(tx) {
    const { data, records } = hydrateStudy(await tx.listStudy());
    data.scopes[0].projects = (await tx.listProjects()).map((r) => ({
      ...r.value,
      id: r.key,
    }));
    data.scopes[0].sections = (await tx.listSections()).map((r) => ({
      ...r.value,
      id: r.key,
    }));
    return { data, records };
  }
  const rows = (data, kind) =>
    studyKinds.includes(kind) ? data.study[kind] : data.scopes[0][kind];
  const revision = (records, kind, item) =>
    studyKinds.includes(kind)
      ? records.get(kind + "_" + item.id).revision
      : item.revision;
  async function read(kind, { limit = 100, cursor = "", courseId = "" } = {}) {
    return repository.transact(async (tx) => {
      if (kind === "board") {
        const r = await tx.getBoard();
        return r
          ? {
              state: parsePlanningState(JSON.parse(r.payload)),
              revision: r.revision,
            }
          : {
              state: { version: 1, items: [], threads: [], circles: [] },
              revision: 0,
            };
      }
      const { data, records } = studyKinds.includes(kind)
        ? hydrateStudy(await tx.listStudy())
        : { data: blankAssistantData(), records: new Map() };
      if (kind === "projects" || kind === "sections")
        data.scopes[0][kind] = (
          await (kind === "projects" ? tx.listProjects() : tx.listSections())
        ).map((r) => ({ ...r.value, id: r.key }));
      const selected = rows(data, kind)
          .filter(
            (r) =>
              (!cursor || r.id > cursor) &&
              (!courseId || r.courseId === courseId),
          )
          .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
        page = selected.slice(0, limit);
      return {
        items: page.map((r) => ({
          ...r,
          revision: revision(records, kind, r),
        })),
        nextCursor: selected.length > limit ? page.at(-1).id : null,
      };
    });
  }
  async function mutate({ kind, id, method, body, idempotencyKey, path }) {
    object(
      body,
      kind === "board"
        ? ["state", "expectedRevision"]
        : ["values", "expectedRevision"],
      method === "POST"
        ? ["values"]
        : kind === "board"
          ? ["state", "expectedRevision"]
          : ["values", "expectedRevision"],
    );
    if (
      method !== "POST" &&
      (!Number.isSafeInteger(body.expectedRevision) ||
        body.expectedRevision < 0)
    )
      fail("invalid-input");
    const fingerprint = await sha256(
        stableJson({ kind, id: id || "", method, path, body }),
      ),
      receiptKey = "receipt_" + (await sha256(idempotencyKey)),
      mutationId = uuid(),
      generated = uuid();
    return repository.transact(async (tx) => {
      const receipt = await tx.getMeta(receiptKey);
      if (receipt) {
        if (receipt.fingerprint !== fingerprint) fail("idempotency-key-reused");
        return { ...receipt.result, replayed: true };
      }
      const { data, records } = await snapshot(tx);
      let result;
      if (kind === "board") {
        const old = await tx.getBoard();
        if ((old?.revision || 0) !== body.expectedRevision)
          fail("revision-conflict");
        let state;
        try {
          state = parsePlanningState(body.state);
        } catch {
          fail("invalid-input");
        }
        if (
          state.items.some(
            (i) =>
              i.kind === "card" &&
              !data.scopes[0].projects.some(
                (p) => p.id === i.projectId && !p.trashedAt,
              ),
          )
        )
          fail("resource-not-found");
        const payload = JSON.stringify(state);
        if (new TextEncoder().encode(payload).length > 150000)
          fail("request-too-large");
        result = {
          id: "personal",
          revision: body.expectedRevision + 1,
          created: !old,
        };
        tx.setBoard({
          version: 1,
          scope: "",
          payload,
          revision: result.revision,
          mutationId,
        });
      } else {
        if (
          !body.values ||
          typeof body.values !== "object" ||
          Array.isArray(body.values)
        )
          fail("invalid-input");
        if (kind === "projects" && Object.hasOwn(body.values, "assignedTo"))
          fail("invalid-input");
        const list = rows(data, kind),
          existing = id ? list.find((r) => r.id === id) : null;
        if (method === "PATCH" && !existing) fail("resource-not-found");
        if (
          existing &&
          revision(records, kind, existing) !== body.expectedRevision
        )
          fail("revision-conflict");
        // Existing linked reminder edits must remain in the atomic university reminder workflow.
        if (
          (kind === "tasks" && existing?.reminderProjectId) ||
          (kind === "projects" &&
            id &&
            data.study.tasks.some((t) => t.reminderProjectId === id))
        )
          fail("linked-reminder-use-ui");
        let changes;
        try {
          changes = planAssistantChanges(
            data,
            [
              {
                target: kind,
                action: method === "POST" ? "create" : "update",
                id: method === "POST" ? "api-new" : id,
                scope: "personal",
                values: body.values,
              },
            ],
            now(),
            false,
            () => generated,
          );
        } catch {
          fail("invalid-input");
        }
        const change = changes[0];
        if (!change) {
          if (!existing) fail("duplicate-resource");
          return {
            id: existing.id,
            revision: revision(records, kind, existing),
            created: false,
          };
        }
        const after = change.after;
        // Reuse existing imported-task identity, and exact normalized names for courses.
        const duplicate =
          method === "POST"
            ? kind === "tasks"
              ? list.find(
                  (t) =>
                    sameImportedStudyTask(t, after) ||
                    (after.url &&
                      new URL(after.url).searchParams.has("id") &&
                      sameStudySourceLink(t.url, after.url)),
                )
              : kind === "courses"
                ? list.find(
                    (c) =>
                      c.url === after.url &&
                      c.name.trim().toLocaleLowerCase() ===
                        after.name.trim().toLocaleLowerCase(),
                  )
                : null
            : null;
        if (
          duplicate &&
          kind === "tasks" &&
          duplicate.courseId !== after.courseId
        )
          fail("duplicate-resource");
        if (duplicate)
          result = {
            id: duplicate.id,
            revision: revision(records, kind, duplicate),
            created: false,
          };
        else {
          const rev = studyKinds.includes(kind)
            ? existing
              ? revision(records, kind, existing) + 1
              : 0
            : after.revision;
          result = { id: after.id, revision: rev, created: method === "POST" };
          if (studyKinds.includes(kind))
            tx.setStudy(kind + "_" + after.id, {
              kind,
              id: after.id,
              payload: JSON.stringify(after),
              deleted: false,
              revision: rev,
              mutationId,
            });
          else if (kind === "projects")
            tx.setProject(after.id, { ...after, mutationId });
          else tx.setSection(after.id, { ...after, mutationId });
        }
      }
      tx.setMeta(receiptKey, {
        kind: "receipt",
        fingerprint,
        result,
        expiresAt: new Date(now() + 30 * 86400000),
      });
      return result;
    });
  }
  return { read, mutate };
}
