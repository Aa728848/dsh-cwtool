/**
 * Composable CWTools panels.
 *
 * Three pure, browser-safe React components that a host can drop into any slot:
 * \`LocalisationMatrix\` (multi-language edits with missing/duplicate markers and
 * an \`onSave\` callback), \`EvidenceCenter\` (Before/After/Diff captures with
 * provenance and failure), and \`SemanticInspector\` (query_rules / query_scope /
 * go_to_definition / find_references over caller handlers, rendering real results
 * only). They import no host runtime code and no Node builtins; copy is passed in
 * as a \`locale\` prop so the same component serves English and Chinese.
 */
export { LocalisationMatrix } from './LocalisationMatrix.tsx'
export type {
  LocalisationMatrixProps, LocalisationRow, LocalisationSave,
} from './LocalisationMatrix.tsx'
export { EvidenceCenter } from './EvidenceCenter.tsx'
export type { EvidenceCenterProps, EvidenceEntry } from './EvidenceCenter.tsx'
export { SemanticInspector } from './SemanticInspector.tsx'
export type {
  SemanticHandler, SemanticHandlers, SemanticInspectorProps, SemanticQueryArgs, SemanticQueryKind,
} from './SemanticInspector.tsx'
export { panelsEn, panelsText, panelsZh } from './panelsLocales.ts'
export type { PanelsLocale, PanelsText } from './panelsLocales.ts'
