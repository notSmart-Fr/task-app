<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.
## Vendored Repositories & External Reference Code

This project vendors external library source code under the `repos/` directory.

- **Read-Only Context:** Use vendored repositories strictly as read-only reference material when writing code for related libraries.
- **Reference Truth:** Prefer idiomatic patterns, tests, and API implementations found inside `repos/` over web search results or generated assumptions.
- **Do NOT Edit:** Never modify any files inside `repos/` unless explicitly instructed.
- **Do NOT Import:** Never write application imports pointing to `repos/` (e.g., `import { ... } from "repos/effect"` is strictly forbidden). Always import from official NPM packages (e.g., `import { ... } from "effect"`).

### Effect Framework Guidance
- When writing Effect code, inspect `repos/effect/` for examples of idiomatic usage, tests, module structure, and API design.
- Treat `repos/effect/` as the single source of truth for Effect patterns.
- Always check `agent-patterns/` first if a relevant pattern file exists before exploring `repos/effect/`.
- For a concise, repo-specific reference on schemas, errors, generators, HttpApi, and service patterns, read `agent-patterns/effect-core.md` before implementing new Effect code.

<!-- END:nextjs-agent-rules -->
