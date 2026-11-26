// The browser-safe `cwtools-shared/catalog` entry, never the package root: this
// module is bundled into the browser client, and the root re-exports Host
// modules that require Node builtins (`fs`, `path`, `crypto`, ...) at load.
// `scripts/check-client-bundle.mjs` fails the build if a builtin leaks back in.
import { getMcpToolRegistryMetadata, isMcpWriteToolName, listMcpToolSchemas } from 'cwtools-shared/catalog'

/**
 * How the settings page groups the shared tool catalog.
 *
 * The catalog itself is owned by `cwtools-shared`: this module never keeps a
 * copy of tool names. It only records which group a shared tool is presented
 * under, so a tool added upstream appears in the page — and in the Host — on its
 * own, with no edit here.
 */
export const CWTOOLS_READ_GROUPS = [
  'project',
  'localisation',
  'semantic',
  'navigation',
  'diagnostics',
  'shader',
  'ide',
] as const

export type CwtoolsReadGroup = typeof CWTOOLS_READ_GROUPS[number]

/** Groups in the order the settings page renders them. */
export const CWTOOLS_READ_GROUP_ORDER: readonly CwtoolsReadGroup[] = CWTOOLS_READ_GROUPS

/**
 * Tools that belong to a specific group rather than the group their shared
 * effect implies. Only tools whose purpose the effect cannot express, or whose
 * group assignment is otherwise surprising, need an entry; everything else
 * falls back to {@link cwtoolsReadGroupForEffect}.
 */
const GROUP_OVERRIDES: Readonly<Record<string, CwtoolsReadGroup>> = {
  query_localisation_index: 'localisation',
  get_diagnostics: 'diagnostics',
  analyze_diagnostic_error: 'diagnostics',
  get_ide_context: 'ide',
  open_in_visual_editor: 'ide',
  query_shader_symbol: 'shader',
  query_shader_compile_unit: 'shader',
  query_shader_platform_variants: 'shader',
  query_shader_callers: 'shader',
  explain_shader_reachability: 'shader',
  validate_shader: 'shader',
  compare_shader_with_vanilla: 'shader',
}

/**
 * Tools that only answer inside a workspace with a full game model. Everything
 * else a host cannot run is filtered per call by `isMcpToolAvailable`
 * (CWT-only workspaces, write policy) instead of by name.
 */
const GAME_MODEL_TOOLS: Readonly<Record<string, string>> = {
  query_targeting_weight: 'stellaris',
}

interface CatalogEntry {
  readonly name: string
  readonly description: string
  readonly inputSchema: Record<string, unknown>
  readonly isWrite: boolean
  readonly group: CwtoolsReadGroup
}

function readGroupForEffect(name: string, effect: string | undefined): CwtoolsReadGroup {
  const override = GROUP_OVERRIDES[name]
  if (override !== undefined) return override
  switch (effect) {
    case 'workspace_read':
      return 'semantic'
    case 'memory':
    case 'none':
      return 'project'
    default:
      // A future effect this page does not know yet still gets a home, so an
      // upstream addition can never be silently dropped from the catalog.
      return 'semantic'
  }
}

function buildCatalog(): readonly CatalogEntry[] {
  return listMcpToolSchemas({ includeWrites: true }).map((schema) => {
    const metadata = getMcpToolRegistryMetadata(schema.name)
    const isWrite = isMcpWriteToolName(schema.name) || metadata?.isWrite === true
    return {
      name: schema.name,
      description: schema.description,
      inputSchema: schema.inputSchema as Record<string, unknown>,
      isWrite,
      group: readGroupForEffect(schema.name, metadata?.effect),
    }
  })
}

/** Every tool the shared catalog publishes, read once at load. */
export const CWTOOLS_CATALOG: readonly CatalogEntry[] = Object.freeze(buildCatalog())

const byName = new Map(CWTOOLS_CATALOG.map(entry => [entry.name, entry]))

/** Read-only tools in rendering order: group order, then shared catalog order. */
export const CWTOOLS_READ_TOOL_NAMES: readonly string[] = Object.freeze(
  CWTOOLS_READ_GROUP_ORDER.flatMap(group =>
    CWTOOLS_CATALOG.filter(entry => !entry.isWrite && entry.group === group).map(entry => entry.name)),
)

/** Tools per group, in rendering order. */
export const CWTOOLS_READ_TOOL_GROUPS: Readonly<Record<CwtoolsReadGroup, readonly string[]>> = Object.freeze(
  CWTOOLS_READ_GROUP_ORDER.reduce<Record<CwtoolsReadGroup, readonly string[]>>((groups, group) => {
    groups[group] = CWTOOLS_CATALOG
      .filter(entry => !entry.isWrite && entry.group === group)
      .map(entry => entry.name)
    return groups
  }, {} as Record<CwtoolsReadGroup, readonly string[]>),
)

/** Write tools the shared catalog publishes. Every one needs an explicit grant. */
export const CWTOOLS_WRITE_TOOL_NAMES: readonly string[] = Object.freeze(
  CWTOOLS_CATALOG.filter(entry => entry.isWrite).map(entry => entry.name),
)

/** @returns the catalog entry of one tool, or undefined when the shared catalog has no such tool. */
export function cwtoolsCatalogEntry(name: string): CatalogEntry | undefined {
  return byName.get(name)
}

/** @returns whether the shared catalog publishes this tool as read-only. */
export function isCwtoolsReadToolName(name: string): boolean {
  const entry = byName.get(name)
  return entry !== undefined && !entry.isWrite
}

/** @returns whether the shared catalog publishes this tool as a write. */
export function isCwtoolsWriteToolName(name: string): boolean {
  const entry = byName.get(name)
  return entry === undefined ? isMcpWriteToolName(name) : entry.isWrite
}

/**
 * The catalog group a read tool is presented under.
 * @throws when the shared catalog has no such read tool.
 */
export function cwtoolsReadGroupFor(name: string): CwtoolsReadGroup {
  const entry = byName.get(name)
  if (entry === undefined || entry.isWrite) throw new Error('Unknown CWTools read tool: ' + name)
  return entry.group
}

/**
 * The game model a tool needs, when it only answers against a full game workspace.
 * @returns the game identifier, or undefined when the tool works anywhere.
 */
export function cwtoolsGameModelFor(name: string): string | undefined {
  return GAME_MODEL_TOOLS[name]
}