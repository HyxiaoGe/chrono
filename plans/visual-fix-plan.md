# Chrono 视觉急救 — 实现计划

## 1. 色彩系统重调 — `globals.css`

### 当前值 → 目标值（全部对齐 Tailwind zinc 色阶）

```
chrono-bg:             #06060a → #09090b   (zinc-950)
chrono-surface:        #0f0f14 → #18181b   (zinc-900)
chrono-surface-hover:  #16161d → #27272a   (zinc-800)
chrono-border:         #1e1e28 → #3f3f46   (zinc-700)
chrono-border-active:  #2e2e3a → #52525b   (zinc-600)
chrono-text:           #e8e8ed → #fafafa   (zinc-50)
chrono-text-secondary: #9898a6 → #a1a1aa   (zinc-400)
chrono-text-muted:     #5c5c6a → #71717a   (zinc-500)
chrono-timeline:       #1e1e28 → #3f3f46   (= border, zinc-700)
```

accent 系列颜色不变：
```
chrono-accent:         #d4a050  (不变)
chrono-revolutionary:  #f0c060  (不变)
chrono-high:           #8a9ab0  (不变)
chrono-medium:         #5c6470 → #71717a  (和 text-muted 对齐，当前太暗)
```

connection 类型颜色不变（caused/enabled/inspired/responded）。

### 确认：全部使用 zinc 标准色阶值

- zinc-950: `#09090b`
- zinc-900: `#18181b`
- zinc-800: `#27272a`
- zinc-700: `#3f3f46`
- zinc-600: `#52525b`
- zinc-500: `#71717a`
- zinc-400: `#a1a1aa`
- zinc-50:  `#fafafa`

没有自发明的颜色值。

---

## 2. MiniMap 替换 — `MiniMap.tsx`

选择**备选方案**：去掉当前的 dot-per-node MiniMap，改为右下角浮动导航。

理由：86 个 dot 在任何尺寸下都不可读，时间刻度条实现复杂且需要精确的位置映射。浮动导航更简单，导航价值更高。

### 新 MiniMap 设计

固定在右下角（`fixed right-4 bottom-4`），包含：

- 当前位置文字：显示 active node 的年份（如 `1943`）
- "/" 分隔 + 总时间跨度（如 `1933 - 2024`）
- "↑" 按钮：回到顶部（滚动到第一个节点）

样式：`rounded-lg border border-chrono-border bg-chrono-surface/95 backdrop-blur-sm`，和页面主体有明确区分。

宽度自适应内容，高度单行。只在 `nodes.length >= 15` 时渲染（ChronoApp 中已有该条件）。

### Props 变更

```typescript
interface Props {
  nodes: TimelineNode[];
  activeNodeId: string | null;
  onNavigateToNode: (id: string) => void;
}
```

移除 `phaseGroups` 和 `visibleNodeIds`（不再需要）。ChronoApp 传参相应简化。

---

## 3. FilterBar 折叠重做 — `FilterBar.tsx`

### 默认状态（折叠）

一行：`[搜索框 w-48] [匹配计数+导航] [filter icon 按钮]`

- 搜索框始终可见，比之前略宽（`w-48`）
- filter icon 按钮：用文字 "Filter"（不引入 icon 库），点击切换展开/折叠
- 当有 active filter 时，Filter 按钮旁显示一个小圆点指示器

### 展开状态

搜索框行下方展开一行：
```
[Rev] [High] [Med]   [Phase dropdown]   [年份范围 slider]   [Reset]
```

- significance toggle 改为 chip 样式：
  - 未选中：`border border-chrono-border text-chrono-text-muted`
  - 选中：`bg-chrono-surface-hover text-chrono-text border border-chrono-border-active`
  - 不再使用红蓝灰三色，统一中性色
- Phase dropdown 和年份 slider 样式不变（已经足够紧凑）
- Reset 按钮只在展开状态且有 active filter 时显示

### 新增 state

FilterBar 内部新增 `const [expanded, setExpanded] = useState(false)` 控制展开/折叠。

---

## 4. 减少 accent 色使用 — `Timeline.tsx`

### Synthesis stats dashboard

当前：`<span className="text-chrono-accent">{nodes.length}</span>`（金色数字）

改为：`<span className="text-chrono-text">{nodes.length}</span>`（白色数字）

涉及 4 处 `text-chrono-accent` → `text-chrono-text`（nodes、sources、connections、corrections 数字）。

### verification_notes

当前：`text-chrono-accent/70`

改为：`text-chrono-text-muted`（中性色，和其他辅助文本一致）

### Connection badge — `TimelineNode.tsx`

当前：每张卡片底部始终显示 `◈ N connections`。

改为：默认隐藏，hover 卡片时才显示。

```
// badge wrapper
<div className="mt-2 text-chrono-tiny text-chrono-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
```

需要在卡片最外层 div 加 `group` class。

---

## 5. 卡片三层分级加强 — `TimelineNode.tsx`

### revolutionary

当前：`bg-chrono-surface p-6 shadow-lg shadow-chrono-revolutionary/5`

改为：`bg-chrono-surface-hover p-6 shadow-md shadow-chrono-revolutionary/10`

- 背景提升一级（从 zinc-900 到 zinc-800），从其他卡片中跳出
- shadow 稍微增强可见度

### high

保持不变：`border border-chrono-border bg-chrono-surface p-5`

### medium

当前：`border border-chrono-border bg-chrono-surface px-4 py-3`（和 high 几乎一样）

改为：无背景、无边框、无圆角。纯文本行。

```
<div className="... px-4 py-2 transition-all hover:bg-chrono-surface/50 ...">
  <h3 className="font-medium text-chrono-text-secondary">{node.title}</h3>
  <p className="mt-0.5 text-chrono-caption text-chrono-text-muted line-clamp-1">
    {node.description}
  </p>
</div>
```

- 标题颜色降级到 `text-chrono-text-secondary`（不再和 high 一样用 `text-chrono-text`）
- hover 时出现微弱背景（`hover:bg-chrono-surface/50`）
- padding 收窄（`py-2`）

### SkeletonCard 对应调整

- revolutionary skeleton：`bg-chrono-surface-hover`
- medium skeleton：去掉边框和背景，只保留 shimmer 条

---

## 6. Synthesis 精简 — `Timeline.tsx`

### summary 截断

用 `line-clamp-3` 截断。加一个 "展开/收起" 按钮。

```tsx
const [summaryExpanded, setSummaryExpanded] = useState(false);

<p className={`mb-4 text-chrono-body leading-relaxed text-chrono-text ${summaryExpanded ? "" : "line-clamp-3"}`}>
  {synthesisData.summary}
</p>
{synthesisData.summary.length > 200 && (
  <button onClick={() => setSummaryExpanded(!summaryExpanded)} className="...">
    {summaryExpanded ? (isZh ? "收起" : "Less") : (isZh ? "展开全文" : "More")}
  </button>
)}
```

### verification_notes 折叠

当前直接渲染。改为和 date_corrections 一样用 CollapsibleSection 包裹，默认折叠。

### 整体间距收紧

- Synthesis 区域 `p-6` → `px-6 py-4`
- `mb-10` → `mb-8`
- `mb-4`（summary 下方）→ `mb-2`

---

## 7. 年份分隔符加强 — `Timeline.tsx`

当前：
```
<span className="text-chrono-caption font-medium text-chrono-text-muted">
```

改为：
```
<span className="pl-1 text-chrono-body font-medium text-chrono-text-secondary">
```

分隔线颜色改为 `bg-chrono-border`（跟着 zinc-700 调亮后自然更可见）。

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `globals.css` | 色值替换（zinc 色阶） |
| `MiniMap.tsx` | 全部重写（浮动导航） |
| `ChronoApp.tsx` | MiniMap 传参简化 |
| `FilterBar.tsx` | 折叠/展开 + chip 样式 |
| `Timeline.tsx` | accent 色移除、synthesis 精简、年份分隔符 |
| `TimelineNode.tsx` | 卡片分级加强、connection badge hover-only |

## 不改的文件

`types/index.ts`、`useResearchStream.ts`、`useConnections.ts`、`useActiveNode.ts`、`SearchInput.tsx`、`ProposalCard.tsx`、`DetailPanel.tsx`、`AppShell.tsx`、`ExportDropdown.tsx`、`utils/timeline.ts`

---

## 执行顺序

1. `globals.css` 色值替换 → build（所有组件自动生效）
2. `TimelineNode.tsx` 卡片分级 + badge hover
3. `Timeline.tsx` accent 减少 + synthesis 精简 + 年份分隔符
4. `MiniMap.tsx` 重写 + `ChronoApp.tsx` 传参调整
5. `FilterBar.tsx` 折叠重做
6. `pnpm build` + `pnpm lint`

---

## Todo List

- [x] 1. globals.css 色值替换（zinc 色阶）→ pnpm build
- [x] 2. TimelineNode.tsx 卡片分级 + badge hover-only
- [x] 3. Timeline.tsx accent 减少 + synthesis 精简 + 年份分隔符
- [x] 4. MiniMap.tsx 重写 + ChronoApp.tsx 传参
- [x] 5. FilterBar.tsx 折叠重做
- [x] 6. pnpm build + pnpm lint clean
