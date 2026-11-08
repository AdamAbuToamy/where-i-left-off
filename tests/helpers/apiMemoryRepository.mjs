import { ApiError } from "../../shared/universityApiPlan.mjs";
/** Synthetic-only MVCC repository. Never imported by production code. */
export class MemoryRepository {
  constructor(uid = "api-owner-synthetic") {
    this.uid = uid;
    this.docs = new Map();
    this.version = 0;
  }
  seed(collection, id, value) {
    this.docs.set(collection + "/" + id, structuredClone(value));
    this.version++;
  }
  get(collection, id) {
    return structuredClone(this.docs.get(collection + "/" + id) || null);
  }
  async transact(fn) {
    for (let i = 0; i < 8; i++) {
      const version = this.version,
        docs = structuredClone(this.docs),
        writes = [];
      const get = (c, id) => {
        if (!/^[A-Za-z0-9_-]{1,600}$/.test(id)) throw Error("invalid id");
        return structuredClone(docs.get(c + "/" + id) || null);
      };
      const tx = {
        listProjects:async()=>[...docs].filter(([k])=>k.startsWith('projects/')).map(([k,value])=>({key:k.split('/')[1],value})),
        listSections:async()=>[...docs].filter(([k])=>k.startsWith('sections/')).map(([k,value])=>({key:k.split('/')[1],value})),
        getBoard:async()=>get('planningBoards','personal'),
        setBoard:v=>writes.push(['planningBoards/personal',v,false]),
        setSection:(id,v)=>writes.push(['sections/'+id,v,true]),
        getStudy: async (id) => get("studyRecords", id),
        getMeta: async (id) => get("apiOperations", id),
        getProject: async (id) => get("projects", id),
        listStudy: async () =>
          [...docs]
            .filter(([k]) => k.startsWith("studyRecords/"))
            .map(([k, value]) => ({ key: k.split("/")[1], value })),
        setStudy: (id, v) => writes.push(["studyRecords/" + id, v, false]),
        setMeta: (id, v) => writes.push(["apiOperations/" + id, v, false]),
        setProject: (id, v) => writes.push(["projects/" + id, v, true]),
      };
      const result = await fn(tx);
      if (version !== this.version) continue;
      for (const [id, value, merge] of writes)
        this.docs.set(
          id,
          structuredClone(
            merge ? { ...(this.docs.get(id) || {}), ...value } : value,
          ),
        );
      if (writes.length) this.version++;
      return result;
    }
    throw new ApiError("transaction-conflict", 409);
  }
  async pendingReminders() {
    return [...this.docs.values()]
      .filter((v) => v.kind === "reminder-outbox" && v.pending)
      .slice(0, 10)
      .map((v) => v.taskId);
  }
}
