/**
 * CWTools settings partition, browser half.
 *
 * The section edits the `cwtools` Host entry through the shared `configForms`
 * service. It owns no permission state of its own: the read groups, the tool
 * grants, the single write this release ships, and every backend bound are the
 * same document the Host validates and the same values the tool surfaces read.
 * The page therefore appears only while the Host actually serves that entry.
 */

// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the ctx.configForms Context merge and the settings slot
// declarations. Cross-plugin collaboration goes through the service, never a
// value import (client bundle purity gate).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { CwtoolsConfig } from '../contract/configTypes.ts'
import { CWTOOLS_SETTINGS_NAMESPACE, CwtoolsSettingsController } from './cwtools-controller.ts'
import type { CwtoolsSectionFace } from './cwtools-controller.ts'
import { CwtoolsSection } from './CwtoolsSection.tsx'
import { CwtoolsSectionIcon } from './CwtoolsSectionIcon.tsx'
import { en, zh, type CwtoolsLocaleKey } from './locales.ts'
import { CwtoolsRightWorkbench } from './CwtoolsRightWorkbench.tsx'
import { workbenchEn, workbenchZh, type CwtoolsWorkbenchLocaleKey } from './workbenchLocales.ts'
import { CWTOOLS_WORKBENCH_REMOTE } from './workbenchRemote.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** CWTools settings section copy. */
    'settings.cwtools': CwtoolsLocaleKey
    'workbench.cwtools': CwtoolsWorkbenchLocaleKey
  }
}

export type { CwtoolsLocaleKey } from './locales.ts'
export type { CwtoolsSectionProps } from './CwtoolsSection.tsx'
export type {
  CwtoolsAcceptedValue, CwtoolsFieldRef, CwtoolsSectionFace, CwtoolsSectionState,
} from './cwtools-controller.ts'

/** Dictionary namespace owned by this plugin. */
const NS = 'settings.cwtools'

/** Slot id shared by the section and its navigation icon. */
const SECTION_ID = 'cwtools'
const WORKBENCH_NS = 'workbench.cwtools'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'configForms', 'remote', 'sidebarRightTabs']

/**
 * Mount the settings section while the Host serves the `cwtools` entry.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'dsh-cwtools: settings dictionaries')
  ctx.effect(() => ctx.locale.register(WORKBENCH_NS, { en: workbenchEn, zh: workbenchZh }), 'dsh-cwtools: workbench dictionaries')
  ctx.effect(async () => {
    const unmount = await ctx.remote.$mount(CWTOOLS_WORKBENCH_REMOTE)
    const remote = ctx.get('remote.cwtoolsWorkbench')
    if (remote === undefined) throw new Error('dsh-cwtools: the Workbench Remote namespace did not mount')
    const id = 'dsh-cwtools'
    const unregister = ctx.sidebarRightTabs.register({
      id, kind: 'cwtools-workbench', title: () => ctx.locale.bind(WORKBENCH_NS)('title'),
      guide: [{ id: 'open', order: 30, title: () => ctx.locale.bind(WORKBENCH_NS)('title'), description: () => ctx.locale.bind(WORKBENCH_NS)('guideDescription') }],
    })
    const dispose = ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
      name: 'sidebar.right.pane.tab', key: id, locale: WORKBENCH_NS,
      inject: () => ({ remote }),
    }, CwtoolsRightWorkbench))
    return async () => { dispose(); unregister(); await unmount() }
  }, 'dsh-cwtools: Workbench Remote and sidebar launcher')
  const form = ctx.configForms.get<CwtoolsConfig>(CWTOOLS_SETTINGS_NAMESPACE)
  const controller = new CwtoolsSettingsController(form)
  ctx.effect(() => () => { controller.dispose() }, 'dsh-cwtools: settings form subscription')
  const face = (): CwtoolsSectionFace => controller.inject()
  // The section exists only for a deployment that actually serves the entry:
  // a Host that stopped serving it leaves no navigation row behind.
  ctx.effect(() => ctx.configForms.whileServed([CWTOOLS_SETTINGS_NAMESPACE], () => {
    const section = ctx.slots.inject('settings.section', () => ctx.slots.register({
      name: 'settings.section',
      id: SECTION_ID,
      order: 40,
      label: () => t('nav'),
      locale: NS,
      inject: face,
    }, CwtoolsSection))
    const icon = ctx.slots.inject('settings.section.icon', () => ctx.slots.register({
      name: 'settings.section.icon',
      id: SECTION_ID,
      locale: NS,
    }, CwtoolsSectionIcon))
    return () => {
      section()
      icon()
    }
  }), 'dsh-cwtools: settings section')
}