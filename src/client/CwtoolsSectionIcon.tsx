/** The CWTools section's navigation mark: a stylized C over the rule braces. */
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'

/**
 * Render the CWTools navigation icon.
 * @param props - requested edge in pixels and whether this section is selected.
 * @returns a decorative SVG in the current text color.
 */
export function CwtoolsSectionIcon({ size, active }: PropsRuntime<'settings.section.icon'>) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true"
    data-cwtools-icon={active ? 'active' : 'idle'}>
    <path d="M11.6 4.2A5.4 5.4 0 1 0 11.6 11.8" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" />
    <path d="M6.1 6.6 4.7 8l1.4 1.4M9.9 6.6 11.3 8l-1.4 1.4" stroke="currentColor"
      strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.75" />
    <circle cx="8" cy="8" r="0.95" fill="currentColor" />
  </svg>
}
