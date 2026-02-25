# Phase 1 Plan — 跑通第一条端到端纵切线

**状态：✅ 已完成**

## 目标

```
POST /research { topic: "iPhone" }
  → Orchestrator 用 LLM 评估复杂度
  → 返回结构化的调研提案 JSON
```

这条线串起：FastAPI 路由 → Pydantic 数据模型 → Orchestrator Phase 0 逻辑 → OpenRouter LLM 调用。

不涉及：SSE 流式推送、子 Agent（Milestone 等）、Tavily 搜索、前端。这些后续横向扩展。

---

## 1. 项目初始化 ✅

### backend/pyproject.toml

```toml
[project]
name = "chrono-backend"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi",
    "uvicorn[standard]",
    "pydantic-ai-slim[openrouter]",
    "sse-starlette",
    "tavily-python",
    "pydantic-settings",
]

[dependency-groups]
dev = [
    "pytest",
    "pytest-asyncio",
    "ruff",
    "httpx",
]

[tool.ruff]
target-version = "py312"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "SIM"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
```

### backend/.env

```
OPENROUTER_API_KEY=sk-or-...
TAVILY_API_KEY=tvly-...
```

（`.env` 已在 `.gitignore` 中）

---

## 2. 文件结构 ✅

这条纵切线只需创建以下文件：

```
backend/
├── pyproject.toml
├── .env
└── app/
    ├── __init__.py
    ├── main.py              # FastAPI app + 路由
    ├── config.py            # 环境变量配置（pydantic-settings）
    ├── models/
    │   ├── __init__.py
    │   └── research.py      # 请求/响应/调研提案的 Pydantic models
    ├── orchestrator/
    │   ├── __init__.py
    │   └── orchestrator.py  # Orchestrator Phase 0 逻辑
    └── services/
        ├── __init__.py
        └── llm.py           # OpenRouter provider 封装
```

暂时不创建的：`agents/`、`sse/`、Tavily 服务——本轮不涉及。

---

## 3. 各文件设计 ✅

### 3.1 config.py — 环境变量 ✅

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    openrouter_api_key: str
    tavily_api_key: str

    # 模型配置
    orchestrator_model: str = "anthropic/claude-sonnet-4.5"
    milestone_model: str = "deepseek/deepseek-chat"
    detail_model: str = "deepseek/deepseep-chat"
    synthesizer_model: str = "anthropic/claude-sonnet-4.5"

    model_config = {"env_file": ".env"}

settings = Settings()
```

模型名存在配置里而非业务逻辑中，切换模型改 `.env` 或环境变量即可。

### 3.2 services/llm.py — OpenRouter 封装 ✅

```python
from pydantic_ai.providers.openrouter import OpenRouterProvider
from app.config import settings

provider = OpenRouterProvider(
    api_key=settings.openrouter_api_key,
)
```

全局单例 provider，所有 Agent 共享。保持最简——不加 `app_url`/`app_title`，产品化时再加。

### 3.3 models/research.py — 数据模型 ✅

基于 `technical-design.md` 第 3.2 节和第 7 节定义。

**请求模型：**

```python
from pydantic import BaseModel

class ResearchRequest(BaseModel):
    topic: str
    language: str = "auto"  # auto / zh / en / ja / ...
```

**Orchestrator 输出（LLM 结构化输出）：**

```python
from enum import Enum
from pydantic import BaseModel, Field

class TopicType(str, Enum):
    PRODUCT = "product"
    TECHNOLOGY = "technology"
    CULTURE = "culture"
    HISTORICAL_EVENT = "historical_event"

class ComplexityLevel(str, Enum):
    LIGHT = "light"
    MEDIUM = "medium"
    DEEP = "deep"
    EPIC = "epic"

class ResearchThread(BaseModel):
    name: str                     # 调研维度名称，如 "产品迭代"
    description: str              # 简要说明
    priority: int = Field(ge=1, le=5)  # 1-5，5 最高
    estimated_nodes: int          # 预估节点数

class DurationEstimate(BaseModel):
    min_seconds: int              # 预估最短时长
    max_seconds: int              # 预估最长时长

class ComplexityAssessment(BaseModel):
    level: ComplexityLevel
    time_span: str                # 如 "2007-2025"
    parallel_threads: int         # 并行线索数
    estimated_total_nodes: int    # 预估总节点数
    reasoning: str                # 复杂度判断的理由

class UserFacingProposal(BaseModel):
    title: str                    # 如 "iPhone 发展史"
    summary: str                  # 1-2 句话描述调研范围
    duration_text: str            # 如 "约 2-3 分钟"
    credits_text: str             # 如 "消耗 1 额度"
    thread_names: list[str]       # 调研维度名称列表（前端展示用）

class ResearchProposal(BaseModel):
    topic: str
    topic_type: TopicType
    language: str                 # 检测到的语言
    complexity: ComplexityAssessment
    research_threads: list[ResearchThread]
    estimated_duration: DurationEstimate
    credits_cost: int             # 预估额度消耗
    user_facing: UserFacingProposal
```

**API 响应模型：**

```python
class ResearchProposalResponse(BaseModel):
    session_id: str
    proposal: ResearchProposal
```

**错误响应模型：**

```python
class ErrorResponse(BaseModel):
    error: str                    # 错误类型标识，如 "llm_service_unavailable"
    message: str                  # 用户可读的错误描述
```

### 3.4 orchestrator/orchestrator.py — Phase 0 逻辑 ✅

Orchestrator 的 Phase 0 是"输入理解与增强"。它用 LLM 评估 topic 复杂度，生成调研提案。

这里的关键架构决策：**Phase 0 的 LLM 调用用 Pydantic AI Agent**，但 Orchestrator 本身是纯 asyncio 层，不继承 Agent。

```python
import logging

from pydantic_ai import Agent
from pydantic_ai.models.openrouter import OpenRouterModel
from app.models.research import ResearchRequest, ResearchProposal
from app.services.llm import provider
from app.config import settings

logger = logging.getLogger(__name__)

# Phase 0 评估 Agent — 模块级定义，全局复用
_proposal_agent = Agent(
    OpenRouterModel(settings.orchestrator_model, provider=provider),
    output_type=ResearchProposal,
    instructions="""\
你是 Chrono 调研系统的策略规划专家。给定一个 topic，你需要分析它并生成一份结构化的调研提案。

## 你的任务

1. **判断 topic 类型**：product（产品）/ technology（技术）/ culture（文化现象）/ historical_event（历史事件）
2. **评估调研复杂度**：基于时间跨度、信息密度、并行线索数来判断
3. **规划调研维度**（research_threads）：每条维度带优先级(1-5)和预估节点数
4. **预估时长和额度**
5. **生成用户友好的展示文案**（user_facing）

## 复杂度评估标准

| 等级 | 节点数 | 额度 | 时长范围 | 典型场景 |
|------|--------|------|----------|---------|
| light | 15-25 | 1 | 90-180秒 | 单一产品/技术，时间跨度 < 20 年。如：iPhone, React, Spotify |
| medium | 25-45 | 2 | 180-240秒 | 多个发展阶段，有分支线索。如：微信, 比特币, Docker |
| deep | 50-80 | 3 | 240-360秒 | 跨度大或多线索并行。如：互联网发展史, 冷战, 人工智能 |
| epic | 80-150+ | 5 | 300-480秒 | 超大规模，需分阶段分线索。如：二战, 人类航天史, 中国改革开放 |

## 调研维度规划原则

- 每个维度应该是一个可独立调研的线索
- priority 5 = 核心主线（必须做），priority 1 = 补充线索（可跳过）
- 总节点数 = 各维度 estimated_nodes 之和，应与复杂度等级匹配
- 维度数量：light 1-2 条，medium 2-3 条，deep 3-5 条，epic 4-6 条

## user_facing 字段要求

- title：简洁的调研标题，如 "iPhone 发展史" / "History of React"
- summary：1-2 句话说明调研范围
- duration_text：用用户友好的方式表达时长，如 "约 2-3 分钟"
- credits_text：如 "消耗 1 额度"
- thread_names：调研维度名称列表，对应 research_threads 的 name 字段

## 示例

**输入**: "iPhone"
**预期输出要点**:
- topic_type: product
- complexity.level: light
- 维度: 产品迭代（priority 5, ~15 nodes）、生态与影响（priority 3, ~5 nodes）
- estimated_duration: {min_seconds: 90, max_seconds: 180}
- credits_cost: 1

**输入**: "比特币"
**预期输出要点**:
- topic_type: technology
- complexity.level: medium
- 维度: 技术演进（priority 5）、市场与监管（priority 4）、生态发展（priority 3）
- estimated_duration: {min_seconds: 180, max_seconds: 240}
- credits_cost: 2

**输入**: "二战"
**预期输出要点**:
- topic_type: historical_event
- complexity.level: epic
- 维度: 军事进程（priority 5）、政治外交（priority 4）、关键人物（priority 4）、科技与经济（priority 3）、社会影响（priority 3）
- estimated_duration: {min_seconds: 300, max_seconds: 480}
- credits_cost: 5

## 语言规则

- 检测输入 topic 的语言，设置 language 字段
- 所有文本字段（包括 user_facing）使用 topic 的语言
- 英文 topic → 英文输出，中文 topic → 中文输出""",
    retries=2,
)


class Orchestrator:
    async def create_proposal(self, request: ResearchRequest) -> ResearchProposal:
        result = await _proposal_agent.run(
            f"请评估以下调研主题并生成调研提案：{request.topic}",
        )
        proposal = result.output
        if request.language != "auto":
            proposal = proposal.model_copy(update={"language": request.language})
        return proposal
```

Orchestrator 是一个普通 class，不是 Pydantic AI Agent。它内部使用 `_proposal_agent` 做 LLM 调用，但编排逻辑在 asyncio 层。后续 Phase 1-4 会在这个 class 上扩展方法。

### 3.5 main.py — FastAPI 入口 ✅

```python
import logging
import uuid

from fastapi import FastAPI, HTTPException
from pydantic_ai.exceptions import UnexpectedModelBehavior

from app.models.research import ErrorResponse, ResearchRequest, ResearchProposalResponse
from app.orchestrator.orchestrator import Orchestrator

logger = logging.getLogger(__name__)

app = FastAPI(title="Chrono API")
orchestrator = Orchestrator()


@app.post(
    "/api/research",
    response_model=ResearchProposalResponse,
    responses={502: {"model": ErrorResponse}},
)
async def create_research(request: ResearchRequest) -> ResearchProposalResponse:
    session_id = str(uuid.uuid4())
    try:
        proposal = await orchestrator.create_proposal(request)
    except (UnexpectedModelBehavior, Exception) as e:
        logger.exception("Failed to create research proposal")
        raise HTTPException(
            status_code=502,
            detail=ErrorResponse(
                error="llm_service_unavailable",
                message="Failed to generate research proposal. Please try again.",
            ).model_dump(),
        )
    return ResearchProposalResponse(session_id=session_id, proposal=proposal)
```

错误处理策略：
- OpenRouter 不可用、LLM 返回无法解析的结构 → catch 异常，返回 502 + 结构化 `ErrorResponse`
- Pydantic AI 内部的 retry（`retries=2`）会先尝试让 LLM 修正输出，全部失败才抛异常
- 不做复杂的重试逻辑——Phase 1 保持简单，LLM 调不通就告诉客户端

---

## 4. 数据流

```
Client
  │
  │ POST /api/research { "topic": "iPhone" }
  ▼
FastAPI (main.py)
  │
  │ orchestrator.create_proposal(request)
  ▼
Orchestrator (orchestrator.py)
  │
  │ _proposal_agent.run("请评估...iPhone")
  ▼
Pydantic AI Agent
  │
  │ OpenRouter API call (Claude Sonnet 4.5)
  │ → 结构化输出 → ResearchProposal
  ▼
Orchestrator
  │
  │ return proposal
  ▼
FastAPI
  │
  │ 200 OK { session_id, proposal }
  │ or 502 { error, message }
  ▼
Client
```

---

## 5. 预期响应示例

### 成功

```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "proposal": {
    "topic": "iPhone",
    "topic_type": "product",
    "language": "en",
    "complexity": {
      "level": "light",
      "time_span": "2007-2025",
      "parallel_threads": 2,
      "estimated_total_nodes": 20,
      "reasoning": "iPhone is a single product line with a clear chronological progression over ~18 years."
    },
    "research_threads": [
      {
        "name": "Product Evolution",
        "description": "Major iPhone model releases and hardware innovations",
        "priority": 5,
        "estimated_nodes": 15
      },
      {
        "name": "Ecosystem & Impact",
        "description": "App Store, iOS evolution, industry impact",
        "priority": 3,
        "estimated_nodes": 5
      }
    ],
    "estimated_duration": {
      "min_seconds": 90,
      "max_seconds": 180
    },
    "credits_cost": 1,
    "user_facing": {
      "title": "History of iPhone",
      "summary": "A timeline covering iPhone's product evolution from the original 2007 launch to the latest models, plus its ecosystem impact.",
      "duration_text": "About 2-3 minutes",
      "credits_text": "1 credit",
      "thread_names": ["Product Evolution", "Ecosystem & Impact"]
    }
  }
}
```

### 失败

```json
{
  "detail": {
    "error": "llm_service_unavailable",
    "message": "Failed to generate research proposal. Please try again."
  }
}
```

---

## 6. 验证方式 ✅

```bash
cd backend
uv sync
uv run fastapi dev

# 另一个终端
curl -X POST http://localhost:8000/api/research \
  -H "Content-Type: application/json" \
  -d '{"topic": "iPhone"}'
```

成功标准：
1. 返回 200 + 结构化的 `ResearchProposalResponse` JSON
2. 复杂度评估合理（iPhone 应该是 light）
3. research_threads 有意义且 estimated_nodes 之和与 estimated_total_nodes 大致匹配
4. user_facing 字段齐全，文案自然
5. 断掉网络或用错 API key 时返回 502 + 结构化错误
