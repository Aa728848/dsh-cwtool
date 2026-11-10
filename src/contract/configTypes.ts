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

export interface CwtoolsConfig {
  enabled: boolean
  readGroups: Record<CwtoolsReadGroup, boolean>
  readTools: Partial<Record<CwtoolsReadToolName, boolean>>
  writeTools: Partial<Record<CwtoolsWriteToolName, boolean>>
  backend: CwtoolsBackendConfig
  output: { maxResultChars: number }
}

/** User/config-layer input before Schemastery fills defaults. */
export interface CwtoolsConfigInput {
  enabled?: boolean
  readGroups?: Partial<Record<CwtoolsReadGroup, boolean>>
  readTools?: Partial<Record<CwtoolsReadToolName, boolean>>
  writeTools?: Partial<Record<CwtoolsWriteToolName, boolean>>
  backend?: Partial<CwtoolsBackendConfig>
  output?: { maxResultChars?: number }
}
