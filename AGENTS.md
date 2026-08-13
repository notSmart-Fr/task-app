<!-- BEGIN:nextjs-agent-rules -->

# Agent instructions for this workspace

This workspace is a mixed project: a Next.js app plus vendored reference code under the repos/ directory. Follow these instructions in order.

## 1. Read the request carefully

- Understand the task before changing anything.
- If the request is ambiguous, ask a short clarifying question instead of guessing.
- Prefer the smallest change that satisfies the request.
- State assumptions explicitly; if multiple interpretations exist, present them rather than picking silently. If something is unclear, ask.

## 2. Engineering principles

- **Think before coding.** Don't assume; surface tradeoffs. If confused, name what's confusing and ask before implementing.
- **Simplicity first.** Minimum code that solves the problem. No speculative abstractions, no unrequested flexibility. If 50 lines can replace 200, rewrite it.
- **Surgical changes.** Touch only what you must; match existing style even if you'd do it differently. Clean up only orphans your change created; mention pre-existing dead code, don't delete it.
- **Goal-driven execution.** Turn tasks into verifiable goals (e.g. "add validation" → "make invalid inputs fail, then pass"). For multi-step tasks, state a short step → verify plan and loop until it passes.

## 3. Follow the project conventions

- Keep changes focused and minimal.
- Avoid unnecessary abstractions, refactors, or new dependencies.
- Prefer deletion over addition when possible.
- Match the style already used in the surrounding files.

## 4. Treat vendored repositories as read-only reference code

- The folders under repos/ are reference material only.
- Do not edit files inside repos/ unless the user explicitly instructs you to do so.
- Do not import from repos/ paths such as repos/effect. Import from published packages such as effect instead.
- When working with Effect-related code, use the local guide under `.knowledge/agent-patterns/` first (see section 5); fall back to `repos/effect` for idiomatic patterns, tests, and API usage when the local notes don't have the answer.

## 5. Use the local Effect reference before implementing Effect code

- Before implementing or modifying Effect code, read `.knowledge/agent-patterns/effect-core.md` first.
- If the local guide does not answer the question, then refer to the vendored `repos/` code (e.g. `repos/effect`) for idiomatic patterns, tests, and API usage.
- That file is the local, repo-specific guide for:
  - Schema.Class and Schema.TaggedError
  - Effect.fail, catchTag, and catchTags
  - Effect.gen yield patterns
  - HttpApi and service/layer patterns
  - time: use Clock, not Date.now / new Date
  - common anti-patterns to avoid

## 6. Prefer a clear vertical-slice architecture for feature work

When building a new feature in this stack, prefer a vertical-slice structure that keeps feature-specific code together while leaving shared infrastructure in shared folders.

Recommended pattern for Next.js + Effect + Effect SQL (no ORM):

- src/lib/db/: shared persistence infrastructure
  - migrations.ts: inline Effect SQL migrations (Migrator.fromRecord)
  - client.ts: DbLive layer (LibsqlClient.layer + migrations)
  - migrate.ts: standalone migration runner (`bun run src/lib/db/migrate.ts`)
- src/features/<feature>/: feature-owned code
  - index.ts: public barrel for the feature
  - schema.ts: request/response schemas and typed errors
  - routes.ts: HttpApi route contract definitions
  - handlers.ts: HttpApiBuilder.group handler layer
  - service.ts: business logic and SQL access (Context.Service + SqlClient)
  - components/: feature UI components
- src/api/: system-level API composition
  - index.ts: compose feature route groups into a root HttpApi
- src/app/api/[[...route]]/route.ts: adapter layer that turns HTTP requests into Effect handlers

See `.knowledge/agent-patterns/effect-core.md` section 8 for the full verified vertical slice.

Use this structure as a default for new features unless the task clearly calls for a different shape. Keep the feature slice focused on feature-specific concerns and avoid mixing shared infrastructure or app-wide concerns into it.

## 7. Verify your changes

- Use the narrowest validation that covers the change; report which checks were run and any that could not be run.
- If feasible, run the relevant checks after editing code.
- For UI or app changes, verify the app still builds or the relevant tests pass.
- For logic changes, leave behind a runnable verification step when appropriate.

Validation:

| Change type | Checks |
| --- | --- |
| Effect / API code | `bun run lint`, `bun run lint:oxlint`, `node node_modules/typescript/bin/tsc --noEmit`, `bunx next build` |
| DB / migrations | `bun run db:migrate` |
| Docs / knowledge only | none (unless code changed) |

## 8. Do not assume missing context

- If a task depends on framework-specific behavior, inspect the existing codebase and nearby examples first.
- Use the workspace files and vendored reference code as the source of truth before relying on memory.

## 9. Default mindset

- Be efficient, not careless.
- Prefer simple solutions over clever ones.
- Handle errors and validation properly, especially at trust boundaries.

## 10. Use .knowledge — project knowledge lives here

`.knowledge/` is the single source of truth for project knowledge. Its subfolders have different
roles — consult only what a task needs:

- `agent-patterns/` — idiomatic code patterns (the Effect v4 guide). **Read before Effect work**
  (see §5); always relevant.
- `notes/` — gotchas, decisions, version constraints. **Check when something behaves unexpectedly
  or before changing deps/tooling.**
- `docs/` — setup & reference (tsgo/TS7, foundation & scaling). **Only for setup/config tasks;
  not required for routine coding.**

Rules:

- Do not keep notes in workspaceStorage or the assistant's out-of-repo memory store.
- Always write project patterns, gotchas, and decisions directly into `.knowledge/` as real,
  committed files.
- Prefer updating an existing file over creating a new one; keep entries concise.
- Consult `.knowledge/` (local) before the vendored `repos/` reference code.

This block is written and re-added by next dev. Keep it intact unless you are explicitly asked to rewrite the project instructions.
<!-- END:nextjs-agent-rules -->
