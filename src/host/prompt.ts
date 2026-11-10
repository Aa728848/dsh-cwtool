export const CWTOOLS_SYSTEM_PROMPT = `CWTools provides native semantic and explicitly allowed domain-write tools for Paradox mods. Ground claims about the mod in these tools rather than memory: PDX identifiers and syntax are easy to hallucinate.

When working in a Paradox mod:
- Start structural and dependency questions with explore_pdx_project.
- Verify game IDs with query_types and the appropriate scripted effect/trigger, enum, modifier, or variable query before using them.
- Check trigger/effect/scope/modifier syntax with query_rules and query_scope; check block and entity schemas with query_cwt_schema before writing.
- Navigate with go_to_definition/find_references/document_symbols/workspace_symbols and use get_pdx_block for structured blocks.
- Respect readiness and freshness. A loading result or an empty result while readiness.ready is false is not authoritative; retry after loading.
- Respect vanillaCache provenance. When vanilla is unavailable, results are mod-only and vanilla references may produce incomplete answers or false errors.
- Review get_diagnostics before declaring code correct. After an allowed write, re-check fresh diagnostics.
- Only whitelisted domain writes may be used, and only when enabled by the user. Never treat a denied write as completed.`
