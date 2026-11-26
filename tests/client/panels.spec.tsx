// @vitest-environment jsdom
/** The three composable CWTools panels: matrix markers + save callback, evidence capture, and semantic queries. */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SharedToolResult } from 'cwtools-shared'
import { EvidenceCenter, type EvidenceEntry } from '../../src/client/panels/EvidenceCenter.tsx'
import { LocalisationMatrix, type LocalisationRow } from '../../src/client/panels/LocalisationMatrix.tsx'
import { SemanticInspector } from '../../src/client/panels/SemanticInspector.tsx'
import { panelsEn, panelsZh } from '../../src/client/panels/panelsLocales.ts'

afterEach(cleanup)

const rows: readonly LocalisationRow[] = [
  { key: 'ship_name', values: { l_english: 'Ship', l_schinese: '舰船' } },
  { key: 'missing_key', values: { l_english: '', l_schinese: '缺失文本' } },
  { key: 'dupe_key', values: { l_english: 'One', l_schinese: 'Two' }, duplicate: ['l_english'] },
]

describe('LocalisationMatrix', () => {
  it('renders one column per language and one row per key', () => {
    render(<LocalisationMatrix languages={['l_english', 'l_schinese']} rows={rows} onSave={vi.fn()} />)
    expect(screen.getByRole('columnheader', { name: panelsEn.locKey })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'l_english' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'l_schinese' })).toBeTruthy()
    for (const row of rows) expect(screen.getByRole('rowheader', { name: row.key })).toBeTruthy()
  })

  it('marks missing and duplicated values', () => {
    render(<LocalisationMatrix languages={['l_english', 'l_schinese']} rows={rows} onSave={vi.fn()} />)
    expect(screen.getAllByText(panelsEn.locMissing)).toHaveLength(1)
    expect(screen.getAllByText(panelsEn.locDuplicate)).toHaveLength(1)
  })

  it('hands a staged edit to onSave without writing anything itself', async () => {
    const onSave = vi.fn(async () => undefined)
    render(<LocalisationMatrix languages={['l_english', 'l_schinese']} rows={rows} onSave={onSave} />)
    const input = screen.getByLabelText('missing_key · l_english')
    fireEvent.change(input, { target: { value: 'Filled' } })
    fireEvent.click(screen.getByRole('button', { name: panelsEn.locSave + ' missing_key · l_english' }))
    await waitFor(() => { expect(onSave).toHaveBeenCalledWith({ key: 'missing_key', language: 'l_english', value: 'Filled' }) })
  })

  it('shows an empty notice for no rows and renders Chinese copy', () => {
    const { rerender } = render(<LocalisationMatrix languages={['l_english']} rows={[]} onSave={vi.fn()} />)
    expect(screen.getByText(panelsEn.locEmpty)).toBeTruthy()
    rerender(<LocalisationMatrix locale='zh' languages={['l_english']} rows={rows} onSave={vi.fn()} />)
    expect(screen.getByRole('heading', { name: panelsZh.localisationTitle })).toBeTruthy()
  })
})

const entries: readonly EvidenceEntry[] = [
  { id: 'ok', title: 'GUI move', before: 'blob:before', after: 'blob:after', diff: 'blob:diff', pixelRatio: 2, version: '1.2.0', source: 'workbench' },
  { id: 'fail', title: 'Particle spawn', failed: true, failureReason: 'renderer crashed' },
]

describe('EvidenceCenter', () => {
  it('renders Before/After/Diff images with provenance', () => {
    render(<EvidenceCenter entries={entries} />)
    expect(screen.getByAltText(panelsEn.evBefore).getAttribute('src')).toBe('blob:before')
    expect(screen.getByAltText(panelsEn.evAfter).getAttribute('src')).toBe('blob:after')
    expect(screen.getByAltText(panelsEn.evDiff).getAttribute('src')).toBe('blob:diff')
    expect(screen.getByText(panelsEn.evVerified)).toBeTruthy()
    expect(screen.getByText(new RegExp(panelsEn.evPixelRatio + ': 2'))).toBeTruthy()
    expect(screen.getByText(new RegExp(panelsEn.evVersion + ': 1.2.0'))).toBeTruthy()
    expect(screen.getByText(new RegExp(panelsEn.evSource + ': workbench'))).toBeTruthy()
  })

  it('reports a failure with its reason and a missing capture as a notice', () => {
    render(<EvidenceCenter entries={entries} />)
    expect(screen.getByText(panelsEn.evFailed)).toBeTruthy()
    expect(screen.getByText(new RegExp(panelsEn.evFailureReason + ': renderer crashed'))).toBeTruthy()
    expect(screen.getAllByText(panelsEn.evNoImage).length).toBeGreaterThanOrEqual(2)
  })

  it('shows an empty notice and localizes to Chinese', () => {
    const { rerender } = render(<EvidenceCenter entries={[]} />)
    expect(screen.getByText(panelsEn.evEmpty)).toBeTruthy()
    rerender(<EvidenceCenter locale='zh' entries={entries} />)
    expect(screen.getByRole('heading', { name: panelsZh.evidenceTitle })).toBeTruthy()
  })
})

const okResult = (data: unknown): SharedToolResult => ({ ok: true, status: 'ready', source: 'test', data })

describe('SemanticInspector', () => {
  it('renders no fake data until a handler returns a result', () => {
    render(<SemanticInspector handlers={{ query_rules: async () => okResult({ rules: ['trigger:is_ai'] }) }} />)
    expect(screen.getByText(panelsEn.semIdle)).toBeTruthy()
    expect(screen.queryByText(/trigger:is_ai/)).toBeNull()
  })

  it('runs query_rules through its handler and renders the real result', async () => {
    const handler = vi.fn(async (args) => okResult({ rules: ['trigger:is_ai'], echo: args }))
    render(<SemanticInspector handlers={{ query_rules: handler }} />)
    fireEvent.change(screen.getByLabelText(new RegExp(panelsEn.semCategory)), { target: { value: 'trigger' } })
    fireEvent.click(screen.getByRole('button', { name: panelsEn.semRun }))
    expect(await screen.findByText(/trigger:is_ai/)).toBeTruthy()
    expect(handler).toHaveBeenCalledWith({ category: 'trigger' })
  })

  it('switches to find_references and passes typed args', async () => {
    const handler = vi.fn(async (args) => okResult({ references: [{ file: 'a.txt', line: 4 }], echo: args }))
    render(<SemanticInspector handlers={{ find_references: handler }} />)
    fireEvent.click(screen.getByRole('tab', { name: panelsEn.semReferences }))
    fireEvent.change(screen.getByLabelText(new RegExp(panelsEn.semIdentifier)), { target: { value: 'ship_event' } })
    fireEvent.change(screen.getByLabelText(new RegExp(panelsEn.semLine)), { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: panelsEn.semRun }))
    expect(await screen.findByText(/ship_event/)).toBeTruthy()
    expect(handler).toHaveBeenCalledWith({ identifier: 'ship_event', line: 12 })
  })

  it('disables the run control when the host provides no handler', () => {
    render(<SemanticInspector handlers={{}} />)
    expect(screen.getByText(panelsEn.semNoHandler)).toBeTruthy()
    expect((screen.getByRole('button', { name: panelsEn.semRun }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('surfaces a thrown handler error instead of a result', async () => {
    render(<SemanticInspector handlers={{ query_rules: async () => { throw new Error('boom') } }} />)
    fireEvent.click(screen.getByRole('button', { name: panelsEn.semRun }))
    expect(await screen.findByText(new RegExp(panelsEn.semError + ': boom'))).toBeTruthy()
  })
})
