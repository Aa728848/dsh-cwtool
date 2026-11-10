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

Host tests cover permission gates, runtime lifetime and canonical results. Client tests cover the settings form and rendered behavior. A real-backend run additionally needs a matching CWTools server built from `cwtools-vscode/src/Main`.

Run the live contract after building this package and the F# server:

```sh
node tests/integration/cwtools-live.mjs
```

It validates real semantic calls, targeting weights, default read-only behavior, localisation BOM handling and path traversal rejection. For a static installation check, install local upstream links first and the built checkout second, then run `dsh --profile <profile> --dump-config`; no Web instance is required.

Install development builds through DSH's bundle installer. Do not edit a profile's manifest or patch manually. Rebuild the Client artifact before refreshing the existing Web GUI. UI acceptance needs Before and After captures under the same profile, scenario, viewport and theme; After-only evidence is insufficient.

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

Host 测试覆盖权限、运行时生命周期与规范结果；Client 测试覆盖设置表单和渲染行为。真实后端验收还需要从 `cwtools-vscode/src/Main` 构建匹配的 CWTools 服务端。

构建本包和 F# 服务端后运行实时契约：

```sh
node tests/integration/cwtools-live.mjs
```

该脚本验证真实语义调用、索敌权重、默认只读、本地化 BOM 和越界拒绝。静态安装检查先安装本地上游链接，再安装构建后的 checkout，然后执行 `dsh --profile <profile> --dump-config`，不需要启动 Web 实例。

开发构建必须通过 DSH 的组合包安装器安装，不要手改 profile 清单或 patch。刷新既有 Web GUI 前先重建 Client 产物。UI 验收必须在相同 profile、场景、视口和主题下提供 Before/After 截图，只有 After 不能通过验收。

### Agent Notes

阅读 `.agents/notes/README.md`。非平凡架构、功能、缺陷修复、简化、流程或测试变更必须在同次改动中更新 Owning Note，不要为局部微调创建重复笔记。
