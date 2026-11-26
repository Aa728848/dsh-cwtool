import { Context } from '@deepseek-ai/cordis'
import { apply, Config } from '../../lib/index.js'
const workspaceRoot='E:/stellaris mod/mymod/Kuat Ancient Empire'
const session={id:'ship-live'};const ctx=new Context()
ctx.provide('tools',{register:()=>()=>{}})
ctx.provide('systemPrompt',{section:()=>()=>{}})
ctx.provide('workingDirectory',{ensure:async()=>workspaceRoot})
ctx.provide('sessions',{get:id=>id===session.id?session:undefined})
ctx.provide('sandboxPolicy',{resolve:()=>({workspaceRoot})})
apply(ctx,Config({backend:{game:'stellaris',serverPath:'C:/Users/A/Documents/cwtools-vscode/artifacts/bin/Main/debug/CWTools Server.exe',rulesPath:'C:/Users/A/Documents/cwtools-vscode/submodules/cwtools-stellaris-config/config',preferActiveBackend:false}}))
try{
 await new Promise(resolve=>setImmediate(resolve))
 const workbench=ctx.get('cwtoolsWorkbench');if(!workbench)throw new Error('Workbench unavailable')
 const file='common/global_ship_designs/executor_boss_design.txt'
 const ship=await workbench.ship(session.id,file,new AbortController().signal)
 const first=ship.designs[0];const node=first?.view.model.find(item=>item.entityName)
 const asset=node?await workbench.shipAsset(session.id,file,node.id,new AbortController().signal):undefined
 console.log(JSON.stringify({designs:ship.designs.length,components:ship.catalog.components.length,icons:ship.catalog.components.filter(item=>item.icon?.uri).length,stats:Object.keys(first?.stats.values??{}).length,warnings:ship.warnings,asset:asset?{hasMesh:Boolean(asset.asset?.meshBase64||asset.asset?.meshUri),warnings:asset.warnings}:null},null,2))
}finally{await ctx.fiber.dispose()}
