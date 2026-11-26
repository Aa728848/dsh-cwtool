/**
 * LocalisationMatrix — a pure, browser-safe React table over a multi-language
 * localisation matrix.
 *
 * One row per key, one editable cell per language. Missing values (empty or
 * undeclared) and duplicated definitions are marked with shared \`Tag\` badges.
 * Editing stages nothing itself: the \`Save\` control on a cell reports the
 * key/language/value to \`onSave\`, and the caller performs the actual write
 * (this component never touches the filesystem or the host).
 */
import { useMemo, useState } from 'react'
import { Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { panelsText, type PanelsLocale } from './panelsLocales.ts'
import css from './Panels.module.css'

/** One localisation key and its per-language values. */
export interface LocalisationRow {
  /** The localisation key, rendered verbatim. */
  readonly key: string
  /** Values by language header (e.g. \`l_english\`); an absent/empty value is missing. */
  readonly values: Readonly<Record<string, string>>
  /** Languages whose definitions are duplicated across files, marked separately from missing. */
  readonly duplicate?: readonly string[]
}

/** A single staged save the matrix asks the caller to persist. */
export interface LocalisationSave {
  readonly key: string
  readonly language: string
  readonly value: string
}

/** Props for {@link LocalisationMatrix}. */
export interface LocalisationMatrixProps {
  /** Interface language; defaults to English. */
  readonly locale?: PanelsLocale
  /** Language headers, in display order. */
  readonly languages: readonly string[]
  /** One row per key. */
  readonly rows: readonly LocalisationRow[]
  /** Called with a staged cell edit; the caller performs the actual write. */
  readonly onSave: (change: LocalisationSave) => void | Promise<void>
}

/** A value is missing when it is absent or empty after trimming. */
function isMissing(row: LocalisationRow, language: string): boolean {
  const value = row.values[language]
  return value === undefined || value.trim() === ''
}

/** One editable localisation cell with its missing/duplicate markers. */
function MatrixCell({ text, row, language, saved, onSave }: {
  text: ReturnType<typeof panelsText>
  row: LocalisationRow
  language: string
  saved: boolean
  onSave: LocalisationMatrixProps['onSave']
}) {
  const [draft, setDraft] = useState(row.values[language] ?? '')
  const [busy, setBusy] = useState(false)
  const missing = isMissing(row, language)
  const duplicate = row.duplicate?.includes(language) ?? false
  const changed = draft !== (row.values[language] ?? '')
  const commit = async () => {
    if (!changed) return
    setBusy(true)
    try {
      await onSave({ key: row.key, language, value: draft })
    } finally {
      setBusy(false)
    }
  }
  return <div className={css.cell}>
    <input value={draft} aria-label={row.key + ' · ' + language}
      onChange={(event) => { setDraft(event.target.value) }} />
    {(missing || duplicate) && <div className={css.badges}>
      {missing && <Tag tone='danger'>{text.locMissing}</Tag>}
      {duplicate && <Tag tone='warning'>{text.locDuplicate}</Tag>}
    </div>}
    <div className={css.cellActions}>
      <button type='button' disabled={!changed || busy}
        aria-label={text.locSave + ' ' + row.key + ' · ' + language}
        onClick={() => { void commit() }}>
        {text.locSave}
      </button>
      {saved && !changed && <Tag tone='success'>{text.locSaved}</Tag>}
    </div>
  </div>
}

/**
 * Render a localisation matrix.
 * @param props - languages, rows, and the save callback.
 * @returns the table, or an empty notice when there are no rows.
 */
export function LocalisationMatrix({ locale = 'en', languages, rows, onSave }: LocalisationMatrixProps) {
  const text = useMemo(() => panelsText(locale), [locale])
  const [saved, setSaved] = useState<ReadonlySet<string>>(new Set())
  if (rows.length === 0) return <section className={css.panel} aria-label={text.localisationTitle}>
    <h2 className={css.title}>{text.localisationTitle}</h2>
    <p className={css.empty}>{text.locEmpty}</p>
  </section>
  const save: LocalisationMatrixProps['onSave'] = async (change) => {
    await onSave(change)
    setSaved((previous) => new Set(previous).add(change.key + ' · ' + change.language))
  }
  return <section className={css.panel} aria-label={text.localisationTitle}>
    <h2 className={css.title}>{text.localisationTitle}</h2>
    <div className={css.tableWrap}>
      <table className={css.table}>
        <thead><tr>
          <th scope='col' className={css.keyCell}>{text.locKey}</th>
          {languages.map((language) => <th scope='col' key={language}>{language}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((row) => <tr key={row.key}>
            <th scope='row' className={css.keyCell}>{row.key}</th>
            {languages.map((language) => <td key={language}>
              <MatrixCell text={text} row={row} language={language}
                saved={saved.has(row.key + ' · ' + language)} onSave={save} />
            </td>)}
          </tr>)}
        </tbody>
      </table>
    </div>
  </section>
}
