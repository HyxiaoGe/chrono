# Similar Topic Detection — Research

## 问题描述

用户输入的 topic 可能存在语义相同但文字不同的情况：

- "iPhone" vs "苹果手机"
- "二战" vs "世界第二次大战" vs "WW2"
- "AI" vs "人工智能" vs "Artificial Intelligence"
- "比特币" vs "Bitcoin"

当前系统对这些情况的处理不完整，会导致重复调研。

## 现有 Topic 匹配机制

### 1. `normalize_topic()` (`backend/app/utils/topic.py`)

```python
def normalize_topic(topic: str) -> str:
    t = topic.strip().lower()
    t = unicodedata.normalize("NFKC", t)
    t = re.sub(r"\s+", " ", t)
    if t in _ALIASES:
        t = _ALIASES[t]
    return t
```

- NFKC 归一化 + lowercase + 空格压缩
- 硬编码别名表：`"二战" → "第二次世界大战"`、`"ww2" → "world war ii"` 等，仅 8 条
- 别名匹配要求完全一致（`t in _ALIASES`），"二战历史"不会命中

### 2. DB 查询 (`backend/app/db/repository.py:get_research_by_topic`)

两层匹配：
1. **精确匹配**：`topic_normalized == normalized` — 走唯一索引，O(1)
2. **模糊匹配**：`topic_normalized.contains(normalized) OR topic.ilike(f"%{topic}%")` — 子串包含

模糊匹配能力有限：
- "iPhone" 能匹配到 "iPhone 发展史"（子串关系）
- "苹果手机" 无法匹配到 "iPhone"（无子串关系、无语义理解）
- 跨语言完全无能力

**安全隐患**：`ilike(f"%{topic}%")` 中用户输入未 escape，`%` 和 `_` 会被当作通配符。如用户输入 `"100%"` 会匹配所有包含 `"100"` 的记录。需要 escape `%` 和 `_`。

### 3. API 层 (`backend/app/main.py:create_research`)

三层缓存策略：
1. **Layer 1 (DB)**：`get_research_by_topic()` 命中 → 返回 `cached=True`，前端跳过 proposal 直接回放
2. **Layer 2 (Redis)**：`get_cached_proposal(normalized)` 命中 → 返回已生成的 proposal（`cached=False`）
3. **Layer 3 (LLM)**：全新调研

`cached=True` 时前端行为：直接进入 research phase，从 DB 回放所有 SSE 事件（瞬间完成）。

### 4. 推荐话题缓存标记 (`GET /api/topics/recommended`)

```python
topic["cached"] = any(
    key in cached or cached in key for cached in cached_set
)
```

用双向子串包含判断，跟 DB 模糊匹配逻辑类似。

## 现有能力总结

| 场景 | 能否命中缓存 | 原因 |
|------|-------------|------|
| "iPhone" → "iPhone" | ✅ 精确 | normalized 完全一致 |
| "二战" → "第二次世界大战" | ✅ 别名 | `_ALIASES` 有映射 |
| "iPhone 15" → "iPhone" | ✅ 模糊 | 子串包含 |
| "iPhone" → "苹果手机" | ❌ | 无子串关系，无语义 |
| "AI" → "人工智能" | ❌ | 跨语言同义 |
| "Bitcoin" → "比特币" | ❌ | 跨语言同义 |
| "React 框架" → "React" | ✅ 模糊 | 子串包含 |

## 前端相关流程

### 搜索提交 (`SearchHome.tsx`)

```
用户输入 topic → router.push(`/app/session/new?topic=${topic}`)
```

无中间拦截步骤，直接跳转到 SessionView。

### Session 初始化 (`SessionView.tsx`)

```
POST /api/research { topic, language: "auto" }
  → data.cached === true  → 跳过 proposal，直接 research phase
  → data.cached === false → 显示 ProposalCard 等用户确认
```

### 关键观察

当前流程中没有"相似 topic 提示"的插入点。如果要加，有两个位置可选：

1. **后端 `POST /api/research` 返回时**：返回相似 topic 信息，前端渲染选择 UI
2. **前端提交前**：先调一个独立接口查相似，再决定是否提交

方案 1 更合理：复用现有请求，不增加额外 roundtrip。

## 数据库 Schema 相关

`ResearchRow` 表关键字段：
- `topic` (Text) — 原始输入
- `topic_normalized` (String(512), UNIQUE INDEX) — 归一化后
- `topic_type` (String(32)) — product / technology / culture / historical_event
- `language` (String(16)) — en / zh / ja 等

`save_research()` 存储时用 `get_research_by_topic()` 判断 upsert，相同 normalized topic 只保留一份。

## LLM 判断方案分析

### 核心流程

```
Layer 1 (DB 精确+模糊) → miss
Layer 1.5 (LLM 相似判断) → 找到 → 返回 similar_topic（不创建 session，不生成 proposal）
                          → 没找到 → 继续
Layer 2 (Redis proposal cache)
Layer 3 (LLM 生成 proposal)
```

1. `POST /api/research` 收到新 topic（检查 `force` 参数，若为 true 则跳过相似检查）
2. Layer 1 精确匹配 + 模糊匹配未命中
3. 从 DB 拉已有 topic 列表，**限制候选数量**（最多 50 条最近的），避免 DB 增长后 LLM 输入过长
4. 将新 topic + 候选列表丢给 LLM 判断
5. LLM 返回匹配的 topic（或 null）
6. 如果有匹配 → **不创建 session、不生成 proposal**，直接返回 `similar_topic` 信息
7. 如果无匹配 → 正常走 Layer 2 → Layer 3 流程

### LLM 调用成本

- 输入：最多 50 个短字符串 + 一个 prompt，约 200-500 tokens
- 输出：一个 topic 字符串或 null，约 10-20 tokens
- 模型：最便宜的模型即可（Haiku 级别）
- 延迟：< 1 秒
- 在 Layer 1（精确/模糊）命中时不会触发，只有 miss 时才调用
- `force=true` 时跳过，不调用

### 需要考虑的边界情况

- "AI" vs "AI 芯片"：语义相关但不是同一个 topic → LLM 应判断为不同
- "人工智能" vs "AI"：同一个概念 → LLM 应判断为相同
- "iPhone" vs "苹果公司"：iPhone 是苹果的产品，但调研范围不同 → 应判断为不同
- 空 topic 列表：DB 无数据时跳过 LLM 调用

### API 响应变化

发现 similar topic 时，**不创建 session、不生成 proposal**，避免浪费 LLM 调用和 session 资源：

```python
class SimilarTopicMatch(BaseModel):
    topic: str              # 已有 topic 的原始文本
    research_id: str        # 已有调研的 DB ID（不是 session_id）

class ResearchProposalResponse(BaseModel):
    session_id: str | None = None          # similar 时为 None
    proposal: ResearchProposal | None = None  # similar 时为 None
    cached: bool = False
    similar_topic: SimilarTopicMatch | None = None
```

前端选择"立即查看"时，有两种方式创建回放 session：

- **方案 A（推荐）**：前端用 `similar_topic.topic`（已有调研的原始 topic 文本）重新 `POST /api/research`。此时 Layer 1 DB 查询会精确命中，走 `cached=True` 路径，自动创建回放 session。**不需要新接口**。
- **方案 B**：新增 `POST /api/research/replay { research_id }` 接口，直接用 research_id 创建回放 session。更显式，但多一个接口。

方案 A 更简单，复用现有逻辑，优先选择。

请求参数变化：

```python
class ResearchRequest(BaseModel):
    topic: str
    language: str = "auto"
    force: bool = False  # 新增：跳过相似检查，强制走 proposal 流程
```

### 前端交互流程

```
POST /api/research { topic } → response

if response.cached:
    直接进入 research（现有逻辑不变）

elif response.similar_topic:
    显示选择 UI（不是 ProposalCard，是新的 similar topic 提示 UI）：
    ├─ "已有相似调研：「{similar_topic.topic}」"
    ├─ [立即查看] → 用 research_id 创建回放 session 并跳转
    └─ [重新调研] → POST /api/research { topic, force: true }
                    → 回到正常 proposal 流程

else:
    显示 ProposalCard（现有逻辑不变）
```

### Redis proposal cache 的局限

Redis 用 `chrono:proposal:{normalized_topic}` 做 key，精确匹配。"苹果手机"和"iPhone"的 normalized key 不同，Redis 不会命中。

这意味着两个语义相同但写法不同的 topic 会各生成一份 proposal（如果 DB 中都没有已完成调研）。这是可以接受的小问题——proposal 生成成本低，且此场景只在两个人几乎同时搜同一个 topic 的不同写法时才发生。

## 已确认的设计决策

1. **LLM 插入位置**：Layer 1 miss 后、Layer 2 之前（Layer 1.5）
2. **发现 similar 时不生成 proposal**：避免浪费 LLM 调用和 session 资源
3. **similar_topic 返回 research_id 而非 session_id**：前端查看时再创建回放 session
4. **`force=true` 参数**：用户选择"重新调研"时跳过相似检查
5. **候选列表上限 50 条**：防止 DB 增长后 LLM 输入过长
6. **返回最匹配的一个**：不返回多个，避免 UI 复杂度
7. **修复 `ilike` SQL 通配符 escape**：顺手修掉安全隐患
