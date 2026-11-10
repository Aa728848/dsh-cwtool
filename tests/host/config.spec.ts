import { describe, expect, it } from 'vitest'
import { Config } from '../../src/config.ts'

 describe('CWTools configuration', () => {
  it('resolves safe defaults', () => {
    const config = Config({})
    expect(config.enabled).toBe(true)
    expect(config.readGroups.semantic).toBe(true)
    expect(config.writeTools.write_localisation).toBe(false)
    expect(config.backend.maxWorkspaceRuntimes).toBe(2)
    expect(config.backend.forceStart).toBe(false)
    expect(config.output.maxResultChars).toBe(16_000)
  })

  it('rejects invalid timers, capacities and output limits', () => {
    expect(() => Config({ backend: { requestTimeoutMs: 0 } })).toThrow()
    expect(() => Config({ backend: { maxWorkspaceRuntimes: 0 } })).toThrow()
    expect(() => Config({ output: { maxResultChars: 10 } })).toThrow()
  })
})
