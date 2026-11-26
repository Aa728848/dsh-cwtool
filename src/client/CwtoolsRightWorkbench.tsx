import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SegmentedTabs, Tag, type SegmentedTab } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { parseAssetFile, parseEventFile, parseGuiFile, parseParticleFile, parseShipDesignDocument, parseSolarSystemFile, parseStaticGalaxy, parseTechFile, type EntityDefinition, type GuiElement, type ParticleEffect, type ShipDesignData, type ShipDesignEntityAssetData } from 'cwtools-shared/editors'
import type { SceneAssetLoader } from './three/types.ts'
import type { SharedToolResult } from 'cwtools-shared'
import { EvidenceCenter, LocalisationMatrix, SemanticInspector, type LocalisationRow, type LocalisationSave, type SemanticQueryKind, type SemanticQueryArgs } from './panels/index.ts'
const EntityScene=lazy(()=>import('./three/Scenes.tsx').then(module=>({default:module.EntityScene})))
const ParticleScene=lazy(()=>import('./three/Scenes.tsx').then(module=>({default:module.ParticleScene})))
const ShipScene=lazy(()=>import('./three/Scenes.tsx').then(module=>({default:module.ShipScene})))
const ResolvedShipScene=lazy(()=>import('./three/Scenes.tsx').then(module=>({default:module.ResolvedShipScene})))
import { GuiCanvas, type GuiCanvasChange } from './GuiCanvas.tsx'
import { captureGuiSvg } from './guiEvidence.ts'
import { ShipGalaxyTools } from './ShipGalaxyTools.tsx'
import type { CwtoolsEventGraphDocument, CwtoolsShipDesignAssetDocument, CwtoolsShipDesignDocument, CwtoolsWorkbenchHostSnapshot, CwtoolsWorkbenchRemote } from '../contract/workbench.ts'
import { EMPTY_WORKBENCH, WORKBENCH_PREVIEW, workbenchFromHost, type WorkbenchSnapshot } from './workbenchModel.ts'
import { NativeEditorView, type NativeEditorData } from './NativeEditorView.tsx'
import type { CwtoolsWorkbenchLocaleKey } from './workbenchLocales.ts'
import css from './CwtoolsRightWorkbench.module.css'

type Tab = 'preview'|'edit'|'diagnostics'|'tools'
type Exec = (name: string,args: Record<string,unknown>)=>Promise<unknown>
export interface CwtoolsRightWorkbenchFace { readonly remote: CwtoolsWorkbenchRemote }
export type CwtoolsRightWorkbenchProps = PropsRuntime<'sidebar.right.pane.tab'> & PropsLocale<'workbench.cwtools'> & InjectFace<CwtoolsRightWorkbenchFace>

interface ViewProps {
  readonly t:(key:CwtoolsWorkbenchLocaleKey)=>string; readonly data:WorkbenchSnapshot; readonly live:boolean
  readonly onExecute?:Exec; readonly onWrite?:Exec; readonly onRead?:(file:string)=>Promise<{filePath:string;content:string}>; readonly onRefresh?:()=>void;readonly onAsset?:(file:string)=>Promise<{mime:string;base64:string}>;readonly onGui?:(file:string)=>Promise<{elements:GuiElement[];warnings:string[]}>;readonly onEvent?:(file:string)=>Promise<CwtoolsEventGraphDocument>;readonly onShip?:(file:string)=>Promise<CwtoolsShipDesignDocument>;readonly onShipAsset?:(file:string,nodeId:string)=>Promise<CwtoolsShipDesignAssetDocument>
}
const tabs=(t:ViewProps['t']):[SegmentedTab<Tab>,...SegmentedTab<Tab>[]]=>[
  {value:'preview',label:t('design'),id:'cw-preview',panelId:'cw-preview-panel'},{value:'edit',label:t('properties'),id:'cw-edit',panelId:'cw-edit-panel'},{value:'diagnostics',label:t('diagnostics'),id:'cw-diagnostics',panelId:'cw-diagnostics-panel'},{value:'tools',label:t('visualTools'),id:'cw-tools',panelId:'cw-tools-panel'},
]

export function CwtoolsRightWorkbenchView({t,data,live,onExecute,onWrite,onRead,onRefresh,onAsset,onGui,onEvent,onShip,onShipAsset}:ViewProps){
  const [tab,setTab]=useState<Tab>('preview');const [output,setOutput]=useState('');const [native,setNative]=useState<NativeEditorData>();
  const [guiElements,setGuiElements]=useState<readonly GuiElement[]>([]);const originalGui=useRef<readonly GuiElement[]>([]);const svgRef=useRef<SVGSVGElement|null>(null);
  const [particleEffect,setParticleEffect]=useState<ParticleEffect>();const [particleTextures,setParticleTextures]=useState<Record<string,string>>({});const [scene,setScene]=useState<'entity'|'particle'|'ship'>();const [shipDesign,setShipDesign]=useState<ShipDesignData>();const[shipDocument,setShipDocument]=useState<CwtoolsShipDesignDocument>();const[shipAssets,setShipAssets]=useState<Record<string,ShipDesignEntityAssetData>>({});
  const sceneLoader=useMemo<SceneAssetLoader|undefined>(()=>onAsset?{loadMesh:async file=>{const asset=await onAsset(file);const bytes=Uint8Array.from(atob(asset.base64),char=>char.charCodeAt(0));return bytes.buffer},loadTextureUrl:async file=>{const asset=await onAsset(file);return`data:${asset.mime};base64,${asset.base64}`}}:undefined,[onAsset]);
  const [selectedLine,setSelectedLine]=useState<number>();const [beforeImage,setBeforeImage]=useState('');const [afterImage,setAfterImage]=useState('');const [diffRatio,setDiffRatio]=useState('');
  const [undoStack,setUndoStack]=useState<{line:number;change:GuiCanvasChange}[]>([]);
  const [documentPath,setDocumentPath]=useState(data.filePath);useEffect(()=>{setDocumentPath(data.filePath)},[data.filePath]);
  const [busy,setBusy]=useState(false);const [query,setQuery]=useState('');const [locValue,setLocValue]=useState('');
  const [locRows,setLocRows]=useState<LocalisationRow[]>([]);const [languages,setLanguages]=useState<string[]>(['l_english']);
  const [locFile,setLocFile]=useState('localisation/english/workbench_l_english.yml');const [language,setLanguage]=useState('l_english');
  const [draftId,setDraftId]=useState('');const [line,setLine]=useState('');const [x,setX]=useState('');const [y,setY]=useState('');const [width,setWidth]=useState('');const [height,setHeight]=useState('');
  const call=async(fn:Exec|undefined,name:string,args:Record<string,unknown>):Promise<unknown>=>{if(!fn)return undefined;setBusy(true);try{const result=await fn(name,args);setOutput(JSON.stringify(result,null,2));return result}catch(error){setOutput(error instanceof Error?error.message:String(error));return undefined}finally{setBusy(false)}};
  const refreshShip=async():Promise<void>=>{if(!onShip)return;const built=await onShip(documentPath);setShipDocument(built);setShipDesign(built.designs[0]?.design);setOutput(built.warnings.join('\n'));if(!built.designs[0])throw new Error('No ship design found.')}
  const nativeOpen=async(kind:'tech'|'event'|'galaxy'|'entity'|'solar'|'gui'|'particle'|'ship')=>{
    if(!onRead)return;setBusy(true);setOutput('');setNative(undefined);setGuiElements([]);setParticleEffect(undefined);setShipDocument(undefined);setShipAssets({});setScene(undefined)
    try{
      const doc=await onRead(documentPath)
      if(kind==='gui'){
        const gui=onGui?await onGui(documentPath):undefined;const parsed=gui?.elements??parseGuiFile(doc.content,new Map());if(gui?.warnings.length)setOutput(gui.warnings.join('\n'));originalGui.current=parsed;setGuiElements(parsed);setSelectedLine(undefined);setBeforeImage('');setAfterImage('');setDiffRatio('')
        setTimeout(()=>{if(svgRef.current)void captureGuiSvg(svgRef.current).then(result=>{setBeforeImage(result.dataUrl)}).catch((error:unknown)=>{setOutput(error instanceof Error?error.message:String(error))})},0)
      }else if(kind==='ship'){
        if(onShip)await refreshShip()
        else{const parsed=parseShipDesignDocument(doc.content);setShipDesign(parsed.designs[0]);setOutput(JSON.stringify(parsed.diagnostics));if(!parsed.designs[0])throw new Error('No ship design found.')}
      }else if(kind==='particle'){const parsed=parseParticleFile(doc.content,doc.filePath);if(parsed.diagnostics.length)setOutput(JSON.stringify(parsed.diagnostics));const effect=parsed.effects[0];setParticleEffect(effect);if(!effect)throw new Error('No particle effect found.');if(onAsset){const entries=await Promise.all(effect.subsystems.filter(item=>item.texture?.file&&true).map(async item=>{try{const asset=await onAsset(item.texture!.file);return[item.texture!.file,`data:${asset.mime};base64,${asset.base64}`]as const}catch{return null}}));setParticleTextures(Object.fromEntries(entries.filter(entry=>entry!==null)))}
      }else if(kind==='tech')setNative({kind,graph:parseTechFile(doc.content,doc.filePath)})
      else if(kind==='event'){
        if(onEvent){const built=await onEvent(documentPath);setNative({kind,graph:built.graph});if(built.warnings.length)setOutput(built.warnings.join('\n'))}
        else setNative({kind,graph:parseEventFile(doc.content,doc.filePath,{status:'unavailable',source:'cwt_fallback',rules:[],definitionTypes:[],warnings:['Preview-only single-file semantic fallback']})})
      }
      else if(kind==='galaxy'){const result=parseStaticGalaxy(doc.content);if(!result.ok)throw new Error(result.error);setNative({kind,result})}
      else if(kind==='solar')setNative({kind,systems:parseSolarSystemFile(doc.content)})
      else setNative({kind,entities:parseAssetFile(doc.content,doc.filePath).entities})
    }catch(error){setNative(undefined);setGuiElements([]);setOutput(error instanceof Error?error.message:String(error))}finally{setBusy(false)}
  };
  const applyDraft=(result:unknown)=>{if(typeof result==='object'&&result!==null&&'data'in result){const payload=(result as{data?:unknown}).data;if(typeof payload==='object'&&payload!==null&&'elements'in payload&&Array.isArray((payload as{elements?:unknown}).elements))setGuiElements((payload as{elements:readonly GuiElement[]}).elements)}}
  const draft=async(action:'begin'|'update'|'validate'|'commit'|'discard'):Promise<string|undefined>=>{
    const args:Record<string,unknown>={action,filePath:documentPath};if(draftId)args.transactionId=draftId
    if(action==='update'){args.line=Number(line);if(x)args.x=Number(x);if(y)args.y=Number(y);if(width)args.width=Number(width);if(height)args.height=Number(height)}
    const result=await call(onWrite,'gui_draft',args);applyDraft(result);let id:string|undefined=draftId
    if(action==='begin'&&typeof result==='object'&&result!==null&&'data'in result){const payload=(result as{data?:unknown}).data;if(typeof payload==='object'&&payload!==null&&'transactionId'in payload&&typeof(payload as{transactionId?:unknown}).transactionId==='string'){id=(payload as{transactionId:string}).transactionId;setDraftId(id)}}
    if(action==='commit'||action==='discard'){id=undefined;setDraftId('')}return id
  }
  const commitCanvas=async(lineNumber:number,change:GuiCanvasChange,record=true)=>{
    if(record){const visit=(items:readonly GuiElement[]):GuiElement|undefined=>{for(const item of items){if(item.line===lineNumber)return item;const found=visit(item.children);if(found)return found}return undefined};const current=visit(guiElements);if(current)setUndoStack(stack=>[...stack.slice(-31),{line:lineNumber,change:{x:current.position.x,y:current.position.y,width:current.size.width,height:current.size.height}}])}
    const id=draftId||await draft('begin');if(!id)return;const result=await call(onWrite,'gui_draft',{action:'update',filePath:documentPath,transactionId:id,line:lineNumber,x:change.x,y:change.y,width:change.width,height:change.height});applyDraft(result)
  }
  const undo=()=>{const previous=undoStack.at(-1);if(previous){setUndoStack(stack=>stack.slice(0,-1));void commitCanvas(previous.line,previous.change,false)}}
  const commitDraft=async()=>{if(svgRef.current)try{const result=await captureGuiSvg(svgRef.current,beforeImage||undefined);setAfterImage(result.dataUrl);setDiffRatio(result.diffRatio??'0.00%')}catch(error){setOutput(error instanceof Error?error.message:String(error))}await draft('commit')}
  const discardDraft=async()=>{await draft('discard');setGuiElements(originalGui.current);setUndoStack([]);setAfterImage('');setDiffRatio('')}
  const queryLocalisation=async()=>{const result=await call(onExecute,'query_localisation_index',{key:query,contains:true,compareLanguages:true,limit:100});if(typeof result==='object'&&result!==null&&'data'in result){const payload=(result as{data?:unknown}).data;if(typeof payload==='object'&&payload!==null&&'entries'in payload&&Array.isArray((payload as{entries?:unknown}).entries)){const entries=(payload as{entries:{key:string;language:string;value:string}[]}).entries;const map=new Map<string,LocalisationRow>();const langs=new Set<string>();for(const entry of entries){const previous=map.get(entry.key);const row:LocalisationRow={key:entry.key,values:{...previous?.values,[entry.language]:entry.value}};map.set(entry.key,row);langs.add(entry.language)}setLocRows([...map.values()]);setLanguages([...langs].sort())}}}
  const saveLocalisation=async(save:LocalisationSave)=>{await call(onWrite,'write_localisation',{filePath:locFile.replace('l_english',save.language),language:save.language,entries:[{key:save.key,value:save.value}]})}
  useEffect(()=>{
    if(scene!=='ship'||!shipDocument||!onShipAsset)return
    let cancelled=false;setShipAssets({});const snapshot=shipDocument.designs.find(item=>item.design.id===shipDesign?.id)??shipDocument.designs[0];const nodes=(snapshot?.view.model??[]).filter(item=>item.entityName).slice(0,64)
    void(async()=>{for(const node of nodes){const resolved=await onShipAsset(documentPath,node.id);if(cancelled)return;if(resolved.asset)setShipAssets(current=>({...current,[node.id]:resolved.asset!}))}})().catch(error=>{if(!cancelled)setOutput(error instanceof Error?error.message:String(error))})
    return()=>{cancelled=true}
  },[scene,shipDocument,shipDesign?.id,onShipAsset,documentPath])
  const semantic=(kind:SemanticQueryKind)=>async(args:SemanticQueryArgs):Promise<SharedToolResult>=>{if(!onExecute)throw new Error('Semantic Remote is unavailable.');return await onExecute(kind,{...args}) as SharedToolResult}
  const panelLocale=t('title')==='CWTools 工作台'?'zh':'en'
  useEffect(()=>{if(!draftId||!onWrite)return;const timer=setInterval(()=>{void call(onWrite,'gui_draft',{action:'status',filePath:documentPath,transactionId:draftId}).then(applyDraft)},5000);return()=>{clearInterval(timer)}},[draftId,documentPath,onWrite]);
  const locateDiagnostic=(location:string)=>{const index=location.lastIndexOf(':');const file=index>0?location.slice(0,index):documentPath;const sourceLine=index>0?Number(location.slice(index+1)):0;setDocumentPath(file);if(onRead&&file.toLowerCase().endsWith('.gui'))void onRead(file).then(doc=>{const parsed=parseGuiFile(doc.content,new Map());const visit=(items:readonly GuiElement[]):GuiElement|undefined=>{for(const item of items){if(sourceLine>=item.line&&sourceLine<=item.endLine)return item;const found=visit(item.children);if(found)return found}return undefined};const selected=visit(parsed);originalGui.current=parsed;setGuiElements(parsed);setSelectedLine(selected?.line);setNative(undefined);setTab('preview')})}
  const ide=(editor:string)=>{void call(onExecute,'open_in_visual_editor',{editor})};
  return <section className={css.pane} aria-label={t('title')} data-cwtools-right-workbench>
    <header className={css.header}><div className={css.heading}><strong>{data.projectName}</strong><Tag>{live?t('live'):t('preview')}</Tag></div><button type='button' className={css.iconButton} onClick={onRefresh} aria-label='Refresh'>↻</button><input className={css.pathInput} aria-label='Workspace document path' value={documentPath} onChange={event=>{setDocumentPath(event.target.value)}} placeholder='interface/example.gui'/></header>
    <div className={css.tabs}><SegmentedTabs items={tabs(t)} value={tab} onChange={setTab} label={t('title')} size='sm' /></div>
    <div className={css.content}>
      {tab==='preview'&&<><div className={css.editorGrid}>{([['tech','Tech Tree'],['event','Event Chain'],['galaxy','Static Galaxy'],['entity','Entity'],['solar','Solar System']]as const).map(([kind,label])=><button type='button' key={kind} disabled={!onRead||busy} onClick={()=>{void nativeOpen(kind)}}>{label}</button>)}<button type='button' disabled={!onRead||busy} onClick={()=>{void nativeOpen('gui')}}>GUI Native</button><button type='button' disabled={!onRead||busy} onClick={()=>{void nativeOpen('entity').then(()=>{setScene('entity')})}}>Entity Native 3D</button><button type='button' disabled={!onRead||busy} onClick={()=>{void nativeOpen('ship').then(()=>{setScene('ship')})}}>Ship Design 3D</button><button type='button' disabled={!onRead||busy} onClick={()=>{void nativeOpen('particle').then(()=>{setScene('particle')})}}>Particle Native 3D</button><button type='button' disabled={!onExecute} onClick={()=>{ide('particle')}}>Particle IDE</button><button type='button' disabled={!onExecute} onClick={()=>{ide('solar_system')}}>Solar 3D</button></div>
        <div className={css.stage}>{scene==='ship'&&shipDocument?<Suspense fallback={<p>Loading resolved ship…</p>}><ResolvedShipScene assets={Object.values(shipAssets)} loader={sceneLoader} className={css.three}/></Suspense>:scene==='ship'&&shipDesign?<Suspense fallback={<p>Loading ship…</p>}><ShipScene ship={{name:shipDesign.name,sections:shipDesign.sections.map((section,index)=>({slot:section.slot,position:[index*2,0,0],entity:{name:section.template,states:[],locators:[],attaches:[],meshSettings:[],line:section.source.startLine,endLine:section.source.endLine,filePath:documentPath}}))}} loader={sceneLoader} className={css.three}/></Suspense>:scene==='entity'&&native?.kind==='entity'&&native.entities[0]?<Suspense fallback={<p>Loading 3D…</p>}><EntityScene entity={native.entities[0]} loader={sceneLoader} className={css.three}/></Suspense>:scene==='particle'&&particleEffect?<Suspense fallback={<p>Loading 3D…</p>}><ParticleScene effect={particleEffect} textures={particleTextures} className={css.three}/></Suspense>:guiElements.length?<GuiCanvas elements={guiElements} selectedLine={selectedLine} onSelect={setSelectedLine} onCommit={(lineNumber,change)=>{void commitCanvas(lineNumber,change)}} svgRef={element=>{svgRef.current=element}}/>:native?<NativeEditorView data={native}/>:data.elements.length?<div className={css.guiStage}>{data.elements.map(element=><div key={element.id} className={element.id==='confirm'?css.guiSelected:css.guiElement} style={{left:`${Math.min(80,element.x/12)}%`,top:`${Math.min(82,element.y/8)}%`}}>{element.name}</div>)}</div>:<div className={css.empty}><strong>{t('noEditor')}</strong><pre>{data.contextText}</pre></div>}</div>
        {(beforeImage||afterImage)&&<EvidenceCenter locale={panelLocale} entries={[{id:'gui-current',title:documentPath,before:beforeImage||undefined,after:afterImage||undefined,pixelRatio:diffRatio?Number.parseFloat(diffRatio):undefined,source:draftId?'Agent / shared draft':'User',version:draftId||undefined}]}/>}</>}
      {tab==='edit'&&<div className={css.form}><h2>{t('guiDraft')}</h2>{!live&&<p>{t('previewNotice')}</p>}<div className={css.row}><button type='button' disabled={!onWrite||busy} onClick={()=>{void draft('begin')}}>Begin</button><code>{draftId||'—'}</code></div><label>Element line<input value={line} onChange={e=>{setLine(e.target.value)}} inputMode='numeric'/></label><div className={css.numeric}>{([['X',x,setX],['Y',y,setY],['W',width,setWidth],['H',height,setHeight]]as const).map(([label,value,set])=><label key={label}>{label}<input value={value} onChange={e=>{set(e.target.value)}} inputMode='decimal'/></label>)}</div><div className={css.row}><button type='button' disabled={!undoStack.length||busy} onClick={undo}>Undo</button><button type='button' disabled={!draftId||!line||busy} onClick={()=>{void draft('update')}}>Update</button><button type='button' disabled={!draftId||busy} onClick={()=>{void draft('validate')}}>Validate</button><button type='button' disabled={!draftId||busy} onClick={()=>{void commitDraft()}}>Commit</button><button type='button' disabled={!draftId||busy} onClick={()=>{void discardDraft()}}>Discard</button></div><pre className={css.output}>{output}</pre></div>}
      {tab==='edit'&&(shipDesign||native?.kind==='galaxy')&&<ShipGalaxyTools documentPath={documentPath} shipDesign={shipDesign} shipStats={(shipDocument?.designs.find(item=>item.design.id===shipDesign?.id)??shipDocument?.designs[0])?.stats} shipCatalog={shipDocument?.catalog} galaxy={native?.kind==='galaxy'?native.result:undefined} onWrite={onWrite} onShipDesign={setShipDesign} onShipRefresh={()=>{void refreshShip()}}/>}
      {tab==='diagnostics'&&<div className={css.diagnostics}>{data.diagnostics.length===0?<p>No diagnostics.</p>:data.diagnostics.map(item=><article key={item.code} role='button' tabIndex={0} onClick={()=>{locateDiagnostic(item.location)}} onKeyDown={event=>{if(event.key==='Enter')locateDiagnostic(item.location)}}><span data-severity={item.severity}>{item.severity}</span><div><strong>{item.code}</strong><p>{item.message}</p><small>{item.location}</small></div></article>)}</div>}
      {tab==='tools'&&<div className={css.form}><h2>{t('localisation')}</h2><label>Key or PDX type<input value={query} onChange={e=>{setQuery(e.target.value)}}/></label><div className={css.row}><button type='button' disabled={!onExecute||busy} onClick={()=>{void queryLocalisation()}}>Query localisation</button><button type='button' disabled={!onExecute||!query||busy} onClick={()=>{void call(onExecute,'query_types',{typeName:query,limit:100})}}>Query type</button></div><label>{t('localisationFile')}<input value={locFile} onChange={e=>{setLocFile(e.target.value)}}/></label><label>{t('localisationLanguage')}<input value={language} onChange={e=>{setLanguage(e.target.value)}}/></label><label>{t('localisationValue')}<textarea value={locValue} onChange={e=>{setLocValue(e.target.value)}}/></label><button type='button' disabled={!onWrite||!query||!locValue||busy} onClick={()=>{void call(onWrite,'write_localisation',{filePath:locFile,language,entries:[{key:query,value:locValue}]})}}>{t('saveLocalisation')}</button><LocalisationMatrix locale={panelLocale} languages={languages} rows={locRows} onSave={save=>{void saveLocalisation(save)}}/><SemanticInspector locale={panelLocale} handlers={{query_rules:semantic('query_rules'),query_scope:semantic('query_scope'),go_to_definition:semantic('go_to_definition'),find_references:semantic('find_references')}}/><pre className={css.output}>{output}</pre></div>}
    </div><footer className={css.footer}><span>{data.backendLabel}</span><span>{data.diagnostics.length} {t('diagnostics')}</span></footer>
  </section>
}

export function CwtoolsRightWorkbench({t,sessionId,remote}:CwtoolsRightWorkbenchProps){
  const [host,setHost]=useState<CwtoolsWorkbenchHostSnapshot>();const [error,setError]=useState<string>();
  const refresh=useCallback(()=>{const controller=new AbortController();setError(undefined);void remote.snapshot(sessionId,controller.signal).then(answer=>{if(answer.ok)setHost(answer.value);else setError(answer.error.message)}).catch((reason:unknown)=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:String(reason))});return()=>{controller.abort()}},[remote,sessionId]);
  useEffect(()=>refresh(),[refresh]);
  useEffect(()=>{const timer=setInterval(()=>{refresh()},10000);return()=>{clearInterval(timer)}},[refresh]);
  const fallback={...EMPTY_WORKBENCH,contextText:error??t('loading')};const data=host?workbenchFromHost(host):fallback;
  const execute:Exec=async(name,args)=>{const answer=await remote.execute(sessionId,name,args);if(!answer.ok)throw new Error(answer.error.message);return answer.value};
  const write:Exec=async(name,args)=>{const answer=await remote.write(sessionId,name,args);if(!answer.ok)throw new Error(answer.error.message);return answer.value};
  const asset=useCallback(async(file:string)=>{const answer=await remote.asset(sessionId,file);if(!answer.ok)throw new Error(answer.error.message);return answer.value},[remote,sessionId]);
  const gui=useCallback(async(file:string)=>{const answer=await remote.gui(sessionId,file);if(!answer.ok)throw new Error(answer.error.message);return answer.value},[remote,sessionId]);
  const event=useCallback(async(file:string)=>{const answer=await remote.event(sessionId,file);if(!answer.ok)throw new Error(answer.error.message);return answer.value},[remote,sessionId]);
  const ship=useCallback(async(file:string)=>{const answer=await remote.ship(sessionId,file);if(!answer.ok)throw new Error(answer.error.message);return answer.value},[remote,sessionId]);
  const shipAsset=useCallback(async(file:string,nodeId:string)=>{const answer=await remote.shipAsset(sessionId,file,nodeId);if(!answer.ok)throw new Error(answer.error.message);return answer.value},[remote,sessionId]);
  return <CwtoolsRightWorkbenchView t={t} data={data} live onExecute={execute} onWrite={write} onRead={async file=>{const answer=await remote.read(sessionId,file);if(!answer.ok)throw new Error(answer.error.message);return answer.value}} onRefresh={()=>{refresh()}} onAsset={asset} onGui={gui} onEvent={event} onShip={ship} onShipAsset={shipAsset}/>
}

export function CwtoolsRightWorkbenchPreview({t}:{t:(key:CwtoolsWorkbenchLocaleKey)=>string}){return <CwtoolsRightWorkbenchView t={t} data={WORKBENCH_PREVIEW} live={false}/>}