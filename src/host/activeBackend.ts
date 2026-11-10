import { createNativeBridgeLspHost, discoverNativeBridge, type LspHost } from 'cwtools-node'
import type { Config } from '../config.ts'
import { CwtoolsToolError } from './errors.ts'

export interface ActiveBackend {
  lspHost: LspHost
  readyAtMs?: number
}

/** Resolve a healthy active host only for the exact current mod root. */
export async function resolveActiveBackend(config: Config, workspaceRoot: string, signal: AbortSignal): Promise<ActiveBackend | undefined> {
  const manifestPath = config.backend.activeManifestPath.trim() || undefined
  const discovery = await discoverNativeBridge(workspaceRoot, {
    manifestPath,
    timeoutMs: config.backend.requestTimeoutMs,
    signal,
  })
  if (discovery.kind === 'incompatible') {
    throw new CwtoolsToolError('backend_incompatible', discovery.reason)
  }
  if (discovery.kind === 'unavailable') return undefined
  return {
    lspHost: createNativeBridgeLspHost(discovery.manifest, discovery.readyAtMs),
    ...(discovery.readyAtMs === undefined ? {} : { readyAtMs: discovery.readyAtMs }),
  }
}
