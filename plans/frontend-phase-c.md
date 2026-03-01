# 前端 Phase C 计划：已有数据可视化

## 当前实现理解

### 数据流验证

1. **phase_name**：后端节点 dict 有可选 `phase_name` 字段。SSE skeleton 推送时包含此字段。`useResearchStream` 用 `JSON.parse` + spread 传递，前端 `onSkeleton` 回调直接 `{...n, status: "skeleton"}` 展开，所以 `phase_name` 会自动保留——只要 TypeScript 类型补上即可。

2. **connections**：`SynthesisData` 已有 `connections?: TimelineConnection[]`。后端 orchestrator L749 把 `gap_connections` 塞进 `synthesis_data["connections"]`。前端 `onSynthesis` 直接设置 `synthesisData`，数据已经到位。

3. **date_corrections**：后端 orchestrator L749 只推送了 `connections`，没推 `date_corrections`。需要在同一位置加一行。前端 `SynthesisData` 也没有 `date_corrections` 字段。

### orchestrator.py 改动点

```python
# L749（现有）
synthesis_data["connections"] = [c.model_dump() for c in gap_connections]
# 新增一行
synthesis_data["date_corrections"] = [c.model_dump() for c in synthesis.date_corrections] if synthesis.date_corrections else []
# L750（现有）
await session.push(SSEEventType.SYNTHESIS, synthesis_data)
```

---

## C1：类型补全 + 后端微调

### types/index.ts

```typescript
// SkeletonNodeData 新增
phase_name?: string;

// TimelineNode 新增
phase_name?: string;

// 新增
export interface DateCorrection {
  node_id: string;
  original_date: string;
  corrected_date: string;
  reason: string;
}

// SynthesisData 新增
date_corrections?: DateCorrection[];
```

### orchestrator.py

L749 后加一行（见上方）。

---

## C2：Phase 分组展示

### `computePhaseGroups(nodes)` 纯函数 — Timeline.tsx

```typescript
interface PhaseGroup {
  name: string;
  startIndex: number;
  endIndex: number;
  timeRange: string;  // "1933 - 1939"
}

function computePhaseGroups(nodes: TimelineNode[]): PhaseGroup[] {
  // 1. 如果没有任何节点有 phase_name，返回 []
  // 2. 按 phase_name 连续分组（相同 phase_name 的连续节点 = 一个组）
  //    注意：gap 节点可能没有 phase_name，归入最近的上一个阶段
  // 3. 从每组首尾节点的 date 提取年份，格式化 timeRange
}
```

gap 节点处理：后端 gap 节点没有 `phase_name`。策略：没有 `phase_name` 的节点归入前一个阶段（如果前面有阶段的话）。这样避免 gap 节点打断阶段分组。

### 渲染

在 Timeline 的节点循环中，当 `index === group.startIndex` 时插入阶段标题块：

```tsx
<div className="mb-6 mt-12 first:mt-0">
  {/* 渐变分隔线 */}
  <div className="mb-4 h-px bg-gradient-to-r from-transparent via-chrono-border to-transparent" />
  <div className="flex items-baseline gap-3 pl-24">
    <h2 className="text-chrono-title font-semibold text-chrono-text">
      {group.name}
    </h2>
    <span className="text-chrono-caption text-chrono-text-muted">
      {group.timeRange}
    </span>
  </div>
</div>
```

- `mt-12` 给阶段间留空白（第一个阶段 `first:mt-0`）
- 渐变分隔线：从透明 → border 色 → 透明，比实线更柔和
- 阶段标题 `text-chrono-title`，时间范围 `text-chrono-caption`
- `pl-24`（= w-16 date + w-8 dot gap）对齐卡片区域

### 与年份分隔符的关系

阶段标题出现的位置如果也有年份分隔符，阶段标题替代年份分隔符。实现方式：`computeSeparators` 生成分隔符后，过滤掉和 `phaseGroup.startIndex` 重合的分隔符。

---

## C3：因果关系连线（方案 B — 内联标记）

### `hooks/useConnections.ts`（新建）

```typescript
interface NodeConnectionInfo {
  outgoing: { targetId: string; targetTitle: string; relationship: string; type: string }[];
  incoming: { sourceId: string; sourceTitle: string; relationship: string; type: string }[];
}

type ConnectionMap = Map<string, NodeConnectionInfo>;

function buildConnectionMap(
  connections: TimelineConnection[],
  nodes: TimelineNode[],
): ConnectionMap { ... }

export function useConnections(
  connections: TimelineConnection[] | undefined,
  nodes: TimelineNode[],
): ConnectionMap {
  return useMemo(() => {
    if (!connections || connections.length === 0) return new Map();
    return buildConnectionMap(connections, nodes);
  }, [connections, nodes]);
}
```

### Connection type 颜色 — globals.css

```css
--color-chrono-caused: #e07050;
--color-chrono-enabled: #5090d0;
--color-chrono-inspired: #50b080;
--color-chrono-responded: #9070c0;
```

### TimelineNode 连接标记

TimelineNodeCard 新增 props：
```typescript
connectionCount: number;
onShowConnections: (nodeId: string) => void;
```

当 `connectionCount > 0` 时，卡片底部渲染一个小标记：
```tsx
<button onClick={(e) => { e.stopPropagation(); onShowConnections(node.id); }}
        className="mt-2 text-chrono-tiny text-chrono-text-muted hover:text-chrono-text-secondary">
  ◈ {connectionCount} {isZh ? "个关联" : "connections"}
</button>
```

### Connection Popover

点击连接标记后，在卡片下方展开一个内联 popover（不是独立组件，而是 TimelineNodeCard 内部的展开区域，类似之前的 expanded detail 但用于 connections）。

TimelineNodeCard 内部新增 `showConnections` state。展开时显示：

```tsx
<div className="mt-3 space-y-2 border-t border-chrono-border pt-3">
  {info.outgoing.map(conn => (
    <button onClick={() => onNavigate(conn.targetId)} className="flex items-center gap-2 text-left w-full">
      <span className="text-chrono-tiny">→</span>
      <span className="text-chrono-caption text-chrono-text-secondary truncate">{conn.targetTitle}</span>
      <span className={`rounded-full px-1.5 py-0.5 text-chrono-tiny ${typeColorClass(conn.type)}`}>
        {conn.type}
      </span>
    </button>
  ))}
  {info.incoming.map(conn => (
    <button onClick={() => onNavigate(conn.sourceId)} className="...">
      <span className="text-chrono-tiny">←</span>
      <span>...</span>
    </button>
  ))}
</div>
```

### 节点跳转 + 高亮

1. 每个节点外层 div 加 `id={node.id}`
2. `ChronoApp` 新增 `highlightedNodeId: string | null` state
3. 跳转逻辑：`document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })` + `setHighlightedNodeId(targetId)` + 1.5s 后 `setHighlightedNodeId(null)`
4. `onNavigateToNode` callback 从 ChronoApp → Timeline → TimelineNodeCard

### highlight 动画 — globals.css

```css
--animate-highlight: highlight 1.5s ease-out forwards;

@keyframes highlight {
  0%, 30% { box-shadow: 0 0 0 2px var(--color-chrono-accent); }
  100% { box-shadow: 0 0 0 2px transparent; }
}
```

TimelineNodeCard 新增 `isHighlighted` prop，当 true 时加 `animate-highlight` class。

### DetailPanel connections 展示

在 DetailPanel 中，如果当前节点有 connections，在 sources 区域之前增加一个 "Connections" section，列出该节点的 outgoing + incoming 关系。复用 `NodeConnectionInfo` 数据，样式同 popover 但不需要跳转功能（因为已经在面板里了）。

---

## C4：Synthesis 区域增强

### 统计仪表盘

替换当前的 timeline_span + source_count 统计行：

```tsx
<div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-chrono-tiny text-chrono-text-muted">
  <span><span className="text-chrono-accent">{nodes.length}</span> {isZh ? "节点" : "nodes"}</span>
  <span><span className="text-chrono-accent">{synthesisData.source_count}</span> {isZh ? "来源" : "sources"}</span>
  {connections.length > 0 && (
    <span><span className="text-chrono-accent">{connections.length}</span> {isZh ? "因果关系" : "connections"}</span>
  )}
  {dateCorrections.length > 0 && (
    <span><span className="text-chrono-accent">{dateCorrections.length}</span> {isZh ? "日期修正" : "corrections"}</span>
  )}
  <span>{synthesisData.timeline_span}</span>
</div>
```

需要把 `nodes.length`、`connections`、`dateCorrections` 传给 Timeline 或在 Timeline 内部访问。`nodes` 和 `synthesisData` 已经是 Timeline 的 props，直接读取即可。

### Date Corrections 折叠区域

```tsx
{dateCorrections.length > 0 && (
  <CollapsibleSection title={isZh ? "日期修正记录" : "Date Corrections"} count={dateCorrections.length}>
    {dateCorrections.map(corr => {
      const nodeTitle = nodes.find(n => n.id === corr.node_id)?.title ?? corr.node_id;
      return (
        <div key={corr.node_id} className="text-chrono-tiny text-chrono-text-muted">
          {nodeTitle}: {corr.original_date} → {corr.corrected_date}
          <span className="ml-2 text-chrono-text-muted/60">({corr.reason})</span>
        </div>
      );
    })}
  </CollapsibleSection>
)}
```

`CollapsibleSection` 是一个小的内联组件（在 Timeline.tsx 内部定义即可）：标题 + 数量 badge + 点击展开/收起。

### ~~Connections 概览~~ — 已删除

Synthesis 区域只在统计仪表盘显示 connections 数量，不展开列表。用户想看具体 connections 就点节点开 DetailPanel。

---

## 审核调整（3 处）

1. **取消 connection popover**：TimelineNodeCard 只显示数量 badge（不可展开），点击卡片 = 开 DetailPanel。Connections 交互统一收归 DetailPanel。
2. **阶段标题块对齐**：复用 flex 三栏结构（date w-16 | dot w-8 | card flex-1），标题对齐 card 列。不写死 `pl-24`。
3. **删除 C4c**：Synthesis 区域不展开 connections 列表，只显示数量统计。

---

## 数据流全景

```
Backend SSE
  ├─ skeleton: { nodes: [..., phase_name?: string] }
  ├─ synthesis: { ..., connections: [...], date_corrections: [...] }
  └─ complete: { ... }

ChronoApp (state)
  ├─ nodes: TimelineNode[] (含 phase_name)
  ├─ synthesisData: SynthesisData (含 connections, date_corrections)
  ├─ selectedNodeId → DetailPanel
  ├─ highlightedNodeId → Timeline → TimelineNodeCard (闪烁)
  └─ onNavigateToNode → scrollIntoView + setHighlightedNodeId

Timeline
  ├─ computePhaseGroups(nodes) → 阶段标题块（复用 flex 三栏布局）
  ├─ computeSeparators(nodes) → 年份分隔符（过滤掉与阶段标题重合的）
  ├─ useConnections(connections, nodes) → connectionMap
  ├─ Synthesis 统计仪表盘 + date_corrections 折叠
  └─ TimelineNodeCard (connectionCount, isHighlighted)

DetailPanel
  └─ connections section（唯一详细展示入口，含跳转功能）
```

---

## 文件改动清单

| 文件 | 操作 | 改动 |
|------|------|------|
| `backend/app/orchestrator/orchestrator.py` | 改 | 1 行：synthesis_data 推送前加 date_corrections |
| `types/index.ts` | 改 | 新增 phase_name、DateCorrection、date_corrections |
| `globals.css` | 改 | 新增 4 个 connection type 颜色 + highlight 动画 |
| `hooks/useConnections.ts` | 新建 | connections 数据处理 hook |
| `ChronoApp.tsx` | 改 | 新增 highlightedNodeId state + onNavigateToNode |
| `Timeline.tsx` | 改 | phase 分组 + synthesis 增强 + connections 传递 |
| `TimelineNode.tsx` | 改 | connection 数量 badge + highlight prop |
| `DetailPanel.tsx` | 改 | connections section（唯一交互入口 + 跳转） |

**不改**：`useResearchStream.ts`、`SearchInput.tsx`、`ProposalCard.tsx`、`AppShell.tsx`

---

## Todo List

### C1: 类型补全 + 后端微调
- [x] C1a. `types/index.ts`：新增 phase_name、DateCorrection、date_corrections
- [x] C1b. `orchestrator.py`：synthesis_data 推送前加 date_corrections

### C2: Phase 分组展示
- [x] C2a. `Timeline.tsx`：`computePhaseGroups()` 纯函数
- [x] C2b. `Timeline.tsx`：阶段标题块渲染（复用 flex 三栏）+ 与年份分隔符去重
- [x] C2c. 验证：有 phase_name（二战 epic）显示阶段分组，无 phase_name 不显示

### C3: 因果关系可视化
- [x] C3a. `globals.css`：connection type 颜色 token + highlight 动画
- [x] C3b. `hooks/useConnections.ts`：新建 hook
- [x] C3c. `TimelineNode.tsx`：connection 数量 badge（只显示，不可展开）+ highlight prop
- [x] C3d. `ChronoApp.tsx`：highlightedNodeId state + onNavigateToNode callback
- [x] C3e. `Timeline.tsx`：传递 connectionMap + highlightedNodeId
- [x] C3f. `DetailPanel.tsx`：connections section（唯一入口，含跳转 + highlight）

### C4: Synthesis 区域增强
- [x] C4a. `Timeline.tsx`：统计仪表盘（节点数、来源数、connections 数、corrections 数、时间跨度）
- [x] C4b. `Timeline.tsx`：date_corrections 折叠展示
