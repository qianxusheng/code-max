# code-max

A coding agent being built from scratch, for learning. The author makes the
architectural decisions; Claude handles mechanical execution and catches
mistakes. Prefer explaining *why* over just producing code.

## Stack & layout

- TypeScript, ESM (`"type": "module"`), strict tsconfig (`rootDir: "."`).
- **Single root package** — one `package.json` + `tsconfig.json` at the root.
  NOT a monorepo. Folders like `src/tools/` are just source folders, not
  separate packages. (We deliberately backed away from per-folder packages.)

```
src/tools/        the tool system (built first)
  types.ts        contracts: ToolSpec, ToolCall, ToolPayload, ToolOutput, ToolContext
  errors.ts       RespondToModel (recoverable) vs FatalToolError (abort)
  tool.ts         the Tool interface (spec + handle) — the one extension point
  registry.ts     ToolRegistry: register / buildSpecs / dispatch
  router.ts       buildToolCall (normalize wire format) + route + parseArguments
  handlers/       one Tool per file (echo.ts is the worked example)
  index.ts        public exports
test/             vitest tests
.claude/commands/ personal slash commands (e.g. /commit)
```

## Commands

- `npm run typecheck` — `tsc --noEmit`
- `npm test` — vitest run
- `npm run test:watch` — vitest watch

## Architecture of the tool system

Modeled on Codex's design. Four ideas, keep them intact:

1. **Spec + execution on one object.** A `Tool` owns both its `spec` (what the
   model sees) and `handle()` (what runs). They can't drift apart. Adding a
   capability = implement `Tool` + `register()` it; registry/router/loop never
   change.
2. **Normalize before dispatch.** The router is the ONLY place that knows a
   provider's wire format (`RawFunctionCall`). It converts to the neutral
   `ToolCall`; registry and tools never see provider shapes.
3. **Errors are a two-way channel.** `RespondToModel` → caught in
   `registry.dispatch`, turned into a tool result the model retries on.
   `FatalToolError` (and anything else) → propagates past dispatch to the run
   loop, which is the layer with the authority to stop the turn. Throw the type
   that encodes "how far up this needs to travel."
4. **Registry is the single choke point.** One `try/catch` lives in `dispatch`,
   protecting every tool, so tools carry no error-handling boilerplate.

### Conventions

- Tools throw `RespondToModel` for recoverable failures (bad args, not found),
  `FatalToolError` for unrecoverable ones. Never return error strings directly
  from a handler.
- `handle()` is always `async` (returns `Promise<ToolOutput>`) even for sync
  tools, so callers can `await` uniformly.
- Tools parse their own args via `parseArguments(call)`; the router only does
  structural validation.
- `ToolCall.id` is carried through but unused until the run loop exists — the
  loop will pair it with `ToolOutput` when forming the message back to the model.

## Not built yet (intended next)

- `src/agent/` run loop (owns when to stop; catches `FatalToolError`).
- `src/model/` provider client (produces `RawFunctionCall[]`).
- Real tools: `read_file`, `shell`, `apply_patch`.

## Deliberately skipped (scale/product features, not core design)

code-mode, tool discovery/search, exposure tiers, parallel-call handling, MCP.
An MCP tool will just be another `Tool` in the registry when the time comes.
