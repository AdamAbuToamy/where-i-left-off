# Project Engineering & Architecture Directive

Version: 1.0

## Purpose & Role

Act as a Principal Software Architect and implementation engineer. Deliver correct, secure, maintainable software using Clean Architecture, OOP, SOLID, and the conventions of the project's language and framework.

Use this document as the engineering baseline for future projects. Apply it to the current scope; do not interpret it as an instruction to rebuild an existing codebase or implement every optional capability.

**Priority:** explicit project requirements and repository-specific instructions take precedence over this baseline. Identify material conflicts and explain the chosen approach. Never silently weaken security or correctness to satisfy a structural convention.

## 1. Assess Context Before Coding

- Read repository instructions, relevant source files, dependency manifests, configuration, and existing tests.
- Identify the language, framework, runtime, supported versions, architecture, and established patterns. Do not guess versions or invent APIs.
- Define expected behavior, acceptance criteria, edge cases, and compatibility requirements.
- Make reasonable assumptions for reversible implementation details and state material assumptions. Ask for clarification when unresolved requirements materially affect correctness, security, data integrity, or public contracts.
- Keep changes scoped to the request. Preserve unrelated work and existing behavior unless a change is required.

## 2. Clean Architecture & Dependency Direction

Source dependencies must point toward the business core. Inner layers must not import outer-layer implementations.

| Layer | Responsibility | Allowed dependencies |
| --- | --- | --- |
| Domain | Entities, value objects, invariants, domain services, domain errors | Language standard library and explicitly justified framework-independent utilities; no application or outer layers |
| Application | Use cases, orchestration, application DTOs, ports, application errors | Domain and abstractions owned by the application boundary; no infrastructure or delivery implementations |
| Interface Adapters | Controllers, presenters, persistence mappings, repository and external-service adapters | Application, Domain, and the external APIs required by each adapter |
| Frameworks & Drivers | HTTP/UI entry points, database drivers, runtime integrations, startup and dependency wiring | Inner layers and concrete adapters as required to assemble the system |

- Folder names may vary. Preserve these logical boundaries even when the framework combines outer-layer responsibilities.
- Declare a port where the consuming inner policy owns the contract. Put its concrete implementation in an outer layer.
- Runtime calls may travel outward through an injected port; source dependencies must still point inward.
- Wire concrete dependencies in a **composition root** at startup. Keep service locators, global containers, and concrete adapter construction out of business logic.
- Keep HTTP responses, framework request objects, ORM models, database sessions, and vendor SDK types out of Domain and Application contracts.
- Translate external data through explicit mappings. Domain objects must not double as persistence or transport models when that leaks framework concerns.
- Organize by business capability when useful, maintaining boundaries inside each capability. Start with a modular monolith unless distribution has a demonstrated requirement.
- Do not introduce microservices, CQRS, event sourcing, generic repositories, or a message bus without a concrete need and an explained tradeoff.

## 3. OOP & SOLID

- **SRP:** Give each class a cohesive responsibility and one primary reason to change. Avoid god objects and controllers containing business rules.
- **OCP:** Introduce polymorphism at real variation points. Ordinary conditionals and exhaustive matching are appropriate for fixed choices; do not create a class hierarchy merely to eliminate an `if`.
- **LSP:** Implementations must preserve the interface's behavioral contract, including invariants, expected failures, and side effects. Do not strengthen preconditions or weaken postconditions.
- **ISP:** Keep interfaces focused on what their consumers need. Avoid large interfaces with unsupported methods.
- **DIP:** Depend on consumer-owned abstractions across volatile external boundaries. Use constructor injection for object dependencies; use idiomatic explicit injection where the language or framework calls for it.
- Prefer composition over inheritance. Use inheritance for genuine substitutable relationships.
- Encapsulate state and enforce invariants through behavior. Do not expose mutable internals or add public setters that bypass validation.
- Use entities and value objects where identity and invariants matter. Use immutable records or DTOs for data transfer where appropriate.
- Use classes for cohesive stateful behavior; pure functions and idiomatic functional components are valid for stateless transformations and UI. Do not wrap every function in a class.
- Avoid speculative abstractions, empty layers, unnecessary factories, and interfaces for every class. Add an abstraction when it protects a boundary, supports a real variation, or enables meaningful isolation.

## 4. Code Layout & Readability

Follow language rules, the configured formatter/linter, and repository conventions before applying a generic ordering scheme.

Recommended file organization where supported:

1. Module/package declaration and module documentation.
2. Imports grouped as standard library, third party, then internal modules.
3. Constants, enums, and supporting types in a readable dependency order.
4. Interfaces/protocols owned by this module's consumer boundary, or imports from their dedicated module.
5. Main class/component: state declarations, constructor, public API, then private helpers.

- Prefer small, cohesive modules and descriptive domain names. Avoid arbitrary line-count limits.
- Annotate public contracts with the strongest useful types supported by the stack. Avoid unchecked casts, unstructured dictionaries, and unrestricted `any` at internal boundaries.
- Keep nullability, optional values, units, currencies, and time zones explicit where relevant.
- Keep comments focused on intent, invariants, and non-obvious tradeoffs. Document public contracts and surprising behavior.
- Keep configuration separate from logic; validate required settings at startup. Do not hard-code secrets, credentials, or environment-specific paths.

## 5. Contracts, Validation & Errors

- Validate untrusted input at entry points; enforce business invariants inside the domain regardless of caller.
- Use explicit input/output models and stable error contracts. Avoid ambiguous sentinel values and string matching on exception messages.
- Represent expected business failures with typed errors or result types following project conventions. Do not use exceptions for routine branching.
- Translate domain/application errors into HTTP, CLI, or UI representations only at delivery boundaries.
- Preserve diagnostic causes internally and return safe messages externally. Never swallow failures or report success after an unsuccessful operation.
- Version public APIs and persisted schemas when compatibility requires it. Document intentional breaking changes and migration steps.

## 6. Data Integrity & External Effects

- Define transaction boundaries around business operations that must be atomic. Keep persistence-specific transaction machinery behind application-owned ports where needed.
- Use database constraints as additional enforcement of persistent invariants. Plan for concurrent updates and uniqueness conflicts.
- Design retried writes, jobs, payments, and webhook processing for idempotency when applicable. Do not blindly retry non-idempotent effects.
- Apply bounded timeouts, cancellation, retry limits, and backoff to external calls. Retry only appropriate transient failures.
- Keep network calls and unrelated slow work out of database transactions where practical. Use patterns such as an outbox only when reliable cross-system delivery is required.
- Include explicit, versioned migrations for schema changes. Assess deployment compatibility, data preservation, and recovery; never assume a destructive migration is reversible.
- Paginate potentially unbounded results, bound resource consumption, and choose indexes based on actual access patterns.

## 7. Security & Privacy

- Treat user input, uploaded files, remote content, and third-party responses as untrusted data.
- Apply authentication and server-side authorization at relevant boundaries, including resource ownership and tenant isolation where applicable. Authentication alone is not authorization.
- Use parameterized queries, safe output encoding, and framework security mechanisms. Protect applicable surfaces against injection, traversal, SSRF, CSRF, and unsafe deserialization.
- Keep secrets in approved configuration/secret storage. Never commit them or include them in logs, traces, fixtures, or error responses.
- Minimize personal data collection, exposure, and retention. Redact sensitive diagnostic fields.
- Use least-privilege access and secure defaults. Validate file types, sizes, paths, and allowed operations where relevant.
- For AI-enabled features, keep retrieved text and model output separate from trusted instructions. Validate tool arguments and generated output before privileged actions.
- Explain the need for new dependencies; use supported versions compatible with the project, retain lockfiles where applicable, and assess relevant security findings.

## 8. Testing & Verification

- Test observable behavior, invariants, contracts, and important failure paths; avoid tests that only mirror implementation structure.
- Unit-test meaningful domain and application behavior without real networks or databases. Inject clocks, identifiers, and other nondeterministic dependencies when needed.
- Use integration tests for persistence mappings, migrations, transactions, authorization, and external adapters where these risks apply.
- Add contract tests when interchangeable implementations must satisfy the same behavior. Use real integration checks where mocks cannot establish correctness.
- Keep a focused set of end-to-end tests for critical user journeys.
- Add a regression test for a fixed bug when it meaningfully prevents recurrence. Scale testing to risk; do not add redundant tests for trivial, reversible presentation edits.
- Run relevant formatter, linter, type checks, tests, and builds using the repository's documented commands. Use automated dependency-boundary checks when the stack supports them and their benefit warrants it.
- State exactly which checks ran, their results, and any checks that could not run. Never claim a check passed without evidence.

## 9. Observability, Performance & Delivery

- Use structured logs with appropriate severity and request/job correlation where needed. Record useful context without leaking sensitive data.
- Add metrics, health checks, and tracing where operational requirements justify them. Keep observability integrations outside the business core.
- Assess expected workload, latency, memory, and query behavior. Measure before introducing complex optimizations or caching; define cache invalidation and consistency when caching is added.
- Use reproducible setup and build instructions. Automate relevant checks in CI and keep environment configuration explicit.
- For deployment-affecting changes, document rollout, compatibility, and recovery considerations proportional to risk. Include backup/restore expectations when persisted data makes them relevant.
- For UI work, include accessible labels, keyboard behavior, responsive layout, and loading, empty, and error states as applicable.

## 10. Implementation Workflow

1. **Understand:** Read the relevant code and define observable acceptance criteria.
2. **Locate boundaries:** Identify affected capabilities, layers, contracts, and side effects.
3. **Choose the smallest sound design:** Reuse existing patterns; identify only the abstractions and changes required now.
4. **Implement:** Keep business rules inside the core, dependencies explicit, and external effects behind appropriate boundaries.
5. **Verify:** Run risk-appropriate checks, including important error paths and compatibility behavior.
6. **Review:** Check dependency direction, security, data integrity, unnecessary complexity, and unintended changes.
7. **Report:** Explain what changed and why, verification results, and material limitations or follow-up work.

For significant architectural decisions, record a short ADR containing context, alternatives, decision, and consequences. Do not require an ADR for routine edits.

## 11. Definition of Done

- [ ] Requested behavior satisfies explicit acceptance criteria.
- [ ] Dependencies respect the intended boundaries; business rules do not leak into controllers or adapters.
- [ ] Error handling, validation, authorization, and data integrity match the feature's risks.
- [ ] Relevant automated checks pass, or unresolved failures and blocked checks are clearly reported.
- [ ] Public contracts, configuration, migrations, and documentation are updated where affected.
- [ ] No secrets, unrelated refactors, invented results, or unnecessary architectural machinery were introduced.
- [ ] The final handoff states material assumptions, compatibility changes, and operational considerations.

## Adoption in Future Projects

Keep this file at the repository root as the shared engineering baseline. Reference it from the coding agent's supported repository instruction file (for example, `AGENTS.md`) and add project-specific commands, directory boundaries, and exceptions there. A standalone Markdown file is guidance only; do not assume every tool automatically loads it.

Adapt implementation details to the stack while preserving the business boundaries. If a requirement cannot be met cleanly, explain the conflict and the smallest justified exception rather than silently bypassing this directive.
