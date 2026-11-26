/**
 * Bilingual copy for the composable CWTools panels.
 *
 * Each panel receives a \`locale\` prop (\`'en'\` | \`'zh'\`); the caller owns the
 * choice, so the same pure component serves both languages without importing any
 * host or Node code. Every key here is rendered by exactly one panel.
 */

/** Which interface language a panel renders. */
export type PanelsLocale = 'en' | 'zh'

/** English copy. */
export const panelsEn = {
  localisationTitle: 'Localisation matrix',
  locLanguage: 'Language',
  locKey: 'Key',
  locMissing: 'Missing',
  locDuplicate: 'Duplicate',
  locSave: 'Save row',
  locSaved: 'Saved',
  locEmpty: 'No localisation rows.',
  locEdit: 'Value',
  evidenceTitle: 'Evidence center',
  evBefore: 'Before',
  evAfter: 'After',
  evDiff: 'Diff',
  evPixelRatio: 'Pixel ratio',
  evVersion: 'Version',
  evSource: 'Source',
  evFailed: 'Failed',
  evVerified: 'Verified',
  evPending: 'Pending',
  evNoImage: 'No capture',
  evEmpty: 'No evidence captured.',
  evFailureReason: 'Failure detail',
  semanticTitle: 'Semantic inspector',
  semRules: 'Rules',
  semScope: 'Scope',
  semDefinition: 'Definition',
  semReferences: 'References',
  semRun: 'Run query',
  semRunning: 'Running…',
  semIdle: 'Run a query to see its real result.',
  semCategory: 'Rule category',
  semName: 'Rule name',
  semScopeName: 'Scope filter',
  semFile: 'File',
  semLine: 'Line',
  semColumn: 'Column',
  semSymbol: 'Symbol name',
  semIdentifier: 'Identifier',
  semWarnings: 'Warnings',
  semNextSteps: 'Next steps',
  semData: 'Result data',
  semNoHandler: 'This query is not available in the current host.',
  semError: 'Query failed',
} as const

/** Simplified Chinese copy, checked against the English keys. */
export const panelsZh: Record<keyof typeof panelsEn, string> = {
  localisationTitle: '本地化矩阵',
  locLanguage: '语言',
  locKey: '键',
  locMissing: '缺失',
  locDuplicate: '重复',
  locSave: '保存本行',
  locSaved: '已保存',
  locEmpty: '没有本地化行。',
  locEdit: '文本',
  evidenceTitle: '证据中心',
  evBefore: '修改前',
  evAfter: '修改后',
  evDiff: '差异',
  evPixelRatio: '像素比例',
  evVersion: '版本',
  evSource: '来源',
  evFailed: '失败',
  evVerified: '已验证',
  evPending: '待定',
  evNoImage: '暂无截图',
  evEmpty: '还没有任何证据。',
  evFailureReason: '失败详情',
  semanticTitle: '语义检查器',
  semRules: '规则',
  semScope: '作用域',
  semDefinition: '定义',
  semReferences: '引用',
  semRun: '运行查询',
  semRunning: '查询中…',
  semIdle: '运行查询以查看真实结果。',
  semCategory: '规则类别',
  semName: '规则名称',
  semScopeName: '作用域过滤',
  semFile: '文件',
  semLine: '行',
  semColumn: '列',
  semSymbol: '符号名称',
  semIdentifier: '标识符',
  semWarnings: '警告',
  semNextSteps: '后续步骤',
  semData: '结果数据',
  semNoHandler: '当前宿主不提供该查询。',
  semError: '查询失败',
}

/** The copy shape a panel reads; keyed by the English dictionary. */
export type PanelsText = Record<keyof typeof panelsEn, string>

/**
 * Select the dictionary for a locale.
 * @param locale - interface language requested by the caller.
 * @returns the matching copy object.
 */
export function panelsText(locale: PanelsLocale): PanelsText {
  return locale === 'zh' ? panelsZh : panelsEn
}
