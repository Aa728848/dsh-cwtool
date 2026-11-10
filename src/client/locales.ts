/**
 * Copy for the CWTools settings section.
 *
 * Section, group, field, and form-frame text lives here. Tool names, field
 * paths, and configuration keys stay verbatim from the frozen contract and are
 * never translated.
 */

/** Every key this section renders. */
export type CwtoolsLocaleKey =
  | 'nav' | 'title' | 'intro'
  | 'sectionBackend' | 'sectionReadAccess' | 'sectionWriteAccess' | 'sectionOutput'
  | 'enabled' | 'enabledHint'
  | 'serverPath' | 'serverPathHint'
  | 'gamePath' | 'gamePathHint'
  | 'rulesPath' | 'rulesPathHint'
  | 'cachePath' | 'cachePathHint'
  | 'activeManifestPath' | 'activeManifestPathHint'
  | 'preferActiveBackend' | 'preferActiveBackendHint'
  | 'game' | 'gameHint'
  | 'forceStart' | 'forceStartHint'
  | 'debug' | 'debugHint'
  | 'startupTimeoutMs' | 'startupTimeoutMsHint'
  | 'requestTimeoutMs' | 'requestTimeoutMsHint'
  | 'idleShutdownMs' | 'idleShutdownMsHint'
  | 'maxWorkspaceRuntimes' | 'maxWorkspaceRuntimesHint'
  | 'maxResultChars' | 'maxResultCharsHint'
  | 'writeLocalisation' | 'writeLocalisationHint' | 'writePolicyNote'
  | 'groupProject' | 'groupLocalisation' | 'groupSemantic'
  | 'groupNavigation' | 'groupDiagnostics' | 'groupShader'
  | 'groupDisabledNote' | 'readAccessIntro'
  | 'overridden' | 'reset' | 'invalidNumber'
  | 'readOnly' | 'unavailable' | 'save' | 'saving' | 'saveFailed'
  | 'failedTitle' | 'acceptedValue' | 'retryHint' | 'conflictNotice' | 'emptyValue'
  | 'on' | 'off'

/** English copy. */
export const en: Record<CwtoolsLocaleKey, string> = {
  nav: 'CWTools',
  title: 'CWTools',
  intro: 'Configure the CWTools language server and which semantic tools this bundle exposes. Every control on this page is saved together.',
  sectionBackend: 'Backend and project',
  sectionReadAccess: 'Read tools',
  sectionWriteAccess: 'Write access',
  sectionOutput: 'Output',
  enabled: 'Enable CWTools tools',
  enabledHint: 'Turning this off withdraws every CWTools tool while keeping the settings below.',
  serverPath: 'Server path',
  serverPathHint: 'Path to the CWTools language server executable. When empty, the backend is discovered automatically: an installed CWTools extension or a development build. This bundle does not ship one.',
  gamePath: 'Game path',
  gamePathHint: 'Path to the Paradox game installation.',
  rulesPath: 'Rules path',
  rulesPathHint: 'Path to the CWTools rules directory. Empty uses the server default.',
  cachePath: 'Cache path',
  cachePathHint: 'Directory for the server cache. Empty uses the workspace default.',
  activeManifestPath: 'Active bridge manifest (optional)',
  activeManifestPathHint: 'Explicit bridge-manifest.json for active-first reuse. Empty auto-discovers the current workspace host.',
  preferActiveBackend: 'Prefer the active backend',
  preferActiveBackendHint: 'Reuse a healthy active host for this workspace. If none is reusable, start a standalone backend; an incompatible active host never causes a second one.',
  game: 'Game',
  gameHint: 'Paradox game identifier such as stellaris or ck3. Empty detects it from the project.',
  forceStart: 'Force start',
  forceStartHint: 'Start the language server even when the project does not look like a supported game.',
  debug: 'Debug logging',
  debugHint: 'Keep verbose server diagnostics in the log.',
  startupTimeoutMs: 'Startup timeout (ms)',
  startupTimeoutMsHint: 'How long to wait for the language server to become ready.',
  requestTimeoutMs: 'Request timeout (ms)',
  requestTimeoutMsHint: 'How long one tool request may wait for the server.',
  idleShutdownMs: 'Idle shutdown (ms)',
  idleShutdownMsHint: 'How long an unused project runtime is kept before it stops.',
  maxWorkspaceRuntimes: 'Runtime limit',
  maxWorkspaceRuntimesHint: 'How many project runtimes may live at once, from 1 to 8.',
  maxResultChars: 'Result preview limit',
  maxResultCharsHint: 'Characters of each tool result shown to the model; stored values stay complete, from 1000 to 200000.',
  writeLocalisation: 'Allow write_localisation',
  writeLocalisationHint: 'When off, localisation writes are refused.',
  writePolicyNote: 'This page never grants a write on its own: every write still passes the DSH tool policy of the active session.',
  groupProject: 'Project queries',
  groupLocalisation: 'Localisation',
  groupSemantic: 'Semantic queries',
  groupNavigation: 'Navigation',
  groupDiagnostics: 'Diagnostics',
  groupShader: 'Shader',
  groupDisabledNote: 'Tool choices inside a disabled group are kept.',
  readAccessIntro: 'A group gates its tools. A tool runs only when the group and the tool are both on.',
  overridden: 'Overridden',
  reset: 'Reset to default',
  invalidNumber: 'Enter a whole number in the allowed range.',
  readOnly: 'This deployment stores settings read-only.',
  unavailable: 'The CWTools plugin is not loaded, so it cannot be configured right now.',
  save: 'Save',
  saving: 'Saving…',
  saveFailed: 'The Host did not accept these values.',
  failedTitle: 'The Host kept its own values; your draft is still here.',
  acceptedValue: 'Host accepted',
  retryHint: 'Correct the draft and save again, or leave the page to discard it.',
  conflictNotice: 'Settings changed elsewhere while you were editing, so this save was refused.',
  emptyValue: 'Empty',
  on: 'On',
  off: 'Off',
}

/** Simplified Chinese copy, checked against the English keys. */
export const zh: Record<CwtoolsLocaleKey, string> = {
  nav: 'CWTools',
  title: 'CWTools',
  intro: '配置 CWTools 语言服务器，以及本组合包开放哪些语义工具。本页所有控件会一起保存。',
  sectionBackend: '后端与项目',
  sectionReadAccess: '只读工具',
  sectionWriteAccess: '写入权限',
  sectionOutput: '输出',
  enabled: '启用 CWTools 工具',
  enabledHint: '关闭后不再提供任何 CWTools 工具，下方的设置仍然保留。',
  serverPath: '服务器路径',
  serverPathHint: 'CWTools 语言服务器可执行文件路径。留空时自动发现后端：已安装的 CWTools 扩展或开发构建。本组合包不自带后端。',
  gamePath: '游戏路径',
  gamePathHint: 'Paradox 游戏安装目录。',
  rulesPath: '规则路径',
  rulesPathHint: 'CWTools 规则目录。留空使用服务器默认值。',
  cachePath: '缓存路径',
  cachePathHint: '服务器缓存目录。留空使用工作区默认值。',
  activeManifestPath: '活跃桥接清单（可选）',
  activeManifestPathHint: '指定活跃优先复用的 bridge-manifest.json。留空时自动发现当前工作区宿主。',
  preferActiveBackend: '优先复用活跃后端',
  preferActiveBackendHint: '复用当前工作区健康的活跃宿主，没有可复用宿主时才启动独立后端；活跃宿主不兼容时不会再启动第二个实例。',
  game: '游戏',
  gameHint: 'Paradox 游戏标识，例如 stellaris 或 ck3。留空时从项目自动识别。',
  forceStart: '强制启动',
  forceStartHint: '即使项目不像受支持的游戏，也启动语言服务器。',
  debug: '调试日志',
  debugHint: '在日志中保留详细的服务端诊断。',
  startupTimeoutMs: '启动超时（毫秒）',
  startupTimeoutMsHint: '等待语言服务器就绪的最长时间。',
  requestTimeoutMs: '请求超时（毫秒）',
  requestTimeoutMsHint: '单次工具请求等待服务器的最长时间。',
  idleShutdownMs: '空闲关闭（毫秒）',
  idleShutdownMsHint: '无人使用的项目运行时保留多久后停止。',
  maxWorkspaceRuntimes: '运行时上限',
  maxWorkspaceRuntimesHint: '同时存活的项目运行时数量，1 到 8。',
  maxResultChars: '结果预览上限',
  maxResultCharsHint: '展示给模型的每份工具结果字符数；存储值始终完整，1000 到 200000。',
  writeLocalisation: '允许 write_localisation',
  writeLocalisationHint: '关闭时拒绝本地化写入。',
  writePolicyNote: '本页不会单方面授予写入：每次写入仍要通过当前会话的 DSH 工具策略。',
  groupProject: '项目查询',
  groupLocalisation: '本地化',
  groupSemantic: '语义查询',
  groupNavigation: '导航',
  groupDiagnostics: '诊断',
  groupShader: '着色器',
  groupDisabledNote: '组关闭时，组内工具的选择仍然保留。',
  readAccessIntro: '组是其工具的开关。只有组和工具同时开启，工具才会运行。',
  overridden: '已覆盖',
  reset: '恢复默认',
  invalidNumber: '请输入允许范围内的整数。',
  readOnly: '本部署的设置为只读。',
  unavailable: 'CWTools 插件当前未加载，暂时无法配置。',
  save: '保存',
  saving: '保存中…',
  saveFailed: '本部署没有接受这些值。',
  failedTitle: '本部署保留了它自己的值，你的草稿仍在。',
  acceptedValue: '本部署已接受',
  retryHint: '修改草稿后再次保存，或离开本页放弃草稿。',
  conflictNotice: '编辑期间设置已在别处更新，因此本次保存被拒绝。',
  emptyValue: '空',
  on: '开启',
  off: '关闭',
}

/**
 * The shared settings frame's copy, read from this section's dictionary.
 * @param t - the section's locale reader.
 * @returns the labels the shared form frame renders.
 */
export function formLabels(t: (key: CwtoolsLocaleKey) => string): {
  unavailable: string
  readOnly: string
  saveFailed: string
  save: string
  saving: string
} {
  return {
    unavailable: t('unavailable'),
    readOnly: t('readOnly'),
    saveFailed: t('saveFailed'),
    save: t('save'),
    saving: t('saving'),
  }
}
