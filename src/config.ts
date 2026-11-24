import type { Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {
  CwtoolsBackendConfig, CwtoolsConfig, CwtoolsConfigInput, CwtoolsDiagnosticsConfig,
} from './contract/configTypes.ts'
import {
  cwtoolsReadGroupFor, CWTOOLS_READ_GROUPS, isCwtoolsReadToolName,
  type CwtoolsReadGroup,
} from './contract/toolCatalog.ts'

/** Plain, unwrapped values the runtime consumes. */
export type Config = CwtoolsConfig

/**
 * Host-provided live surface: the Host passes every editable section as a
 * volatile reference, so a saved settings change reaches the running instance
 * without remounting it. Sections without a volatile reference never appear in
 * the Host settings page at all.
 */
export interface CwtoolsLiveConfig {
  enabled: Volatile<boolean>
  readGroups: Volatile<Record<CwtoolsReadGroup, boolean>>
  readTools: Volatile<Record<string, boolean>>
  writeTools: Volatile<Record<string, boolean>>
  backend: Volatile<CwtoolsBackendConfig>
  diagnostics: Volatile<CwtoolsDiagnosticsConfig>
  output: Volatile<{ maxResultChars: number }>
}

const timer = z.number().step(1).min(1).max(2_147_483_647)

const defaultGroups = (enabled: boolean): Record<CwtoolsReadGroup, boolean> =>
  Object.fromEntries(CWTOOLS_READ_GROUPS.map(group => [group, enabled])) as Record<CwtoolsReadGroup, boolean>

/**
 * The tool ledger. Keys are not enumerated: the shared catalog publishes the
 * tool set, and this schema only stores the grants someone overrode. A stored
 * key for a tool the catalog no longer publishes is harmless.
 */
const toolLedger = z.dict(z.boolean(), z.string()).default({})

export const Config: z<CwtoolsConfigInput, CwtoolsLiveConfig> = z.object({
  enabled: z.boolean().default(true).volatile(),
  readGroups: z.object({
    project: z.boolean().default(true),
    localisation: z.boolean().default(true),
    semantic: z.boolean().default(true),
    navigation: z.boolean().default(true),
    diagnostics: z.boolean().default(true),
    shader: z.boolean().default(true),
    ide: z.boolean().default(true),
  }).default({}).volatile(),
  readTools: toolLedger.volatile(),
  // Every write stays off until someone stores its name here.
  writeTools: toolLedger.volatile(),
  backend: z.object({
    serverPath: z.string().default(''),
    gamePath: z.string().default(''),
    rulesPath: z.string().default(''),
    cachePath: z.string().default(''),
    game: z.string().default(''),
    forceStart: z.boolean().default(false),
    startupTimeoutMs: timer.default(30_000),
    requestTimeoutMs: timer.default(20_000),
    idleShutdownMs: timer.default(600_000),
    maxWorkspaceRuntimes: z.number().step(1).min(1).max(8).default(2),
    preferActiveBackend: z.boolean().default(true),
    activeManifestPath: z.string().default(''),
    debug: z.boolean().default(false),
  }).default({}).volatile(),
  diagnostics: z.object({
    ignoreCodes: z.array(z.string()).default([]),
    ignoreFiles: z.array(z.string()).default([]),
    localisationFilter: z.union([z.const('off'), z.const('problems'), z.const('all')]).default('off'),
  }).default({}).volatile(),
  output: z.object({
    maxResultChars: z.number().step(1).min(1_000).max(200_000).default(16_000),
  }).default({}).volatile(),
})

/** Read every live section once so one operation sees one consistent configuration.
 * @param config - the Host-provided live configuration.
 * @returns plain values for the runtime, tools and their snapshots.
 */
export function snapshotConfig(config: CwtoolsLiveConfig): Config {
  return {
    enabled: config.enabled.get(),
    readGroups: { ...defaultGroups(true), ...config.readGroups.get() },
    readTools: { ...config.readTools.get() },
    writeTools: { ...config.writeTools.get() },
    backend: { ...config.backend.get() },
    diagnostics: {
      ignoreCodes: [...config.diagnostics.get().ignoreCodes],
      ignoreFiles: [...config.diagnostics.get().ignoreFiles],
      localisationFilter: config.diagnostics.get().localisationFilter,
    },
    output: { ...config.output.get() },
  }
}

/**
 * Whether a read tool may run. A tool unknown to this build is not granted:
 * the value must come from the shared catalog so a stale name cannot open a
 * gate, and a stored `false` is the only per-tool opt-out.
 * @param config - the snapshot the current operation runs against.
 * @param name - the tool the model called.
 * @returns whether the master switch, its group, and its own entry all allow it.
 */
export function isReadToolEnabled(config: Config, name: string): boolean {
  return config.enabled && isCwtoolsReadToolName(name)
    && config.readGroups[cwtoolsReadGroupFor(name)] === true
    && config.readTools[name] !== false
}

/**
 * Whether the write allowlist names this tool.
 * @param config - the snapshot the current operation runs against.
 * @param name - the write tool the model called.
 * @returns whether the operator explicitly allowed it.
 */
export function isWriteToolEnabled(config: Config, name: string): boolean {
  return config.enabled && config.writeTools[name] === true
}

/** @deprecated Prefer {@link isWriteToolEnabled}; kept for the localisation settings path. */
export function isWriteLocalisationEnabled(config: Config): boolean {
  return isWriteToolEnabled(config, 'write_localisation')
}

/** @returns the write tools this configuration allows, in catalog order. */
export function allowedWriteTools(config: Config): string[] {
  return Object.keys(config.writeTools).filter(name => isWriteToolEnabled(config, name))
}
