/**
 * Staged configuration form for the CWTools settings section.
 *
 * The section edits one Host entry (`cwtools`). Its fields are leaves one or
 * two levels deep (`backend.*`, `readGroups.*`, `readTools.*`,
 * `writeTools.*`, `output.*`), while the shared `SettingsFormModel` addresses
 * top-level fields of a section with a single-element path. This module
 * therefore presents the entry through a flat view: the shared model stages and
 * validates every leaf exactly as it does for a plugin card, and this adapter
 * translates each single-element path back into the nested path the Host
 * document stores.
 *
 * Only a save writes. One save is one `mutate` call, so a single revision fence
 * covers every control the user touched, a refused save keeps its drafts, and a
 * reset is an `unset` that lets the field re-inherit the composition layer.
 *
 * A disabled group keeps its per-tool values: turning a group off only disables
 * its child controls, and every tool stays on the ledger so re-enabling the
 * group restores exactly the grants it had.
 */
import type { SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import {
  SettingsFormModel, settingsNumberField, settingsTextField,
  type SettingsFieldSpec, type SettingsFieldState, type SettingsFormActions,
  type SettingsFormPathOp, type SettingsFormScope, type SettingsFormScopeSnapshot,
  type SettingsFormShell,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { CwtoolsConfig } from '../contract/configTypes.ts'
import {
  CWTOOLS_READ_GROUP_ORDER, CWTOOLS_READ_TOOL_GROUPS, CWTOOLS_READ_TOOL_NAMES,
  cwtoolsReadGroupFor,
  type CwtoolsReadGroup, type CwtoolsReadToolName,
} from '../contract/toolCatalog.ts'

/** Settings namespace of the Host entry this section edits. */
export const CWTOOLS_SETTINGS_NAMESPACE = 'cwtools'

/** Configuration block a leaf belongs to. */
type CwtoolsBlock = 'enabled' | 'backend' | 'readGroups' | 'readTools' | 'writeTools' | 'output'

/** One leaf field of the section, addressed inside the Host document. */
export interface CwtoolsFieldRef {
  /** Dotted path inside the namespace section. */
  field: string
  /** Configuration block the leaf belongs to. */
  block: CwtoolsBlock
}

/** A value the Host holds for one field after a save it did not accept. */
export interface CwtoolsAcceptedValue {
  /** Dotted path of the field. */
  field: string
  /** The value the Host kept, rendered as that field's draft text. */
  text: string
}

/** What the section renders: shared form state plus this entry's fields. */
export interface CwtoolsSectionState extends SettingsFormShell {
  /** Every control's draft text and validity, keyed by dotted path. */
  fields: Record<string, SettingsFieldState>
  /** Effective on-state of each read group. */
  groups: Record<CwtoolsReadGroup, boolean>
  /** Effective on-state of each tool: its own grant AND its group's. */
  tools: Record<CwtoolsReadToolName, boolean>
  /** Whether the refused save lost a revision race with an edit made elsewhere. */
  conflict: boolean
  /** Values the Host still holds after a refused save; empty otherwise. */
  accepted: readonly CwtoolsAcceptedValue[]
}

/** Actions and observable state the slot renderer binds. */
export interface CwtoolsSectionFace extends SettingsFormActions {
  hooks: {
    cwtoolsSection: SnapshotStore<CwtoolsSectionState>
  }
  /**
   * Stage one switch.
   * @param field - dotted path of the switch.
   * @param next - the value the user asked for.
   */
  toggle: (field: string, next: boolean) => void
}

/** Absolute paths and the game identifier of the backend block. */
const TEXT_FIELDS: readonly CwtoolsFieldRef[] = [
  { field: 'backend.serverPath', block: 'backend' },
  { field: 'backend.gamePath', block: 'backend' },
  { field: 'backend.rulesPath', block: 'backend' },
  { field: 'backend.cachePath', block: 'backend' },
  { field: 'backend.activeManifestPath', block: 'backend' },
  { field: 'backend.game', block: 'backend' },
]

/**
 * Whole-number fields with the bounds the Host schema enforces.
 *
 * The Host owns these bounds (`src/config.ts`); the copy here only decides
 * whether a draft is worth sending, so a typo fails in the form instead of
 * becoming a refused write. A draft the Host rejects anyway is refused there
 * and keeps its drafts.
 */
const NUMBER_FIELDS: readonly (CwtoolsFieldRef & { min: number; max: number })[] = [
  { field: 'backend.startupTimeoutMs', block: 'backend', min: 1, max: 2_147_483_647 },
  { field: 'backend.requestTimeoutMs', block: 'backend', min: 1, max: 2_147_483_647 },
  { field: 'backend.idleShutdownMs', block: 'backend', min: 1, max: 2_147_483_647 },
  { field: 'backend.maxWorkspaceRuntimes', block: 'backend', min: 1, max: 8 },
  { field: 'output.maxResultChars', block: 'output', min: 1_000, max: 200_000 },
]

/** Switches that are off until someone stores them. */
const DEFAULT_OFF_FIELDS: readonly CwtoolsFieldRef[] = [
  { field: 'backend.forceStart', block: 'backend' },
  { field: 'backend.debug', block: 'backend' },
  { field: 'writeTools.write_localisation', block: 'writeTools' },
]

/** Switches whose absent value means on: the master switch and every read grant. */
const DEFAULT_ON_FIELDS: readonly CwtoolsFieldRef[] = [
  { field: 'enabled', block: 'enabled' },
  { field: 'backend.preferActiveBackend', block: 'backend' },
  ...CWTOOLS_READ_GROUP_ORDER.map((group): CwtoolsFieldRef => ({ field: `readGroups.${group}`, block: 'readGroups' })),
  ...CWTOOLS_READ_TOOL_NAMES.map((tool): CwtoolsFieldRef => ({ field: `readTools.${tool}`, block: 'readTools' })),
]

/** Master switch and backend fields, in the order the page renders them. */
const topLevel = (block: CwtoolsBlock): readonly CwtoolsFieldRef[] =>
  [...TEXT_FIELDS, ...DEFAULT_OFF_FIELDS, ...NUMBER_FIELDS, ...DEFAULT_ON_FIELDS]
    .filter(ref => ref.block === block)

/** Every control on the page, in rendering order. */
export const CWTOOLS_FIELDS: readonly CwtoolsFieldRef[] = [
  ...topLevel('enabled'),
  ...topLevel('backend'),
  ...topLevel('readGroups'),
  ...topLevel('readTools'),
  ...topLevel('writeTools'),
  ...topLevel('output'),
]

/** Every leaf of the entry, addressed by dotted path. */
type FlatSection = Record<string, unknown>

/**
 * Expand one level of block nesting into dotted leaf paths.
 * @param section - an accepted section or one of its composition layers.
 * @returns its leaves by dotted path; a nested object is expanded, not kept.
 */
function flatten(section: unknown): FlatSection {
  const flat: FlatSection = {}
  if (typeof section !== 'object' || section === null || Array.isArray(section)) return flat
  for (const [key, value] of Object.entries(section)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      for (const [child, leaf] of Object.entries(value)) flat[`${key}.${child}`] = leaf
    } else {
      flat[key] = value
    }
  }
  return flat
}

/**
 * The conversion spec of one switch.
 * @param field - dotted path of the switch.
 * @param fallback - the text an absent value renders as.
 * @returns the field's conversion spec.
 */
function switchField(field: string, fallback: 'true' | 'false'): SettingsFieldSpec {
  return {
    field,
    format: value => (typeof value === 'boolean' ? String(value) : fallback),
    parse: text => (text === 'true' ? { kind: 'set', value: true }
      : text === 'false' ? { kind: 'set', value: false } : undefined),
  }
}

/**
 * A whole-number field that also refuses drafts outside the Host's bounds.
 * @param ref - the field and its inclusive bounds.
 * @returns the field's conversion spec.
 */
function boundedNumberField(ref: CwtoolsFieldRef & { min: number; max: number }): SettingsFieldSpec {
  const numeric = settingsNumberField(ref.field)
  return {
    ...numeric,
    parse: (text) => {
      const write = numeric.parse(text)
      if (write?.kind !== 'set') return write
      const value = write.value as number
      return Number.isSafeInteger(value) && value >= ref.min && value <= ref.max ? write : undefined
    },
  }
}

/** The conversion spec of every control on the page. */
const SPECS: readonly SettingsFieldSpec[] = [
  ...topLevel('enabled').map(ref => switchField(ref.field, 'true')),
  ...DEFAULT_ON_FIELDS.filter(ref => ref.block === 'backend').map(ref => switchField(ref.field, 'true')),
  ...TEXT_FIELDS.map(ref => settingsTextField(ref.field)),
  ...DEFAULT_OFF_FIELDS.filter(ref => ref.block === 'backend').map(ref => switchField(ref.field, 'false')),
  ...NUMBER_FIELDS.filter(ref => ref.block === 'backend').map(boundedNumberField),
  ...topLevel('readGroups').map(ref => switchField(ref.field, 'true')),
  ...topLevel('readTools').map(ref => switchField(ref.field, 'true')),
  ...DEFAULT_OFF_FIELDS.filter(ref => ref.block === 'writeTools').map(ref => switchField(ref.field, 'false')),
  ...NUMBER_FIELDS.filter(ref => ref.block === 'output').map(boundedNumberField),
]

/** Read the spec of one field. */
const specOf = (field: string): SettingsFieldSpec | undefined => SPECS.find(candidate => candidate.field === field)

/**
 * Present one Host entry as a flat section, and translate its single-element
 * write paths back into the nested paths the document stores.
 */
class FlatSectionScope implements SettingsFormScope<FlatSection> {
  /** The last write attempted, so the section can tell a refusal from a conflict. */
  lastWrite: { readonly fields: readonly string[]; readonly revision: number | undefined; accepted: boolean } | undefined
  private cache: { readonly source: SettingsFormScopeSnapshot<CwtoolsConfig>; readonly flat: SettingsFormScopeSnapshot<FlatSection> } | undefined
  private readonly listeners = new Set<() => void>()

  /** @param form - the shared configuration form of this Host entry. */
  constructor(private readonly form: ConfigForm<CwtoolsConfig>) {}

  /** @returns the entry's current snapshot with every block flattened. */
  getSnapshot(): SettingsFormScopeSnapshot<FlatSection> {
    const source = this.form.getSnapshot()
    if (this.cache?.source === source) return this.cache.flat
    const flat: SettingsFormScopeSnapshot<FlatSection> = {
      status: source.status,
      value: source.value === undefined ? undefined : flatten(source.value),
      base: flatten(source.base),
      user: flatten(source.user),
      writable: source.writable,
      revision: source.revision,
    }
    this.cache = { source, flat }
    return flat
  }

  /**
   * Observe snapshot replacements, keeping this adapter's own listeners so a
   * settled write republishes the refusal bookkeeping.
   * @param listener - invoked after each change.
   * @returns the disposer removing this listener.
   */
  subscribe(listener: () => void): () => void {
    const unsubscribe = this.form.subscribe(listener)
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
      unsubscribe()
    }
  }

  /**
   * Write one save's operations as a single revision-fenced mutation.
   * @param ops - the staged operations, addressed by dotted path.
   * @param expectedRevision - the revision the drafts were staged against.
   * @returns whether the Host accepted the mutation.
   */
  async mutate(ops: readonly SettingsFormPathOp[], expectedRevision?: number): Promise<boolean> {
    const revision = expectedRevision ?? this.form.getSnapshot().revision
    this.lastWrite = { fields: ops.map(op => op.path.join('.')), revision, accepted: false }
    const accepted = await this.form.mutate(ops.map(toWireOp), revision)
    this.lastWrite = { fields: this.lastWrite.fields, revision, accepted }
    for (const listener of [...this.listeners]) listener()
    return accepted
  }

  /** Release this view of the shared form. */
  dispose(): void {
    this.listeners.clear()
  }
}

/**
 * Translate one staged operation into the wire shape the Host accepts: the
 * single dotted segment the shared model uses becomes the nested path the
 * Host document stores.
 * @param op - the staged operation.
 * @returns the same operation addressed inside the document.
 */
function toWireOp(op: SettingsFormPathOp): SettingsPathOpView {
  const path = [...op.path].flatMap(segment => segment.split('.'))
  return op.op === 'set'
    ? { op: 'set', path, value: op.value as SettingsPathOpView extends { value: infer V } ? V : never }
    : { op: 'unset', path }
}

/**
 * Bind the whole CWTools section to one staged form.
 *
 * Every control is staged; a save writes the staged edits together; leaving the
 * page drops them. A refused save keeps its drafts, reports the values the Host
 * still holds, and says whether the document moved underneath.
 */
export class CwtoolsSettingsController {
  private readonly scope: FlatSectionScope
  private readonly form: SettingsFormModel<FlatSection>
  private readonly store: SnapshotStore<CwtoolsSectionState>

  /** @param form - the shared configuration form of the `cwtools` entry. */
  constructor(form: ConfigForm<CwtoolsConfig>) {
    this.scope = new FlatSectionScope(form)
    this.form = new SettingsFormModel<FlatSection>(this.scope, [...SPECS])
    this.store = this.form.bind(() => this.project())
  }

  /**
   * Bind the section to the slot renderer.
   * @returns the section snapshot and its staged actions.
   */
  inject(): CwtoolsSectionFace {
    return {
      hooks: { cwtoolsSection: this.store },
      ...this.form.actions(),
      toggle: (field, next) => { this.form.actions().edit(field, String(next)) },
    }
  }

  /** Release the accepted-value subscription and the flattened view. */
  dispose(): void {
    this.form.dispose()
    this.scope.dispose()
  }

  /** Rebuild everything the component renders from the current reads and drafts. */
  private project(): CwtoolsSectionState {
    const shell = this.form.shell()
    const fields: Record<string, SettingsFieldState> = {}
    for (const ref of CWTOOLS_FIELDS) fields[ref.field] = this.form.field(ref.field)
    const stored = (field: string): boolean => fields[field]?.text === 'true'
    const groups = {} as Record<CwtoolsReadGroup, boolean>
    for (const group of CWTOOLS_READ_GROUP_ORDER) groups[group] = stored(`readGroups.${group}`)
    const tools = {} as Record<CwtoolsReadToolName, boolean>
    for (const tool of CWTOOLS_READ_TOOL_NAMES) tools[tool] = groups[cwtoolsReadGroupFor(tool)] && stored(`readTools.${tool}`)
    return {
      ...shell,
      fields,
      groups,
      tools,
      conflict: shell.failed && this.conflict(),
      accepted: shell.failed ? this.acceptedValues() : [],
    }
  }

  /** Whether the refused write lost a revision race rather than failing validation. */
  private conflict(): boolean {
    const write = this.scope.lastWrite
    if (write === undefined || write.accepted) return false
    const revision = this.scope.getSnapshot().revision
    return write.revision !== undefined && revision !== undefined && revision !== write.revision
  }

  /**
   * The values the Host still holds for the fields the refused save tried to
   * write. Read from the accepted section, never from the draft, so the notice
   * shows what a reload would restore.
   */
  private acceptedValues(): readonly CwtoolsAcceptedValue[] {
    const write = this.scope.lastWrite
    if (write === undefined) return []
    const accepted = this.scope.getSnapshot().value ?? {}
    return write.fields.flatMap((field) => {
      const spec = specOf(field)
      if (spec === undefined) return []
      return [{ field, text: spec.format(accepted[field]) }]
    })
  }
}
