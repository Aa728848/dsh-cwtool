// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GalaxyCanvas } from '../../src/client/GalaxyCanvas.tsx'
import type { ParsedSystem, StaticGalaxyParseResult } from 'cwtools-shared/editors'

afterEach(() => { cleanup() })

const makeSystem = (id: string, nodeKey: string, x: number, y: number): ParsedSystem => ({
  nodeKey, id, name: id,
  x: { kind: 'fixed', value: x }, y: { kind: 'fixed', value: y },
  transform: { x: { mul: 1, add: 0, invertible: true }, y: { mul: 1, add: 0, invertible: true } },
  hasTransform: false, editable: true, diagnostics: [],
  keySpan: { start: 0, end: 0 }, line: 1,
})

const galaxy = {
  ok: true,
  scenarios: [{
    scenarioKey: 'k', name: 'Test Galaxy',
    settings: { randomHyperlanes: false },
    systems: [makeSystem('a', 'node-a', 0, 0), makeSystem('b', 'node-b', 100, 100)],
    nebulas: [], hyperlanes: [], diagnostics: [],
    keySpan: { start: 0, end: 0 }, line: 1,
  }],
} as unknown as StaticGalaxyParseResult

// world (0,0)/(100,100) mapped into an 800x580 viewBox with 44px padding:
// node-a sits at view (44,44); a +10 world move is +71.2 / +49.2 view px.
const VIEW_10X = 44 + 71.2
const VIEW_10Y = 44 + 49.2

const mount = (selectedNode: string | undefined, onCommit = vi.fn()) => {
  vi.stubGlobal('PointerEvent', MouseEvent)
  const result = render(<GalaxyCanvas galaxy={galaxy} selectedNode={selectedNode} onSelect={() => {}} onCommit={onCommit} />)
  const svg = result.container.querySelector('svg')!
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 580, right: 800, bottom: 580, x: 0, y: 0, toJSON: () => ({}) })
  return { ...result, svg, onCommit }
}

describe('GalaxyCanvas', () => {
  it('commits exactly one numeric move on pointer up and none on a click', () => {
    const { container, svg, onCommit } = mount('node-a')
    const node = container.querySelector('circle')!.closest('g')!
    fireEvent.pointerDown(node, { pointerId: 1, clientX: 44, clientY: 44 })
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 44, clientY: 44 })
    expect(onCommit).not.toHaveBeenCalled()
    fireEvent.pointerDown(node, { pointerId: 2, clientX: 44, clientY: 44 })
    fireEvent.pointerMove(svg, { pointerId: 2, clientX: VIEW_10X, clientY: VIEW_10Y })
    fireEvent.pointerUp(svg, { pointerId: 2, clientX: VIEW_10X, clientY: VIEW_10Y })
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith({ nodeKey: 'node-a', x: 10, y: 10 })
  })

  it('moves the selected node with arrow keys, Alt multiplying the step by ten', () => {
    const { svg, onCommit } = mount('node-a')
    fireEvent.keyDown(svg, { key: 'ArrowRight' })
    fireEvent.keyDown(svg, { key: 'ArrowDown', altKey: true })
    expect(onCommit).toHaveBeenNthCalledWith(1, { nodeKey: 'node-a', x: 1, y: 0 })
    expect(onCommit).toHaveBeenNthCalledWith(2, { nodeKey: 'node-a', x: 0, y: 10 })
  })

  it('registers no-bleed window listeners during a drag and removes them on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const { container, unmount } = mount('node-a')
    const node = container.querySelector('circle')!.closest('g')!
    fireEvent.pointerDown(node, { pointerId: 3, clientX: 44, clientY: 44 })
    expect(addSpy.mock.calls.some(call => call[0] === 'pointerup')).toBe(true)
    unmount()
    expect(removeSpy.mock.calls.some(call => call[0] === 'pointerup')).toBe(true)
    expect(removeSpy.mock.calls.some(call => call[0] === 'pointercancel')).toBe(true)
  })
})