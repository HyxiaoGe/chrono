# Proposal 近期变革遗漏问题修复

## 问题

搜索"阿里巴巴"时，Proposal agent 输出的 4 个 research_threads 全部面向传统业务线（电商、金融、组织、云计算），完全遗漏了 2023–2026 年的 AI 战略转型（通义千问、AI 驱动战略、开源大模型等）。

**根因**：Layer 1 — Proposal agent 纯靠 LLM 内部知识规划维度，prompt 中缺少对"近期范式变革"的引导，也没有外部搜索提供近期事实。

## 方案：双管齐下

### 改动 1：Prompt 优化

在 system prompt 的"调研维度规划原则"部分追加规则，要求模型主动考虑近期变革：

```
- **近期变革敏感度**：规划维度时必须考虑该领域近 3 年内是否有重大范式变革（如 AI 转型、新能源转型、监管重构等）。如果有，必须给予独立的调研维度，不能仅作为其他维度的子话题。对于企业/产品类 topic，"最新战略方向"应优先成为独立维度。
```

**改动位置**：`orchestrator.py:160`，在维度规划原则的最后一条之后插入。

### 改动 2：Proposal 前搜索增强

在 `create_proposal()` 中，调 LLM 之前先做一次轻量 Tavily 搜索，将结果作为上下文注入 user prompt。

**搜索策略**：
- 查询：`"{topic} latest developments major changes {current_year-1} {current_year}"`（中文 topic 用中文查询）
- `max_results=5`，`search_depth="basic"`
- 用已有的 `tavily.search_and_format()` 获取格式化结果

**Prompt 注入**：
```
请评估以下调研主题并生成调研提案：阿里巴巴

以下是该主题的近期动态（供维度规划参考）：
【1】阿里巴巴全面拥抱 AI，通义千问系列模型开源...
【2】阿里云 AI 营收超过传统云业务...
...
```

**成本评估**：
- 1 次 Tavily basic 搜索 ≈ 200ms
- Prompt 增加 ~300 tokens
- 相比 proposal LLM 调用（2-4s）可忽略

## 涉及文件

| 文件 | 改动 |
|------|------|
| `backend/app/orchestrator/orchestrator.py:155-160` | System prompt 追加近期变革规则 |
| `backend/app/orchestrator/orchestrator.py:556-569` | `create_proposal()` 加搜索增强 |

## 不改动

- Pydantic 模型不变
- 前端不变
- 其他 agent 不变

## Todo

- [x] 在 system prompt 维度规划原则中追加近期变革敏感度规则
- [x] 在 `create_proposal()` 中加入 Tavily 搜索，将结果注入 user prompt（含 graceful 降级）
- [ ] 本地测试"阿里巴巴" proposal，确认 AI 战略维度出现
