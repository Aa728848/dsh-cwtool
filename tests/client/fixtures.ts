/** A real configuration-form fixture: accepted values, writes, and refusal modes. */

import { vi } from 'vitest'
import type { ConfigForm, ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client'
import type { CwtoolsConfig } from '../../src/contract/configTypes.ts'
import {
  CWTOOLS_READ_GROUP_ORDER, CWTOOLS_READ_TOOL_NAMES,
} from '../../src/contract/toolCatalog.ts'

/** How the fake Host answers the next write. */
export type HostVerdict =
  /** Accept and store the operations. */
  | 'accept'
  /** Refuse the values themselves; the revision does not move. */
  | 'refuse'
  /** Refuse because the document moved underneath; the revision advances. */
  | 'conflict'

/** What the Host does with the values it refuses: the accepted section keeps them. */
export function defaultConfig(): CwtoolsConfig {
  return {
    enabled: true,
    readGroups: Object.fromEntries(CWTOOLS_READ_GROUP_ORDER.map(group => [group, true])) as CwtoolsConfig['readGroups'],
    readTools: {},
    writeTools: { write_localisation: false },
    backend: {
      serverPath: '',
      gamePath: '',
      rulesPath: '',
      cachePath: '',
      game: '',
      forceStart: false,
      startupTimeoutMs: 30_000,
      requestTimeoutMs: 20_000,
      idleShutdownMs: 600_000,
      maxWorkspaceRuntimes: 2,
      debug: false,
    },
    output: { maxResultChars: 16_000 },
  }
}

/** The user layer a fresh document holds: nothing was overridden yet. */
export function emptyUser(): unknown {
  return { backend: {}, output: {} }
}

/** Split a dotted operation path into the document's nesting. */
function splitPath(path: readonly string[]): { head: string; tail: string | undefined } {
  const [head = '', tail] = path
  return { head, tail }
}

/**
 * One Host entry's accepted section plus its write path, as `ctx.configForms.get`
 * provides it. Every write is recorded so a spec can assert the exact document
 * operations one save produced.
 */
export class TestConfigForm implements ConfigForm<CwtoolsConfig> {
  /** Every `mutate` call, in wire shape. */
  readonly writes: { ops: SettingsPathOpView[]; revision: number | undefined }[] = []
  /** Ordered verdicts; the last one repeats once the list is spent. */
  verdicts: HostVerdict[] = ['accept']
  /** Set to throw from the next write, as a transport failure would. */
  transportFailure: Error | undefined
  private snapshot: ConfigFormSnapshot<CwtoolsConfig>
  private readonly listeners = new Set<() => void>()

  /**
   * @param config - the accepted section; defaults cover a fresh deployment.
   * @param user - the stored user layer; absence means nothing was overridden.
   */
  constructor(config: CwtoolsConfig = defaultConfig(), user: unknown = emptyUser()) {
    this.snapshot = {
      status: 'ready',
      value: config,
      base: defaultConfig(),
      user,
      revision: 1,
      writable: true,
    }
  }

  /** @returns the current snapshot. */
  getSnapshot(): ConfigFormSnapshot<CwtoolsConfig> {
    return this.snapshot
  }

  /**
   * Observe snapshot replacements.
   * @param listener - invoked after each change.
   * @returns the disposer removing this listener.
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /**
   * Apply ordered operations, or refuse them per the next verdict.
   * @param ops - the document operations.
   * @param expectedRevision - the revision the caller read.
   * @returns whether the Host accepted the write.
   */
  async mutate(ops: readonly SettingsPathOpView[], expectedRevision?: number): Promise<boolean> {
    this.writes.push({ ops: ops.map(op => structuredClone(op)), revision: expectedRevision })
    if (this.transportFailure !== undefined) {
      const failure = this.transportFailure
      this.transportFailure = undefined
      throw failure
    }
    const verdict = this.verdicts.length > 1 ? this.verdicts.shift() : this.verdicts[0]
    if (verdict === 'refuse') {
      this.publish({})
      return false
    }
    if (verdict === 'conflict') {
      this.publish({ revision: (this.snapshot.revision ?? 0) + 1 })
      return false
    }
    this.apply(ops)
    return true
  }

  /**
   * Write one scalar field; kept for parity with the shared form contract.
   * @param field - top-level field of the section.
   * @param value - the value to store.
   * @returns whether the Host accepted the write.
   */
  set(field: string, value: unknown): Promise<boolean> {
    return this.mutate([{ op: 'set', path: [field], value: value as never }])
  }

  /**
   * Clear one field; kept for parity with the shared form contract.
   * @param field - top-level field of the section.
   * @returns whether the Host accepted the clear.
   */
  unset(field: string): Promise<boolean> {
    return this.mutate([{ op: 'unset', path: [field] }])
  }

  /** How many live subscriptions this form holds, so a spec can prove teardown. */
  get listenerCount(): number {
    return this.listeners.size
  }

  /** Replace the accepted section without a write, as an outside edit would. */
  accept(config: CwtoolsConfig, revision = (this.snapshot.revision ?? 0) + 1): void {
    this.publish({ value: config, revision })
  }

  /** Stop serving the entry, as a Host that unmounted the plugin would. */
  withdraw(): void {
    this.publish({ status: 'unavailable' })
  }

  /** Store the operations in the accepted value, mirroring the Host's document. */
  private apply(ops: readonly SettingsPathOpView[]): void {
    const value = structuredClone(this.snapshot.value ?? defaultConfig()) as unknown as Record<string, unknown>
    const user = structuredClone(this.snapshot.user ?? {}) as Record<string, unknown>
    for (const op of ops) {
      const { head, tail } = splitPath(op.path)
      if (op.op === 'unset') {
        if (tail === undefined) delete value[head]
        else delete (value[head] as Record<string, unknown> | undefined)?.[tail]
        continue
      }
      if (tail === undefined) {
        value[head] = op.value
        user[head] = op.value
        continue
      }
      const block = (value[head] ?? {}) as Record<string, unknown>
      block[tail] = op.value
      value[head] = block
      const userBlock = (user[head] ?? {}) as Record<string, unknown>
      userBlock[tail] = op.value
      user[head] = userBlock
    }
    this.publish({
      value: value as unknown as CwtoolsConfig,
      user,
      revision: (this.snapshot.revision ?? 0) + 1,
    })
  }

  private publish(patch: Partial<ConfigFormSnapshot<CwtoolsConfig>>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of [...this.listeners]) listener()
  }
}

/** A deployment whose settings document refuses writes. */
export function readOnlyConfig(): TestConfigForm {
  const form = new TestConfigForm()
  form.getSnapshot().writable = false
  return form
}

/** Spy surface for the actions a spec drives directly. */
export function actionSpies() {
  return {
    edit: vi.fn(),
    resetField: vi.fn(),
    save: vi.fn(),
    discard: vi.fn(),
    toggle: vi.fn(),
  }
}

/** Every read tool the first release ships, for count assertions. */
export const READ_TOOL_COUNT = CWTOOLS_READ_TOOL_NAMES.length