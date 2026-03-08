# Similar Topic Detection — Plan

## 概述

在 `POST /api/research` 的 Layer 1 (DB) miss 之后，插入 Layer 1.5：用 LLM 判断新 topic 是否与 DB 中已有 topic 语义相同。命中时不创建 session、不生成 proposal，返回 `similar_topic` 信息让前端展示选择 UI。

## 涉及的文件和改动

### 后端

| 文件 | 改动 |
|------|------|
| `backend/app/models/research.py` | 新增 `SimilarTopicMatch` model；修改 `ResearchRequest` 加 `force` 字段；修改 `ResearchProposalResponse` 字段改为可选 |
| `backend/app/config.py` | 新增 `similar_topic_model` 配置 |
| `backend/app/db/repository.py` | 新增 `list_topic_candidates()` 函数；修复 `ilike` 通配符 escape |
| `backend/app/main.py` | 在 `create_research` 中插入 Layer 1.5 逻辑 |
| `backend/app/agents/similar_topic.py` | **新文件**：similar topic 判断 agent |

### 前端

| 文件 | 改动 |
|------|------|
| `frontend/src/types/index.ts` | 新增 `SimilarTopicMatch` 类型；修改 `ResearchProposalResponse` |
| `frontend/src/components/SessionView.tsx` | 处理 similar_topic 响应；`handleViewSimilar` 和 `handleForceNewResearch` 逻辑 |
| `frontend/src/components/SimilarTopicCard.tsx` | **新文件**：相似 topic 选择 UI 组件 |

## 详细实现

### 1. 后端 Models (`backend/app/models/research.py`)

```python
class SimilarTopicMatch(BaseModel):
    topic: str          # 已有调研的原始 topic 文本
    research_id: str    # 已有调研的 DB UUID

class ResearchRequest(BaseModel):
    topic: str
    language: str = "auto"
    force: bool = False  # True 时跳过 Layer 1.5 相似检查

class ResearchProposalResponse(BaseModel):
    session_id: str | None = None
    proposal: ResearchProposal | None = None
    cached: bool = False
    similar_topic: SimilarTopicMatch | None = None
```

`ResearchProposalResponse` 的 `session_id` 和 `proposal` 改为 Optional。当返回 `similar_topic` 时两者为 None。

### 2. Config (`backend/app/config.py`)

```python
similar_topic_model: str = "openrouter:deepseek/deepseek-chat"
```

用最便宜、最快的模型。跟 dedup 用同一个。

### 3. DB Repository (`backend/app/db/repository.py`)

新增函数：

```python
_LIKE_ESCAPE = str.maketrans({"%": "\\%", "_": "\\_"})

async def list_topic_candidates(
    session: AsyncSession, limit: int = 50
) -> list[tuple[str, str, uuid.UUID]]:
    """返回 (topic, topic_normalized, id) 列表，最多 limit 条，按时间倒序。"""
    stmt = (
        select(
            ResearchRow.topic,
            ResearchRow.topic_normalized,
            ResearchRow.id,
        )
        .where(ResearchRow.total_nodes > 0)
        .order_by(ResearchRow.created_at.desc())
        .limit(limit)
    )
    result = await session.execute(stmt)
    return list(result.all())
```

修复 `get_research_by_topic` 中的 `ilike` escape：

```python
# 修改前
ResearchRow.topic.ilike(f"%{topic.strip()}%")

# 修改后
escaped = topic.strip().translate(_LIKE_ESCAPE)
ResearchRow.topic.ilike(f"%{escaped}%", escape="\\")
```

### 4. Similar Topic Agent (`backend/app/agents/similar_topic.py`)

**新文件**。Pydantic AI agent，判断新 topic 是否与已有 topic 列表中的某个语义相同。

```python
from pydantic import BaseModel
from pydantic_ai import Agent

from app.config import settings
from app.services.llm import resolve_model


class SimilarTopicResult(BaseModel):
    matched_topic: str | None = None  # 匹配到的已有 topic 原文，无匹配则 None


_similar_topic_agent = Agent(
    resolve_model(settings.similar_topic_model),
    output_type=SimilarTopicResult,
    instructions="""\
You are a topic similarity detector. Given a NEW topic and a list of EXISTING topics, \
determine if the new topic is semantically the same as any existing topic.

## Rules

- Two topics are "the same" if a user searching for one would be satisfied \
with the research results of the other
- Cross-language synonyms count as the same: "iPhone" = "苹果手机", \
"AI" = "人工智能", "Bitcoin" = "比特币"
- Related but different scope is NOT the same: "AI" ≠ "AI 芯片", \
"iPhone" ≠ "苹果公司", "二战" ≠ "一战"
- If multiple existing topics match, return the most relevant one
- If no match, return matched_topic as null

## Output

Return the EXACT text of the matched existing topic (not a rewrite), or null.""",
    retries=1,
)


async def find_similar_topic(
    new_topic: str,
    existing_topics: list[str],
) -> str | None:
    """返回匹配到的已有 topic 原文，无匹配返回 None。"""
    if not existing_topics:
        return None

    topic_list = "\n".join(f"- {t}" for t in existing_topics)
    prompt = f"NEW topic: {new_topic}\n\nEXISTING topics:\n{topic_list}"

    result = await _similar_topic_agent.run(prompt)
    matched = result.output.matched_topic

    # 容错：LLM 可能返回大小写/空格略有出入的字符串，用 normalized 比较
    if matched:
        matched_stripped = matched.strip()
        for t in existing_topics:
            if t.strip().lower() == matched_stripped.lower():
                return t  # 返回原始列表中的版本
    return None
```

### 5. API 层 (`backend/app/main.py`)

在 `create_research` 函数中，Layer 1 miss 之后、Layer 2 之前，插入 Layer 1.5：

```python
async def create_research(request: ResearchRequest) -> ResearchProposalResponse:
    session_id = str(uuid.uuid4())
    normalized = normalize_topic(request.topic)

    # Layer 1: DB cache (精确+模糊匹配)
    if async_session_factory is not None:
        try:
            async with async_session_factory() as db:
                db_cached = await get_research_by_topic(db, request.topic)
            if db_cached:
                # ... 现有 cached=True 逻辑不变 ...

        except Exception:
            logger.warning("DB cache lookup failed, falling back")

    # Layer 1.5: LLM 相似 topic 检测（仅 force=False 且 DB 可用时）
    if not request.force and async_session_factory is not None:
        try:
            async with async_session_factory() as db:
                candidates = await list_topic_candidates(db)
            if candidates:
                existing_topics = [t[0] for t in candidates]  # topic 原文列表
                matched = await find_similar_topic(request.topic, existing_topics)
                if matched:
                    # 找到匹配的 candidate
                    match_row = next(c for c in candidates if c[0] == matched)
                    logger.info(
                        "Similar topic found: '%s' ≈ '%s'",
                        request.topic, matched,
                    )
                    return ResearchProposalResponse(
                        similar_topic=SimilarTopicMatch(
                            topic=matched,
                            research_id=str(match_row[2]),
                        ),
                    )
        except Exception:
            logger.warning("Similar topic check failed, falling back")

    # Layer 2: Redis proposal cache
    # ... 现有逻辑不变 ...

    # Layer 3: Fresh LLM call
    # ... 现有逻辑不变 ...
```

需要新增 import：

```python
from app.agents.similar_topic import find_similar_topic
from app.db.repository import list_topic_candidates
```

### 6. 前端 Types (`frontend/src/types/index.ts`)

```typescript
export interface SimilarTopicMatch {
  topic: string;
  research_id: string;
}

export interface ResearchProposalResponse {
  session_id: string | null;
  proposal: ResearchProposal | null;
  cached: boolean;
  similar_topic: SimilarTopicMatch | null;
}
```

### 7. 前端 SessionView (`frontend/src/components/SessionView.tsx`)

Phase 新增 `"similar"`：

```typescript
type SessionPhase = "loading" | "similar" | "proposal" | "research" | "error";
```

新增 state：

```typescript
const [similarTopic, setSimilarTopic] = useState<SimilarTopicMatch | null>(null);
const [isNavigating, setIsNavigating] = useState(false);
```

Init 逻辑中处理 similar_topic 响应（`sessionId === "new"` 分支）：

```typescript
.then((data) => {
  if (data.cached) {
    // ... 现有逻辑 ...
  } else if (data.similar_topic) {
    setSimilarTopic(data.similar_topic);
    setPhase("similar");
  } else {
    const sid: string = data.session_id;
    setRealSessionId(sid);
    setProposal(data.proposal);
    setPhase("proposal");
  }
})
```

处理用户选择（带 loading 状态 + fallback）：

```typescript
function handleViewSimilar() {
  if (!similarTopic || isNavigating) return;
  setIsNavigating(true);
  // 用已有 topic 重新 POST，会走 Layer 1 cached=True 路径
  fetch("/api/research", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic: similarTopic.topic, language: "auto" }),
  })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data) => {
      const sid: string = data.session_id;
      setRealSessionId(sid);
      setProposal(data.proposal);
      window.history.replaceState(null, "", `/app/session/${sid}`);

      if (data.cached) {
        // 预期路径：Layer 1 命中，直接回放
        setActiveSession({ sessionId: sid, topic: data.proposal.topic });
        setStreamSessionId(sid);
        setPhase("research");
      } else {
        // Fallback：DB 记录可能已被删除，当作普通 proposal 处理
        setPhase("proposal");
      }
    })
    .catch(() => {
      setIsNavigating(false);
      setPhase("error");
      setError("Failed to load research.");
    });
}

function handleForceNewResearch() {
  const topic = searchParams.get("topic");
  if (!topic || isNavigating) return;
  setIsNavigating(true);
  setPhase("loading");
  fetch("/api/research", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, language: "auto", force: true }),
  })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data) => {
      const sid: string = data.session_id;
      setRealSessionId(sid);
      setProposal(data.proposal);
      window.history.replaceState(null, "", `/app/session/${sid}`);
      setIsNavigating(false);
      setPhase("proposal");
    })
    .catch(() => {
      setIsNavigating(false);
      setPhase("error");
      setError("Failed to create research.");
    });
}
```

渲染 similar phase：

```tsx
{phase === "similar" && similarTopic && (
  <div className="animate-fade-in">
    <SimilarTopicCard
      originalTopic={searchParams.get("topic") ?? ""}
      similarTopic={similarTopic.topic}
      onViewExisting={handleViewSimilar}
      onNewResearch={handleForceNewResearch}
      isLoading={isNavigating}
      locale={locale}
    />
  </div>
)}
```

### 8. SimilarTopicCard 组件 (`frontend/src/components/SimilarTopicCard.tsx`)

**新文件**。UI 设计参照 ProposalCard 的风格，居中卡片。按钮文案固定短文案，topic 名称放在描述文字中（避免长 topic 撑爆按钮布局）。

```tsx
interface Props {
  originalTopic: string;
  similarTopic: string;
  onViewExisting: () => void;
  onNewResearch: () => void;
  isLoading: boolean;
  locale: string;
}

export function SimilarTopicCard({
  originalTopic,
  similarTopic,
  onViewExisting,
  onNewResearch,
  isLoading,
  locale,
}: Props) {
  const isZh = locale.startsWith("zh");

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4">
      <div className="w-full max-w-xl rounded-2xl border border-chrono-border
                      bg-chrono-surface/80 p-8">
        <h2 className="text-chrono-title font-semibold text-chrono-text">
          {isZh ? "发现相似调研" : "Similar Research Found"}
        </h2>
        <p className="mt-3 text-chrono-body text-chrono-text-secondary">
          {isZh
            ? <>你搜索的「{originalTopic}」与已有调研「<span className="font-medium text-chrono-text">{similarTopic}</span>」内容相似，可以直接查看已有结果。</>
            : <>Your search &quot;{originalTopic}&quot; is similar to existing research &quot;<span className="font-medium text-chrono-text">{similarTopic}</span>&quot;. You can view the existing results instantly.</>}
        </p>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onViewExisting}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-chrono-accent px-4 py-3
                       text-chrono-body font-medium text-white
                       transition-colors hover:bg-chrono-accent-hover
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isZh ? "查看已有调研" : "View Existing"}
          </button>
          <button
            onClick={onNewResearch}
            disabled={isLoading}
            className="rounded-lg border border-chrono-border px-4 py-3
                       text-chrono-body text-chrono-text-muted
                       transition-colors hover:bg-chrono-surface-hover
                       hover:text-chrono-text-secondary
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isZh ? "重新调研" : "New Research"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

## 数据流总结

```
用户输入 "苹果手机"
    ↓
POST /api/research { topic: "苹果手机" }
    ↓
Layer 1: DB 精确+模糊 → miss（"苹果手机" 与 "iphone" 无子串关系）
    ↓
Layer 1.5: LLM 判断
  ├─ 从 DB 拉候选: ["iPhone", "二战", "Bitcoin", ...] (最多 50 条)
  ├─ LLM: "苹果手机" ≈ "iPhone" → matched
  └─ 返回 { similar_topic: { topic: "iPhone", research_id: "..." } }
    ↓
前端显示 SimilarTopicCard
  ├─ [查看已有调研] → POST /api/research { topic: "iPhone" }
  │                   → Layer 1 精确命中 → cached=True → 回放
  │                   → (fallback: 如果未命中 cached，当 proposal 处理)
  └─ [重新调研] → POST /api/research { topic: "苹果手机", force: true }
                  → 跳过 Layer 1.5 → Layer 2/3 → 新 proposal
```

## 权衡取舍

1. **每次 Layer 1 miss 都调 LLM**：增加约 0.5-1s 延迟和少量 token 消耗。但 Layer 1 miss 本身就意味着要等 Layer 3 的 proposal LLM 调用（2-5s），相比之下这个开销可接受。
2. **不覆盖 Redis proposal cache**：两个语义相同的 topic 在 proposal 阶段可能各生成一份 proposal。成本低，可接受。
3. **候选上限 50 条**：如果 DB 有 1000 条而匹配项在第 51-1000 条之间，会漏掉。实际场景中最近 50 条覆盖率已经很高。
4. **`force=true` 后新调研**：用户明确选择重新调研，新结果与已有的是独立的（不同 `topic_normalized`，各自一条 DB 记录）。

## Todo List

### Phase A: 后端核心

- [x] 1. `backend/app/models/research.py` — 新增 `SimilarTopicMatch`；修改 `ResearchRequest` 加 `force`；修改 `ResearchProposalResponse` 字段改 Optional
- [x] 2. `backend/app/config.py` — 新增 `similar_topic_model`
- [x] 3. `backend/app/db/repository.py` — 新增 `list_topic_candidates()`；修复 `ilike` escape
- [x] 4. `backend/app/agents/similar_topic.py` — 新文件，similar topic agent
- [x] 5. `backend/app/main.py` — 在 `create_research` 中插入 Layer 1.5

### Phase B: 前端

- [x] 6. `frontend/src/types/index.ts` — 新增 `SimilarTopicMatch` 类型；修改 `ResearchProposalResponse`
- [x] 7. `frontend/src/components/SimilarTopicCard.tsx` — 新文件，选择 UI 组件（固定短按钮文案 + isLoading disabled）
- [x] 8. `frontend/src/components/SessionView.tsx` — 新增 similar phase；`handleViewSimilar`（带 cached fallback）；`handleForceNewResearch`；`isNavigating` loading 状态

### Phase C: 验证

- [x] 9. `ruff check` + `pnpm build` 确保无 lint/type 错误
- [ ] 10. 手动验证：搜索已有 topic 的同义词，确认 similar 提示正常
