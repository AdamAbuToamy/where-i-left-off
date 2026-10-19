# Architecture and OOP decisions

The application uses React composition for presentation and encapsulated objects for domain and infrastructure behavior. Inheritance is reserved for the safe error hierarchy; storage alternatives implement interfaces instead of inheriting a large base class.

| Responsibility | Owner | Dependency direction |
| --- | --- | --- |
| Validate and create cards; preserve identity, revision, completion/activity rules | `ProjectEntity` | Domain functions and DTOs only |
| Read/write/observe a durable local workspace | `WorkspaceStore` interface | Implemented by `IndexedDbWorkspaceStore` |
| Observe cloud data and commit idempotent mutations | `WorkspaceRemote` interface | Implemented by `FirestoreWorkspaceRemote` |
| Queue mutations, retry, resolve conflicts and publish state | `OfflineWorkspace` | Interfaces, domain objects and injected clock |
| Select production implementations | `createWorkspace` | Composition root; constructs adapters |
| Browser configuration validation | `clientConfiguration` | Shared by Vite startup and Firebase initialization |
| User metrics and account suspension | `repository` | Independent of card-write commands |

`ProjectEntity` retains private state and returns defensive snapshots. An edit returns a new validated entity; callers cannot mutate its links or identity through a snapshot. State-changing behavior goes through domain methods rather than public fields/setters. DTOs remain serializable plain records for React and IndexedDB.

`OfflineWorkspace` has no runtime Firebase dependency. Unit tests inject an in-memory store, a remote transport and a clock. Firestore integration tests exercise the same domain object and adapter as production. The former parallel `addProject`/`changeProject`/section write implementations were removed from `repository.ts`.

The domain preserves incomplete edits, rejects stale destructive revisions and invalid ordering values, and applies completion timestamps consistently. Transport retains mutation IDs and full baseline comparison, including legacy inferred timestamps. Absent legacy fields are kept absent when unchanged; normalization alone must not change server-visible permissions.

## Scope and constraints

- Data authorization belongs to Firestore rules; private TypeScript members and frontend permissions do not authorize requests.
- Section removal is atomic locally, but its cloud moves and removal are sequential and retryable. This is deliberate offline behavior, not a cross-document cloud transaction.
- Pure validators/date/checklist functions remain functions. Wrapping stateless utilities in classes would add indirection without encapsulating a resource or invariant.
- There is no claim of zero defects or zero duplication across the entire repository. The duplicate persistence path and duplicate weekly date formatter identified in review are removed.

References: [TypeScript classes](https://www.typescriptlang.org/docs/handbook/2/classes.html), [React custom hooks](https://react.dev/learn/reusing-logic-with-custom-hooks).
