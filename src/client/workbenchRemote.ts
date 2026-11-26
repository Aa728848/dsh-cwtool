import { z } from 'zod'
import type { InvocationDescriptor } from '@deepseek-ai/dsh-typert-protocol'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { EventGraph, GuiElement } from 'cwtools-shared/editors'
import type { CwtoolsWorkbenchRemote, CwtoolsEventGraphDocument, CwtoolsShipDesignAssetDocument, CwtoolsShipDesignDocument, CwtoolsGuiDocument, CwtoolsWorkbenchAsset, CwtoolsWorkbenchDocument, CwtoolsWorkbenchHostSnapshot } from '../contract/workbench.ts'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteMap {
    'cwtoolsWorkbench/snapshot': CwtoolsWorkbenchRemote['snapshot']
    'cwtoolsWorkbench/read': CwtoolsWorkbenchRemote['read']
    'cwtoolsWorkbench/asset': CwtoolsWorkbenchRemote['asset']
    'cwtoolsWorkbench/gui': CwtoolsWorkbenchRemote['gui']
    'cwtoolsWorkbench/event': CwtoolsWorkbenchRemote['event']
    'cwtoolsWorkbench/ship': CwtoolsWorkbenchRemote['ship']
    'cwtoolsWorkbench/shipAsset': CwtoolsWorkbenchRemote['shipAsset']
    'cwtoolsWorkbench/execute': CwtoolsWorkbenchRemote['execute']
    'cwtoolsWorkbench/write': CwtoolsWorkbenchRemote['write']
  }
  interface TypertRemoteNamespaceMap {
    cwtoolsWorkbench: CwtoolsWorkbenchRemote
  }
}

const sessionId = z.custom<SessionId>(value => typeof value === 'string' && value.length > 0 && value.length <= 256)
const guiElements=z.custom<GuiElement[]>(value=>{const visit=(input:unknown,depth:number):boolean=>Array.isArray(input)&&depth<=64&&input.every(item=>{if(typeof item!=='object'||item===null)return false;const row=item as Record<string,unknown>;const position=row.position as Record<string,unknown>|undefined;const size=row.size as Record<string,unknown>|undefined;return typeof row.name==='string'&&typeof row.type==='string'&&typeof position?.x==='number'&&Number.isFinite(position.x)&&typeof position.y==='number'&&Number.isFinite(position.y)&&typeof size?.width==='number'&&Number.isFinite(size.width)&&typeof size.height==='number'&&Number.isFinite(size.height)&&visit(row.children,depth+1)});return visit(value,0)})
const toolResult = z.looseObject({ ok: z.boolean(), status: z.enum(['ready', 'partial', 'success', 'loading', 'stale', 'denied', 'unavailable', 'error']), source: z.string(), data: z.unknown().optional() })
const snapshotResult = z.looseObject({
  sessionId,
  workspaceRoot: z.string(),
  projectName: z.string(),
  backend: z.enum(['disabled', 'ready']),
  context: toolResult.nullable(),
  diagnostics: toolResult.nullable(),
})
const eventGraph = z.custom<EventGraph>(value => {
  if (typeof value !== 'object' || value === null) return false
  const graph = value as { nodes?: unknown; edges?: unknown }
  return Array.isArray(graph.nodes) && graph.nodes.length <= 1000 && graph.nodes.every(node => {
    if (typeof node !== 'object' || node === null) return false
    const item = node as Record<string, unknown>
    return typeof item.id === 'string' && typeof item.type === 'string' && typeof item.file === 'string' && typeof item.line === 'number' && Number.isInteger(item.line) && typeof item.endLine === 'number' && Number.isInteger(item.endLine) && typeof item.namespace === 'string' && Array.isArray(item.semanticReferences)
  }) && Array.isArray(graph.edges) && graph.edges.length <= 10_000 && graph.edges.every(edge => {
    if (typeof edge !== 'object' || edge === null) return false
    const item = edge as Record<string, unknown>
    return typeof item.source === 'string' && typeof item.target === 'string' && typeof item.edgeType === 'string'
  })
})
const eventResult = z.looseObject({ filePath: z.string(), graph: eventGraph, seedIds: z.array(z.string()).max(1000), catalogStatus: z.enum(['ready', 'partial', 'unavailable']), warnings: z.array(z.string()) })
const shipDocument = z.custom<CwtoolsShipDesignDocument>(value => {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  const catalog = item.catalog as Record<string, unknown> | undefined
  return typeof item.filePath === 'string' && Array.isArray(item.designs) && item.designs.length <= 50 && item.designs.every(design => typeof design === 'object' && design !== null && 'design' in design && 'view' in design && 'stats' in design) && Array.isArray(item.warnings) && !!catalog && ['shipSizes', 'roles', 'cultures', 'technologies', 'sections', 'components'].every(key => Array.isArray(catalog[key]))
})
const shipAsset = z.custom<CwtoolsShipDesignAssetDocument>(value => {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  const validAsset = (asset: unknown, depth: number): boolean => {
    if (depth > 8 || typeof asset !== 'object' || asset === null) return false
    const row = asset as Record<string, unknown>
    return typeof row.name === 'string' && Array.isArray(row.locators) && Array.isArray(row.meshSettings) && Array.isArray(row.attaches) && row.attaches.every(child => typeof child === 'object' && child !== null && validAsset((child as {entity?:unknown}).entity, depth + 1))
  }
  return typeof item.nodeId === 'string' && Array.isArray(item.warnings) && (item.asset === undefined || validAsset(item.asset, 0))
})
const jsonCodec = <T>(typeSymbol: string, schema: z.ZodType<T>) => ({ mode: 'strict' as const, typeSymbol, create: () => schema })

function descriptor(method: 'snapshot' | 'execute' | 'write' | 'read' | 'asset' | 'gui' | 'event' | 'ship' | 'shipAsset'): InvocationDescriptor {
  const parameters: InvocationDescriptor['parameters'] = [{
    name: 'sessionId', wire: 'sessionId', source: 'json',
    codec: jsonCodec('dsh-cwtools#SessionId', sessionId),
  }, ...(method === 'execute' || method === 'write') ? [{
    name: 'name', wire: 'name', source: 'json' as const,
    codec: jsonCodec('dsh-cwtools#ToolName', z.string().min(1).max(160)),
  }, {
    name: 'args', wire: 'args', source: 'json' as const,
    codec: jsonCodec('dsh-cwtools#ToolArguments', z.record(z.string(), z.unknown())),
  }] : [], ...(method === 'read'||method === 'asset'||method === 'gui'||method === 'event'||method === 'ship'||method === 'shipAsset') ? [{
    name: 'filePath', wire: 'filePath', source: 'json' as const,
    codec: jsonCodec('dsh-cwtools#EditorPath', z.string().min(1).max(1000)),
  }] : [], ...method === 'shipAsset' ? [{
    name: 'nodeId', wire: 'nodeId', source: 'json' as const,
    codec: jsonCodec('dsh-cwtools#ShipNodeId', z.string().min(1).max(512)),
  }] : []]
  return {
    id: `dsh-cwtools#cwtoolsWorkbench/${method}`,
    service: 'cwtoolsWorkbench', namespace: 'cwtoolsWorkbench', method,
    invocation: { kind: 'direct' }, parameters,
    cancellation: { parameter: 'signal' },
    result: method === 'snapshot'
      ? jsonCodec<CwtoolsWorkbenchHostSnapshot>('dsh-cwtools#WorkbenchSnapshot', snapshotResult)
      : method === 'ship'
        ? jsonCodec<CwtoolsShipDesignDocument>('dsh-cwtools#ShipDesignDocument', shipDocument)
        : method === 'shipAsset'
          ? jsonCodec<CwtoolsShipDesignAssetDocument>('dsh-cwtools#ShipDesignAssetDocument', shipAsset)
          : method === 'event'
        ? jsonCodec<CwtoolsEventGraphDocument>('dsh-cwtools#EventGraphDocument', eventResult)
        : method === 'read'
        ? jsonCodec<CwtoolsWorkbenchDocument>('dsh-cwtools#WorkbenchDocument', z.looseObject({ filePath: z.string(), content: z.string() }))
        : method === 'gui'
          ? jsonCodec<CwtoolsGuiDocument>('dsh-cwtools#GuiDocument',z.looseObject({filePath:z.string(),elements:guiElements,warnings:z.array(z.string())}))
          : method === 'asset'
          ? jsonCodec<CwtoolsWorkbenchAsset>('dsh-cwtools#WorkbenchAsset',z.looseObject({filePath:z.string(),mime:z.string(),base64:z.string()}))
          : jsonCodec('dsh-cwtools#SharedToolResult', toolResult),
  }
}

export const CWTOOLS_WORKBENCH_REMOTE = {
  package: 'dsh-cwtools',
  descriptors: [descriptor('snapshot'), descriptor('read'), descriptor('asset'), descriptor('gui'), descriptor('event'), descriptor('ship'), descriptor('shipAsset'), descriptor('execute'), descriptor('write')],
}