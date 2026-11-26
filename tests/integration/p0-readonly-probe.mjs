import { Context } from '@deepseek-ai/cordis'
import {mkdir,writeFile} from 'node:fs/promises'
import { apply, Config } from '../../lib/index.js'

const startedAt=Date.now()
const workspaceRoot='E:/stellaris mod/mymod/Kuat Ancient Empire'
const serverPath='C:/Users/A/Documents/cwtools-vscode/artifacts/bin/Main/debug/CWTools Server.exe'
const rulesPath='C:/Users/A/Documents/cwtools-vscode/submodules/cwtools-stellaris-config/config'
const definitions=new Map();const session={id:'p0-live'};const ctx=new Context()
ctx.provide('tools',{register:definition=>{definitions.set(definition.name,definition);return()=>{definitions.delete(definition.name)}}})
ctx.provide('systemPrompt',{section:()=>()=>{}})
ctx.provide('workingDirectory',{ensure:async()=>workspaceRoot})
ctx.provide('sessions',{get:id=>id===session.id?session:undefined})
ctx.provide('sandboxPolicy',{resolve:()=>({workspaceRoot})})
apply(ctx,Config({backend:{serverPath,rulesPath,game:'stellaris',startupTimeoutMs:120000,requestTimeoutMs:60000,preferActiveBackend:false}}))
const execute=async(name,args)=>{
  const definition=definitions.get(name);if(!definition)return{ok:false,error:{code:'not_registered',message:name}}
  try{return await definition.execute(args,{agent:{session},signal:new AbortController().signal})}
  catch(error){return{ok:false,status:'unavailable',error:{code:error.code??'error',message:error.message}}}
}
const report={toolCount:definitions.size,defaultWrites:{localisation:definitions.has('write_localisation'),guiDraft:definitions.has('gui_draft')}}
try{
  let explored;for(let attempt=0;attempt<90;attempt++){explored=await execute('explore_pdx_project',{file:'interface/kuat_mod_settings_ui.gui',maxNodes:12,maxEdges:30,depth:1});if(explored.ok&&explored.status!=='loading')break;await new Promise(resolve=>setTimeout(resolve,2000))}report.explore={ok:explored.ok,status:explored.status,readiness:explored.readiness??null,warnings:explored.warnings??[],hasData:explored.data!=null}
  let diagnostics;let attempts=0
  while(attempts<1){attempts++;diagnostics=await execute('get_diagnostics',{file:'interface/kuat_mod_settings_ui.gui',limit:20});if(diagnostics.status!=='loading')break;await new Promise(resolve=>setTimeout(resolve,2000))}
  report.diagnostics={ok:diagnostics.ok,status:diagnostics.status,readiness:diagnostics.readiness??null,count:diagnostics.status==='loading'?null:diagnostics.data?.diagnostics?.length??null,attempts,authoritative:diagnostics.ok&&diagnostics.status!=='loading',warnings:diagnostics.warnings??[]}
  const workspaceDiagnostics=await execute('get_diagnostics',{limit:50});report.workspaceDiagnostics={ok:workspaceDiagnostics.ok,status:workspaceDiagnostics.status,count:workspaceDiagnostics.status==='loading'?null:workspaceDiagnostics.data?.diagnostics?.length??null,authoritative:workspaceDiagnostics.ok&&workspaceDiagnostics.status!=='loading',readiness:workspaceDiagnostics.readiness??null,warnings:workspaceDiagnostics.warnings??[]}
  const loc=await execute('query_localisation_index',{key:'kuat',contains:true,compareLanguages:true,limit:3});report.localisationSample={ok:loc.ok,status:loc.status,data:loc.data??null,error:loc.error??null}
  const workbench=ctx.get('cwtoolsWorkbench');if(workbench){const gui=await workbench.gui('p0-live','interface/kuat_mod_settings_ui.gui',new AbortController().signal);const flat=items=>items.flatMap(item=>[item,...flat(item.children)]);const rows=flat(gui.elements);report.guiDocument={file:gui.filePath,elements:rows.length,textures:rows.filter(item=>item.captureTexture).length,warnings:gui.warnings};await mkdir('artifacts/ui',{recursive:true});await writeFile('artifacts/ui/actual-gui-document.json',JSON.stringify(gui))}else report.guiDocument={unavailable:true}
  let semantic;for(let attempt=0;attempt<30;attempt++){semantic=await execute('get_semantic_catalog',{});if(semantic.ok&&semantic.status!=='loading')break;await new Promise(resolve=>setTimeout(resolve,2000))}report.semanticCatalog={ok:semantic.ok,status:semantic.status,rules:semantic.data?.rules?.length??null,definitionTypes:semantic.data?.definitionTypes?.length??null,directoryPaths:semantic.data?.directoryPaths?.length??null,dataKeys:semantic.data&&typeof semantic.data==='object'?Object.keys(semantic.data):[],error:semantic.error??null}
  if(workbench){const event=await workbench.event('p0-live','events/kuat_system_selector_events.txt',new AbortController().signal);report.eventGraph={file:event.filePath,catalogStatus:event.catalogStatus,nodes:event.graph.nodes.length,edges:event.graph.edges.length,seedIds:event.seedIds.length,files:new Set(event.graph.nodes.map(node=>node.file)).size,warnings:event.warnings}}
  if(workbench){const ship=await workbench.ship('p0-live','common/global_ship_designs/executor_boss_design.txt',new AbortController().signal);const first=ship.designs[0];const iconCount=ship.catalog.components.filter(item=>item.icon?.uri).length;report.shipDesign={designs:ship.designs.length,shipSizes:ship.catalog.shipSizes.length,sections:ship.catalog.sections.length,components:ship.catalog.components.length,technologies:ship.catalog.technologies.length,stats:Object.keys(first?.stats.values??{}).length,resources:Object.keys(first?.stats.resources??{}).length,icons:iconCount,modelNodes:first?.view.model.length??0,warnings:ship.warnings};const node=first?.view.model.find(item=>item.entityName);if(node){const resolved=await workbench.shipAsset('p0-live','common/global_ship_designs/executor_boss_design.txt',node.id,new AbortController().signal);const count=asset=>asset?1+asset.attaches.reduce((sum,child)=>sum+count(child.entity),0):0;report.shipAsset={nodeId:node.id,entities:count(resolved.asset),hasMesh:Boolean(resolved.asset?.meshBase64||resolved.asset?.meshUri),textures:Object.keys(resolved.asset?.textureMap??{}).length,warnings:resolved.warnings}}}
  const postFile=await execute('get_diagnostics',{file:'interface/kuat_mod_settings_ui.gui',limit:20});report.postReadyDiagnostics={ok:postFile.ok,status:postFile.status,count:postFile.ok&&postFile.status!=='loading'?postFile.data?.diagnostics?.length??null:null,authoritative:postFile.ok&&postFile.status!=='loading',readiness:postFile.readiness??null,warnings:postFile.warnings??[]}
  const postWorkspace=await execute('get_diagnostics',{limit:50});report.postReadyWorkspaceDiagnostics={ok:postWorkspace.ok,status:postWorkspace.status,count:postWorkspace.ok&&postWorkspace.status!=='loading'?postWorkspace.data?.diagnostics?.length??null:null,authoritative:postWorkspace.ok&&postWorkspace.status!=='loading',readiness:postWorkspace.readiness??null,warnings:postWorkspace.warnings??[]}
  const ide=await execute('get_ide_context',{});report.standaloneIde={ok:ide.ok,status:ide.status,error:ide.error??null}
  report.timing={totalMs:Date.now()-startedAt}
  console.log(JSON.stringify(report,null,2))
}finally{await ctx.fiber.dispose()}