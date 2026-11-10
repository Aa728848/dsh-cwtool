import type { Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {
  CwtoolsBackendConfig, CwtoolsConfig, CwtoolsConfigInput, CwtoolsDiagnosticsConfig,
} from './contract/configTypes.ts'
import {
  cwtoolsReadGroupFor,
  type CwtoolsReadGroup, type CwtoolsReadToolName, type CwtoolsWriteToolName,
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
  readTools: Volatile<Partial<Record<CwtoolsReadToolName, boolean>>>
  writeTools: Volatile<Partial<Record<CwtoolsWriteToolName, boolean>>>
  backend: Volatile<CwtoolsBackendConfig>
  diagnostics: Volatile<CwtoolsDiagnosticsConfig>
  output: Volatile<{ maxResultChars: number }>
}

const timer = z.number().step(1).min(1).max(2_147_483_647)

export const Config: z<CwtoolsConfigInput, CwtoolsLiveConfig> = z.object({
  enabled: z.boolean().default(true).volatile(),
  readGroups: z.object({
    project: z.boolean().default(true),
    localisation: z.boolean().default(true),
    semantic: z.boolean().default(true),
    navigation: z.boolean().default(true),
    diagnostics: z.boolean().default(true),
    shader: z.boolean().default(true),
  }).default({}).volatile(),
  readTools: z.dict(z.boolean(), z.string()).default({}).volatile(),
  writeTools: z.object({
    write_localisation: z.boolean().default(false),
  }).default({}).volatile(),
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
    maxResultChars: z.number().step(1).min(1000).max(200_000).default(16_000),
  }).default({}).volatile(),
})

/** Read every live section once so one operation sees one consistent configuration.
 * @param config - the Host-provided live configuration.
 * @returns plain values for the runtime, tools and their snapshots.
 */
export function snapshotConfig(config: CwtoolsLiveConfig): Config {
  return {
    enabled: config.enabled.get(),
    readGroups: { ...config.readGroups.get() },
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

export function isReadToolEnabled(config: Config, name: CwtoolsReadToolName): boolean {
  return config.enabled && config.readGroups[cwtoolsReadGroupFor(name)] && config.readTools[name] !== false
}

export function isWriteLocalisationEnabled(config: Config): boolean {
  return config.enabled && config.writeTools.write_localisation === true
}
