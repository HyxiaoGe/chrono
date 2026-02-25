# Frontend Plan — 前端原型 + SSE Timeline 渲染

## 目标 ✅

```
1. ✅ 用户输入关键词 → POST /api/research → 显示确认界面
2. ✅ 点击"开始调研" → GET stream → SSE 连接
3. ✅ skeleton 事件 → 骨架出现（shimmer 动画）
4. ✅ node_detail 事件 × N → 逐节点从 shimmer 变为完整内容（入场动画）
5. ✅ complete 事件 → 完成状态
```

---

## 1. 项目初始化

```bash
cd /Users/sean/code/chrono
pnpm create next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --no-import-alias --turbopack
```

选项说明：`--app`（App Router）、`--src-dir`（src/ 目录）、`--no-import-alias`（用默认 `@/`）、`--turbopack`（dev server 用 Turbopack）。

然后安装动画依赖（根据实际 Tailwind 版本选择）：
- Tailwind v3：`pnpm add -D tailwindcss-animate`
- Tailwind v4：`pnpm add -D tw-animate-css`

---

## 2. 文件结构

```
frontend/src/
├── app/
│   ├── layout.tsx             # HTML shell + 全局字体
│   ├── page.tsx               # Server Component，渲染 ChronoApp
│   └── globals.css            # Tailwind imports + 自定义动画
├── components/
│   ├── ChronoApp.tsx          # Client Component，管理全局状态和三阶段切换
│   ├── SearchInput.tsx        # 关键词输入 + 提交按钮
│   ├── ProposalCard.tsx       # 调研提案确认界面
│   ├── Timeline.tsx           # 时间轴容器（中央线 + 节点列表）
│   └── TimelineNode.tsx       # 单个节点卡片（skeleton/complete 两种状态）
├── hooks/
│   └── useResearchStream.ts   # SSE 连接 hook
└── types/
    └── index.ts               # TypeScript 类型定义
```

加上根目录配置：
```
frontend/
├── next.config.ts             # rewrites 代理 + compress: false
├── tailwind.config.ts         # 自定义动画（如果 Tailwind v3）
├── tsconfig.json
└── package.json
```

---

## 3. 各文件设计

### 3.1 next.config.ts — API 代理

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
```

`compress: false` 防止 gzip 缓冲 SSE 事件。如果 SSE 仍有缓冲问题，备选方案是 Route Handler 透明代理（见 research）。

### 3.2 types/index.ts — TypeScript 类型

对齐后端 Pydantic models：

```typescript
// --- 后端 API 类型 ---

export interface ResearchRequest {
  topic: string;
  language?: string;
}

export interface ResearchProposal {
  topic: string;
  topic_type: "product" | "technology" | "culture" | "historical_event";
  language: string;
  complexity: {
    level: "light" | "medium" | "deep" | "epic";
    time_span: string;
    parallel_threads: number;
    estimated_total_nodes: number;
    reasoning: string;
  };
  research_threads: {
    name: string;
    description: string;
    priority: number;
    estimated_nodes: number;
  }[];
  estimated_duration: {
    min_seconds: number;
    max_seconds: number;
  };
  credits_cost: number;
  user_facing: {
    title: string;
    summary: string;
    duration_text: string;
    credits_text: string;
    thread_names: string[];
  };
}

export interface ResearchProposalResponse {
  session_id: string;
  proposal: ResearchProposal;
}

// --- SSE 事件 data 类型 ---

export interface ProgressData {
  phase: string;
  message: string;
  percent: number;
}

export interface SkeletonNodeData {
  id: string;
  date: string;
  title: string;
  subtitle: string;
  significance: "revolutionary" | "high" | "medium";
  description: string;
  sources: string[];
  status: "skeleton";
}

export interface NodeDetailData {
  key_features: string[];
  impact: string;
  key_people: string[];
  context: string;
  sources: string[];
}

export interface NodeDetailEvent {
  node_id: string;
  details: NodeDetailData;
}

export interface CompleteData {
  total_nodes: number;
  detail_completed: number;
}

// --- 前端状态类型 ---

export type NodeStatus = "skeleton" | "loading" | "complete";

export interface TimelineNode {
  id: string;
  date: string;
  title: string;
  subtitle: string;
  significance: "revolutionary" | "high" | "medium";
  description: string;
  sources: string[];
  status: NodeStatus;
  details?: NodeDetailData;
}

export type AppPhase = "input" | "proposal" | "research";
```

### 3.3 hooks/useResearchStream.ts — SSE Hook

```typescript
"use client";

import { useEffect, useRef, useCallback } from "react";
import type {
  ProgressData,
  SkeletonNodeData,
  NodeDetailEvent,
  CompleteData,
} from "@/types";

interface StreamCallbacks {
  onProgress?: (data: ProgressData) => void;
  onSkeleton?: (data: { nodes: SkeletonNodeData[] }) => void;
  onNodeDetail?: (data: NodeDetailEvent) => void;
  onComplete?: (data: CompleteData) => void;
  onError?: (data: { error: string; message: string }) => void;
  onConnectionError?: () => void;
}

export function useResearchStream(
  sessionId: string | null,
  callbacks: StreamCallbacks,
) {
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const es = new EventSource(`/api/research/${sessionId}/stream`);
    esRef.current = es;

    function listen<T>(event: string, handler?: (data: T) => void) {
      es.addEventListener(event, (e) => {
        if (!handler) return;
        try {
          handler(JSON.parse((e as MessageEvent).data));
        } catch { /* malformed JSON */ }
      });
    }

    listen<ProgressData>("progress", (d) => cbRef.current.onProgress?.(d));
    listen<{ nodes: SkeletonNodeData[] }>("skeleton", (d) => cbRef.current.onSkeleton?.(d));
    listen<NodeDetailEvent>("node_detail", (d) => cbRef.current.onNodeDetail?.(d));
    listen<CompleteData>("complete", (d) => {
      cbRef.current.onComplete?.(d);
      es.close();
    });
    listen<{ error: string; message: string }>("error", (d) => cbRef.current.onError?.(d));

    es.onerror = () => {
      cbRef.current.onConnectionError?.();
      es.close();
    };

    return () => { es.close(); };
  }, [sessionId]);

  return { close: useCallback(() => esRef.current?.close(), []) };
}
```

关键设计：
- `cbRef` 防止 stale closure，effect 只在 `sessionId` 变化时重连
- `listen` 辅助函数统一处理 JSON parse + type cast
- complete 事件后自动 close
- onerror 禁止自动重连
- 通过 ref 间接读取最新 callback，addEventListener 注册时的 handler 永远读 ref

### 3.4 components/ChronoApp.tsx — 全局状态管理

```typescript
"use client";

import { useState, useCallback, useTransition } from "react";
import type {
  AppPhase,
  ResearchProposal,
  TimelineNode,
  CompleteData,
} from "@/types";
import { useResearchStream } from "@/hooks/useResearchStream";
import { SearchInput } from "./SearchInput";
import { ProposalCard } from "./ProposalCard";
import { Timeline } from "./Timeline";

export function ChronoApp() {
  const [phase, setPhase] = useState<AppPhase>("input");
  const [isPending, startTransition] = useTransition();

  // Proposal 阶段
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [proposal, setProposal] = useState<ResearchProposal | null>(null);

  // Research 阶段
  const [streamSessionId, setStreamSessionId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<TimelineNode[]>([]);
  const [progressMessage, setProgressMessage] = useState("");
  const [completeData, setCompleteData] = useState<CompleteData | null>(null);

  // POST /api/research
  function handleSearch(topic: string) {
    startTransition(async () => {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      if (!res.ok) throw new Error("Failed to create proposal");
      const data = await res.json();
      setSessionId(data.session_id);
      setProposal(data.proposal);
      setPhase("proposal");
    });
  }

  // 用户确认，开始 SSE
  function handleConfirm() {
    setPhase("research");
    setStreamSessionId(sessionId);
  }

  // 用户取消，回到输入
  function handleCancel() {
    setPhase("input");
    setSessionId(null);
    setProposal(null);
  }

  // SSE 回调
  useResearchStream(streamSessionId, {
    onProgress: useCallback((data) => {
      setProgressMessage(data.message);
      // detail phase 开始时，把所有 skeleton 节点标记为 loading
      if (data.phase === "detail") {
        setNodes((prev) =>
          prev.map((n) => (n.status === "skeleton" ? { ...n, status: "loading" } : n)),
        );
      }
    }, []),

    onSkeleton: useCallback(({ nodes: skeletonNodes }) => {
      setNodes(
        skeletonNodes.map((n) => ({ ...n, status: "skeleton" as const })),
      );
    }, []),

    onNodeDetail: useCallback(({ node_id, details }) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === node_id
            ? { ...n, details, status: "complete" as const, sources: [...n.sources, ...details.sources] }
            : n,
        ),
      );
    }, []),

    onComplete: useCallback((data) => {
      setCompleteData(data);
    }, []),
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      {phase === "input" && (
        <SearchInput onSearch={handleSearch} isPending={isPending} />
      )}
      {phase === "proposal" && proposal && (
        <ProposalCard
          proposal={proposal}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
      {phase === "research" && (
        <Timeline
          nodes={nodes}
          progressMessage={progressMessage}
          completeData={completeData}
        />
      )}
    </main>
  );
}
```

关键设计：
- **两个 sessionId**：`sessionId`（POST 返回时设置）和 `streamSessionId`（用户确认后设置）。useResearchStream 依赖 `streamSessionId`，避免 POST 返回后就自动连接 SSE
- **useTransition**：包裹 POST fetch，`isPending` 驱动 SearchInput 的 loading 状态
- **detail phase → loading 状态**：收到 `progress("detail")` 时批量更新节点状态为 loading
- **sources 合并**：node_detail 的 sources 追加到节点的 sources 列表（skeleton 可能已有 sources）

### 3.5 components/SearchInput.tsx

```typescript
"use client";

import { useState } from "react";

interface Props {
  onSearch: (topic: string) => void;
  isPending: boolean;
}

export function SearchInput({ onSearch, isPending }: Props) {
  const [topic, setTopic] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim() || isPending) return;
    onSearch(topic.trim());
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <h1 className="mb-8 text-4xl font-bold tracking-tight">Chrono</h1>
      <p className="mb-8 text-zinc-400">输入任意关键词，AI 为你生成时间线</p>
      <form onSubmit={handleSubmit} className="flex w-full max-w-md gap-3">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="iPhone, 比特币, 冷战..."
          disabled={isPending}
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3
                     text-zinc-100 placeholder-zinc-500 outline-none
                     focus:border-zinc-500 transition-colors"
        />
        <button
          type="submit"
          disabled={isPending || !topic.trim()}
          className="rounded-lg bg-zinc-100 px-6 py-3 font-medium text-zinc-900
                     hover:bg-zinc-200 disabled:opacity-50 transition-colors"
        >
          {isPending ? "分析中..." : "调研"}
        </button>
      </form>
    </div>
  );
}
```

### 3.6 components/ProposalCard.tsx

```typescript
"use client";

import type { ResearchProposal } from "@/types";

interface Props {
  proposal: ResearchProposal;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ProposalCard({ proposal, onConfirm, onCancel }: Props) {
  const { user_facing, complexity } = proposal;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
        <h2 className="text-2xl font-bold">{user_facing.title}</h2>
        <p className="mt-2 text-zinc-400">{user_facing.summary}</p>

        {/* 调研维度 */}
        <div className="mt-6">
          <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">调研维度</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {user_facing.thread_names.map((name) => (
              <span
                key={name}
                className="rounded-full border border-zinc-700 px-3 py-1 text-sm text-zinc-300"
              >
                {name}
              </span>
            ))}
          </div>
        </div>

        {/* 元数据 */}
        <div className="mt-6 flex gap-6 text-sm text-zinc-400">
          <span>{user_facing.duration_text}</span>
          <span>{user_facing.credits_text}</span>
          <span>{complexity.estimated_total_nodes} 个节点</span>
        </div>

        {/* 操作按钮 */}
        <div className="mt-8 flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-zinc-100 py-3 font-medium text-zinc-900
                       hover:bg-zinc-200 transition-colors"
          >
            开始调研
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg border border-zinc-700 px-6 py-3 text-zinc-400
                       hover:border-zinc-500 hover:text-zinc-200 transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 3.7 components/Timeline.tsx

```typescript
"use client";

import type { TimelineNode, CompleteData } from "@/types";
import { TimelineNodeCard } from "./TimelineNode";

interface Props {
  nodes: TimelineNode[];
  progressMessage: string;
  completeData: CompleteData | null;
}

export function Timeline({ nodes, progressMessage, completeData }: Props) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      {/* 顶部进度 */}
      {!completeData && progressMessage && (
        <div className="mb-8 text-center text-sm text-zinc-400">
          {progressMessage}
        </div>
      )}

      {completeData && (
        <div className="mb-8 text-center text-sm text-zinc-500">
          调研完成 · {completeData.total_nodes} 个节点 · {completeData.detail_completed} 个已补充详情
        </div>
      )}

      {/* 时间轴 */}
      <div className="relative">
        {/* 中央线 */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-zinc-800" />

        {nodes.map((node, index) => (
          <TimelineNodeCard
            key={node.id}
            node={node}
            side={index % 2 === 0 ? "left" : "right"}
          />
        ))}
      </div>
    </div>
  );
}
```

### 3.8 components/TimelineNode.tsx

```typescript
"use client";

import { useState } from "react";
import type { TimelineNode } from "@/types";

interface Props {
  node: TimelineNode;
  side: "left" | "right";
}

export function TimelineNodeCard({ node, side }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isComplete = node.status === "complete";

  // 中央线上的节点标记
  const dotClass =
    node.significance === "revolutionary"
      ? "h-4 w-4 bg-amber-400 ring-4 ring-amber-400/20"
      : node.significance === "high"
        ? "h-3 w-3 bg-zinc-300"
        : "h-2.5 w-2.5 bg-zinc-600";

  return (
    <div className="relative mb-12 flex items-start">
      {/* 中央圆点 */}
      <div className="absolute left-1/2 -translate-x-1/2 z-10">
        <div className={`rounded-full ${dotClass}`} />
      </div>

      {/* 卡片（左或右） */}
      <div
        className={`w-[calc(50%-2rem)] ${side === "left" ? "pr-8" : "ml-auto pl-8"}`}
      >
        {isComplete ? (
          <CompleteCard node={node} expanded={expanded} onToggle={() => setExpanded(!expanded)} />
        ) : (
          <SkeletonCard node={node} />
        )}
      </div>
    </div>
  );
}

function SkeletonCard({ node }: { node: TimelineNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="text-xs text-zinc-500">{node.date}</div>
      <div className="mt-1 font-medium">{node.title}</div>
      <div className="mt-3 space-y-2 animate-pulse">
        <div className="h-3 w-full rounded bg-zinc-800" />
        <div className="h-3 w-4/5 rounded bg-zinc-800" />
        <div className="h-3 w-3/5 rounded bg-zinc-800" />
      </div>
    </div>
  );
}

function CompleteCard({
  node,
  expanded,
  onToggle,
}: {
  node: TimelineNode;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isRevolutionary = node.significance === "revolutionary";

  return (
    <div
      className={`animate-fade-in rounded-xl border p-5 cursor-pointer transition-colors
        ${isRevolutionary
          ? "border-amber-400/30 bg-zinc-900 shadow-lg shadow-amber-400/5"
          : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
        }`}
      onClick={onToggle}
    >
      <div className="text-xs text-zinc-500">{node.date}</div>
      <h3 className={`mt-1 font-medium ${isRevolutionary ? "text-amber-200" : ""}`}>
        {node.title}
      </h3>
      <p className="mt-2 text-sm text-zinc-400">{node.description}</p>

      {expanded && node.details && (
        <div className="mt-4 space-y-4 animate-fade-in">
          {/* Key Features */}
          <div>
            <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">关键特性</h4>
            <ul className="mt-1 space-y-1">
              {node.details.key_features.map((f, i) => (
                <li key={i} className="text-sm text-zinc-300">• {f}</li>
              ))}
            </ul>
          </div>

          {/* Impact */}
          <div>
            <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">影响</h4>
            <p className="mt-1 text-sm text-zinc-300">{node.details.impact}</p>
          </div>

          {/* Key People */}
          {node.details.key_people.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">关键人物</h4>
              <ul className="mt-1 space-y-1">
                {node.details.key_people.map((p, i) => (
                  <li key={i} className="text-sm text-zinc-300">{p}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Context */}
          <div>
            <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">背景</h4>
            <p className="mt-1 text-sm text-zinc-300">{node.details.context}</p>
          </div>

          {/* Sources */}
          {node.sources.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">来源</h4>
              <ul className="mt-1 space-y-1">
                {node.sources.map((url, i) => (
                  <li key={i}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-zinc-500 hover:text-zinc-300 truncate block"
                    >
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

关键设计：
- **skeleton 状态**：显示真实的 date + title（从 skeleton 事件来），下面用 shimmer 占位
- **complete 状态**：`animate-fade-in` 入场动画，条件渲染切换时自动触发
- **revolutionary 节点**：amber 色高亮边框 + 更大的中央圆点 + 特殊阴影
- **展开/收起**：默认收起（title + description），点击展开显示 details 全部字段
- **side 控制左右交替**：通过 `w-[calc(50%-2rem)]` + `ml-auto` 实现

### 3.9 app/page.tsx + app/layout.tsx

```typescript
// src/app/page.tsx
import { ChronoApp } from "@/components/ChronoApp";

export default function Page() {
  return <ChronoApp />;
}
```

```typescript
// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Chrono",
  description: "AI-powered timeline research",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

### 3.10 globals.css — 自定义动画

```css
@import "tailwindcss";

/* 如果 Tailwind v4，用 CSS 定义动画 */
@theme {
  --animate-fade-in: fade-in 0.4s ease-out forwards;

  @keyframes fade-in {
    0% { opacity: 0; transform: translateY(8px); }
    100% { opacity: 1; transform: translateY(0); }
  }
}
```

如果是 Tailwind v3，改在 `tailwind.config.ts` 的 `theme.extend` 里定义。

---

## 4. 数据流

```
SearchInput
  │ onSearch(topic)
  ▼
ChronoApp
  │ POST /api/research → setProposal + setSessionId → phase="proposal"
  ▼
ProposalCard
  │ onConfirm → setStreamSessionId → phase="research"
  ▼
useResearchStream(streamSessionId)
  │
  ├─ progress → setProgressMessage
  │             (detail phase → 批量标记 loading)
  │
  ├─ skeleton → setNodes(初始化)
  │
  ├─ node_detail → setNodes(增量更新)
  │                 TimelineNode 从 shimmer → 内容 + animate-fade-in
  │
  └─ complete → setCompleteData
               Timeline 显示完成元数据
```

---

## 5. 验证方式

```bash
# 终端 1：后端
cd backend && uv run fastapi dev app/main.py --port 8000

# 终端 2：前端
cd frontend && pnpm dev

# 浏览器访问 http://localhost:3000
```

成功标准：
1. 输入 "iPhone" → 显示提案确认（title, summary, thread_names, duration_text）
2. 点击"开始调研" → 骨架出现，节点显示 date + title + shimmer
3. 节点逐个从 shimmer 变为完整内容，有入场动画
4. 点击节点展开详情（key_features, impact, key_people, context, sources）
5. complete 后底部显示元数据
6. revolutionary 节点有特殊视觉样式
