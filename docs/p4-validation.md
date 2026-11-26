# P4 只读发布审计报告

> 目标仓库：`C:/Users/A/Documents/cwtools-vscode`　审计时间戳：**2026-11-26 13:27:05（本机）**
> 审计性质：**只读**。除本文件外未修改任何产品代码、未启动替代 DSH server、未执行递归删除。

## 0. 范围与前提

- 审计对象：根仓库当前未提交变更 + 两个 dirty 子模块（`cwtools-mcp`、`dsh-cwtool`）指针。
- **重要前提（并发编辑）**：审计期间 `submodules/dsh-cwtool` 工作树正被作者实时写入（13:23→13:26 持续新增/修改 `src/client/GuiCanvas.tsx`、`panels/*`、`CwtoolsRightWorkbench.tsx` 等）。本报告所有结论以 **13:27:05 快照**为准；早于此时间点的瞬时失败（见 §4 P0-1）仅作过程记录。发布前必须以最终提交态重跑本报告 §6 全部命令。
- 由于工作树仍 dirty（根 21 项、`dsh-cwtool` 39 项未提交/未跟踪），本报告审计的是**工作树快照**而非某个已提交版本。

## 1. 变更概览

| 位置 | 内容 | 规模 |
| --- | --- | --- |
| 根 `client/**` | 多个解析器/协议文件改为转调 `cwtools-shared/editors` 的兼容 shim；`expressEval`、`staticGalaxyParser`、`techTreeParser`、`guiPreview` 等 | 17 文件，`-5979 / +238` |
| 根 `rollup.config.mjs` | 新增 `sharedEditorsResolver()`（解析 `cwtools-shared/editors` 到 `node_modules` dist），避免把 Host 共享 barrel 暴露给 Webview | 少量 |
| 根 `tsconfig.json` | 新增 `baseUrl` + `paths` 指向 `cwtools-shared/dist/editors` 类型 | 2 行 |
| `submodules/cwtools-mcp` | 指针 dirty（`...-dirty`），无提交指针变更 | — |
| `submodules/dsh-cwtool` | 指针 dirty；新增右侧工作台（CwtoolsRightWorkbench/GuiCanvas/panels/NativeEditorView/workbench*）、Host 侧 Workbench Remote（workbenchCore/Service）与契约；`tsdown.config.ts`、`runtime.ts`、`index.ts` 等改动 | 39 项含新增 |
| Agent Notes | 根 `.agents/notes/implemented/architecture/2026-11-26-shared-editor-parsers.md`、`dsh-cwtool/.agents/notes/.../2026-11-26-dsh-cwtools-workbench.md` 均已新增（符合 AGENTS 要求） | — |

## 2. 检查结果总表（可复现，退出码为准）

| # | 检查项 | 结果 | 退出码 |
| --- | --- | --- | --- |
| 1 | root `npm run check:release -- --skip-compile --skip-test` | **PASS**（2 项因跳过编译/单测而告警，非失败） | 0 |
| 2 | root `npx tsc -p tsconfig.json --noEmit` | **PASS** | 0 |
| 3 | dsh-cwtool `npm pack --dry-run --ignore-scripts` | **PASS**（35 文件，157.7 kB） | 0 |
| 4 | dsh-cwtool `npx tsc -p tsconfig.json --noEmit`（13:27 快照） | **PASS** | 0 |
| 5 | dsh-cwtool `npx vitest run` | **PASS**（13 文件 / 116 用例） | 0 |
| 6 | dsh-cwtool `node scripts/check-client-bundle.mjs` | **PASS**（无 Node builtin 泄漏） | 0 |
| 7 | root `npm test`（VS Code 集成） | **UNRUN** | — |
| 8 | root `npm run verify`（完整预发布门） | **UNRUN** | — |
| 9 | F# `dotnet build src/LSP/`、`src/Main/`、`npm run test:fsx` | **UNRUN** | — |
| 10 | 真实 DSH GUI 视觉截图验证（亮/暗主题） | **UNRUN**（约束禁止启动替代 server） | — |

## 3. 逐项发现

### 3.1 dsh-cwtools npm pack 内容（PASS，含一处陈旧产物）

命令：`cd submodules/dsh-cwtool && npm pack --dry-run --ignore-scripts`
- 结果：`dsh-cwtools-0.3.1.tgz`，`total files 35`，`package size 157.7 kB`，`unpacked size 724.6 kB`，退出码 0。
- 清单合理：`lib/index.js`（Host）、`lib/client.js`（浏览器，~614 kB）、`lib/types/**/*.d.ts`、`locale/{en,zh}.json`、`cordis.patch.yml`、`icon.svg`、`README.md`、`docs/visual-editors-and-particles.md`、`LICENSE`。
- **发现（P1）**：`lib/types/client/CwtoolsWorkbench.d.ts` 被打包，但其源码 `src/client/CwtoolsWorkbench.tsx` **已不存在**（已重命名为 `CwtoolsRightWorkbench.tsx`）。该 `.d.ts` 为 12:36 旧构建残留（`tsc --emitDeclarationOnly` 与 `tsdown clean:false` 都不会清除陈旧 `.d.ts`）。运行期无害，但会给消费者一个指向不存在组件的类型导出，属发布整洁性问题。

### 3.2 root release check（PASS）

命令：`npm run check:release -- --skip-compile --skip-test` → 退出码 0。
- 通过：版本同步、CHANGELOG、必需文件、双语单源文档、无硬编码 localhost/密钥、release 清单合法、受保护键盘快捷键规避、NLS 完整、Webview bundle 非空、各平台 server 二进制存在、F# Path.Combine 规范。
- 仅 `TypeScript compilation` 与 `Unit tests` 两项显示为 SKIPPED（告警），这是 `--skip-compile --skip-test` 的预期结果，**不代表失败**；但也**不能**当作“编译/单测已通过”——它们由 §3.2/§3.8 的单独命令覆盖。

### 3.3 主题审计（部分不达标）

- 工作台主样式 `CwtoolsRightWorkbench.module.css` **合格**：使用 `--dsw-alias-*` / `--dsw-radius-*` / `--dsw-focus-ring-*` 等主题变量，随 DSH 主题切换。
- **发现（P1）**：`NativeEditorView.module.css` 与 `GuiCanvas.module.css` 使用约 40 处硬编码十六进制色值（如 `#10171f`、`#0d141b`、`#79d7b0`、`#e8c77c`），且画布固定深色背景。这是**仅暗色**设计，在亮色/高对比主题下会与整体 UI 割裂，不满足“使用主题变量”的 Webview 约束。建议改为主题令牌，或明确声明这三块为“深色语义画布”并在文档/设置中说明。

### 3.4 窄栏审计（可用但有优化空间）

- `CwtoolsRightWorkbench.module.css` 仅在 `@media(max-width:520px)` 将 `.editorGrid`/`.numeric` 由 4 列降为 2 列、压缩 padding；≥521px 一律 4 列。右侧栏在中等宽度（~520–760px）时按钮文案（Particle 3D、Static Galaxy 等）可能挤压。
- `.stage` 最小高度 280–320px；`NativeEditorView`/`GuiCanvas` 的 SVG 用 `viewBox` 自适应缩放，窄栏下不会溢出但有下限高度。
- 结论：**可用**，建议将断点提前（如 640px 起 2 列）并给 `editorGrid` 按钮 `white-space:nowrap`/`text-overflow` 兜底（P2）。

### 3.5 键盘可访问性（存在缺口）

- 合格项：按钮均为原生 `button`；`button/input/textarea:focus-visible` 有统一焦点环；`GuiCanvas` 的 `<svg>` 有 `role="img"` + `aria-label`；`SegmentedTabs` 传 `label`；面板（EvidenceCenter/LocalisationMatrix/SemanticInspector）均有 `aria-label`。
- **发现（P2）**：`GuiCanvas` 的元素拖动/缩放**仅响应指针事件**（`onPointerDown/Move/Up`），无 `tabIndex`、无箭头键移动/缩放、无数字输入回退，键盘用户无法操作画布。考虑到这是“GUI 可视化编辑”的核心交互，建议补键盘路径（方向键微调 + Shift 加速，`Delete`/`Esc` 等）或提供属性面板数值输入作为等价入口。
- 面板区域未发现 `div onClick` 伪装按钮等反模式。

### 3.6 缓存 / 取消 / dispose / 大项目性能（整体稳健）

- Host `runtime.ts`：有空闲回收（`idleShutdownMs`，`unref` 定时器）、容量淘汰（`maxWorkspaceRuntimes`）、并发串行化队列（`serial`）、`AbortController` 传播（`awaitWithAbort`/`signal` 监听与清理）、`dispose()` 会 abort 全部在途控制器并 `disposeEntry`。**设计稳健**。
- Workbench Remote（`workbenchCore.ts`）：`read` 有工作区路径包含校验（`resolveWorkspacePath` + `realpath` 二次确认）、扩展名白名单（txt/asset/gfx/gui）、2,000,000 字节上限、`fatal` UTF-8 解码；`execute` 仅放行只读工具、`write` 仅放行 `write_localisation`/`gui_draft`。**边界安全到位**。
- 前端 `snapshot`：每次刷新并行取 `get_ide_context`+`get_diagnostics`，用 `AbortController` 在卸载时中止，无客户端缓存层。可接受。
- 性能上限：`NativeEditorView` 对图/实体做 `slice(0,60/80/40/100)` 截断；`GuiCanvas` 扁平化后 `slice(0,1500)`。但 `flat()` 递归**无深度上限**，极端深层 GUI 有栈/遍历风险（P2 提示）。
- **性能提示（P2）**：`guiEvidence.ts` 的 `captureGuiSvg` 在每次“打开 GUI”与“提交”时把 SVG 序列化后光栅化到 960×540，并对 51.8 万像素做同步 `getImageData` 循环；大 SVG（接近 1500 元素）时会造成主线程卡顿。建议改为按需/防抖或在 Worker 中执行。
- 拖拽时 `GuiCanvas` 每次 `pointermove` 都 `setOverride` 触发整棵 SVG 重渲染，元素多时有抖动风险（P2）。

### 3.7 根仓库解析器下沉重构（结构合理）

- `client/extension/*Parser.ts`、`guiPreview.ts`、`staticGalaxyProtocol.ts` 等改为转调 `cwtools-shared/editors`（单一来源），并用 `rollup.config.mjs` 的 `sharedEditorsResolver` 只解析浏览器安全 barrel。root `tsc --noEmit` 通过（退出码 0），`node_modules/cwtools-shared/dist/editors/index.{js,d.ts}` 存在（v0.5.0）。结构合理。

## 4. 优先修复项

### P0（发布阻断，须在打包前确认）
1. **确认最终态 `pnpm build` 全绿**：`prepack` = `typecheck && build:types && tsdown && check:client-bundle`。审计中途曾观测到 `GuiCanvas.tsx` 三处类型错误（`svgRef` 的 `RefObject<SVGSVGElement|null>` 与在 `g`/`rect` 上使用 `PointerEvent<SVGSVGElement>`），于 13:26 被作者修复；**发布前必须对冻结提交重跑 `pnpm build`，退出码必须为 0**，否则 `npm publish` 会在 prepack 阶段失败。

### P1（发布整洁性 / 主题一致性）
2. 打包前删除陈旧 `lib/types/client/CwtoolsWorkbench.d.ts`（或在干净 `lib/` 上重建），避免发布一个指向不存在组件的类型文件。
3. `NativeEditorView.module.css` / `GuiCanvas.module.css` 的硬编码颜色改为主题令牌，或明确标注为深色专用画布并说明亮色主题行为。

### P2（体验 / 可访问性 / 性能）
4. `GuiCanvas` 增加键盘操作（方向键移动、Shift 微调、Esc 取消）或属性面板数值输入等价入口。
5. 窄栏断点提前到 ~640px，按钮文本溢出兜底。
6. `captureGuiSvg` 光栅化防抖/Worker 化；`GuiCanvas` 拖拽渲染优化（如拖拽时用 CSS transform 预览，操作结束再落状态）；`flat()` 增加深度上限。

## 5. 未运行项（明确 UNRUN，不得视为通过）

- root `npm test`、`npm run test:shader-lsp`、`npm run test:cwt-lsp`、`npm run test:cwt-game-lsp`：需要 VS Code/Display 与 vanilla 数据，本只读审计未执行。
- root `npm run verify`（lint+compile+typecheck+unit+release 全量）：未执行。
- F# `dotnet build src/LSP/`、`dotnet build src/Main/`、`npm run test:fsx`：未执行。
- 真实 DSH Web GUI 的亮/暗主题视觉与窄栏截图：约束禁止启动替代 DSH server，故仅有源码级审计，无 Before/After 截图证据。
- `npm pack`（含 `prepack` 的真实打包/网络发布）：仅执行 `--dry-run --ignore-scripts`，未做真实构建打包。

## 6. 复现命令清单

```bash
# 根仓库（只读 + 纯命令行检查）
cd C:/Users/A/Documents/cwtools-vscode
git status --short
npm run check:release -- --skip-compile --skip-test   # 期望退出码 0（2 项 SKIPPED 告警）
npx tsc -p tsconfig.json --noEmit                       # 期望退出码 0

# dsh-cwtool 子模块
cd submodules/dsh-cwtool
npm pack --dry-run --ignore-scripts                     # 期望退出码 0，35 文件
npx tsc -p tsconfig.json --noEmit                       # 期望退出码 0（发布前必须重跑）
npx vitest run                                          # 期望 13 文件 / 116 用例全过
node scripts/check-client-bundle.mjs                    # 期望无 Node builtin 泄漏
pnpm build                                              # 发布前门：typecheck+build:types+tsdown+check:client-bundle，必须 0
```

---

审计结论：**当前工作树快照在可执行的只读门（release check / root typecheck / dsh-cwtool typecheck+单测+bundle / pack dry-run）上均通过**；但存在 1 个 P0 前置条件（发布前须在冻结提交上重跑 `pnpm build` 确认类型全绿）、2 个 P1（陈旧 `.d.ts`、主题硬编码）与若干 P2（键盘/窄栏/性能）待修。多个需要 VS Code/浏览器/vanilla 数据的检查为 **UNRUN**，未计入通过。
