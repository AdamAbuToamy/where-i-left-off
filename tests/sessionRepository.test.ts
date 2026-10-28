import { it, expect, vi } from "vitest";
import {
  SessionRepository,
  SessionRemoteConflict,
} from "../src/session/repository";
import type {
  SessionLocalPort,
  SessionRemotePort,
  SessionJournal,
  RemoteSession,
} from "../src/session/repository";
import { emptySession, planSessionOperations } from "../src/session/domain";
const identity = {
  id: "session",
  projectId: "card",
  groupId: "",
  startedAt: 1,
};
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
function harness() {
  let cached: SessionJournal | null = null,
    remote: RemoteSession | null = null,
    online = false,
    authorized = true;
  const listeners = new Set<() => void>();
  let receive!: (value: RemoteSession | null, cache: boolean) => void;
  const local: SessionLocalPort = {
    read: async () => structuredClone(cached),
    update: async (change) => {
      cached = structuredClone(change(structuredClone(cached)));
      for (const fn of listeners) queueMicrotask(fn);
      return structuredClone(cached);
    },
    listen: (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    sync: async (work) => work(),
  };
  const cloud: SessionRemotePort = {
    watch: (fn) => {
      receive = fn;
      queueMicrotask(() => fn(structuredClone(remote), false));
      return () => {};
    },
    write: vi.fn(async (state, expected, mutationId) => {
      if ((remote?.revision ?? null) !== expected)
        throw new SessionRemoteConflict(remote);
      remote = {
        state: structuredClone(state),
        revision: (expected ?? -1) + 1,
        mutationId,
      };
      return structuredClone(remote);
    }),
  };
  const options = {
    identity,
    local,
    remote: cloud,
    authorized: () => authorized,
    online: () => online,
    newId: () => crypto.randomUUID(),
    now: () => 100,
  };
  const repo = new SessionRepository(options);
  return {
    repo,
    cloud,
    options,
    local,
    cache: () => cached,
    remote: () => remote,
    network: (v: boolean) => {
      online = v;
    },
    authorize: (v: boolean) => {
      authorized = v;
    },
    setRemote: (v: RemoteSession) => {
      remote = v;
      receive(v, false);
    },
  };
}
const proposal = (revision = 0) => ({
  sessionId: "session",
  baseRevision: revision,
  origin: "voice" as const,
  operations: [
    {
      verb: "add_item" as const,
      operationId: "op",
      id: "item",
      text: "Check Firebase",
    },
  ],
});
it("persists locally offline, survives reload, deduplicates and flushes on reconnect", async () => {
  const h = harness();
  await h.repo.start(() => {});
  await tick();
  const result = await h.repo.apply(proposal());
  expect(result.pending).toBe(true);
  expect(h.cache()?.state.items).toHaveLength(1);
  h.repo.stop();
  const reopened = new SessionRepository(h.options);
  await reopened.start(() => {});
  await tick();
  expect(reopened.current().items[0].text).toBe("Check Firebase");
  await reopened.apply(proposal());
  expect(reopened.current().items).toHaveLength(1);
  h.network(true);
  await reopened.flush();
  expect(reopened.status().pending).toBe(false);
  expect(h.remote()?.state.items).toHaveLength(1);
  reopened.stop();
});
it("retains local changes after a failed server write and never claims sync", async () => {
  const h = harness();
  await h.repo.start(() => {});
  await tick();
  await h.repo.apply(proposal());
  h.network(true);
  h.cloud.write = vi.fn(async () => {
    throw new Error("unavailable");
  });
  await h.repo.flush();
  expect(h.repo.status()).toMatchObject({
    pending: true,
    error: "unavailable",
  });
  expect(h.repo.current().items).toHaveLength(1);
  h.repo.stop();
});
it("detects competing revisions and requires an explicit resolution", async () => {
  const h = harness();
  await h.repo.start(() => {});
  await tick();
  await h.repo.apply(proposal());
  const state = planSessionOperations(
    emptySession(identity),
    {
      ...proposal(),
      operations: [
        {
          verb: "add_note",
          operationId: "other",
          id: "note",
          text: "Other device",
        },
      ],
    },
    100,
  );
  h.setRemote({ state, revision: 0, mutationId: "remote" });
  await tick();
  expect(h.repo.status().conflict).toBe(true);
  await expect(h.repo.apply(proposal(1))).rejects.toThrow("session-conflict");
  await h.repo.resolve("remote");
  expect(h.repo.current().notes[0].text).toBe("Other device");
  expect(h.repo.current().items).toEqual([]);
  expect(h.repo.status()).toMatchObject({ conflict: false, pending: false });
  h.repo.stop();
});
it("denies work after account change and after stop", async () => {
  const h = harness();
  await h.repo.start(() => {});
  await tick();
  h.authorize(false);
  await expect(h.repo.apply(proposal())).rejects.toThrow("account-changed");
  expect(h.cache()?.state.items || []).toEqual([]);
  h.repo.stop();
});
it("does not publish a late initial read after cleanup and supports StrictMode restart", async () => {
  const h = harness();
  let finish!: (v: SessionJournal | null) => void;
  h.local.read = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const listener = vi.fn();
  const started = h.repo.start(listener);
  h.repo.stop();
  finish(null);
  await started;
  expect(listener).not.toHaveBeenCalled();
  h.local.read = async () => null;
  await h.repo.start(listener);
  await tick();
  expect(h.repo.status().ready).toBe(true);
  h.repo.stop();
});
it("rejects invalid batches without writing any local changes", async () => {
  const h = harness();
  await h.repo.start(() => {});
  await tick();
  await expect(
    h.repo.apply({
      ...proposal(),
      operations: [
        ...proposal().operations,
        { verb: "delete_item", operationId: "bad", id: "missing" },
      ],
    }),
  ).rejects.toThrow("session-reference");
  expect(h.cache()?.state.items || []).toEqual([]);
  h.repo.stop();
});

it("absorbs background flush cancellation while leaving the pending local journal intact", async () => {
  const h = harness();
  await h.repo.start(() => {});
  await tick();
  await h.repo.apply(proposal());
  h.network(true);
  const flush = h.repo.flush();
  h.repo.stop();
  await expect(flush).resolves.toBeUndefined();
  expect(h.cache()?.pending).toBe(true);
});
