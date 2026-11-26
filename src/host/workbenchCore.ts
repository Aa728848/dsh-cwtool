import path from 'node:path'
import { createHash } from 'node:crypto'
import { decodeDds, decodeTga } from 'cwtools-node'
import { realpath, open, readFile, readdir, stat } from 'node:fs/promises'
import { TextDecoder } from 'node:util'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-sandbox-policy'
import type {} from '@deepseek-ai/dsh-session'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { isPathInsideOrEqual, resolveWorkspacePath } from 'cwtools-shared'
import { buildSpriteIndex, parseGuiFile, parsePdxSemanticCatalog, type GuiElement } from 'cwtools-shared/editors'
import type { SharedToolResult } from 'cwtools-shared'
import { isCwtoolsReadToolName } from '../contract/toolCatalog.ts'
import type { CwtoolsEventGraphDocument, CwtoolsGuiDocument, CwtoolsShipDesignAssetDocument, CwtoolsShipDesignDocument, CwtoolsWorkbenchAsset, CwtoolsWorkbenchDocument, CwtoolsWorkbenchHostSnapshot } from '../contract/workbench.ts'
import { buildWorkspaceEventGraph } from './eventGraph.ts'
import { loadShipDesignHostSession, type ShipDesignHostSession } from './shipDesign.ts'
import type { CwtoolsRuntimePool } from './runtime.ts'

export interface CwtoolsWorkbenchRuntimeRef { current: CwtoolsRuntimePool | undefined }

/** Decorator-free business core, independently testable from the Remote transport shell. */
export class CwtoolsWorkbenchCore {
  private readonly shipSessions=new Map<string,{hash:string;session:ShipDesignHostSession}>()
  constructor(private readonly ctx: Context, private readonly runtime: CwtoolsWorkbenchRuntimeRef) {}

  private workspaceRoot(sessionId: SessionId): string {
    if (typeof sessionId !== 'string' || sessionId.length === 0 || sessionId.length > 256) {
      throw new RemoteError('cwtools-workbench/session-required', 'A valid Session id is required.', {})
    }
    const session = this.ctx.get('sessions')?.get(sessionId)
    const policy = this.ctx.get('sandboxPolicy')
    if (session === undefined || policy === undefined) {
      throw new RemoteError('cwtools-workbench/session-required', 'The selected Session is not active on this Host.', { sessionId })
    }
    return policy.resolve({ session }).workspaceRoot
  }

  private pool(sessionId: SessionId): { root: string; runtime: CwtoolsRuntimePool } {
    const root = this.workspaceRoot(sessionId)
    const runtime = this.runtime.current
    if (runtime === undefined) {
      throw new RemoteError('cwtools-workbench/disabled', 'CWTools is disabled or still reloading its configuration.', { sessionId })
    }
    return { root, runtime }
  }

  private async shipSession(sessionId:SessionId,filePath:string,signal:AbortSignal):Promise<ShipDesignHostSession>{
    const document=await this.read(sessionId,filePath,signal);if(!document.filePath.toLowerCase().endsWith('.txt'))throw new RemoteError('cwtools-workbench/bad-request','A .txt ship design document is required.',{name:'ship'})
    const root=this.workspaceRoot(sessionId);const roots=this.runtime.current?.resourceRoots(root)??[root];const hash=createHash('sha256').update(document.content).digest('hex');const key=root+'\0'+document.filePath;const cached=this.shipSessions.get(key)
    if(cached?.hash===hash)return cached.session
    const session=await loadShipDesignHostSession(roots,document.filePath,document.content,signal);this.shipSessions.delete(key);this.shipSessions.set(key,{hash,session})
    while(this.shipSessions.size>4){const oldest=this.shipSessions.keys().next().value;if(typeof oldest!=='string')break;this.shipSessions.delete(oldest)}
    return session
  }

  async ship(sessionId:SessionId,filePath:string,signal:AbortSignal):Promise<CwtoolsShipDesignDocument>{return (await this.shipSession(sessionId,filePath,signal)).document}

  async shipAsset(sessionId:SessionId,filePath:string,nodeId:string,signal:AbortSignal):Promise<CwtoolsShipDesignAssetDocument>{
    if(typeof nodeId!=='string'||nodeId.length<1||nodeId.length>512)throw new RemoteError('cwtools-workbench/bad-request','A valid ship model node id is required.',{name:'shipAsset'})
    const session=await this.shipSession(sessionId,filePath,signal);const node=session.document.designs.flatMap(item=>item.view.model).find(item=>item.id===nodeId)
    if(!node?.entityName)return{nodeId,warnings:['The selected model node has no resolvable entity.']}
    const resolved=await session.resources.load(node.entityName);return{nodeId,asset:resolved.asset,warnings:resolved.warnings}
  }

  async event(sessionId:SessionId,filePath:string,signal:AbortSignal):Promise<CwtoolsEventGraphDocument>{
    const document=await this.read(sessionId,filePath,signal)
    if(!document.filePath.toLowerCase().endsWith('.txt'))throw new RemoteError('cwtools-workbench/bad-request','A .txt event document is required.',{name:'event'})
    const {root,runtime}=this.pool(sessionId)
    const raw=await runtime.execute('get_semantic_catalog',{},root,signal)
    const catalog=raw.ok?parsePdxSemanticCatalog(raw.data):undefined
    if(!catalog||catalog.status==='unavailable')return{filePath:document.filePath,graph:{nodes:[],edges:[]},seedIds:[],catalogStatus:'unavailable',warnings:[raw.ok?'The CWTools semantic catalog is not ready.':raw.error?.message??'The CWTools semantic catalog is unavailable.']}
    const built=await buildWorkspaceEventGraph({root,sessionId,seedPath:document.filePath,seedContent:document.content,catalog,signal,read:(id,file,abort)=>this.read(id,file,abort)})
    return{filePath:document.filePath,graph:built.graph,seedIds:built.seedIds,catalogStatus:catalog.status,warnings:built.warnings}
  }

  async gui(sessionId:SessionId,filePath:string,signal:AbortSignal):Promise<CwtoolsGuiDocument>{
    const document=await this.read(sessionId,filePath,signal);if(!document.filePath.toLowerCase().endsWith('.gui'))throw new RemoteError('cwtools-workbench/bad-request','A .gui document is required.',{name:'gui'});const root=this.workspaceRoot(sessionId);const gfxFiles:string[]=[];const interfaceRoot=path.join(root,'interface');
    const scan=async(dir:string,depth:number):Promise<void>=>{if(depth>8||gfxFiles.length>=200)return;const entries=await readdir(dir,{withFileTypes:true}).catch(()=>[]);entries.sort((a,b)=>a.name.localeCompare(b.name));for(const entry of entries){const target=path.join(dir,entry.name);if(entry.isDirectory())await scan(target,depth+1);else if(entry.isFile()&&entry.name.toLowerCase().endsWith('.gfx')){gfxFiles.push(target);if(gfxFiles.length>=200)return}}};await scan(interfaceRoot,0);
    const gfx=[];for(const file of gfxFiles){gfx.push({path:file,content:await readFile(file,'utf8')})}const sprites=buildSpriteIndex(gfx);const parsed=parseGuiFile(document.content,sprites);let textures=0;let bytes=0;let missing=0;const seen=new Set<string>();
    const visit=async(items:GuiElement[]):Promise<void>=>{for(const item of items){if(item.spriteTexture&&!seen.has(item.spriteTexture)&&textures<48&&bytes<16_000_000){seen.add(item.spriteTexture);try{const asset=await this.asset(sessionId,item.spriteTexture,signal);if(asset.base64.length+bytes<=16_000_000){item.captureTexture=`data:${asset.mime};base64,${asset.base64}`;bytes+=asset.base64.length;textures++}}catch{missing++}}await visit(item.children)}};await visit(parsed);const warnings=missing>0?[`${missing} sprite texture(s) were unavailable, outside the workspace, or undecodable.`]:[];return{filePath:document.filePath,elements:parsed,warnings}
  }

  async asset(sessionId:SessionId,filePath:string,signal:AbortSignal):Promise<CwtoolsWorkbenchAsset>{
    const root=this.workspaceRoot(sessionId);const extension=path.extname(filePath).toLowerCase()
    if(!['.mesh','.png','.jpg','.jpeg','.dds','.tga'].includes(extension))throw new RemoteError('cwtools-workbench/bad-request','A workspace or configured vanilla mesh/texture asset is required.',{name:'asset'})
    const roots=this.runtime.current?.resourceRoots(root)??[root]
    for(const candidateRoot of roots){
      if(signal.aborted)throw signal.reason
      const resolution=resolveWorkspacePath(candidateRoot,filePath)
      if(!resolution.ok||!resolution.resolvedPath||!resolution.relativePath)throw new RemoteError('cwtools-workbench/bad-request','The asset path must stay inside an authorized resource root.',{name:'asset'})
      const [realRoot,realTarget]=await Promise.all([realpath(candidateRoot),realpath(resolution.resolvedPath)]).catch(()=>[])
      if(typeof realRoot!=='string'||typeof realTarget!=='string')continue
      if(!isPathInsideOrEqual(realRoot,realTarget))throw new RemoteError('cwtools-workbench/bad-request','The asset resolves outside its authorized resource root.',{name:'asset'})
      const info=await stat(realTarget).catch(()=>undefined);if(!info?.isFile())continue
      if(info.size>32_000_000)throw new RemoteError('cwtools-workbench/bad-request','Scene assets are limited to 32,000,000 bytes.',{name:'asset'})
      if(extension==='.dds'||extension==='.tga'){const decoded=extension==='.dds'?decodeDds(realTarget):decodeTga(realTarget);if(!decoded)throw new RemoteError('cwtools-workbench/bad-request','The DDS/TGA texture could not be decoded.',{name:'asset'});return{filePath:resolution.relativePath,mime:'image/png',base64:decoded.dataUri.split(',')[1]??''}}
      const bytes=await readFile(realTarget);const mime=extension==='.png'?'image/png':extension==='.mesh'?'application/octet-stream':'image/jpeg';return{filePath:resolution.relativePath,mime,base64:bytes.toString('base64')}
    }
    throw new RemoteError('cwtools-workbench/bad-request','The asset does not exist in the workspace or configured vanilla resource root.',{name:'asset'})
  }

  async read(sessionId: SessionId, filePath: string, signal: AbortSignal): Promise<CwtoolsWorkbenchDocument> {
    const root = this.workspaceRoot(sessionId)
    const resolution = resolveWorkspacePath(root, filePath)
    if (!resolution.ok || resolution.resolvedPath === undefined || resolution.relativePath === undefined || !/\.(?:txt|asset|gfx|gui)$/i.test(resolution.resolvedPath)) {
      throw new RemoteError('cwtools-workbench/bad-request', 'A workspace-contained .txt, .asset, .gfx, or .gui file is required.', { name: 'read' })
    }
    const [realRoot, realTarget] = await Promise.all([realpath(root), realpath(resolution.resolvedPath)])
    if (!isPathInsideOrEqual(realRoot, realTarget)) {
      throw new RemoteError('cwtools-workbench/bad-request', 'The editor document resolves outside the workspace.', { name: 'read' })
    }
    if (signal.aborted) throw signal.reason
    const handle = await open(realTarget, 'r')
    try {
      const stat = await handle.stat()
      if (stat.size > 2_000_000) throw new RemoteError('cwtools-workbench/bad-request', 'Editor documents are limited to 2,000,000 bytes.', { name: 'read' })
      const buffer = Buffer.alloc(Math.max(1, stat.size))
      await handle.read(buffer, 0, buffer.length, 0)
      const content = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
      return { filePath: resolution.relativePath, content }
    } finally { await handle.close() }
  }

  async snapshot(sessionId: SessionId, signal: AbortSignal): Promise<CwtoolsWorkbenchHostSnapshot> {
    const root = this.workspaceRoot(sessionId)
    const runtime = this.runtime.current
    if (runtime === undefined) {
      return { sessionId, workspaceRoot: root, projectName: path.basename(root), backend: 'disabled', context: null, diagnostics: null }
    }
    const [context, diagnostics] = await Promise.all([
      runtime.execute('get_ide_context', {}, root, signal),
      runtime.execute('get_diagnostics', {}, root, signal),
    ])
    return { sessionId, workspaceRoot: root, projectName: path.basename(root), backend: 'ready', context, diagnostics }
  }

  async execute(sessionId: SessionId, name: string, args: Record<string, unknown>, signal: AbortSignal): Promise<SharedToolResult> {
    if (!isCwtoolsReadToolName(name)) {
      throw new RemoteError('cwtools-workbench/read-only', 'The Workbench execute endpoint only exposes configured read-only CWTools tools.', { name })
    }
    if (typeof args !== 'object' || args === null || Array.isArray(args)) {
      throw new RemoteError('cwtools-workbench/bad-request', 'Tool arguments must be an object.', { name })
    }
    const { root, runtime } = this.pool(sessionId)
    return await runtime.execute(name, args, root, signal)
  }

  async write(sessionId: SessionId, name: string, args: Record<string, unknown>, signal: AbortSignal): Promise<SharedToolResult> {
    if (!['write_localisation','gui_draft','ship_design_draft','static_galaxy_draft'].includes(name)) {
      throw new RemoteError('cwtools-workbench/read-only', 'The Workbench write facade only allows explicitly configured domain editors.', { name })
    }
    if (typeof args !== 'object' || args === null || Array.isArray(args)) {
      throw new RemoteError('cwtools-workbench/bad-request', 'Tool arguments must be an object.', { name })
    }
    const { root, runtime } = this.pool(sessionId)
    return await runtime.execute(name, args, root, signal)
  }
}