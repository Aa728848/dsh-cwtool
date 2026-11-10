# Agent Notes

本目录记录架构与工程决策。遵循「每个事实只有一个家」：用户行为在 README，模块与数据流在 ARCHITECTURE，常驻规则在 AGENTS，设计原因、备选方案和权衡在 Agent Notes。

## 路径与生命周期

```text
.agents/notes/{lifecycle}/{class}/YYYY-MM-DD-slug.md
```

- lifecycle：`proposed`、`implemented`、`rejected`、`archived`。
- class（封闭六类）：`feature`、`bug-fix`、`simplification`、`architecture`、`process`、`testing`。
- 文件名使用日期和英文短横线 slug；标题与正文使用规范简体中文。
- 不维护全局 INDEX 或 TABLE_OF_CONTENTS。

## Owning Note

修改前先检索 implemented 笔记。原决策仍成立时，原地更新拥有该决策的 Note；只有没有 owning note 或出现全新/相反决策时才新建。implemented 笔记反映真实代码基线，禁止保留计划式规格。

## 文件骨架

所有笔记以以下两行结构开始：

```markdown
# Agent Note: <标题>

Status: <proposed | implemented | rejected — <原因> | archived>
```

proposed 使用 Problem / Proposal / Alternatives considered / Acceptance criteria / Risks。implemented 使用 Problem / Decision / Alternatives considered / Consequences，不使用 Proposal、Plan 或 Acceptance criteria。
