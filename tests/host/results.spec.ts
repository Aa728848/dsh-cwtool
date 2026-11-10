import { describe, expect, it } from 'vitest'
import { normalizeSuccessfulResult, renderCwtoolsResult } from '../../src/host/results.ts'

 describe('CWTools canonical results', () => {
  it('removes undefined object fields and sorts keys without changing arrays', () => {
    const result = normalizeSuccessfulResult({
      ok: true,
      status: 'ready',
      source: 'test',
      data: { z: undefined, b: 2, a: 1 },
      warnings: ['first', 'second'],
    })
    expect(result).toEqual({
      ok: true,
      status: 'ready',
      source: 'test',
      data: { a: 1, b: 2 },
      warnings: ['first', 'second'],
    })
  })

  it('rejects non-JSON and malformed success values', () => {
    expect(() => normalizeSuccessfulResult({ ok: true, status: 'ready', source: 'test', data: Number.NaN })).toThrow(/non-finite/)
    expect(() => normalizeSuccessfulResult({ ok: true, status: 'unavailable', source: 'test' })).toThrow(/invalid success/)
  })

  it('truncates only rendered text and includes an explicit marker', () => {
    const value = { ok: true, status: 'ready', source: 'test', data: 'abcdef' }
    const rendered = renderCwtoolsResult(value, 20)
    expect(rendered).toContain('truncated')
    expect(rendered).toContain('canonical tool result is unchanged')
    expect(value.data).toBe('abcdef')
  })
})
