import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { SharedToolResult } from 'cwtools-shared'
import type { CwtoolsEventGraphDocument, CwtoolsGuiDocument, CwtoolsShipDesignAssetDocument, CwtoolsShipDesignDocument, CwtoolsWorkbenchAsset, CwtoolsWorkbenchDocument, CwtoolsWorkbenchHostSnapshot } from '../contract/workbench.ts'
import { CwtoolsWorkbenchCore, type CwtoolsWorkbenchRuntimeRef } from './workbenchCore.ts'

export type { CwtoolsWorkbenchRuntimeRef } from './workbenchCore.ts'

/** Session-confined Remote facade over the same runtime pool used by Agent tools. */
export class CwtoolsWorkbenchService extends TypertRemoteService {
  static inject = ['sessions', 'sandboxPolicy']
  private readonly core: CwtoolsWorkbenchCore

  constructor(ctx: Context, runtime: CwtoolsWorkbenchRuntimeRef) {
    super(ctx, 'cwtoolsWorkbench')
    this.core = new CwtoolsWorkbenchCore(ctx, runtime)
  }

  @Remote({ resources: { session: (sessionId: SessionId) => sessionId } })
  async ship(sessionId:SessionId,filePath:string,signal:AbortSignal):Promise<CwtoolsShipDesignDocument>{return await this.core.ship(sessionId,filePath,signal)}

  @Remote({ resources: { session: (sessionId: SessionId) => sessionId } })
  async shipAsset(sessionId:SessionId,filePath:string,nodeId:string,signal:AbortSignal):Promise<CwtoolsShipDesignAssetDocument>{return await this.core.shipAsset(sessionId,filePath,nodeId,signal)}

  @Remote({ resources: { session: (sessionId: SessionId) => sessionId } })
  async event(sessionId:SessionId,filePath:string,signal:AbortSignal):Promise<CwtoolsEventGraphDocument>{return await this.core.event(sessionId,filePath,signal)}

  @Remote({ resources: { session: (sessionId: SessionId) => sessionId } })
  async gui(sessionId:SessionId,filePath:string,signal:AbortSignal):Promise<CwtoolsGuiDocument>{return await this.core.gui(sessionId,filePath,signal)}

  @Remote({ resources: { session: (sessionId: SessionId) => sessionId } })
  async asset(sessionId:SessionId,filePath:string,signal:AbortSignal):Promise<CwtoolsWorkbenchAsset>{return await this.core.asset(sessionId,filePath,signal)}

  @Remote({ resources: { session: (sessionId: SessionId) => sessionId } })
  async read(sessionId: SessionId, filePath: string, signal: AbortSignal): Promise<CwtoolsWorkbenchDocument> {
    return await this.core.read(sessionId, filePath, signal)
  }

  @Remote({ resources: { session: (sessionId: SessionId) => sessionId } })
  async snapshot(sessionId: SessionId, signal: AbortSignal): Promise<CwtoolsWorkbenchHostSnapshot> {
    return await this.core.snapshot(sessionId, signal)
  }

  @Remote({ resources: { session: (sessionId: SessionId) => sessionId } })
  async execute(sessionId: SessionId, name: string, args: Record<string, unknown>, signal: AbortSignal): Promise<SharedToolResult> {
    return await this.core.execute(sessionId, name, args, signal)
  }

  @Remote({ resources: { session: (sessionId: SessionId) => sessionId } })
  async write(sessionId: SessionId, name: string, args: Record<string, unknown>, signal: AbortSignal): Promise<SharedToolResult> {
    return await this.core.write(sessionId, name, args, signal)
  }
}

export default CwtoolsWorkbenchService