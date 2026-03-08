# Session UI/UX Polish Plan

## 1. DetailPanel 优化

### 1a. Sources 链接美化
当前：裸 URL 截断显示，难以识别来源
改为：提取域名 + path 简化显示，加上 external link 图标

```tsx
// Before:  https://en.wikipedia.org/wiki/iPhone_(1st_generation)
// After:   wikipedia.org › iPhone_(1st_generation)  ↗
function formatUrl(url: string): { display: string; domain: string } {
  try {
    const u = new URL(url);
    const domain = u.hostname.replace(/^www\./, "");
    const path = u.pathname.length > 1 ? u.pathname.slice(1) : "";
    const short = path.length > 40 ? path.slice(0, 37) + "…" : path;
    return { display: short ? `${domain} › ${short}` : domain, domain };
  } catch {
    return { display: url, domain: "" };
  }
}
```

样式：每个 source 一行，`domain` 用 `text-chrono-text-secondary`，path 用 `text-chrono-text-muted`，右侧 `ExternalLink` 图标（lucide）。

### 1b. Connections 分组显示
当前：outgoing 和 incoming 混在一起
改为：分成两组，各带小标题

```
→ Caused / Enabled（影响了）
  App Store Launch            caused
  iPhone X & Face ID          inspired

← Influenced by（受影响于）
  Macintosh Launch            enabled
```

使用 `"→ "` + 标题 + 关系标签的布局不变，但加上 outgoing/incoming 的分组标题。关系描述 `conn.relationship` 目前没显示，加到 hover title 或小字显示。

## 2. Timeline 节点卡片优化

### 2a. Connection count 常驻显示
当前：`opacity-0 group-hover:opacity-100`，hover 才能看到
改为：始终显示，但用低调样式。改成 inline 在 meta 行里，不单独占一行。

### 2b. Medium 节点增加辨识度
当前：`px-4 py-2`，无边框无背景，和空白区域几乎没有区分
改为：加 `rounded-lg` + 微弱左边框 `border-l-2 border-chrono-medium/30`，hover 时 `bg-chrono-surface/50`。

### 2c. Skeleton → Complete 过渡动画
当前：骨架屏直接替换为内容，无过渡
改为：完成时加 `animate-fade-in` class（已有此动画 class）。确认 skeleton 到 complete 切换时触发。

## 3. MiniMap 增强

当前：只显示年份 + 回顶部按钮，移动端隐藏。

优化方案：
- 加进度信息：`12/26 nodes`（完成数/总数）
- 加当前 phase 名称
- 移动端：不显示完整 MiniMap，但在 Navbar 区域已有 activeYear 显示，足够

```tsx
// 进度计算
const completedCount = nodes.filter(n => n.status === "complete").length;
// 显示: 12/26 ◈ 2015 / 2007–2025
```

## 4. DenseGroup 优化

### 4a. 折叠态增加信息
当前：只有 `N events` + 标题列表
改为：加时间跨度、高亮 significance 标记

```tsx
// 5 events · 2008–2010 · ● 1 high
```

### 4b. 展开/收起动画
使用 CSS `max-height` + `overflow: hidden` + `transition` 做平滑展开。或者用 `grid-template-rows: 0fr → 1fr` 技巧（更简洁）。

## 5. SynthesisBlock 层次优化

当前：summary + key_insight + stats + verification notes + date corrections 全部平铺

改为：
- summary 和 key_insight 保持当前位置不变
- stats 行改成 pill/chip 样式，更紧凑：`26 nodes | 145 sources | 14 connections | 2007–2025`
- verification notes 改成图标触发的 tooltip 或 popover，不占主体空间。用一个小图标 `ℹ️ 3 notes` 点击展开即可（当前的 CollapsibleSection 已经是折叠的，保留但视觉上更紧凑）

## 6. 选中节点时高亮关联节点

当前：选中节点只影响 DetailPanel 和自身的 ring 样式，timeline 上其他关联节点无变化。

改为：选中节点 A 时，A 的所有关联节点在 timeline 上获得 subtle highlight：
- 关联节点卡片左边框变色（根据 connection type 的颜色）
- 非关联节点略微降低透明度 `opacity-60`

实现：
1. `Timeline` 组件接收 `selectedNodeId`，从 `connectionMap` 计算出 `connectedNodeIds: Set<string>`
2. 传给每个 `TimelineNodeCard` 一个 `isConnected` prop
3. 非选中且非关联的节点加 `opacity-60 transition-opacity`

---

## 实施顺序

### Phase A：快速改进（改动小、效果明显）
- [ ] 2a. Connection count 常驻显示
- [ ] 2b. Medium 节点辨识度
- [ ] 2c. Skeleton → Complete 过渡
- [ ] 3. MiniMap 进度信息

### Phase B：DetailPanel 优化
- [ ] 1a. Sources 链接美化
- [ ] 1b. Connections 分组 + relationship 显示

### Phase C：交互增强
- [ ] 6. 选中节点时高亮关联节点
- [ ] 4a. DenseGroup 折叠态信息
- [ ] 4b. DenseGroup 展开动画

### Phase D：收尾
- [ ] 5. SynthesisBlock 层次优化
