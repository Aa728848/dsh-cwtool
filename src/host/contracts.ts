import type { HostServices, SharedToolResult } from 'cwtools-shared'

export interface CwtoolsExecutionContext {
  signal?: AbortSignal
}

export type CwtoolsToolCallHandler = (
  name: string,
  args?: Record<string, unknown>,
  context?: CwtoolsExecutionContext,
) => Promise<SharedToolResult>

export interface CwtoolsNodeHostOptions {
  workspaceRoot: string
  game?: string
  serverPath?: string
  gamePath?: string
  cachePath?: string
  rulesPath?: string
  enableWrites: boolean
  allowedTools: string[]
  forceStart: boolean
  startupTimeoutMs?: number
  requestTimeoutMs?: number
  lspHost?: HostServices['lsp']
  readyAtMs?: number
  debug?: boolean
}

export type CwtoolsNodeHostFactory = (options: CwtoolsNodeHostOptions) => HostServices
