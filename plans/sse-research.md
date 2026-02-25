# SSE in FastAPI — Research

## 1. SSE 协议基础

SSE (Server-Sent Events) 是 HTTP 上的单向推送协议。客户端通过 `EventSource` API 发起 GET 请求，服务端返回 `Content-Type: text/event-stream` 的流式响应。

### 1.1 Wire Format

```
event: agent_status\n
data: {"agent_id": "milestone-1", "status": "running"}\n
\n
```

关键规则：
- 每个 field 用 `\n` 结尾
- 事件之间用空行 `\n` 分隔（即 `\n\n` 结束一个事件）
- `event:` 指定事件类型，客户端用 `addEventListener("agent_status", ...)` 监听
- `data:` 是载荷，可以是任意字符串（我们用 JSON）
- `id:` 可选，客户端断线重连时通过 `Last-Event-ID` header 告知服务端
- `retry:` 可选，告诉客户端重连间隔（毫秒）
- 不带 `event:` 的消息走 `onmessage` 默认处理器

### 1.2 客户端示例

```typescript
const es = new EventSource("/api/research/stream/abc123");

es.addEventListener("skeleton", (e) => {
  const data = JSON.parse(e.data);
  renderSkeleton(data);
});

es.addEventListener("node_detail", (e) => {
  const data = JSON.parse(e.data);
  fillNodeDetail(data);
});

es.addEventListener("complete", () => {
  es.close();
});
```

---

## 2. 方案对比：sse-starlette vs 原生 StreamingResponse

### 2.1 sse-starlette（推荐）

**包信息**: `sse-starlette` v3.2.0 (2026-01-17), BSD-3-Clause, Python 3.9+

#### 核心 API

三个主要类：

1. **`EventSourceResponse`** — 响应对象，接收 async generator，自动处理 SSE 编码、keepalive ping、客户端断连检测
2. **`ServerSentEvent`** — 结构化事件，支持 `data`, `event`, `id`, `retry` 字段
3. **`JSONServerSentEvent`** — 同上，但 `data` 自动做 JSON 序列化

#### EventSourceResponse 构造参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `content` | AsyncIterator | 必填 | async generator，yield 事件 |
| `status_code` | int | 200 | HTTP 状态码 |
| `headers` | dict | None | 额外 HTTP headers |
| `media_type` | str | `text/event-stream` | Content-Type |
| `ping` | int | 15 | keepalive ping 间隔（秒），0 禁用 |
| `sep` | str | `\r\n` | 行分隔符 |
| `send_timeout` | float | None | 发送超时（秒） |
| `ping_message_factory` | Callable | None | 自定义 ping 消息工厂 |
| `data_sender_callable` | Callable | None | 独立数据发送协程 |
| `client_close_handler_callable` | Callable | None | 客户端断开回调 |
| `background` | BackgroundTask | None | 响应结束后的后台任务 |

#### 代码示例：发送多种类型的结构化事件

```python
import asyncio
import json
from fastapi import FastAPI, Request
from sse_starlette import EventSourceResponse, ServerSentEvent

app = FastAPI()

@app.get("/api/research/stream/{session_id}")
async def stream_research(session_id: str, request: Request):
    async def event_generator():
        try:
            # 推送 agent 状态
            yield ServerSentEvent(
                data=json.dumps({
                    "agent_id": "milestone-1",
                    "status": "running",
                    "message": "正在构建时间轴骨架..."
                }),
                event="agent_status",
                id="evt-001",
            )

            await asyncio.sleep(1)

            # 推送骨架数据
            skeleton = {
                "nodes": [
                    {"id": "n1", "date": "2007-01-09", "title": "iPhone 发布", "significance": "revolutionary"},
                    {"id": "n2", "date": "2008-07-11", "title": "App Store 上线", "significance": "high"},
                ]
            }
            yield ServerSentEvent(
                data=json.dumps(skeleton),
                event="skeleton",
                id="evt-002",
            )

            # 逐个推送节点详情
            for node in skeleton["nodes"]:
                if await request.is_disconnected():
                    break

                detail = {"node_id": node["id"], "description": "...", "sources": ["..."]}
                yield ServerSentEvent(
                    data=json.dumps(detail),
                    event="node_detail",
                    id=f"evt-detail-{node['id']}",
                )
                await asyncio.sleep(0.5)

            # 完成
            yield ServerSentEvent(data="{}", event="complete")

        except asyncio.CancelledError:
            # 客户端断开或服务器关闭时触发
            # 必须 re-raise，否则 sse-starlette 无法正确清理
            raise

    return EventSourceResponse(
        event_generator(),
        ping=15,
        send_timeout=30,
        headers={"X-Accel-Buffering": "no"},  # Nginx 反代必须
    )
```

#### 用 JSONServerSentEvent 简化 JSON 序列化

```python
from sse_starlette import JSONServerSentEvent

yield JSONServerSentEvent(
    data={"agent_id": "milestone-1", "status": "running"},
    event="agent_status",
)
# data 字段自动做 json.dumps，compact 格式，ensure_ascii=False
```

#### yield dict 的简写形式

sse-starlette 也接受直接 yield dict：

```python
yield {"data": "hello", "event": "message", "id": "1"}
```

但这种形式 `data` 只能是字符串，JSON 需要手动 dumps。且语义不如 `ServerSentEvent` 清晰。对于我们需要多种 event type + JSON payload 的场景，建议统一用 `ServerSentEvent`。

---

### 2.2 原生 StreamingResponse（不推荐）

FastAPI 内置的 `StreamingResponse` 可以实现 SSE，但需要手动处理所有协议细节。

#### 代码示例

```python
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
import asyncio
import json

app = FastAPI()

def format_sse(data: str, event: str | None = None, id: str | None = None) -> str:
    """手动格式化 SSE 事件"""
    lines = []
    if event:
        lines.append(f"event: {event}")
    if id:
        lines.append(f"id: {id}")
    # data 可能包含换行，每行都要加 "data: " 前缀
    for line in data.split("\n"):
        lines.append(f"data: {line}")
    lines.append("")  # 空行结束事件
    lines.append("")
    return "\n".join(lines)

@app.get("/api/research/stream/{session_id}")
async def stream_research(session_id: str, request: Request):
    async def event_generator():
        yield format_sse(
            data=json.dumps({"agent_id": "milestone-1", "status": "running"}),
            event="agent_status",
            id="evt-001",
        )

        await asyncio.sleep(1)

        skeleton = {"nodes": [{"id": "n1", "title": "iPhone 发布"}]}
        yield format_sse(
            data=json.dumps(skeleton),
            event="skeleton",
            id="evt-002",
        )

        yield format_sse(data="{}", event="complete")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
```

#### StreamingResponse 的缺陷

| 问题 | 说明 |
|------|------|
| **无 keepalive ping** | 必须自己实现心跳机制，否则代理/负载均衡器会因为超时断开连接 |
| **客户端断连检测差** | `StreamingResponse` 在客户端断开后不会自动停止 generator，generator 会继续运行直到自然结束或手动检查 `request.is_disconnected()` |
| **手动格式化** | 需要自己写 `format_sse()`，处理多行 data 的 `data: ` 前缀、字段拼接、换行符 |
| **无超时保护** | 没有 `send_timeout`，如果 send 阻塞会卡死 |
| **无优雅关闭** | 服务器关闭时不会通知 generator 停止 |
| **Header 手动设** | Content-Type、Cache-Control、Connection 都要自己写 |

---

### 2.3 结论

**用 sse-starlette，不用 StreamingResponse。**

理由：
1. sse-starlette 完全实现 W3C SSE 规范，不需要手写协议层代码
2. 内建 keepalive ping（默认 15 秒），对付 Nginx/负载均衡器的超时问题
3. 自动检测客户端断连，及时释放资源（对于长时间运行的调研任务至关重要）
4. `ServerSentEvent` 类提供类型化的事件构造，与我们的 Pydantic model 配合良好
5. `send_timeout` 防止 send 阻塞
6. 优雅关闭：监听 uvicorn shutdown 信号，自动 cancel 所有活跃的 generator
7. 成熟稳定：BSD 协议，v3.2.0，活跃维护

---

## 3. 核心模式：asyncio.Queue 桥接后台任务和 SSE

我们的场景：Orchestrator 在后台持续运行（spawn agent、收集结果），SSE endpoint 需要实时推送这些结果。这不是简单的 "async generator 自产自销"，而是需要一个生产者-消费者桥梁。

**asyncio.Queue 是标准方案。**

### 3.1 架构

```
┌──────────────────┐         ┌──────────────────┐
│   Orchestrator   │         │   SSE Endpoint   │
│  (background)    │         │  (async gen)     │
│                  │  Queue  │                  │
│  queue.put(evt)  │ ──────► │  await queue.get │
│                  │         │  yield SSE event │
└──────────────────┘         └──────────────────┘
```

### 3.2 代码示例

```python
import asyncio
import json
from dataclasses import dataclass
from enum import Enum
from typing import Any

from fastapi import FastAPI, Request
from sse_starlette import EventSourceResponse, ServerSentEvent


class SSEEventType(str, Enum):
    AGENT_STATUS = "agent_status"
    SKELETON = "skeleton"
    NODE_DETAIL = "node_detail"
    NODE_ENRICHMENT = "node_enrichment"
    PROGRESS = "progress"
    SYNTHESIS = "synthesis"
    COMPLETE = "complete"
    ERROR = "error"


@dataclass
class SSEEvent:
    type: SSEEventType
    data: dict[str, Any]
    id: str | None = None


class ResearchSession:
    """管理一次调研的 SSE 事件流"""

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.queue: asyncio.Queue[SSEEvent | None] = asyncio.Queue()
        self._closed = False

    async def push(self, event: SSEEvent) -> None:
        """Orchestrator 调用此方法推送事件"""
        if not self._closed:
            await self.queue.put(event)

    async def close(self) -> None:
        """发送终止信号"""
        self._closed = True
        await self.queue.put(None)  # sentinel value

    async def event_generator(self, request: Request):
        """SSE endpoint 消费此 generator"""
        try:
            while True:
                if await request.is_disconnected():
                    break

                try:
                    event = await asyncio.wait_for(
                        self.queue.get(), timeout=1.0
                    )
                except asyncio.TimeoutError:
                    continue  # 回到循环顶部检查 disconnect

                if event is None:  # sentinel
                    break

                yield ServerSentEvent(
                    data=json.dumps(event.data, ensure_ascii=False),
                    event=event.type.value,
                    id=event.id,
                )
        except asyncio.CancelledError:
            raise


# --- 使用示例 ---

app = FastAPI()
sessions: dict[str, ResearchSession] = {}


async def run_orchestrator(session: ResearchSession, topic: str) -> None:
    """模拟 Orchestrator 后台运行"""
    await session.push(SSEEvent(
        type=SSEEventType.AGENT_STATUS,
        data={"agent_id": "milestone", "status": "running"},
    ))

    await asyncio.sleep(2)

    await session.push(SSEEvent(
        type=SSEEventType.SKELETON,
        data={"nodes": [
            {"id": "n1", "date": "2007-01-09", "title": "iPhone announced"},
        ]},
    ))

    await session.push(SSEEvent(
        type=SSEEventType.COMPLETE,
        data={"total_nodes": 1, "duration_seconds": 2},
    ))

    await session.close()


@app.post("/api/research")
async def start_research(topic: str):
    session_id = "abc123"  # 实际用 uuid
    session = ResearchSession(session_id)
    sessions[session_id] = session

    # 启动 Orchestrator 后台任务
    asyncio.create_task(run_orchestrator(session, topic))

    return {"session_id": session_id}


@app.get("/api/research/stream/{session_id}")
async def stream_research(session_id: str, request: Request):
    session = sessions[session_id]
    return EventSourceResponse(
        session.event_generator(request),
        ping=15,
        send_timeout=30,
        headers={"X-Accel-Buffering": "no"},
    )
```

### 3.3 为什么用 Queue 而不是直接在 generator 里跑逻辑

| 直接在 generator 里跑 | Queue 桥接 |
|----------------------|-----------|
| generator 既是生产者又是消费者 | 生产者（Orchestrator）和消费者（SSE）解耦 |
| 无法从外部向 generator 推送事件 | Orchestrator 可以随时 push 事件 |
| 如果客户端断开，Orchestrator 逻辑也被 cancel | Orchestrator 可以独立于 SSE 连接运行 |
| 难以支持多客户端监听同一个调研 | 可以多个 Queue 订阅同一个 Orchestrator |

---

## 4. 连接管理

### 4.1 客户端断连

sse-starlette 提供三层断连检测：

1. **`request.is_disconnected()`** — 在 generator 循环中主动轮询
2. **`asyncio.CancelledError`** — sse-starlette 在检测到断连后 cancel generator
3. **`client_close_handler_callable`** — 断连回调，用于清理资源

```python
async def on_disconnect(message):
    session = sessions.pop(session_id, None)
    if session:
        await session.close()

return EventSourceResponse(
    session.event_generator(request),
    client_close_handler_callable=on_disconnect,
)
```

### 4.2 Keepalive Ping

sse-starlette 默认每 15 秒发一个 SSE comment（`: ping`），不触发客户端事件但维持连接。可自定义：

```python
from sse_starlette import ServerSentEvent

EventSourceResponse(
    generator,
    ping=10,  # 10 秒间隔
    ping_message_factory=lambda: ServerSentEvent(comment="keepalive"),
)
```

### 4.3 Send Timeout

防止因网络问题导致 send 永久阻塞：

```python
EventSourceResponse(generator, send_timeout=30)
# 30 秒内 send 不出去就放弃
```

### 4.4 优雅关闭

sse-starlette 内部 monkey-patch uvicorn 的 shutdown handler，收到 SIGTERM/SIGINT 时：
- 通知所有活跃的 EventSourceResponse
- Cancel 所有 generator
- generator 收到 CancelledError，执行 finally 块清理
- 这一切自动发生，无需额外代码

### 4.5 反代 / CDN 注意事项

| 基础设施 | 问题 | 解决方案 |
|----------|------|---------|
| **Nginx** | 默认 16KB 缓冲，SSE 事件攒够才发 | `X-Accel-Buffering: no` header |
| **Cloudflare** | ~100KB 缓冲，与 SSE 不兼容 | 绕过 Cloudflare 或用 WebSocket |
| **HAProxy** | 超时断连 | timeout 设为大于 ping 间隔 |
| **Vercel** | Serverless 函数有执行时长限制 | 后端不部署在 Vercel，用 Railway/Fly.io |

---

## 5. 错误处理

### 5.1 Generator 内部错误

```python
async def event_generator(self, request: Request):
    try:
        while True:
            event = await self.queue.get()
            if event is None:
                break
            yield ServerSentEvent(
                data=json.dumps(event.data),
                event=event.type.value,
            )
    except asyncio.CancelledError:
        raise  # 必须 re-raise
    except Exception as e:
        # 推送错误事件让前端知道出了问题
        yield ServerSentEvent(
            data=json.dumps({"error": str(e)}),
            event="error",
        )
```

### 5.2 Orchestrator 错误

如果 Orchestrator 后台任务异常退出，需要通过 Queue 通知 SSE：

```python
async def run_orchestrator(session: ResearchSession, topic: str) -> None:
    try:
        # ... 调研逻辑 ...
        pass
    except Exception as e:
        await session.push(SSEEvent(
            type=SSEEventType.ERROR,
            data={"error": str(e), "recoverable": False},
        ))
    finally:
        await session.close()
```

---

## 6. 与 Chrono 架构的对接

基于 `technical-design.md` 第 6.1 节的 SSE 事件协议，以下是对接方案：

### 6.1 事件类型映射

| 技术文档定义的事件 | SSEEventType | 推送时机 |
|-------------------|-------------|---------|
| `agent_status` | AGENT_STATUS | Agent 启动/完成/出错时 |
| `skeleton` | SKELETON | Phase 1 骨架构建完成 |
| `node_detail` | NODE_DETAIL | Phase 2 每个节点完成时 |
| `node_enrichment` | NODE_ENRICHMENT | Phase 3 补充信息时 |
| `progress` | PROGRESS | 定期推送进度百分比 |
| `synthesis` | SYNTHESIS | Phase 4 汇总完成时 |
| `complete` | COMPLETE | 所有工作结束 |

### 6.2 数据流走向

```
POST /api/research          → 创建 session, 启动 Orchestrator task, 返回 session_id
GET  /api/research/stream/X → 建立 SSE 连接, 从 session.queue 消费事件
```

Orchestrator（asyncio 层）通过 `session.push()` 向 Queue 推送事件。
SSE endpoint（FastAPI 层）通过 `session.event_generator()` 消费 Queue 并 yield 给客户端。
两者解耦，Orchestrator 不知道也不关心 SSE 的存在。

### 6.3 Session 生命周期

1. `POST /research` → 创建 `ResearchSession`，存入内存 dict
2. `GET /stream/{id}` → 开始消费 Queue
3. Orchestrator 完成 → push `COMPLETE` 事件 + sentinel `None`
4. Generator 收到 sentinel → 退出循环
5. 客户端收到 `complete` 事件 → 调用 `es.close()`
6. 清理 session（从 dict 中移除）

异常场景：
- 客户端中途断开 → sse-starlette cancel generator → `client_close_handler` 清理 session
- Orchestrator 崩溃 → push `ERROR` 事件 → close session
- 服务器重启 → 所有 generator 收到 CancelledError → 自动清理

---

## 7. 安装

```bash
uv add sse-starlette
```

---

## Sources

- [sse-starlette GitHub](https://github.com/sysid/sse-starlette)
- [sse-starlette PyPI](https://pypi.org/project/sse-starlette/)
- [EventSourceResponse API — DeepWiki](https://deepwiki.com/sysid/sse-starlette/2.1-eventsourceresponse)
- [Usage Guide — DeepWiki](https://deepwiki.com/sysid/sse-starlette/3-usage-guide)
- [FastAPI StreamingResponse disconnect discussion](https://github.com/fastapi/fastapi/discussions/7572)
- [LLM Web App with FastAPI + SSE — DEV Community](https://dev.to/zachary62/build-an-llm-web-app-in-python-from-scratch-part-4-fastapi-background-tasks-sse-21g4)
- [SSE with FastAPI and React](https://www.softgrade.org/sse-with-fastapi-react-langgraph/)
- [Building SSE MCP Server with FastAPI — Ragie](https://www.ragie.ai/blog/building-a-server-sent-events-sse-mcp-server-with-fastapi)
