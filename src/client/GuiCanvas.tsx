import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { GuiElement } from 'cwtools-shared/editors'
import css from './GuiCanvas.module.css'

export interface GuiCanvasChange { x:number;y:number;width:number;height:number }
interface Props { elements:readonly GuiElement[];selectedLine?:number;onSelect:(line:number)=>void;onCommit:(line:number,change:GuiCanvasChange)=>void;svgRef?:(element:SVGSVGElement|null)=>void }
interface Drag { pointerId:number;line:number;mode:'move'|'resize';startX:number;startY:number;origin:GuiCanvasChange }
const flat=(items:readonly GuiElement[],depth=0):GuiElement[]=>depth>64?[]:items.flatMap(item=>[item,...flat(item.children,depth+1)])
const safeImage=(value:string|undefined)=>value?.startsWith('data:image/')||value?.startsWith('blob:')?value:undefined

export function GuiCanvas({elements,selectedLine,onSelect,onCommit,svgRef}:Props){
  const [natural,setNatural]=useState<Record<string,{width:number;height:number}>>({});
  const rootRef=useRef<SVGSVGElement|null>(null);const [drag,setDrag]=useState<Drag>();const [override,setOverride]=useState<{line:number;change:GuiCanvasChange}>();
  const rows=useMemo(()=>flat(elements).filter(item=>(item.size.width>0&&item.size.height>0)||safeImage(item.captureTexture??item.spriteTexture)!==undefined).slice(0,1500),[elements]);
  useEffect(()=>{let active=true;const textures=[...new Set(rows.map(item=>safeImage(item.captureTexture??item.spriteTexture)).filter((value):value is string=>value!==undefined))].slice(0,64);for(const texture of textures){if(natural[texture])continue;const image=new Image();image.onload=()=>{if(active)setNatural(current=>({...current,[texture]:{width:image.naturalWidth,height:image.naturalHeight}}))};image.src=texture}return()=>{active=false}},[rows]);
  const dimensions=(item:GuiElement)=>{const texture=safeImage(item.captureTexture??item.spriteTexture);const size=texture?natural[texture]:undefined;return{width:item.size.width||(size?.width??32)*(item.scale??1),height:item.size.height||(size?.height??32)*(item.scale??1)}};
  const selected=rows.find(item=>item.line===selectedLine)
  const point=(event:PointerEvent<SVGElement>)=>{const svg=rootRef.current??event.currentTarget.ownerSVGElement??event.currentTarget;const rect=svg.getBoundingClientRect();return{x:(event.clientX-rect.left)*1280/rect.width,y:(event.clientY-rect.top)*720/rect.height}}
  const start=(event:PointerEvent<SVGElement>,item:GuiElement,mode:Drag['mode'])=>{event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);const p=point(event);setDrag({pointerId:event.pointerId,line:item.line,mode,startX:p.x,startY:p.y,origin:{x:item.position.x,y:item.position.y,...dimensions(item)}});setOverride(undefined);onSelect(item.line)}
  const move=(event:PointerEvent<SVGSVGElement>)=>{if(!drag||drag.pointerId!==event.pointerId)return;const p=point(event);const dx=Math.round(p.x-drag.startX);const dy=Math.round(p.y-drag.startY);const change=drag.mode==='move'?{...drag.origin,x:drag.origin.x+dx,y:drag.origin.y+dy}:{...drag.origin,width:Math.max(1,drag.origin.width+dx),height:Math.max(1,drag.origin.height+dy)};setOverride({line:drag.line,change})}
  const finish=(event:PointerEvent<SVGSVGElement>)=>{if(!drag||drag.pointerId!==event.pointerId)return;if(override?.line===drag.line)onCommit(drag.line,override.change);setDrag(undefined);setOverride(undefined)}
  const keyboard=(event:KeyboardEvent<SVGSVGElement>)=>{if(!selected||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const dx=event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:0;const dy=event.key==='ArrowUp'?-1:event.key==='ArrowDown'?1:0;const step=event.altKey?10:1;onCommit(selected.line,event.shiftKey?{x:selected.position.x,y:selected.position.y,width:Math.max(1,selected.size.width+dx*step),height:Math.max(1,selected.size.height+dy*step)}:{x:selected.position.x+dx*step,y:selected.position.y+dy*step,width:selected.size.width,height:selected.size.height})}
  return <svg tabIndex={0} onKeyDown={keyboard} ref={element=>{rootRef.current=element;svgRef?.(element)}} className={css.canvas} viewBox='0 0 1280 720' role='img' aria-label='GUI layout canvas' onPointerMove={move} onPointerUp={finish} onPointerCancel={finish}>
    <rect width='1280' height='720' className={css.background}/>
    {rows.map(item=>{const change=override?.line===item.line?override.change:undefined;const x=change?.x??item.position.x;const y=change?.y??item.position.y;const width=change?.width??dimensions(item).width;const height=change?.height??dimensions(item).height;const active=item.line===selectedLine;const image=safeImage(item.captureTexture??item.spriteTexture);return <g key={item.line} className={css.element} onPointerDown={event=>{start(event,item,'move')}}>
      <clipPath id={`clip-${item.line}`}><rect x={x} y={y} width={width} height={height}/></clipPath>{image?<image href={image} x={x} y={y} width={width} height={height} preserveAspectRatio='none'/>:<rect x={x} y={y} width={width} height={height} rx='2' className={active?css.selected:css.box} data-type={item.type}/>} 
      {item.text&&<text x={x+5} y={y+Math.min(18,height/2+4)} className={css.text} clipPath={`url(#clip-${item.line})`}>{item.text}</text>}{active&&<text x={x+4} y={Math.max(10,y-4)} className={css.label}>{item.name} · {item.type}</text>}<title>{item.name} line {item.line}</title>
      {active&&<><rect x={x} y={y} width={width} height={height} className={css.outline}/><rect x={x+width-5} y={y+height-5} width='10' height='10' className={css.handle} onPointerDown={event=>{start(event,item,'resize')}}/></>}
    </g>})}
    {selected&&<text x='12' y='704' className={css.status}>{selected.name} · line {selected.line}</text>}
  </svg>
}