import path from 'node:path'
import { readdir, realpath } from 'node:fs/promises'
import { isPathInsideOrEqual, resolveWorkspacePath } from 'cwtools-shared'
import { annotateEventEntryStatus, buildDefinitionReferenceEdges, buildMtthConditionEdges, extractConnectedSubgraph, mergeGraphs, parseCommonFile, parseEventFile, selectEventSeedIds, type EventGraph, type PdxSemanticCatalog } from 'cwtools-shared/editors'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

export const EVENT_GRAPH_LIMITS = Object.freeze({ eventFiles: 500, commonFiles: 1500, directories: 4000, depth: 12, totalBytes: 48_000_000, nodes: 1000, edges: 10_000 })

interface EventGraphOptions {
  root: string
  sessionId: SessionId
  seedPath: string
  seedContent: string
  catalog: PdxSemanticCatalog
  signal: AbortSignal
  read: (sessionId: SessionId, filePath: string, signal: AbortSignal) => Promise<{ filePath: string; content: string }>
}

export interface WorkspaceEventGraph { graph: EventGraph; seedIds: string[]; warnings: string[] }

async function findSemanticFiles(root: string, semanticPaths: readonly string[], limit: number, signal: AbortSignal, budget: { directories: number }): Promise<string[]> {
  const found = new Map<string, string>()
  const walk = async (directory: string, depth: number): Promise<void> => {
    if (signal.aborted) throw signal.reason
    if (depth > EVENT_GRAPH_LIMITS.depth || budget.directories >= EVENT_GRAPH_LIMITS.directories || found.size >= limit) return
    budget.directories++
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => [])
    entries.sort((left, right) => left.name.localeCompare(right.name))
    for (const entry of entries) {
      if (signal.aborted) throw signal.reason
      if (found.size >= limit || budget.directories >= EVENT_GRAPH_LIMITS.directories) return
      const target = path.join(directory, entry.name)
      if (entry.isDirectory()) await walk(target, depth + 1)
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.txt')) found.set(target, target)
    }
  }
  for (const semanticPath of [...new Set(semanticPaths)].sort()) {
    if (found.size >= limit || budget.directories >= EVENT_GRAPH_LIMITS.directories) break
    const resolution = resolveWorkspacePath(root, semanticPath)
    if (!resolution.ok || !resolution.resolvedPath) continue
    const [realRoot, realDirectory] = await Promise.all([realpath(root), realpath(resolution.resolvedPath)]).catch(() => [])
    if (typeof realRoot !== 'string' || typeof realDirectory !== 'string' || !isPathInsideOrEqual(realRoot, realDirectory)) continue
    await walk(realDirectory, 0)
  }
  return [...found.values()].sort().slice(0, limit)
}

export async function buildWorkspaceEventGraph(options: EventGraphOptions): Promise<WorkspaceEventGraph> {
  const { root, sessionId, seedPath, seedContent, catalog, signal, read } = options
  const warnings = [...catalog.warnings]
  const seedGraph = parseEventFile(seedContent, seedPath, catalog)
  const seedIds = new Set(selectEventSeedIds(seedGraph))
  if (seedIds.size === 0) return { graph: { nodes: [], edges: [] }, seedIds: [], warnings: ['The selected file contains no event definitions.'] }
  const budget = { directories: 0, bytes: 0 }
  const graphs: EventGraph[] = [seedGraph]
  const seen = new Set([seedPath.replace(/\\/g, '/')])
  let skipped = 0
  const readGraphs = async (paths: readonly string[], limit: number, common: boolean): Promise<void> => {
    const files = await findSemanticFiles(root, paths, limit, signal, budget)
    for (const file of files) {
      if (signal.aborted) throw signal.reason
      const relative = path.relative(root, file).replace(/\\/g, '/')
      if (seen.has(relative)) continue
      seen.add(relative)
      try {
        const document = await read(sessionId, relative, signal)
        const bytes = Buffer.byteLength(document.content, 'utf8')
        if (budget.bytes + bytes > EVENT_GRAPH_LIMITS.totalBytes) { skipped++; continue }
        budget.bytes += bytes
        if (!common) {
          const graph = parseEventFile(document.content, document.filePath, catalog)
          if (graph.nodes.length > 0) graphs.push(graph)
          continue
        }
        const result = parseCommonFile(document.content, document.filePath, catalog)
        const graph: EventGraph = { nodes: result.externalSources.map(source => ({ id: source.id, type: source.sourceType, title: source.name, file: source.file, line: source.line, endLine: source.line, namespace: `__${source.sourceType}__`, semanticReferences: source.semanticReferences, definitionIdentity: source.definitionIdentity })), edges: result.edges }
        if (graph.nodes.length > 0 || graph.edges.length > 0) graphs.push(graph)
      } catch (error) { if (signal.aborted) throw signal.reason; skipped++ }
    }
  }
  const eventPaths = catalog.definitionTypes.find(type => type.name === 'event')?.paths ?? []
  await readGraphs(eventPaths, EVENT_GRAPH_LIMITS.eventFiles, false)
  const relatedPaths = catalog.definitionTypes.filter(type => type.name !== 'event').flatMap(type => type.paths)
  await readGraphs(relatedPaths, EVENT_GRAPH_LIMITS.commonFiles, true)
  const merged = mergeGraphs(graphs)
  merged.edges.push(...buildDefinitionReferenceEdges(merged), ...buildMtthConditionEdges(merged))
  const connected = annotateEventEntryStatus(extractConnectedSubgraph(merged, seedIds, Number.POSITIVE_INFINITY, EVENT_GRAPH_LIMITS.nodes))
  if (connected.edges.length > EVENT_GRAPH_LIMITS.edges) {
    connected.edges = connected.edges.slice(0, EVENT_GRAPH_LIMITS.edges)
    warnings.push(`The graph was limited to ${EVENT_GRAPH_LIMITS.edges} edges.`)
  }
  if (skipped > 0) warnings.push(`${skipped} unreadable or over-budget file(s) were skipped.`)
  if (budget.directories >= EVENT_GRAPH_LIMITS.directories) warnings.push(`Directory scanning stopped at ${EVENT_GRAPH_LIMITS.directories} directories.`)
  return { graph: connected, seedIds: [...seedIds].sort(), warnings }
}
