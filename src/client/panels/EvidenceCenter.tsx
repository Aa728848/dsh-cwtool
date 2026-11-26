/**
 * EvidenceCenter — a pure, browser-safe React surface for Before/After/Diff
 * capture evidence.
 *
 * Every capture carries its own pixel ratio, version, and source, and records a
 * failure with its reason instead of pretending success. Images are plain URLs
 * (data or object URLs); the component only renders them, it never reads files.
 */
import { useMemo } from 'react'
import { Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { panelsText, type PanelsLocale } from './panelsLocales.ts'
import css from './Panels.module.css'

/** One capture's Before/After/Diff images and its provenance. */
export interface EvidenceEntry {
  /** Stable id for list keys. */
  readonly id: string
  /** Human title of the scenario captured. */
  readonly title: string
  /** Before image URL, when available. */
  readonly before?: string
  /** After image URL, when available. */
  readonly after?: string
  /** Diff image URL, when available. */
  readonly diff?: string
  /** Device pixel ratio the captures were taken at. */
  readonly pixelRatio?: number
  /** Version the captures belong to. */
  readonly version?: string
  /** Where the capture came from (tool, build, or author). */
  readonly source?: string
  /** Whether the capture step failed. */
  readonly failed?: boolean
  /** Human-readable failure detail, shown only when \`failed\` is true. */
  readonly failureReason?: string
}

/** Props for {@link EvidenceCenter}. */
export interface EvidenceCenterProps {
  /** Interface language; defaults to English. */
  readonly locale?: PanelsLocale
  /** Captures to render, in order. */
  readonly entries: readonly EvidenceEntry[]
}

/** One labeled image slot that degrades to a notice when no URL is supplied. */
function Figure({ src, caption, noImage }: { src: string | undefined; caption: string; noImage: string }) {
  return <figure className={css.figure}>
    <figcaption>{caption}</figcaption>
    {src === undefined
      ? <span className={css.noImage}>{noImage}</span>
      : <img src={src} alt={caption} />}
  </figure>
}

/** One evidence card: status, images, and provenance. */
function EvidenceCard({ text, entry }: { text: ReturnType<typeof panelsText>; entry: EvidenceEntry }) {
  const failed = entry.failed === true
  return <article className={css.evidenceCard} aria-label={entry.title}>
    <div className={css.evidenceHead}>
      <strong>{entry.title}</strong>
      <Tag tone={failed ? 'danger' : entry.after !== undefined ? 'success' : 'neutral'}>
        {failed ? text.evFailed : entry.after !== undefined ? text.evVerified : text.evPending}
      </Tag>
    </div>
    <div className={css.evidenceGrid}>
      <Figure src={entry.before} caption={text.evBefore} noImage={text.evNoImage} />
      <Figure src={entry.after} caption={text.evAfter} noImage={text.evNoImage} />
      <Figure src={entry.diff} caption={text.evDiff} noImage={text.evNoImage} />
    </div>
    <div className={css.meta}>
      {entry.pixelRatio !== undefined && <span>{text.evPixelRatio}: {entry.pixelRatio}×</span>}
      {entry.version !== undefined && <span>{text.evVersion}: {entry.version}</span>}
      {entry.source !== undefined && <span>{text.evSource}: {entry.source}</span>}
    </div>
    {failed && entry.failureReason !== undefined && <pre className={css.failure}>{text.evFailureReason}: {entry.failureReason}</pre>}
  </article>
}

/**
 * Render the evidence center.
 * @param props - captures and interface locale.
 * @returns the capture list, or an empty notice when there are none.
 */
export function EvidenceCenter({ locale = 'en', entries }: EvidenceCenterProps) {
  const text = useMemo(() => panelsText(locale), [locale])
  if (entries.length === 0) return <section className={css.panel} aria-label={text.evidenceTitle}>
    <h2 className={css.title}>{text.evidenceTitle}</h2>
    <p className={css.empty}>{text.evEmpty}</p>
  </section>
  return <section className={css.panel} aria-label={text.evidenceTitle}>
    <h2 className={css.title}>{text.evidenceTitle}</h2>
    <div className={css.evidenceList}>
      {entries.map((entry) => <EvidenceCard key={entry.id} text={text} entry={entry} />)}
    </div>
  </section>
}
