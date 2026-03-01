# 前端 Phase A+B 改造计划：设计系统 + Timeline 核心布局重构

## 当前实现理解

### 架构
- `page.tsx` → `ChronoApp` (三阶段状态机: input/proposal/research)
- SSE hook (`useResearchStream`) 驱动数据，不改
- 类型定义 (`types/index.ts`) 不改

### 关键技术细节
- **Tailwind v4**：没有 `tailwind.config.ts`，所有配置在 `globals.css` 的 `@theme inline { }` 块中
- Next.js 16 + React 19，无第三方 UI/动画库
- 字体：Geist Sans / Geist Mono（layout.tsx 加载）
- 当前背景色 `#09090b`（接近 zinc-950），前景色 `#fafafa`
- 两个自定义动画：`fade-in`（0.4s）、`slide-up`（0.5s）

### 当前组件问题
1. `TimelineNode.tsx`：`subtitle` 字段存在但未渲染
2. `Timeline.tsx`：左右交替布局（`index % 2`），中心线 1px absolute div
3. 节点展开是原地撑开（`expanded` state），打乱滚动位置
4. 三种 significance 仅在圆点大小和 revolutionary 的 amber 色上有区别，卡片样式几乎一样
5. 骨架态用 `animate-pulse`，loading 和 skeleton 渲染一致
6. 进度只是一行文字 + pulse 圆点

---

## Part A：设计系统

### A1. 设计 Token — globals.css @theme

在 `globals.css` 的 `@theme inline` 块中定义所有 Chrono token（Tailwind v4 方式）：

```css
@theme inline {
  /* --- Colors --- */
  --color-chrono-bg: #06060a;
  --color-chrono-surface: #0f0f14;
  --color-chrono-surface-hover: #16161d;
  --color-chrono-border: #1e1e28;
  --color-chrono-border-active: #2e2e3a;
  --color-chrono-text: #e8e8ed;
  --color-chrono-text-secondary: #9898a6;
  --color-chrono-text-muted: #5c5c6a;
  --color-chrono-accent: #d4a050;
  --color-chrono-revolutionary: #f0c060;
  --color-chrono-high: #8a9ab0;
  --color-chrono-medium: #5c6470;
  --color-chrono-timeline: #1e1e28;

  /* --- Font sizes (with line-height) --- */
  --font-size-chrono-hero: 3.5rem;
  --font-size-chrono-hero--line-height: 1.1;
  --font-size-chrono-title: 1.5rem;
  --font-size-chrono-title--line-height: 1.3;
  --font-size-chrono-subtitle: 1.125rem;
  --font-size-chrono-subtitle--line-height: 1.4;
  --font-size-chrono-body: 0.9375rem;
  --font-size-chrono-body--line-height: 1.6;
  --font-size-chrono-caption: 0.8125rem;
  --font-size-chrono-caption--line-height: 1.5;
  --font-size-chrono-tiny: 0.6875rem;
  --font-size-chrono-tiny--line-height: 1.4;

  /* --- Animations --- */
  --animate-fade-in: fade-in 0.4s ease-out forwards;
  --animate-slide-up: slide-up 0.5s ease-out forwards;
  --animate-slide-in-right: slide-in-right 0.3s ease-out forwards;

  @keyframes fade-in {
    0% { opacity: 0; transform: translateY(8px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes slide-up {
    0% { opacity: 0; transform: translateY(16px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes slide-in-right {
    0% { opacity: 0; transform: translateX(24px); }
    100% { opacity: 1; transform: translateX(0); }
  }
}
```

Shimmer 动画不能放在 `@theme` 块里（需要用 `@property` 或 `@keyframes` 在全局作用域），单独在 `@theme` 块外定义：

```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

加一个 `.shimmer` utility class（通过 `@utility` 指令或直接写 class）：

```css
@utility shimmer {
  background: linear-gradient(
    90deg,
    var(--color-chrono-surface) 0%,
    var(--color-chrono-surface-hover) 40%,
    var(--color-chrono-surface) 80%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}
```

`body` 样式更新：
```css
body {
  background: var(--color-chrono-bg);
  color: var(--color-chrono-text);
}
```

### A2. App Shell — `components/AppShell.tsx`（新建）

```tsx
// 固定顶栏 + 内容区域
interface Props {
  topic?: string;         // research 阶段显示当前 topic
  showTopBar: boolean;    // input 阶段 false（logo 在页面内），其他阶段 true
  children: React.ReactNode;
}
```

结构：
- 顶栏高度 48px，`position: sticky; top: 0`，半透明背景 + backdrop-blur
- 左侧："Chrono" 小 logo（text-sm font-semibold，点击可回首页 — 但本次不加路由，只是视觉占位）
- 右侧：`topic` 存在时显示 topic 名
- `children` 在顶栏下方渲染
- input 阶段 `showTopBar=false`，顶栏不渲染（SearchInput 自己有大 logo）

改造 `ChronoApp.tsx`：
```tsx
<AppShell topic={phase !== "input" ? proposal?.topic : undefined} showTopBar={phase !== "input"}>
  {phase === "input" && <SearchInput ... />}
  {phase === "proposal" && <ProposalCard ... />}
  {phase === "research" && <Timeline ... />}
</AppShell>
```

### A3. SearchInput 视觉升级

改动范围：
- `h1`：`text-5xl` → `text-chrono-hero`，加 `tracking-wider`，加 `text-chrono-accent` 让品牌色出现
- 副标题：`text-zinc-500` → `text-chrono-text-muted`
- 输入框：`border-zinc-800 bg-zinc-900` → `border-chrono-border bg-chrono-surface`，focus 态用 `border-chrono-border-active`
- 按钮：保持白底深色文字的反差按钮，但颜色改为 `bg-chrono-text text-chrono-bg`
- 错误文字：`text-red-400` 保持（不属于 chrono token 范围）

### A4. ProposalCard 升级

改动范围：
- 外框：`border-zinc-800 bg-zinc-900/80` → `border-chrono-border bg-chrono-surface/80`
- 标题：`text-2xl` → `text-chrono-title`
- 摘要：`text-zinc-400` → `text-chrono-text-secondary`
- thread pills：`border-zinc-700 text-zinc-300` → `border-chrono-border text-chrono-text-secondary`
- priority 视觉：在每个 pill 里加 opacity 差异 — priority 5 的 `opacity-100`，priority 1 的 `opacity-50`（需要把 `user_facing.thread_names` 换成渲染 `research_threads`，因为 thread_names 没有 priority 信息）

  **注意**：当前 ProposalCard 只用 `user_facing.thread_names`（字符串数组），没有 priority 信息。要实现 priority 视觉差异，需要把 `proposal.research_threads` 也传入（已在 props 中通过 `proposal` 传入）。改为遍历 `proposal.research_threads`，用 `thread.name` 显示名称，用 `thread.priority` 控制视觉权重。

- complexity level indicator：4 个小圆点，根据 level 亮不同数量
  - light = 1 亮，medium = 2 亮，deep = 3 亮，epic = 4 亮
  - 亮的用 `bg-chrono-accent`，暗的用 `bg-chrono-border`

- 底部统计信息：`text-zinc-500` → `text-chrono-text-muted`
- 按钮：同 SearchInput 风格统一

### A5. 组件硬编码颜色替换

全面搜索 `zinc-` 引用，替换为对应的 chrono token：

| 旧值 | 新值 |
|------|------|
| `bg-zinc-900` | `bg-chrono-surface` |
| `border-zinc-800` | `border-chrono-border` |
| `border-zinc-700` | `border-chrono-border` 或 `border-chrono-border-active` |
| `text-zinc-100` / `text-zinc-200` / `text-zinc-300` | `text-chrono-text` |
| `text-zinc-400` | `text-chrono-text-secondary` |
| `text-zinc-500` / `text-zinc-600` | `text-chrono-text-muted` |
| `bg-zinc-800` | `bg-chrono-border`（骨架条）或 `bg-chrono-surface-hover` |
| `hover:border-zinc-700` / `hover:border-zinc-500` | `hover:border-chrono-border-active` |
| `bg-amber-400` | `bg-chrono-revolutionary` |
| `text-amber-200` | `text-chrono-revolutionary` |

---

## Part B：Timeline 核心布局重构

### B1. 单侧时间轴布局 — `Timeline.tsx` 重构

替换当前的中心线 + 左右交替布局。

新布局结构：
```
<div className="relative pl-24">       ← 给左侧时间轴线留空间
  {/* 竖线 */}
  <div className="absolute left-16 top-0 bottom-0 w-px bg-chrono-timeline" />

  {nodes.map(node => (
    <TimelineEntry node={node} ... />  ← 新组件，包含圆点+日期+卡片
  ))}
</div>
```

- 左侧区域（~64px 宽）：日期标签 + 竖线 + 圆点
- 右侧区域（剩余空间）：节点卡片
- 移除 `side` prop（不再需要左右判断）

### B2. 年份/年代分隔符

在 `Timeline.tsx` 中增加纯函数 `computeSeparators(nodes)`：

```ts
interface Separator {
  label: string;        // "2010" 或 "1940s"
  insertBeforeIndex: number;
}

function computeSeparators(nodes: TimelineNode[]): Separator[] {
  // 逻辑：
  // 1. 提取每个节点的年份
  // 2. 找到年份变化点
  // 3. 如果相邻年份节点都只有 1-2 个，按年代(decade)分组
  // 4. 如果某年有 >8 个节点，不在该年内部加分隔
  // 返回需要插入分隔符的位置和标签
}
```

分隔符渲染：
```
<div className="relative flex items-center my-6">
  <div className="absolute left-16 h-px w-8 bg-chrono-border" />  ← 从竖线延伸的短横线
  <span className="ml-24 text-chrono-caption text-chrono-text-muted font-medium">
    2010
  </span>
</div>
```

### B3. 节点卡片三层视觉分级 — `TimelineNode.tsx` 重写

移除 `side` prop，移除 `expanded` state（详情改为侧面板）。

**revolutionary 大卡片**：
```tsx
<div className="rounded-xl border-l-4 border-chrono-revolutionary bg-chrono-surface p-6
                shadow-lg shadow-chrono-revolutionary/5">
  <h3 className="text-chrono-subtitle font-semibold text-chrono-revolutionary">{node.title}</h3>
  {node.subtitle && <p className="text-chrono-caption text-chrono-text-secondary">{node.subtitle}</p>}
  <p className="mt-2 text-chrono-body text-chrono-text-secondary">{node.description}</p>
</div>
```
- 左侧 4px 色条（`border-l-4 border-chrono-revolutionary`）
- 标题用 `text-chrono-subtitle`，revolutionary 色
- subtitle 渲染（之前被忽略）
- description 完整展示
- 时间轴圆点：16px，带光晕 `ring-4 ring-chrono-revolutionary/20`

**high 中卡片**：
```tsx
<div className="rounded-xl border border-chrono-border bg-chrono-surface p-5
                hover:border-chrono-border-active transition-colors">
  <h3 className="font-semibold text-chrono-text">{node.title}</h3>
  <p className="mt-1.5 text-chrono-body text-chrono-text-secondary line-clamp-2">{node.description}</p>
</div>
```
- 标准边框，hover 变亮
- description 截断两行（`line-clamp-2`）
- 时间轴圆点：12px，`bg-chrono-high`

**medium 紧凑卡片**：
```tsx
<div className="rounded-lg border border-chrono-border bg-chrono-surface px-4 py-3
                hover:border-chrono-border-active transition-colors">
  <div className="flex items-baseline gap-3">
    <h3 className="font-medium text-chrono-text">{node.title}</h3>
  </div>
  <p className="mt-1 text-chrono-caption text-chrono-text-muted line-clamp-1">{node.description}</p>
</div>
```
- 更紧凑的 padding
- description 截断一行
- 时间轴圆点：8px，`bg-chrono-medium`

点击卡片 → 调用 `onSelect(node.id)`（新 prop），不再自己管理 expanded state。

### B4. 节点详情侧面板 — `components/DetailPanel.tsx`（新建）

```tsx
interface Props {
  node: TimelineNode | null;   // null = 关闭
  language: string;
  onClose: () => void;
}
```

结构：
- 固定定位：`position: fixed; right: 0; top: 0; bottom: 0; width: 420px`
- 半透明背景遮罩（点击关闭）
- 进入动画：`animate-slide-in-right`
- ESC 键监听关闭
- 内容：节点完整信息（标题、日期、significance badge、description、key_features、impact、key_people、context、sources）
- 从 `TimelineNode.tsx` 现有的 expanded 区域迁移渲染逻辑（DetailSection 组件保留）
- 滚动：面板内容溢出时面板内部滚动，页面不动

状态管理：
- `ChronoApp.tsx` 新增 `selectedNodeId: string | null` state
- `Timeline` 接收 `selectedNodeId` 和 `onSelectNode` props
- `TimelineNode` 接收 `isSelected` 和 `onSelect` props
- 选中的节点在时间轴上加高亮：`ring-2 ring-chrono-accent/40`

### B5. Skeleton 状态升级

- 骨架卡片保持标题和日期可见（当前已如此）
- 详情占位区：把 `animate-pulse` 的 `div` 替换为 `.shimmer` utility class
- 节点从 skeleton → complete 的过渡：加 `animate-fade-in`

### B6. Synthesis 区域调整

改动范围：
- 外框：`border-zinc-800 bg-zinc-900/50` → `border-chrono-border bg-chrono-surface/50`
- 标题：`text-zinc-400` → `text-chrono-text-secondary`
- 正文：`text-zinc-300` → `text-chrono-text`
- insight：`text-zinc-400` → `text-chrono-text-secondary`
- 统计数据：改横排紧凑展示（节点数 · 来源数 · 时间跨度）
- verification_notes：`text-amber-500/70` → `text-chrono-accent/70`

### B7. Progress 状态升级

替换当前的 pulse 圆点 + 文字：

```tsx
{!completeData && progressMessage && (
  <div className="mb-8">
    {/* Indeterminate progress bar */}
    <div className="h-0.5 w-full overflow-hidden rounded-full bg-chrono-border">
      <div className="h-full w-1/3 animate-indeterminate rounded-full bg-chrono-accent" />
    </div>
    <p className="mt-3 text-center text-chrono-caption text-chrono-text-muted">
      {progressMessage}
    </p>
  </div>
)}
```

新增 `indeterminate` 动画（在 globals.css）：
```css
@keyframes indeterminate {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}
```

---

## 文件改动清单

| 文件 | 操作 | 改动概述 |
|------|------|----------|
| `globals.css` | 改 | 替换 `@theme` 为完整 chrono token + shimmer/indeterminate 动画 |
| `components/AppShell.tsx` | 新建 | 顶栏 + 内容容器 |
| `components/DetailPanel.tsx` | 新建 | 节点详情侧面板 |
| `components/ChronoApp.tsx` | 改 | 包裹 AppShell，新增 selectedNodeId state，传递 onSelectNode |
| `components/SearchInput.tsx` | 改 | 颜色替换为 chrono token |
| `components/ProposalCard.tsx` | 改 | 颜色替换 + priority 视觉 + complexity indicator |
| `components/Timeline.tsx` | 改 | 单侧布局 + 年份分隔符 + progress bar + synthesis 调整 |
| `components/TimelineNode.tsx` | 改 | 三层卡片 + 移除 expanded + 骨架 shimmer |

**不改的文件**：
- `hooks/useResearchStream.ts`
- `types/index.ts`
- `app/layout.tsx`
- `app/page.tsx`
- `next.config.ts`
- `postcss.config.mjs`
- 所有后端代码

---

## 设计决策说明

1. **Tailwind v4 @theme 而非 tailwind.config.ts**：项目用 Tailwind v4，配置完全在 CSS 的 `@theme` 块中定义。指令中提到的 `tailwind.config.ts` 方式不适用于 v4。

2. **日期显示位置**：日期放在时间轴线左侧（小字），卡片内不再重复日期。Revolutionary 大卡片因为视觉重要性，可考虑在卡片标题上方保留日期——最终实现时以视觉效果为准。

3. **侧面板 vs 底部 sheet**：桌面端用固定右侧面板（420px），不使用 dialog/modal。移动端适配在 Phase E。

4. **Shimmer 实现**：用 CSS `@utility` 指令定义 `.shimmer` class（Tailwind v4 自定义 utility 方式），不引入额外依赖。

5. **年份分隔符自适应逻辑**：纯函数实现，可测试。规则：
   - 年份变化时插入分隔符
   - 如果连续多个年份各只有 1-2 个节点，合并为年代分隔（"1940s"）
   - 同年 >8 个节点时不在年内加分隔

6. **不引入新依赖**：所有效果用纯 CSS + React 实现。不加 framer-motion、radix-ui、headless-ui 等。

---

## Todo List

### Phase A: 设计系统
- [x] A1. `globals.css`：定义完整 chrono token（颜色、字号、动画、shimmer、indeterminate）
- [x] A2. 新建 `AppShell.tsx`：顶栏 + 内容容器
- [x] A3. `SearchInput.tsx`：颜色替换为 chrono token
- [x] A4. `ProposalCard.tsx`：颜色替换 + priority 视觉 + complexity indicator
- [x] A5. `ChronoApp.tsx`：包裹 AppShell，传递 topic 和 showTopBar

### Phase B: Timeline 布局重构
- [x] B1. `Timeline.tsx`：单侧时间轴布局（移除左右交替，左侧日期+线+圆点，右侧卡片）
- [x] B2. `Timeline.tsx`：年份/年代分隔符 `computeSeparators()` 逻辑 + 渲染
- [x] B3. `TimelineNode.tsx`：三层卡片（revolutionary/high/medium）+ 移除 expanded + shimmer 骨架
- [x] B4. 新建 `DetailPanel.tsx`：侧面板详情展示（ESC 关闭、slide-in/slide-out 动画、内部滚动）
- [x] B5. `ChronoApp.tsx`：新增 selectedNodeId + onSelectNode 回调
- [x] B6. `Timeline.tsx`：synthesis 区域视觉对齐 + progress bar 替换
- [x] B7. 全组件扫描：确认无残留 zinc- 硬编码颜色

### 验证
- [x] `pnpm build` 通过（TypeScript 无错误）
- [x] `pnpm lint` 通过（ESLint 无错误）
- [x] 全局 grep `zinc-` 结果为 0
