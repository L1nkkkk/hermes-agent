# Maid Atelier → Hermes 迁移文档

本目录是 **Maid Atelier** 迁到 Hermes Agent fork 的规划文档，供管理员拍板。只描述产品与工程约束，**不改 Hermes 运行时代码**。

| 文档 | 用途 |
| --- | --- |
| [企划书](./企划书.md) | 背景、范围、架构映射、分阶段、风险、验收与待拍板项 |
| [UI / 功能对齐清单](./ui-parity-checklist.md) | 从企划书 §4.3 与 §8 抽出的可勾选对照表 |

## 仓库

| 项 | 值 |
| --- | --- |
| 目标宿主 | Hermes Agent fork [`https://github.com/L1nkkkk/hermes-agent`](https://github.com/L1nkkkk/hermes-agent) |
| 现壳基线 | OpenClaw fork `L1nkkkk/openclaw`（Maid Atelier Control UI） |
| 状态 | 草案。钉选上游 commit / tag、预发网关、仓库可见性策略仍空，见企划书附录 A 与 §9 |

## 诚实边界

- 不写未提供的 commit SHA，不附截图，不伪造 PR 外链。
- 草案点名的本机对照图（`/workspace/maid-atelier-target-ref.png` 等）**未纳入本仓库**。
- OpenClaw 约 PR #1–#9 已合 `main`、PR #10 仍为 draft 的说法，沿用企划草案，本目录未对照该远端复核。
