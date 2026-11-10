import path from 'node:path'
import { createNodeHostServices, detectProjectSupport } from 'cwtools-node'
import {
  createToolCallHandler,
  getMcpToolRegistryMetadata,
  isMcpToolAvailable,
  type HostServices,
  type SharedToolResult,
} from 'cwtools-shared'
import type { Config } from '../config.ts'
import { isReadToolEnabled, isWriteLocalisationEnabled } from '../config.ts'
import {
  CWTOOLS_STELLARIS_ONLY_TOOLS,
  isCwtoolsReadToolName,
  isCwtoolsWriteToolName,
} from '../contract/toolCatalog.ts'
import type { CwtoolsToolCallHandler } from './contracts.ts'
import { abortError, awaitWithAbort, CwtoolsToolError, throwIfAborted } from './errors.ts'
import { resolveActiveBackend } from './activeBackend.ts'

interface RuntimeEntry {
  readonly root: string
  readonly host: HostServices
  readonly handler: CwtoolsToolCallHandler
  readonly controllers: Set<AbortController>
  queue: Promise<void>
  active: number
  lastUsed: number
  idleTimer?: NodeJS.Timeout
  disposed: boolean
}

interface ProjectResolution {
  root: string
  supported: boolean
  reason: string
  kind: string
  game: string
}

function optional(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

export class CwtoolsRuntimePool {
  private readonly entries = new Map<string, RuntimeEntry>()
  private readonly pendingEntries = new Map<string, Promise<RuntimeEntry>>()
  private disposed = false

  constructor(private readonly config: Config) {}

  get workspaceCount(): number {
    return this.entries.size
  }

  canExpose(name: string, workspaceRoot: string): boolean {
    return this.exposureReason(name, workspaceRoot) === undefined
  }

  exposureReason(name: string, workspaceRoot: string): string | undefined {
    if (this.disposed || !this.config.enabled) return 'CWTools is disabled by configuration.'
    if (isCwtoolsReadToolName(name)) {
      if (!isReadToolEnabled(this.config, name)) return 'Tool ' + name + ' is disabled by read-group or per-tool configuration.'
    } else if (isCwtoolsWriteToolName(name)) {
      if (!isWriteLocalisationEnabled(this.config)) return 'Tool ' + name + ' requires an explicit write allowlist entry.'
    } else {
      return 'Tool ' + name + ' is outside the first-release CWTools catalog.'
    }
    const project = this.resolveProject(workspaceRoot)
    if (!project.supported) return project.reason
    const cwtOnly = project.kind === 'cwt-only'
    if (!isMcpToolAvailable(name, { includeWrites: isWriteLocalisationEnabled(this.config), cwtOnly })) {
      return cwtOnly ? 'Tool ' + name + ' is unavailable in a CWT-only workspace.' : 'Tool ' + name + ' is unavailable under the current write policy.'
    }
    if (CWTOOLS_STELLARIS_ONLY_TOOLS.has(name) && project.game !== 'stellaris') {
      return 'Tool ' + name + ' requires a Stellaris full-mod workspace.'
    }
    return undefined
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    workspaceRoot: string,
    signal: AbortSignal,
  ): Promise<SharedToolResult> {
    throwIfAborted(signal)
    if (this.disposed) throw new CwtoolsToolError('runtime_disposed', 'The CWTools runtime has been disposed.')
    const denied = this.exposureReason(name, workspaceRoot)
    if (denied !== undefined) throw new CwtoolsToolError('tool_not_available', denied)
    const entry = await this.entryFor(workspaceRoot, signal)
    if (this.disposed) {
      throw new CwtoolsToolError('runtime_disposed', 'The CWTools runtime has been disposed.')
    }
    const controller = new AbortController()
    const abort = () => { controller.abort(signal.reason) }
    if (signal.aborted) abort()
    else signal.addEventListener('abort', abort, { once: true })
    entry.controllers.add(controller)
    entry.active++
    this.clearIdle(entry)
    try {
      const run = () => entry.handler(name, args, { signal: controller.signal })
      const metadata = getMcpToolRegistryMetadata(name)
      const result = metadata?.concurrencyClass === 'parallel'
        ? await awaitWithAbort(run(), controller.signal)
        : await this.serial(entry, run, controller.signal)
      if (result.source === 'cwtools-mcp') return { ...result, source: 'cwtools-dsh' }
      return result
    } finally {
      signal.removeEventListener('abort', abort)
      entry.controllers.delete(controller)
      entry.active--
      entry.lastUsed = Date.now()
      this.scheduleIdle(entry)
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const entry of this.entries.values()) this.disposeEntry(entry)
    this.entries.clear()
  }

  private resolveProject(workspaceRoot: string): ProjectResolution {
    const requested = path.resolve(workspaceRoot)
    const support = detectProjectSupport(requested, {
      game: optional(this.config.backend.game),
      gamePath: optional(this.config.backend.gamePath),
    })
    const enabled = support.supported || this.config.backend.forceStart
    const kind = support.supported ? support.kind : this.config.backend.forceStart ? 'mod' : support.kind
    return {
      root: path.resolve(support.supported ? support.matchedAt ?? requested : requested),
      supported: enabled,
      reason: support.reason,
      kind,
      game: kind === 'cwt-only' ? 'cwt' : optional(this.config.backend.game) ?? support.gameId ?? 'paradox',
    }
  }

  private async entryFor(workspaceRoot: string, signal: AbortSignal): Promise<RuntimeEntry> {
    if (this.disposed) throw new CwtoolsToolError('runtime_disposed', 'The CWTools runtime has been disposed.')
    const project = this.resolveProject(workspaceRoot)
    if (!project.supported) throw new CwtoolsToolError('project_not_supported', project.reason)
    const existing = this.entries.get(project.root)
    if (existing !== undefined) {
      existing.lastUsed = Date.now()
      this.clearIdle(existing)
      return existing
    }
    const pending = this.pendingEntries.get(project.root)
    if (pending !== undefined) return await pending
    const created = this.createEntry(project, signal)
    this.pendingEntries.set(project.root, created)
    try {
      const entry = await created
      if (this.disposed) {
        this.entries.delete(project.root)
        if (!entry.disposed) entry.host.dispose?.()
        throw new CwtoolsToolError('runtime_disposed', 'The CWTools runtime was disposed while the workspace host was starting.')
      }
      return entry
    } finally {
      this.pendingEntries.delete(project.root)
    }
  }

  private async createEntry(project: ProjectResolution, signal: AbortSignal): Promise<RuntimeEntry> {
    const active = this.config.backend.preferActiveBackend
      ? await resolveActiveBackend(this.config, project.root, signal)
      : undefined
    if (this.disposed) {
      if (active && 'dispose' in active.lspHost && typeof active.lspHost.dispose === 'function') active.lspHost.dispose()
      throw new CwtoolsToolError('runtime_disposed', 'The CWTools runtime has been disposed.')
    }
    const writes = isWriteLocalisationEnabled(this.config)
    const host = createNodeHostServices({
      workspaceRoot: project.root,
      game: project.game === 'paradox' || project.game === 'cwt' ? undefined : project.game,
      serverPath: optional(this.config.backend.serverPath),
      gamePath: optional(this.config.backend.gamePath),
      cachePath: optional(this.config.backend.cachePath),
      rulesPath: optional(this.config.backend.rulesPath),
      enableWrites: writes,
      allowedTools: writes ? ['write_localisation'] : [],
      forceStart: this.config.backend.forceStart,
      startupTimeoutMs: this.config.backend.startupTimeoutMs,
      requestTimeoutMs: this.config.backend.requestTimeoutMs,
      debug: this.config.backend.debug,
      ...(active === undefined ? {} : { lspHost: active.lspHost, readyAtMs: active.readyAtMs }),
    })
    const entry: RuntimeEntry = {
      root: project.root,
      host,
      handler: createToolCallHandler(host),
      controllers: new Set(),
      queue: Promise.resolve(),
      active: 0,
      lastUsed: Date.now(),
      disposed: false,
    }
    this.entries.set(project.root, entry)
    this.enforceCapacity(entry)
    return entry
  }

  private enforceCapacity(created: RuntimeEntry): void {
    if (this.entries.size <= this.config.backend.maxWorkspaceRuntimes) return
    const candidate = [...this.entries.values()]
      .filter(entry => entry !== created && entry.active === 0)
      .sort((left, right) => left.lastUsed - right.lastUsed)[0]
    if (candidate === undefined) {
      this.entries.delete(created.root)
      this.disposeEntry(created)
      throw new CwtoolsToolError(
        'workspace_capacity',
        'All configured CWTools workspace runtimes are active.',
        ['Retry after an active call finishes, close an idle workspace, or increase backend.maxWorkspaceRuntimes.'],
      )
    }
    this.entries.delete(candidate.root)
    this.disposeEntry(candidate)
  }

  private async serial(
    entry: RuntimeEntry,
    run: () => Promise<SharedToolResult>,
    signal: AbortSignal,
  ): Promise<SharedToolResult> {
    const queued = entry.queue.then(async () => {
      throwIfAborted(signal)
      if (entry.disposed) throw new CwtoolsToolError('runtime_disposed', 'The workspace CWTools runtime was disposed before the call started.')
      return await run()
    })
    entry.queue = queued.then(() => undefined, () => undefined)
    return await awaitWithAbort(queued, signal)
  }

  private clearIdle(entry: RuntimeEntry): void {
    if (entry.idleTimer !== undefined) clearTimeout(entry.idleTimer)
    entry.idleTimer = undefined
  }

  private scheduleIdle(entry: RuntimeEntry): void {
    if (entry.disposed || entry.active !== 0 || this.disposed) return
    this.clearIdle(entry)
    entry.idleTimer = setTimeout(() => {
      if (entry.active !== 0 || entry.disposed || this.disposed) return
      this.entries.delete(entry.root)
      this.disposeEntry(entry)
    }, this.config.backend.idleShutdownMs)
    entry.idleTimer.unref()
  }

  private disposeEntry(entry: RuntimeEntry): void {
    if (entry.disposed) return
    entry.disposed = true
    this.clearIdle(entry)
    for (const controller of entry.controllers) controller.abort(abortError('The CWTools workspace runtime was disposed.'))
    entry.controllers.clear()
    entry.host.dispose?.()
  }
}
