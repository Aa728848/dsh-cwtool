/**
 * The CWTools settings section.
 *
 * One page over the `cwtools` Host entry: the backend and project paths, the
 * timeout and runtime bounds, the six read groups with their 37 tools, the one
 * write this release ships, and the result preview bound.
 *
 * The page stages nothing itself: every control reports what the user typed to
 * the controller, and the shared `SettingsForm` frame is the single place a
 * draft becomes a document mutation. Leaving the page drops the drafts.
 */
import { useId } from 'react'
import { SettingsForm, SettingsValueField, Switch, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  CWTOOLS_READ_GROUP_ORDER, CWTOOLS_READ_TOOL_GROUPS,
  type CwtoolsReadGroup,
} from '../contract/toolCatalog.ts'
import type { CwtoolsSectionFace, CwtoolsSectionState } from './cwtools-controller.ts'
import { formLabels, type CwtoolsLocaleKey } from './locales.ts'
import css from './CwtoolsSection.module.css'

/** Props assembled by the settings renderer for this section. */
export type CwtoolsSectionProps = PropsRuntime<'settings.section'>
  & PropsLocale<'settings.cwtools'>
  & InjectFace<CwtoolsSectionFace>

/** Locale keys of every group heading. */
const GROUP_LABEL: Record<CwtoolsReadGroup, CwtoolsLocaleKey> = {
  project: 'groupProject',
  localisation: 'groupLocalisation',
  semantic: 'groupSemantic',
  navigation: 'groupNavigation',
  diagnostics: 'groupDiagnostics',
  shader: 'groupShader',
}

/** Label and hint of every named field, keyed by dotted path. */
const FIELD_COPY: Record<string, { label: CwtoolsLocaleKey; hint: CwtoolsLocaleKey }> = {
  'enabled': { label: 'enabled', hint: 'enabledHint' },
  'backend.serverPath': { label: 'serverPath', hint: 'serverPathHint' },
  'backend.gamePath': { label: 'gamePath', hint: 'gamePathHint' },
  'backend.rulesPath': { label: 'rulesPath', hint: 'rulesPathHint' },
  'backend.cachePath': { label: 'cachePath', hint: 'cachePathHint' },
  'backend.game': { label: 'game', hint: 'gameHint' },
  'backend.forceStart': { label: 'forceStart', hint: 'forceStartHint' },
  'backend.debug': { label: 'debug', hint: 'debugHint' },
  'backend.startupTimeoutMs': { label: 'startupTimeoutMs', hint: 'startupTimeoutMsHint' },
  'backend.requestTimeoutMs': { label: 'requestTimeoutMs', hint: 'requestTimeoutMsHint' },
  'backend.idleShutdownMs': { label: 'idleShutdownMs', hint: 'idleShutdownMsHint' },
  'backend.maxWorkspaceRuntimes': { label: 'maxWorkspaceRuntimes', hint: 'maxWorkspaceRuntimesHint' },
  'writeTools.write_localisation': { label: 'writeLocalisation', hint: 'writeLocalisationHint' },
  'output.maxResultChars': { label: 'maxResultChars', hint: 'maxResultCharsHint' },
}

/** Text and number fields of the page, in rendering order. */
const TEXT_ROW_FIELDS: readonly string[] = [
  'backend.serverPath',
  'backend.gamePath',
  'backend.rulesPath',
  'backend.cachePath',
  'backend.game',
]

/** Number fields of the backend block. */
const BACKEND_NUMBER_FIELDS: readonly string[] = [
  'backend.startupTimeoutMs',
  'backend.requestTimeoutMs',
  'backend.idleShutdownMs',
  'backend.maxWorkspaceRuntimes',
]

/** Switches of the backend block. */
const BACKEND_SWITCH_FIELDS: readonly string[] = ['backend.forceStart', 'backend.debug']

/** One switch row: its copy, the reset a stored override offers, and the control. */
function SwitchRow({ id, checked, overridden, disabled, copy, t, onToggle, onReset }: {
  id: string
  checked: boolean
  overridden: boolean
  disabled: boolean
  copy: { label: CwtoolsLocaleKey; hint: CwtoolsLocaleKey }
  t: (key: CwtoolsLocaleKey) => string
  onToggle: (next: boolean) => void
  onReset: () => void
}) {
  return <div className={css.row}>
    <div className={css.rowText}>
      <span className={css.rowLabel} id={id + '-label'}>{t(copy.label)}</span>
      <span className={css.rowHint}>{t(copy.hint)}</span>
    </div>
    <div className={css.rowMark}>
      {overridden
        ? <>
          <Tag tone="neutral">{t('overridden')}</Tag>
          <button type="button" className={css.reset} disabled={disabled} onClick={onReset}>
            {t('reset')}
          </button>
        </>
        : null}
      <Switch checked={checked} label={t(copy.label)} disabled={disabled}
        onChange={(next) => { onToggle(next) }} />
      <span className={css.rowHint}>{checked ? t('on') : t('off')}</span>
    </div>
  </div>
}

/** One read group: its switch, and every tool it owns. */
function GroupBlock({ group, state, disabled, t, onToggle, onReset }: {
  group: CwtoolsReadGroup
  state: CwtoolsSectionState
  disabled: boolean
  t: (key: CwtoolsLocaleKey) => string
  onToggle: (field: string, next: boolean) => void
  onReset: (field: string) => void
}) {
  const groupField = 'readGroups.' + group
  const active = state.groups[group]
  const tools = CWTOOLS_READ_TOOL_GROUPS[group]
  return <section className={css.group} aria-label={t(GROUP_LABEL[group])}>
    <div className={css.groupHead}>
      <h4 className={css.groupTitle}>{t(GROUP_LABEL[group])}</h4>
      <div className={css.rowMark}>
        <span className={css.groupCount}>{tools.length}</span>
        <Switch checked={active} label={t(GROUP_LABEL[group])} disabled={disabled}
          onChange={(next) => { onToggle(groupField, next) }} />
        {state.fields[groupField]?.overridden
          ? <button type="button" className={css.reset} disabled={disabled} onClick={() => { onReset(groupField) }}>
            {t('reset')}
          </button>
          : null}
      </div>
    </div>
    <ul className={css.tools}>
      {tools.map((tool) => {
        const toolField = 'readTools.' + tool
        const granted = state.fields[toolField]?.text === 'true'
        const toolDisabled = disabled || !active
        return <li key={tool} className={state.tools[tool] ? css.tool : css.tool + ' ' + css.toolOff}>
          <Switch checked={granted} label={tool} disabled={toolDisabled}
            title={toolDisabled ? t('groupDisabledNote') : tool}
            onChange={(next) => { onToggle(toolField, next) }} />
          <span className={css.toolName}>{tool}</span>
        </li>
      })}
    </ul>
  </section>
}

/**
 * Render the CWTools settings section.
 * @param props - the section snapshot, its staged actions, and localized copy.
 * @returns the page inside the shared settings form frame.
 */
export function CwtoolsSection(props: CwtoolsSectionProps) {
  const { t } = props
  const state = props.useCwtoolsSection(value => value)
  const id = useId()
  const locked = !state.writable || state.saving
  const controlId = (field: string): string => id + '-' + field.replaceAll('.', '-')
  const copyOf = (field: string) => FIELD_COPY[field]
  const fieldOf = (path: string) => state.fields[path] ?? { text: '', overridden: false, invalid: false }
  const switchRow = (path: string, disabled: boolean) => {
    const copy = copyOf(path)
    /* v8 ignore next 2 -- every rendered switch is declared in FIELD_COPY. */
    if (copy === undefined) return null
    const current = fieldOf(path)
    return <SwitchRow key={path} id={controlId(path)} checked={current.text === 'true'}
      overridden={current.overridden} disabled={disabled} copy={copy} t={t}
      onToggle={(next) => { props.toggle(path, next) }}
      onReset={() => { props.resetField(path) }} />
  }
  const valueRow = (path: string, numeric: boolean) => {
    const copy = copyOf(path)
    /* v8 ignore next 2 -- every rendered value field is declared in FIELD_COPY. */
    if (copy === undefined) return null
    const current = fieldOf(path)
    return <SettingsValueField key={path} id={controlId(path)} label={t(copy.label)} hint={t(copy.hint)}
      numeric={numeric} disabled={locked} {...current}
      overriddenLabel={t('overridden')} resetLabel={t('reset')} invalidLabel={t('invalidNumber')}
      onEdit={(text) => { props.edit(path, text) }}
      onReset={() => { props.resetField(path) }} />
  }
  return <section className={css.section}>
    <h2 className={css.title}>{t('title')}</h2>
    <p className={css.intro}>{t('intro')}</p>
    <SettingsForm labels={formLabels(t)} state={state} onSave={props.save} onDiscard={props.discard}>
      {state.failed
        ? <div className={css.failure} role="alert">
          <p className={css.failureTitle}>{t('failedTitle')}</p>
          {state.conflict ? <p className={css.note}>{t('conflictNotice')}</p> : null}
          {state.accepted.length === 0 ? null : <dl className={css.accepted}>
            <dt>{t('acceptedValue')}</dt>
            {state.accepted.map(entry => <dd key={entry.field}>
              <code>{entry.field}</code> {entry.text === '' ? t('emptyValue') : entry.text}
            </dd>)}
          </dl>}
          <p className={css.note}>{t('retryHint')}</p>
        </div>
        : null}
      {switchRow('enabled', locked)}
      <div className={css.block}>
        <h3 className={css.blockHead}>{t('sectionBackend')}</h3>
        <div className={css.fields}>{TEXT_ROW_FIELDS.map(path => valueRow(path, false))}</div>
        <div className={css.fields}>{BACKEND_NUMBER_FIELDS.map(path => valueRow(path, true))}</div>
        {BACKEND_SWITCH_FIELDS.map(path => switchRow(path, locked))}
      </div>
      <div className={css.block}>
        <h3 className={css.blockHead}>{t('sectionReadAccess')}</h3>
        <p className={css.note}>{t('readAccessIntro')}</p>
        <div className={css.groups}>
          {CWTOOLS_READ_GROUP_ORDER.map(group => <GroupBlock key={group} group={group} state={state}
            disabled={locked} t={t} onToggle={props.toggle} onReset={props.resetField} />)}
        </div>
        <p className={css.note}>{t('groupDisabledNote')}</p>
      </div>
      <div className={css.block}>
        <h3 className={css.blockHead}>{t('sectionWriteAccess')}</h3>
        {switchRow('writeTools.write_localisation', locked)}
        <p className={css.note}>{t('writePolicyNote')}</p>
      </div>
      <div className={css.block}>
        <h3 className={css.blockHead}>{t('sectionOutput')}</h3>
        <div className={css.fields}>{valueRow('output.maxResultChars', true)}</div>
      </div>
    </SettingsForm>
  </section>
}