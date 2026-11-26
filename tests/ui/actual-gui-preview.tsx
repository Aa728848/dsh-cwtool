import React,{useState} from 'react'
import{createRoot}from'react-dom/client'
import{GuiCanvas}from'../../src/client/GuiCanvas.tsx'
import guiDocument from'../../artifacts/ui/actual-gui-document.json' with {type:'json'}
import type{GuiElement}from'cwtools-shared/editors'
import'./workbench-preview.css'
const initial=guiDocument.elements as unknown as GuiElement[]
function App(){
 const[elements,setElements]=useState(initial);const[selected,setSelected]=useState<number>()
 const update=(items:GuiElement[],line:number,change:{x:number;y:number;width:number;height:number}):GuiElement[]=>items.map(item=>item.line===line?{...item,position:{x:change.x,y:change.y},size:{width:change.width,height:change.height}}:{...item,children:update(item.children,line,change)})
 return<div className='capture-right'><div className='capture-tabs'><span>Actual Mod · kuat_mod_settings_ui.gui</span></div><div style={{minHeight:0,flex:1}}><GuiCanvas elements={elements} selectedLine={selected} onSelect={setSelected} onCommit={(line,change)=>{setElements(update(elements,line,change))}}/></div></div>
}
createRoot(document.getElementById('root')!).render(<App/>)