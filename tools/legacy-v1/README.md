# v1 遗留测试（当前全部失败，这是预期的）

这 13 个测试写给 **v1 的单文件架构**（`index.html` 6,365 行那一版，见 git 历史 `dbdd9c1`）。
v2.0 换了一套代码，它们调用的函数和 DOM 结构都不存在了，所以对当前 `index.html` 跑一定失败。

**没有删掉，是因为它们是旧引擎的行为规格书。** 往 v2.0 移植任何一个旧能力时，
先读对应的测试，就知道这个能力当年被要求做到什么程度。

| 文件 | 记录的是什么行为 | 移植状态 |
|---|---|---|
| `test-calc.cjs` | 计算器：白名单安全、隐式乘法、键盘路由（26 条） | ✅ 引擎已移植，见 `tools/test-calc-v2.cjs` |
| `test-spr.cjs` → 已升级 | 填空题官方判分（42 条） | ✅ 在 `tools/test-spr.cjs`，对 v2.0 仍通过 |
| `audit-serializer.cjs` | 喂 AI 的题目文本清洗 | ✅ `serializeQuestion` 已在 v2.0 |
| `test-stats.cjs` | 掌握度统计按题不按次 | ⬜ 未移植 |
| `test-nav.cjs` | 答完一组回到来源视图、一键看本次错题 | ⬜ 未移植 |
| `test-scroll.cjs` | 重绘时保留阅读材料滚动位置、换题归零 | ⬜ 未移植（v2.0 的渲染方式不同，需重新评估） |
| `test-timer.cjs` | 计时开关：按官方配速给总时限 | ⬜ 未移植 |
| `test-why.cjs` / `test-tags.cjs` | 错因自述落盘、11 类错因自动归类 | ✅ 已在 v2.0 |
| `test-picker.cjs` | 组卷筛选（领域/技能/难度/题数） | ⬜ 未移植 |
| `test-highlight.cjs` | 划词高亮归属到当前题 | ⬜ 未移植 |
| `test-pdf.cjs` | PDF 导入的跨域 Worker | ⬜ 未移植 |
| `test-ai.cjs` | 模型供应商连通性与故障转移 | ⬜ 未移植 |
| `test-desmos-and-domains.cjs` | Desmos 嵌入 + 8 大 Domain 展开 | 🟡 部分（v2.0 自己做了一套） |

## 怎么跑（只在需要对照旧行为时）

```bash
git stash              # 如果有未提交改动
git checkout dbdd9c1 -- index.html
node tools/legacy-v1/test-calc.cjs
git checkout HEAD -- index.html
```

## 已删除

`test-mirror.cjs`（b7/b7m 命名空间）、`test-profile.cjs`（多档案）、`smoke.cjs`（v1 端到端）
——它们测的机制在 v2.0 里已经不存在，留着没有参考价值。要找可以去 git 历史 `dbdd9c1`。
