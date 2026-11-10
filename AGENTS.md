# Agent Guide

## Scope

This repository delivers the standalone `dsh-cwtools` bundle. Do not add an MCP server, MCP SDK dependency, VS Code bridge client, or edits to the DeepSeek Harness checkout.

## Sources of truth

- `src/contract/toolCatalog.ts` owns the first-release tool names and groups used by Host and Client.
- `src/contract/configTypes.ts` owns configuration types; `src/config.ts` owns runtime defaults and validation.
- `cwtools-shared` owns generated tool schemas and semantic dispatch. Never hand-edit upstream generated files.
- User behavior belongs in `README.md`, module/data flow in `ARCHITECTURE.md`, and durable rationale in Agent Notes.

## Engineering rules

- Preserve default read-only behavior. Every write requires an explicit configuration allowlist and continues through DSH tool policy.
- Resolve the workspace from the calling Agent Session. Never fall back to the plugin process cwd.
- Propagate AbortSignal, bound runtime pools, and dispose every watcher, timer, connection and child process.
- Validate external JSON and LSP payloads. Tool results are lossless JSON; UI truncation must not truncate canonical values.
- Client code uses DSH slots, typed locales, shared primitives and semantic theme tokens. It must not import Host runtime code or Node builtins.
- Do not perform recursive deletes. Delete named artifacts or let the owning tool clean its own trees.
- Run focused tests before broader checks and report every unrun relevant check explicitly.

## Agent Notes

Non-trivial changes create or update an Owning Note under `.agents/notes/` in the same change. Follow `.agents/notes/README.md`; notes are written in Simplified Chinese.
