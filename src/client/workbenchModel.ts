export type WorkbenchMode = 'design' | 'source' | 'diff' | 'tools'
export type WorkbenchBottomTab = 'diagnostics' | 'changes' | 'evidence'

export interface WorkbenchElement {
  readonly id: string
  readonly name: string
  readonly kind: string
  readonly depth: number
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface WorkbenchDiagnostic {
  readonly severity: 'error' | 'warning' | 'info'
  readonly code: string
  readonly message: string
  readonly location: string
}

export interface WorkbenchSnapshot {
  readonly projectName: string
  readonly filePath: string
  readonly backendLabel: string
  readonly contextText?: string
  readonly elements: readonly WorkbenchElement[]
  readonly diagnostics: readonly WorkbenchDiagnostic[]
  readonly source: string
  readonly before: string
  readonly after: string
}

export const EMPTY_WORKBENCH: WorkbenchSnapshot = {
  projectName: 'CWTools', filePath: '', backendLabel: '', elements: [], diagnostics: [], source: '', before: '', after: '',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function diagnosticRows(value: unknown): readonly WorkbenchDiagnostic[] {
  const rows = Array.isArray(value) ? value : isRecord(value) && Array.isArray(value.diagnostics) ? value.diagnostics : []
  return rows.flatMap((row, index): WorkbenchDiagnostic[] => {
    if (!isRecord(row)) return []
    const severity = row.severity === 'error' || row.severity === 'warning' || row.severity === 'info' ? row.severity : 'info'
    const line = typeof row.line === 'number' ? `:${String(row.line)}` : ''
    return [{
      severity,
      code: text(row.code, `CWT-${String(index + 1)}`),
      message: text(row.message, text(row.text, 'Unknown diagnostic')).slice(0, 1000),
      location: `${text(row.filePath, text(row.file, ''))}${line}`.slice(0, 300),
    }]
  }).slice(0, 500)
}

function resultText(result: import('cwtools-shared').SharedToolResult | null): string {
  if (result === null) return 'CWTools is disabled.'
  if (result.ok === false) return result.error === undefined ? 'The IDE context request failed.' : `${result.error.code}: ${result.error.message}`
  if (result.data === undefined) return 'No IDE context is available.'
  return JSON.stringify(result.data, null, 2).slice(0, 12000)
}

/** Narrow Host results into the browser-safe view model; no preview rows are introduced. */
export function workbenchFromHost(host: import('../contract/workbench.ts').CwtoolsWorkbenchHostSnapshot): WorkbenchSnapshot {
  const context = isRecord(host.context?.data) ? host.context.data : undefined
  const activeFile = isRecord(context?.activeTextEditor) ? context.activeTextEditor : undefined
  return {
    projectName: host.projectName,
    filePath: text(activeFile?.filePath, text(activeFile?.path, host.workspaceRoot)),
    backendLabel: host.backend === 'ready' ? 'DSH Host · Live workspace' : 'CWTools disabled',
    contextText: resultText(host.context),
    elements: [],
    diagnostics: diagnosticRows(host.diagnostics?.data),
    source: '', before: '', after: '',
  }
}

/** Explicit design-preview data. Production callers must supply a real snapshot instead. */
export const WORKBENCH_PREVIEW: WorkbenchSnapshot = {
  projectName: 'Stellaris UI Overhaul',
  filePath: 'interface/ship_overview.gui',
  backendLabel: 'DSH Host · UI Preview',
  elements: [
    { id: 'root', name: 'window_root', kind: 'WINDOW', depth: 0, x: 0, y: 0, width: 1280, height: 720 },
    { id: 'header', name: 'header', kind: 'CONTAINER', depth: 1, x: 0, y: 0, width: 1280, height: 92 },
    { id: 'list', name: 'ship_list', kind: 'LIST', depth: 1, x: 24, y: 112, width: 310, height: 480 },
    { id: 'details', name: 'ship_details', kind: 'CONTAINER', depth: 1, x: 356, y: 112, width: 900, height: 480 },
    { id: 'confirm', name: 'button_confirm', kind: 'BUTTON', depth: 2, x: 880, y: 596, width: 139, height: 32 },
  ],
  diagnostics: [
    { severity: 'warning', code: 'CWT207', message: '当前 spriteType 未包含 hover 状态', location: '行 184' },
    { severity: 'info', code: '布局建议', message: '按钮与父容器底边距离为 16px', location: '属性' },
    { severity: 'error', code: 'CWT118', message: '本地化键不存在', location: 'gui.yml:42' },
  ],
  source: 'buttonType = {\n  name = "button_confirm"\n  position = { x = 880 y = 596 }\n  size = { x = 139 y = 32 }\n  spriteType = "GFX_button_standard"\n}',
  before: '− position = { x = 860 y = 612 }',
  after: '+ position = { x = 880 y = 596 }',
}