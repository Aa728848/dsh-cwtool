import React from 'react'
import { createRoot } from 'react-dom/client'
import type { StaticGalaxyParseResult } from 'cwtools-shared/editors'
import { GalaxyCanvas } from '../../src/client/GalaxyCanvas.tsx'
import './workbench-preview.css'
const galaxy={scenarios:[{systems:[{id:'alpha',nodeKey:'a',name:'Alpha',x:{value:100},y:{value:100}},{id:'beta',nodeKey:'b',name:'Beta',x:{value:420},y:{value:220}},{id:'gamma',nodeKey:'c',name:'Gamma',x:{value:220},y:{value:400}}],hyperlanes:[{kind:'add',fromId:'alpha',toId:'beta'},{kind:'add',fromId:'beta',toId:'gamma'}]}]} as unknown as StaticGalaxyParseResult
createRoot(document.getElementById('root')!).render(<div className='capture-right'><div className='capture-tabs'><span>Static Galaxy · drag / arrows</span></div><GalaxyCanvas galaxy={galaxy} selectedNode='b' onCommit={()=>{}}/></div>)