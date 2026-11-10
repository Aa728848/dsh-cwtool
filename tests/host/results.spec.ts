import { describe, expect, it } from 'vitest'
import { errorFromSharedResult, normalizeSuccessfulResult, renderCwtoolsResult } from '../../src/host/results.ts'

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

  it('keeps the stable error code visible in the surfaced message', () => {
    const error = errorFromSharedResult({
      ok: false,
      status: 'unavailable',
      source: 'test',
      error: { code: 'active_unavailable', message: 'fetch failed' },
    })
    expect(error.code).toBe('active_unavailable')
    expect(error.message).toContain('fetch failed')
    expect(error.message).toContain('active_unavailable')
  })

  it('truncates only rendered text and includes an explicit marker', () => {
    const value = { ok: true, status: 'ready', source: 'test', data: 'abcdef' }
    const rendered = renderCwtoolsResult(value, 20)
    expect(rendered).toContain('truncated')
    expect(rendered).toContain('canonical tool result is unchanged')
    expect(value.data).toBe('abcdef')
  })
})
