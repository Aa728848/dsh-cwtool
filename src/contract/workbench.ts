import type { SharedToolResult } from 'cwtools-shared'
import type { EventGraph, GuiElement, ShipDesignData, ShipDesignEntityAssetData, ShipDesignIconData, ShipDesignStatsData, ShipDesignViewData } from 'cwtools-shared/editors'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    'cwtools-workbench/session-required': { readonly sessionId?: string }
    'cwtools-workbench/disabled': { readonly sessionId: string }
    'cwtools-workbench/read-only': { readonly name: string }
    'cwtools-workbench/bad-request': { readonly name: string }
  }
}

export interface CwtoolsWorkbenchHostSnapshot {
  readonly sessionId: SessionId
  readonly workspaceRoot: string
  readonly projectName: string
  readonly backend: 'disabled' | 'ready'
  readonly context: SharedToolResult | null
  readonly diagnostics: SharedToolResult | null
}

export interface CwtoolsWorkbenchDocument {
  readonly filePath: string
  readonly content: string
}

export interface CwtoolsGuiDocument { readonly filePath:string;readonly elements:GuiElement[];readonly warnings:string[] }

export interface CwtoolsWorkbenchAsset { readonly filePath:string;readonly mime:string;readonly base64:string }
export interface CwtoolsEventGraphDocument { readonly filePath:string;readonly graph:EventGraph;readonly seedIds:string[];readonly catalogStatus:'ready'|'partial'|'unavailable';readonly warnings:string[] }
export interface CwtoolsShipDesignSnapshot { readonly design:ShipDesignData;readonly view:ShipDesignViewData;readonly stats:ShipDesignStatsData }
export interface CwtoolsShipCatalogOptions { readonly shipSizes:string[];readonly roles:string[];readonly cultures:string[];readonly technologies:string[];readonly sections:Array<{key:string;shipSizes:string[];fitsOnSlots:string[]}>;readonly components:Array<{key:string;kind:string;size:string;componentSet?:string;upgradesTo?:string;icon?:ShipDesignIconData}> }
export interface CwtoolsShipDesignDocument { readonly filePath:string;readonly designs:CwtoolsShipDesignSnapshot[];readonly catalog:CwtoolsShipCatalogOptions;readonly warnings:string[] }
export interface CwtoolsShipDesignAssetDocument { readonly nodeId:string;readonly asset?:ShipDesignEntityAssetData;readonly warnings:string[] }

export interface CwtoolsWorkbenchRemote {
  ship(sessionId:SessionId,filePath:string,signal?:AbortSignal):Promise<import('@deepseek-ai/dsh-typert-protocol').RemoteResult<CwtoolsShipDesignDocument>>
  shipAsset(sessionId:SessionId,filePath:string,nodeId:string,signal?:AbortSignal):Promise<import('@deepseek-ai/dsh-typert-protocol').RemoteResult<CwtoolsShipDesignAssetDocument>>
  event(sessionId:SessionId,filePath:string,signal?:AbortSignal):Promise<import('@deepseek-ai/dsh-typert-protocol').RemoteResult<CwtoolsEventGraphDocument>>
  gui(sessionId:SessionId,filePath:string,signal?:AbortSignal):Promise<import('@deepseek-ai/dsh-typert-protocol').RemoteResult<CwtoolsGuiDocument>>
  asset(sessionId:SessionId,filePath:string,signal?:AbortSignal):Promise<import('@deepseek-ai/dsh-typert-protocol').RemoteResult<CwtoolsWorkbenchAsset>>
  read(sessionId: SessionId, filePath: string, signal?: AbortSignal): Promise<import('@deepseek-ai/dsh-typert-protocol').RemoteResult<CwtoolsWorkbenchDocument>>
  snapshot(sessionId: SessionId, signal?: AbortSignal): Promise<import('@deepseek-ai/dsh-typert-protocol').RemoteResult<CwtoolsWorkbenchHostSnapshot>>
  execute(sessionId: SessionId, name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<import('@deepseek-ai/dsh-typert-protocol').RemoteResult<SharedToolResult>>
  write(sessionId: SessionId, name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<import('@deepseek-ai/dsh-typert-protocol').RemoteResult<SharedToolResult>>
}