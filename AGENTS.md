<!-- BEGIN:nextjs-agent-rules -->

# Agent instructions for this workspace

This workspace is a mixed project: a Next.js app plus vendored reference code under the repos/ directory. Follow these instructions in order.

## 1. Read the request carefully

- Understand the task before changing anything.
- If the request is ambiguous, ask a short clarifying question instead of guessing.
- Prefer the smallest change that satisfies the request.

## 2. Follow the project conventions

- Keep changes focused and minimal.
- Avoid unnecessary abstractions, refactors, or new dependencies.
- Prefer deletion over addition when possible.
- Match the style already used in the surrounding files.

## 3. Treat vendored repositories as read-only reference code

- The folders under repos/ are reference material only.
- Do not edit files inside repos/ unless the user explicitly instructs you to do so.
- Do not import from repos/ paths such as repos/effect. Import from published packages such as effect instead.
- When working with Effect-related code, inspect repos/effect first for idiomatic patterns, tests, and API usage.

## 4. Use the local Effect reference before implementing Effect code

- Before implementing or modifying Effect code, read agent-patterns/effect-core.md.
- That file is the local, repo-specific guide for:
  - Schema.Class and Schema.TaggedError
  - Effect.fail, catchTag, and catchTags
  - Effect.gen yield patterns
  - HttpApi and service/layer patterns
  - common anti-patterns to avoid

## 5. Prefer a clear vertical-slice architecture for feature work

When building a new feature in this stack, prefer a vertical-slice structure that keeps feature-specific code together while leaving shared infrastructure in shared folders.

Recommended pattern for Next.js + Effect + Drizzle:

- src/lib/db/: shared persistence infrastructure
  - index.ts: database client and ORM setup
  - schema.ts: shared Drizzle table definitions
- src/features/<feature>/: feature-owned code
  - index.ts: public barrel for the feature
  - schema.ts: request/response schemas and typed errors
  - routes.ts: HttpApi route contract definitions
  - handlers.ts: transport-to-effect adapters
  - service.ts: business logic and database access
  - components/: feature UI components
- src/api/: system-level API composition
  - routes.ts or index.ts: compose feature route groups into a root API
- src/app/api/[[...route]]/route.ts: adapter layer that turns HTTP requests into Effect handlers

Use this structure as a default for new features unless the task clearly calls for a different shape. Keep the feature slice focused on feature-specific concerns and avoid mixing shared infrastructure or app-wide concerns into it.

## 6. Verify your changes

- If feasible, run the relevant checks after editing code.
- For UI or app changes, verify the app still builds or the relevant tests pass.
- For logic changes, leave behind a runnable verification step when appropriate.

## 6. Do not assume missing context

- If a task depends on framework-specific behavior, inspect the existing codebase and nearby examples first.
- Use the workspace files and vendored reference code as the source of truth before relying on memory.

## 7. Default mindset

- Be efficient, not careless.
- Prefer simple solutions over clever ones.
- Handle errors and validation properly, especially at trust boundaries.

This block is written and re-added by next dev. Keep it intact unless you are explicitly asked to rewrite the project instructions.
<!-- END:nextjs-agent-rules -->
