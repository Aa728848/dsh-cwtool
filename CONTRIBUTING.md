# Contributing

[English](#english) | [中文](#中文)

<a id="english"></a>
## English

### Prerequisites

Use Node.js 24.9+ and pnpm 11. Build matching `cwtools-shared` and `cwtools-node` packages from the adjacent `cwtools-mcp` checkout before local development. Link them through the package manager without committing machine-specific dependency paths, then install this package's dependencies.

### Checks

```sh
pnpm run typecheck
pnpm run build
pnpm run test:host
pnpm run test:client
pnpm pack
```

Host tests cover permission gates, active-first/fallback/incompatible behavior, runtime lifetime and canonical results. Client tests cover the settings form and rendered behavior. Focused active-first checks are `pnpm exec vitest run tests/host/activeBackend.spec.ts tests/host/runtime.spec.ts`; the adjacent `cwtools-mcp` checkout also runs `npm run test:contracts -w cwtools-node`. A real-backend run additionally needs a matching CWTools server built from `cwtools-vscode/src/Main`.

Run the live contract after building this package and the F# server:

```sh
node tests/integration/cwtools-live.mjs
```

It validates real semantic calls, targeting weights, default read-only behavior, localisation BOM handling and path traversal rejection. For a static installation check, install local upstream links first and the built checkout second, then run `dsh --profile <profile> --dump-config`; no Web instance is required.

Install development builds through DSH's bundle installer. Do not edit a profile's manifest or patch manually. Rebuild the Client artifact before refreshing the existing Web GUI. UI acceptance needs Before and After captures under the same profile, scenario, viewport and theme; After-only evidence is insufficient.

For the active-first change, automated evidence includes 60 DSH tests, 177 upstream contract tests, the native HTTP server/protocol tests, VS Code compile/typecheck, both .NET builds with zero warnings/errors, and 19 F# capability checks. The full VS Code unit run has 2762 passes and one pre-existing user-rules failure (`shader_files`: actual 50, fixture 49). Static linked-checkout installation and `--dump-config` are verified, but real profile UI activation, saving, and Before/After visual acceptance have not been performed; do not claim that they passed. Direct tarball installation was also attempted but could not resolve the unpublished `cwtools-node` registry dependency (404); the acceptance profile remained on its original local links.

### Agent Notes

Read `.agents/notes/README.md`. Update the Owning Note in the same change for non-trivial architecture, feature, bug-fix, simplification, process or testing work. Do not create duplicate notes for local refinements.

<a id="中文"></a>
## 中文

### 环境要求

使用 Node.js 24.9+ 与 pnpm 11。本地开发前，先在相邻 `cwtools-mcp` checkout 构建匹配的 `cwtools-shared` 与 `cwtools-node`。通过包管理器链接它们，不要把机器专属依赖路径提交到清单，然后安装本包依赖。

### 验证

```sh
pnpm run typecheck
pnpm run build
pnpm run test:host
pnpm run test:client
pnpm pack
```

Host 测试覆盖权限、active-first/回退/不兼容行为、运行时生命周期与规范结果；Client 测试覆盖设置表单和渲染行为。active-first 聚焦检查为 `pnpm exec vitest run tests/host/activeBackend.spec.ts tests/host/runtime.spec.ts`，相邻 `cwtools-mcp` checkout 还需运行 `npm run test:contracts -w cwtools-node`。真实后端验收还需要从 `cwtools-vscode/src/Main` 构建匹配的 CWTools 服务端。

构建本包和 F# 服务端后运行实时契约：

```sh
node tests/integration/cwtools-live.mjs
```

该脚本验证真实语义调用、索敌权重、默认只读、本地化 BOM 和越界拒绝。静态安装检查先安装本地上游链接，再安装构建后的 checkout，然后执行 `dsh --profile <profile> --dump-config`，不需要启动 Web 实例。

开发构建必须通过 DSH 的组合包安装器安装，不要手改 profile 清单或 patch。刷新既有 Web GUI 前先重建 Client 产物。UI 验收必须在相同 profile、场景、视口和主题下提供 Before/After 截图，只有 After 不能通过验收。

本次 active-first 改动的自动证据包括 60 项 DSH 测试、177 项上游契约测试、原生 HTTP 服务/协议测试、VS Code 编译/类型检查、两个 .NET 构建均为 0 警告 0 错误，以及 19 项 F# 能力检查。VS Code 全量单测为 2762 项通过、1 项用户既有 rules 失败（`shader_files` 实际 50、fixture 49）。静态本地链接安装与 `--dump-config` 已验证，但真实 profile 中的 UI 激活、保存和 Before/After 视觉验收尚未执行，不能声称这些项目已通过。直接安装 tarball 也已尝试，但包管理器无法解析尚未发布的 `cwtools-node` registry 依赖（404）；验收 profile 保持原有本地链接。

### Agent Notes

阅读 `.agents/notes/README.md`。非平凡架构、功能、缺陷修复、简化、流程或测试变更必须在同次改动中更新 Owning Note，不要为局部微调创建重复笔记。
