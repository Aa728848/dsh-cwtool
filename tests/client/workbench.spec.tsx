// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CwtoolsRightWorkbenchView } from '../../src/client/CwtoolsRightWorkbench.tsx'
import { workbenchEn, type CwtoolsWorkbenchLocaleKey } from '../../src/client/workbenchLocales.ts'
import { WORKBENCH_PREVIEW, workbenchFromHost } from '../../src/client/workbenchModel.ts'
import type { CwtoolsWorkbenchHostSnapshot } from '../../src/contract/workbench.ts'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

const t=(key:CwtoolsWorkbenchLocaleKey)=>workbenchEn[key];const sessionId='session-right' as SessionId;afterEach(()=>{cleanup()});
const liveHost=():CwtoolsWorkbenchHostSnapshot=>({sessionId,workspaceRoot:'/mod',projectName:'mod',backend:'ready',context:{ok:true,status:'ready',source:'test',data:{activeTextEditor:{filePath:'technology/test.txt'}}},diagnostics:{ok:true,status:'ready',source:'test',data:{diagnostics:[{severity:'warning',code:'CWT900',message:'Live diagnostic',filePath:'technology/test.txt',line:7}]}}});

describe('CWTools right sidebar workbench',()=>{
  it('renders docked content without a modal or custom application shell',()=>{
    const {container}=render(<CwtoolsRightWorkbenchView t={t} data={WORKBENCH_PREVIEW} live={false}/>);
    expect(container.querySelector('[data-cwtools-right-workbench]')).not.toBeNull();expect(container.querySelector('[role=dialog]')).toBeNull();
    expect(screen.getByRole('tab',{name:'Design'})).toBeDefined();expect(screen.getByRole('tab',{name:'Properties'})).toBeDefined();
  })
  it('shows real diagnostics and never injects preview GUI content in live mode',()=>{
    render(<CwtoolsRightWorkbenchView t={t} data={workbenchFromHost(liveHost())} live/>);
    fireEvent.click(screen.getByRole('tab',{name:'Diagnostics'}));expect(screen.getByText('Live diagnostic')).toBeDefined();expect(screen.queryByText('button_confirm')).toBeNull();
  })
  it('uses shared parsers for a native technology graph in the right pane',async()=>{
    const read=vi.fn(async()=>({filePath:'technology/test.txt',content:'tech_right = { tier = 1 area = physics cost = 100 category = { computing } }'}));
    render(<CwtoolsRightWorkbenchView t={t} data={workbenchFromHost(liveHost())} live onRead={read}/>);fireEvent.click(screen.getByRole('button',{name:'Tech Tree'}));
    expect(await screen.findByText('tech_right')).toBeDefined();expect(read).toHaveBeenCalledWith('technology/test.txt');
  })
  it('wires localisation and GUI draft edits to their domain write tools',async()=>{
    const execute=vi.fn(async(name:string)=>({ok:true,status:'ready',source:'test',data:{name}}));const write=vi.fn(async(name:string,args:Record<string,unknown>)=>({ok:true,status:'success',source:'test',data:args.action==='begin'?{transactionId:'tx-right'}:{name}}));
    render(<CwtoolsRightWorkbenchView t={t} data={workbenchFromHost(liveHost())} live onExecute={execute} onWrite={write}/>);
    fireEvent.click(screen.getByRole('tab',{name:'Visual editors'}));fireEvent.change(screen.getByLabelText('Key or PDX type'),{target:{value:'my_key'}});fireEvent.click(screen.getByRole('button',{name:'Query localisation'}));expect(execute).toHaveBeenCalledWith('query_localisation_index',expect.objectContaining({key:'my_key'}));expect(await screen.findByText(/query_localisation_index/)).toBeDefined();
    fireEvent.change(screen.getByLabelText('Localisation value'),{target:{value:'Text'}});fireEvent.click(screen.getByRole('button',{name:'Write through write_localisation'}));expect(write).toHaveBeenCalledWith('write_localisation',expect.objectContaining({entries:[{key:'my_key',value:'Text'}]}));expect(await screen.findByText(/write_localisation/)).toBeDefined();
    fireEvent.click(screen.getByRole('tab',{name:'Properties'}));fireEvent.click(screen.getByRole('button',{name:'Begin'}));expect(await screen.findByText(/tx-right/)).toBeDefined();fireEvent.change(screen.getByLabelText('Element line'),{target:{value:'3'}});fireEvent.change(screen.getByLabelText('X'),{target:{value:'88'}});fireEvent.click(screen.getByRole('button',{name:'Update'}));expect(write).toHaveBeenCalledWith('gui_draft',expect.objectContaining({action:'update',transactionId:'tx-right',line:3,x:88}));
  })
})