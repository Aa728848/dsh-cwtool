export const CWTOOLS_READ_TOOL_GROUPS = {
  project: [
    'query_project_profile',
    'query_project_knowledge',
    'query_workspace_index',
    'explore_pdx_project',
    'analyze_pdx_flow',
    'query_inline_instantiation',
    'compare_definition_with_vanilla',
  ],
  localisation: ['query_localisation_index'],
  semantic: [
    'query_types',
    'query_rules',
    'query_cwt_schema',
    'search_rule_capabilities',
    'explain_scope',
    'parse_pdx_fragment',
    'query_scope',
    'query_scripted_effects',
    'query_scripted_triggers',
    'query_enums',
    'query_static_modifiers',
    'query_variables',
    'get_entity_info',
    'get_pdx_block',
    'query_targeting_weight',
  ],
  navigation: [
    'get_completion_at',
    'document_symbols',
    'workspace_symbols',
    'go_to_definition',
    'find_references',
  ],
  diagnostics: ['get_diagnostics', 'analyze_diagnostic_error'],
  shader: [
    'query_shader_symbol',
    'query_shader_compile_unit',
    'query_shader_platform_variants',
    'query_shader_callers',
    'explain_shader_reachability',
    'validate_shader',
    'compare_shader_with_vanilla',
  ],
} as const

export type CwtoolsReadGroup = keyof typeof CWTOOLS_READ_TOOL_GROUPS
export type CwtoolsReadToolName = typeof CWTOOLS_READ_TOOL_GROUPS[CwtoolsReadGroup][number]
export const CWTOOLS_READ_GROUP_ORDER: readonly CwtoolsReadGroup[] = [
  'project', 'localisation', 'semantic', 'navigation', 'diagnostics', 'shader',
]
export const CWTOOLS_READ_TOOL_NAMES: readonly CwtoolsReadToolName[] = Object.freeze(
  CWTOOLS_READ_GROUP_ORDER.flatMap(group => [...CWTOOLS_READ_TOOL_GROUPS[group]]),
)
export const CWTOOLS_WRITE_TOOL_NAMES = ['write_localisation'] as const
export type CwtoolsWriteToolName = typeof CWTOOLS_WRITE_TOOL_NAMES[number]
export const CWTOOLS_FIRST_RELEASE_TOOL_NAMES: readonly string[] = [
  ...CWTOOLS_READ_TOOL_NAMES,
  ...CWTOOLS_WRITE_TOOL_NAMES,
]
export const CWTOOLS_STELLARIS_ONLY_TOOLS: ReadonlySet<string> = new Set(['query_targeting_weight'])

const groupByTool = new Map<string, CwtoolsReadGroup>()
for (const group of CWTOOLS_READ_GROUP_ORDER) {
  for (const name of CWTOOLS_READ_TOOL_GROUPS[group]) groupByTool.set(name, group)
}

export function isCwtoolsReadToolName(name: string): name is CwtoolsReadToolName {
  return groupByTool.has(name)
}

export function isCwtoolsWriteToolName(name: string): name is CwtoolsWriteToolName {
  return (CWTOOLS_WRITE_TOOL_NAMES as readonly string[]).includes(name)
}

export function cwtoolsReadGroupFor(name: CwtoolsReadToolName): CwtoolsReadGroup {
  const group = groupByTool.get(name)
  if (group === undefined) throw new Error('Unknown CWTools read tool: ' + name)
  return group
}
