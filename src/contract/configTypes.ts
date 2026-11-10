import type { CwtoolsReadGroup, CwtoolsReadToolName, CwtoolsWriteToolName } from './toolCatalog.ts'

export interface CwtoolsBackendConfig {
  serverPath: string
  gamePath: string
  rulesPath: string
  cachePath: string
  game: string
  forceStart: boolean
  startupTimeoutMs: number
  requestTimeoutMs: number
  idleShutdownMs: number
  maxWorkspaceRuntimes: number
  preferActiveBackend: boolean
  activeManifestPath: string
  debug: boolean
}

/** How localisation diagnostics are filtered, mirroring the server's `errors.localisationFilter`. */
export type CwtoolsLocalisationFilter = 'off' | 'problems' | 'all'

/** Diagnostic noise controls forwarded to the backend. */
export interface CwtoolsDiagnosticsConfig {
  /** Error codes (or message fragments) the backend never reports. */
  ignoreCodes: string[]
  /** File names whose diagnostics are dropped. */
  ignoreFiles: string[]
  /** Localisation diagnostic filter mode. */
  localisationFilter: CwtoolsLocalisationFilter
}

export interface CwtoolsConfig {
  enabled: boolean
  readGroups: Record<CwtoolsReadGroup, boolean>
  readTools: Partial<Record<CwtoolsReadToolName, boolean>>
  writeTools: Partial<Record<CwtoolsWriteToolName, boolean>>
  backend: CwtoolsBackendConfig
  diagnostics: CwtoolsDiagnosticsConfig
  output: { maxResultChars: number }
}

/** User/config-layer input before Schemastery fills defaults. */
export interface CwtoolsConfigInput {
  enabled?: boolean
  readGroups?: Partial<Record<CwtoolsReadGroup, boolean>>
  readTools?: Partial<Record<CwtoolsReadToolName, boolean>>
  writeTools?: Partial<Record<CwtoolsWriteToolName, boolean>>
  backend?: Partial<CwtoolsBackendConfig>
  diagnostics?: Partial<CwtoolsDiagnosticsConfig>
  output?: { maxResultChars?: number }
}
