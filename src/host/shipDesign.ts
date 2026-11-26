import path from 'node:path'
import { readFile, readdir, realpath, stat } from 'node:fs/promises'
import { realpathSync, statSync } from 'node:fs'
import { isPathInsideOrEqual, resolveWorkspacePath } from 'cwtools-shared'
import { buildShipDesignView, computeShipDesignStats, loadShipDesignCatalog, parseShipDesignDocument, type ShipDesignData, type ShipDesignIconData } from 'cwtools-shared/editors'
import { ShipDesignResourceLoader, ShipDesignSpriteResolver, resolveShipDesignViewIcons, type ShipDesignResourceSource } from 'cwtools-node'
import type { CwtoolsShipDesignDocument } from '../contract/workbench.ts'

const TEXT_LIMIT = 2_000_000
const BINARY_LIMIT = 32_000_000

export class LayeredShipDataSource implements ShipDesignResourceSource {
  constructor(private readonly roots: readonly string[], private readonly signal: AbortSignal) {}
  private check(): void { if (this.signal.aborted) throw this.signal.reason }
  private async resolve(relativePath: string): Promise<{ absolute: string; root: string } | undefined> {
    this.check()
    for (const root of this.roots) {
      const resolution = resolveWorkspacePath(root, relativePath)
      if (!resolution.ok || !resolution.resolvedPath) return undefined
      const [realRoot, absolute] = await Promise.all([realpath(root), realpath(resolution.resolvedPath)]).catch(() => [])
      if (typeof realRoot !== 'string' || typeof absolute !== 'string') continue
      if (!isPathInsideOrEqual(realRoot, absolute)) return undefined
      const info = await stat(absolute).catch(() => undefined)
      if (info?.isFile()) return { absolute, root: realRoot }
    }
    return undefined
  }
  async readText(relativePath: string): Promise<string | undefined> {
    const resolved = await this.resolve(relativePath); if (!resolved) return undefined
    const info = await stat(resolved.absolute); if (info.size > TEXT_LIMIT) return undefined
    return await readFile(resolved.absolute, 'utf8')
  }
  async readBinary(relativePath: string): Promise<ArrayBuffer | undefined> {
    const resolved = await this.resolve(relativePath); if (!resolved) return undefined
    const info = await stat(resolved.absolute); if (info.size > BINARY_LIMIT) return undefined
    const bytes = await readFile(resolved.absolute)
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  }
  resolvePath(relativePath: string): string | undefined {
    this.check()
    for (const root of this.roots) {
      const resolution = resolveWorkspacePath(root, relativePath)
      if (!resolution.ok || !resolution.resolvedPath) return undefined
      try {
        const realRoot = realpathSync(root); const absolute = realpathSync(resolution.resolvedPath)
        if (!isPathInsideOrEqual(realRoot, absolute)) return undefined
        if (statSync(absolute).isFile()) return absolute
      } catch { /* try the next Host-owned layer */ }
    }
    return undefined
  }
  async listFiles(relativeDirectory: string): Promise<string[]> {
    this.check(); const merged: string[] = []; const seen = new Set<string>()
    for (const root of this.roots) {
      const resolution = resolveWorkspacePath(root, relativeDirectory)
      if (!resolution.ok || !resolution.resolvedPath) return []
      const [realRoot, directory] = await Promise.all([realpath(root), realpath(resolution.resolvedPath)]).catch(() => [])
      if (typeof realRoot !== 'string' || typeof directory !== 'string') continue
      if (!isPathInsideOrEqual(realRoot, directory)) return []
      const entries = await readdir(directory, { withFileTypes: true }).catch(() => [])
      entries.sort((a, b) => a.name.localeCompare(b.name))
      for (const entry of entries.slice(0, 4000)) {
        const relative = relativeDirectory.replace(/\\/g, '/').replace(/\/+$/g, '') + '/' + entry.name
        const folded = relative.toLowerCase(); if (seen.has(folded)) continue
        seen.add(folded); merged.push(relative)
      }
    }
    return merged
  }
  relativeResource(absolutePath: string): string {
    for (const root of this.roots) {
      try { const realRoot = realpathSync(root); if (isPathInsideOrEqual(realRoot, absolutePath)) return path.relative(realRoot, absolutePath).replace(/\\/g, '/') } catch { /* next root */ }
    }
    return ''
  }
}

export interface ShipDesignHostSession { document: CwtoolsShipDesignDocument; resources: ShipDesignResourceLoader }

export async function loadShipDesignHostSession(roots: readonly string[], filePath: string, content: string, signal: AbortSignal): Promise<ShipDesignHostSession> {
  const source = new LayeredShipDataSource(roots, signal)
  const catalog = await loadShipDesignCatalog(source)
  const sprites = new ShipDesignSpriteResolver(source)
  const resources = new ShipDesignResourceLoader(source, absolute => source.relativeResource(absolute))
  const parsed = parseShipDesignDocument(content)
  const warnings = [...catalog.warnings]
  const designs = parsed.designs.slice(0, 50)
  if (parsed.designs.length > designs.length) warnings.push('Only the first 50 designs were loaded.')
  const snapshots = []
  for (const design of designs) {
    if (signal.aborted) throw signal.reason
    const view = buildShipDesignView(catalog, design)
    await resolveShipDesignViewIcons(view, catalog, sprites)
    snapshots.push({ design, view, stats: computeShipDesignStats(catalog, design) })
  }
  const componentRows = [...catalog.components.values()].filter(item => !item.hidden).sort((a, b) => a.key.localeCompare(b.key)).slice(0, 2000)
  const components = []
  for (const [index, item] of componentRows.entries()) {
    let icon: ShipDesignIconData | undefined
    if (index < 256 && item.icon) icon = await sprites.resolve(item.icon, item.iconFrame)
    components.push({ key: item.key, kind: item.kind, size: item.size, componentSet: item.componentSet, upgradesTo: item.upgradesTo, icon })
  }
  if (componentRows.length > 256) warnings.push('Component option icons were limited to the first 256 components.')
  const sections = [...catalog.sections.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(0, 1000).map(item => ({ key: item.key, shipSizes: item.shipSizes, fitsOnSlots: item.fitsOnSlots }))
  return { resources, document: {
    filePath, designs: snapshots, warnings,
    catalog: {
      shipSizes: [...catalog.base.shipSizes.keys()].sort(), roles: [...catalog.roles].sort(), cultures: [...catalog.base.graphicalCultures].sort(), technologies: [...catalog.technologies.keys()].sort().slice(0, 2000),
      sections, components,
    },
  } }
}
