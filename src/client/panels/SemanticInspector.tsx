/**
 * SemanticInspector — a pure, browser-safe React surface that drives the four
 * semantic queries (query_rules, query_scope, go_to_definition, find_references)
 * through caller-supplied handlers and renders only the real results they return.
 *
 * It deliberately ships no sample data: until the caller hands back a
 * \`SharedToolResult\`, the panel shows an idle notice. Handlers are the only side
 * effect, so the same component works against the live remote, a fixture, or a
 * mock in tests.
 */
import { useMemo, useState } from 'react'
import { SegmentedTabs, Tag, type SegmentedTab } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SharedToolResult } from 'cwtools-shared'
import { panelsText, type PanelsLocale } from './panelsLocales.ts'
import css from './Panels.module.css'

/** The four semantic query kinds this inspector can run. */
export type SemanticQueryKind = 'query_rules' | 'query_scope' | 'go_to_definition' | 'find_references'

/** Arguments a query is run with; every field is optional and narrowed per kind. */
export interface SemanticQueryArgs {
  readonly category?: string
  readonly name?: string
  readonly scope?: string
  readonly file?: string
  readonly line?: number
  readonly column?: number
  readonly symbolName?: string
  readonly identifier?: string
  readonly limit?: number
}

/** A handler runs one query against a real backend and returns its result. */
export type SemanticHandler = (args: SemanticQueryArgs) => Promise<SharedToolResult>

/** Handlers keyed by query kind; a missing handler is reported, never simulated. */
export interface SemanticHandlers {
  readonly query_rules?: SemanticHandler
  readonly query_scope?: SemanticHandler
  readonly go_to_definition?: SemanticHandler
  readonly find_references?: SemanticHandler
}

/** Props for {@link SemanticInspector}. */
export interface SemanticInspectorProps {
  /** Interface language; defaults to English. */
  readonly locale?: PanelsLocale
  /** Real handlers for each semantic query. */
  readonly handlers: SemanticHandlers
}

/** A single text/number input the active query renders. */
interface FieldSpec {
  readonly name: keyof SemanticQueryArgs
  readonly labelKey: keyof ReturnType<typeof panelsText>
  readonly numeric?: boolean
}

/** The fields each query exposes, in reading order. */
const FIELDS: Readonly<Record<SemanticQueryKind, readonly FieldSpec[]>> = {
  query_rules: [
    { name: 'category', labelKey: 'semCategory' },
    { name: 'name', labelKey: 'semName' },
    { name: 'scope', labelKey: 'semScopeName' },
  ],
  query_scope: [
    { name: 'file', labelKey: 'semFile' },
    { name: 'line', labelKey: 'semLine', numeric: true },
    { name: 'column', labelKey: 'semColumn', numeric: true },
  ],
  go_to_definition: [
    { name: 'symbolName', labelKey: 'semSymbol' },
    { name: 'file', labelKey: 'semFile' },
    { name: 'line', labelKey: 'semLine', numeric: true },
    { name: 'column', labelKey: 'semColumn', numeric: true },
  ],
  find_references: [
    { name: 'identifier', labelKey: 'semIdentifier' },
    { name: 'file', labelKey: 'semFile' },
    { name: 'line', labelKey: 'semLine', numeric: true },
    { name: 'column', labelKey: 'semColumn', numeric: true },
  ],
}

/** Human label per query kind. */
const KIND_LABEL: Readonly<Record<SemanticQueryKind, keyof ReturnType<typeof panelsText>>> = {
  query_rules: 'semRules',
  query_scope: 'semScope',
  go_to_definition: 'semDefinition',
  find_references: 'semReferences',
}

/** Narrow a raw input string into the typed arg the handler expects. */
function coerce(spec: FieldSpec, raw: string): SemanticQueryArgs[keyof SemanticQueryArgs] {
  const trimmed = raw.trim()
  if (trimmed === '') return undefined
  if (spec.numeric === true) {
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return trimmed
}

/** Drop the empty values so the handler receives only what the user supplied. */
function toArgs(fields: readonly FieldSpec[], values: Readonly<Record<string, string>>): SemanticQueryArgs {
  const result: Record<string, unknown> = {}
  for (const spec of fields) {
    const value = coerce(spec, values[spec.name] ?? '')
    if (value !== undefined) result[spec.name] = value
  }
  return result as SemanticQueryArgs
}

/** Render one real tool result: status, error, warnings, next steps, and data. */
function ResultView({ text, result }: { text: ReturnType<typeof panelsText>; result: SharedToolResult }) {
  const ok = result.ok
  return <div className={css.result} aria-label={text.semData}>
    <span className={css.pill} data-ok={ok ? 'true' : 'false'}>{result.status}</span>
    {!ok && result.error !== undefined && <pre className={css.failure}>{text.semError}: {result.error.code} — {result.error.message}</pre>}
    {result.warnings !== undefined && result.warnings.length > 0 && <ul className={css.warnings}>
      {result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
    </ul>}
    {result.nextSteps !== undefined && result.nextSteps.length > 0 && <ul className={css.nextSteps}>
      {result.nextSteps.map((step, index) => <li key={index}>{step}</li>)}
    </ul>}
    {result.data !== undefined && <pre className={css.json}>{JSON.stringify(result.data, null, 2)}</pre>}
  </div>
}

/**
 * Render the semantic inspector.
 * @param props - real handlers and interface locale.
 * @returns a query console that renders only the results a handler returns.
 */
export function SemanticInspector({ locale = 'en', handlers }: SemanticInspectorProps) {
  const text = useMemo(() => panelsText(locale), [locale])
  const [kind, setKind] = useState<SemanticQueryKind>('query_rules')
  const [values, setValues] = useState<Record<string, string>>({})
  const [result, setResult] = useState<SharedToolResult>()
  const [error, setError] = useState<string>()
  const [running, setRunning] = useState(false)
  const handler = handlers[kind]
  const fields = FIELDS[kind]
  const tabs = (Object.keys(KIND_LABEL) as SemanticQueryKind[]).map((value): SegmentedTab<SemanticQueryKind> => ({
    value, label: text[KIND_LABEL[value]], id: 'cwp-' + value, panelId: 'cwp-' + value + '-panel',
  })) as [SegmentedTab<SemanticQueryKind>, ...SegmentedTab<SemanticQueryKind>[]]
  const run = async () => {
    if (handler === undefined) return
    setRunning(true); setError(undefined); setResult(undefined)
    try {
      setResult(await handler(toArgs(fields, values)))
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setRunning(false)
    }
  }
  const switchKind = (next: SemanticQueryKind) => {
    setKind(next); setValues({}); setResult(undefined); setError(undefined)
  }
  return <section className={css.panel} aria-label={text.semanticTitle}>
    <h2 className={css.title}>{text.semanticTitle}</h2>
    <SegmentedTabs items={tabs} value={kind} onChange={switchKind} label={text.semanticTitle} size='sm' />
    <div className={css.metaRow}>
      {fields.map((spec) => <label key={spec.name}>{text[spec.labelKey]}
        <input value={values[spec.name] ?? ''} inputMode={spec.numeric === true ? 'numeric' : 'text'}
          onChange={(event) => { const v = event.target.value; setValues((previous) => ({ ...previous, [spec.name]: v })) }} />
      </label>)}
    </div>
    <div className={css.toolRow}>
      <button type='button' disabled={handler === undefined || running} onClick={() => { void run() }}>
        {running ? text.semRunning : text.semRun}
      </button>
      {handler === undefined && <Tag tone='neutral'>{text.semNoHandler}</Tag>}
    </div>
    {error !== undefined
      ? <pre className={css.failure}>{text.semError}: {error}</pre>
      : result !== undefined
        ? <ResultView text={text} result={result} />
        : <p className={css.empty}>{text.semIdle}</p>}
  </section>
}
