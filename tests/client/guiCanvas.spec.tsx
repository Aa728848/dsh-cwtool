// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GuiCanvas } from '../../src/client/GuiCanvas.tsx'
import type { GuiElement } from 'cwtools-shared/editors'
afterEach(()=>{cleanup()})
const element:GuiElement={type:'buttonType',name:'confirm',position:{x:10,y:20},size:{width:100,height:40},children:[],properties:{},line:3,endLine:8,propertyLines:{}}
describe('GuiCanvas',()=>{
 it('commits one bounded move in root SVG coordinates on pointer up',()=>{vi.stubGlobal('PointerEvent',MouseEvent);const commit=vi.fn();const {container}=render(<GuiCanvas elements={[element]} selectedLine={3} onSelect={()=>{}} onCommit={commit}/>);const svg=container.querySelector('svg')!;svg.getBoundingClientRect=()=>({left:0,top:0,width:1280,height:720,right:1280,bottom:720,x:0,y:0,toJSON:()=>{}});SVGElement.prototype.setPointerCapture=vi.fn();const group=container.querySelector('g')!;fireEvent.pointerDown(group,{pointerId:1,clientX:10,clientY:20});fireEvent.pointerMove(svg,{pointerId:1,clientX:35,clientY:50});fireEvent.pointerUp(svg,{pointerId:1,clientX:35,clientY:50});expect(commit).toHaveBeenCalledWith(3,{x:35,y:50,width:100,height:40})})
 it('supports keyboard move and resize through the same draft callback',()=>{const commit=vi.fn();const {container}=render(<GuiCanvas elements={[element]} selectedLine={3} onSelect={()=>{}} onCommit={commit}/>);const svg=container.querySelector('svg')!;fireEvent.keyDown(svg,{key:'ArrowRight'});fireEvent.keyDown(svg,{key:'ArrowDown',shiftKey:true});expect(commit).toHaveBeenNthCalledWith(1,3,{x:11,y:20,width:100,height:40});expect(commit).toHaveBeenNthCalledWith(2,3,{x:10,y:20,width:100,height:41})})
})