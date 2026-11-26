import React from 'react'
import { createRoot } from 'react-dom/client'
import { CwtoolsRightWorkbenchPreview } from '../../src/client/CwtoolsRightWorkbench.tsx'
import { workbenchZh, type CwtoolsWorkbenchLocaleKey } from '../../src/client/workbenchLocales.ts'
import './workbench-preview.css'
document.documentElement.dataset.theme=new URLSearchParams(location.search).get('theme')??'dark'
const t=(key:CwtoolsWorkbenchLocaleKey):string=>workbenchZh[key]
createRoot(document.getElementById('root')!).render(<div className='capture-right'><div className='capture-tabs'><span>CWTools 工作台</span><i>×</i></div><div className='capture-body'><CwtoolsRightWorkbenchPreview t={t}/></div></div>)