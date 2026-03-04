# /app Homepage Experience Refactor

## Context

The `/app` input phase currently shows a bare search bar with hardcoded suggested topic pills and a history list. The goal is to transform it into a discovery-oriented page with:
- Categorized recommended topics from a backend API (replacing hardcoded pills)
- Compact layout with less wasted vertical space
- HistoryList improvements: empty state message, 5-item cap with "View all"

---

## File Changes Summary

| File | Action |
|------|--------|
| `backend/app/data/recommended.py` | **New** — Hardcoded categorized topics data |
| `backend/app/main.py` | **Edit** — Add `GET /api/topics/recommended` endpoint |
| `frontend/src/data/landing.ts` | **Edit** — Remove `tryLabel`/`suggestedTopics`, add `explore`/`noHistory`/`viewAll` |
| `frontend/src/components/RecommendedTopics.tsx` | **New** — Category tabs + topic card grid |
| `frontend/src/components/SearchInput.tsx` | **Edit** — Remove suggested pills, compact layout, add RecommendedTopics |
| `frontend/src/components/HistoryList.tsx` | **Edit** — Empty state, 5-item limit with "View all" |

**Not changed**: ChronoApp.tsx, Timeline.tsx, AppShell.tsx, ProposalCard.tsx, DemoPlayer.tsx, landing page components, hooks/\*

---

## 1. Backend: Recommended Topics API

### `backend/app/data/recommended.py` (new)

每个 topic 包含 `title`/`subtitle`/`complexity`/`estimated_nodes` 四字段，给用户足够的决策信息。Category icon 用 lucide-react icon name（不用 emoji，避免跨平台渲染差异）。

```python
RECOMMENDED_TOPICS: list[dict] = [
    {
        "id": "technology",
        "icon": "cpu",
        "label": {"en": "Technology", "zh": "科技"},
        "topics": [
            {
                "title": {"en": "iPhone", "zh": "iPhone"},
                "subtitle": {"en": "From the first smartphone to a cultural icon", "zh": "从第一部智能手机到文化符号"},
                "complexity": "medium",
                "estimated_nodes": 30,
            },
            {
                "title": {"en": "Bitcoin", "zh": "比特币"},
                "subtitle": {"en": "The rise of decentralized digital currency", "zh": "去中心化数字货币的崛起"},
                "complexity": "medium",
                "estimated_nodes": 28,
            },
            {
                "title": {"en": "Artificial Intelligence", "zh": "人工智能"},
                "subtitle": {"en": "From Turing's dream to ChatGPT", "zh": "从图灵的设想到 ChatGPT"},
                "complexity": "deep",
                "estimated_nodes": 50,
            },
            {
                "title": {"en": "Tesla", "zh": "特斯拉"},
                "subtitle": {"en": "Electric vehicles and the future of transport", "zh": "电动汽车与未来交通"},
                "complexity": "medium",
                "estimated_nodes": 25,
            },
            {
                "title": {"en": "SpaceX", "zh": "SpaceX"},
                "subtitle": {"en": "Reusable rockets and the new space race", "zh": "可回收火箭与新太空竞赛"},
                "complexity": "medium",
                "estimated_nodes": 25,
            },
            {
                "title": {"en": "Quantum Computing", "zh": "量子计算"},
                "subtitle": {"en": "The quest for computational supremacy", "zh": "通往计算霸权之路"},
                "complexity": "light",
                "estimated_nodes": 18,
            },
        ],
    },
    {
        "id": "history",
        "icon": "landmark",
        "label": {"en": "History", "zh": "历史"},
        "topics": [
            {
                "title": {"en": "World War II", "zh": "二战"},
                "subtitle": {"en": "The deadliest conflict in human history", "zh": "人类历史上最惨烈的冲突"},
                "complexity": "deep",
                "estimated_nodes": 55,
            },
            {
                "title": {"en": "Cold War", "zh": "冷战"},
                "subtitle": {"en": "Decades of superpower rivalry", "zh": "数十年的超级大国对抗"},
                "complexity": "deep",
                "estimated_nodes": 50,
            },
            {
                "title": {"en": "French Revolution", "zh": "法国大革命"},
                "subtitle": {"en": "Liberty, equality, and the birth of modern politics", "zh": "自由、平等与现代政治的诞生"},
                "complexity": "medium",
                "estimated_nodes": 30,
            },
            {
                "title": {"en": "Silk Road", "zh": "丝绸之路"},
                "subtitle": {"en": "Ancient trade routes connecting East and West", "zh": "连接东西方的古代贸易之路"},
                "complexity": "medium",
                "estimated_nodes": 25,
            },
            {
                "title": {"en": "Space Race", "zh": "太空竞赛"},
                "subtitle": {"en": "From Sputnik to the Moon landing", "zh": "从斯普特尼克到登月"},
                "complexity": "medium",
                "estimated_nodes": 28,
            },
            {
                "title": {"en": "Roman Empire", "zh": "罗马帝国"},
                "subtitle": {"en": "Rise and fall of the ancient superpower", "zh": "古代超级大国的兴衰"},
                "complexity": "deep",
                "estimated_nodes": 50,
            },
        ],
    },
    {
        "id": "culture",
        "icon": "globe",
        "label": {"en": "Culture", "zh": "文化"},
        "topics": [
            {
                "title": {"en": "Olympic Games", "zh": "奥运会"},
                "subtitle": {"en": "From ancient Greece to a global spectacle", "zh": "从古希腊到全球盛事"},
                "complexity": "deep",
                "estimated_nodes": 45,
            },
            {
                "title": {"en": "Rock Music", "zh": "摇滚音乐"},
                "subtitle": {"en": "The sound that changed a generation", "zh": "改变一代人的声音"},
                "complexity": "medium",
                "estimated_nodes": 30,
            },
            {
                "title": {"en": "Cinema", "zh": "电影"},
                "subtitle": {"en": "From silent films to the streaming era", "zh": "从无声电影到流媒体时代"},
                "complexity": "deep",
                "estimated_nodes": 45,
            },
            {
                "title": {"en": "Renaissance", "zh": "文艺复兴"},
                "subtitle": {"en": "The cultural rebirth of Europe", "zh": "欧洲文化的重生"},
                "complexity": "medium",
                "estimated_nodes": 30,
            },
            {
                "title": {"en": "Hip Hop", "zh": "嘻哈音乐"},
                "subtitle": {"en": "From the Bronx to global dominance", "zh": "从布朗克斯到全球统治"},
                "complexity": "medium",
                "estimated_nodes": 25,
            },
            {
                "title": {"en": "Video Games", "zh": "电子游戏"},
                "subtitle": {"en": "The evolution of interactive entertainment", "zh": "交互式娱乐的进化"},
                "complexity": "medium",
                "estimated_nodes": 30,
            },
        ],
    },
    {
        "id": "science",
        "icon": "atom",
        "label": {"en": "Science", "zh": "科学"},
        "topics": [
            {
                "title": {"en": "DNA Discovery", "zh": "DNA 发现"},
                "subtitle": {"en": "Unlocking the code of life", "zh": "解开生命密码"},
                "complexity": "medium",
                "estimated_nodes": 25,
            },
            {
                "title": {"en": "Climate Change", "zh": "气候变化"},
                "subtitle": {"en": "The science and politics of a warming planet", "zh": "变暖星球的科学与政治"},
                "complexity": "deep",
                "estimated_nodes": 45,
            },
            {
                "title": {"en": "Internet", "zh": "互联网"},
                "subtitle": {"en": "From ARPANET to the connected world", "zh": "从 ARPANET 到互联世界"},
                "complexity": "deep",
                "estimated_nodes": 45,
            },
            {
                "title": {"en": "Nuclear Energy", "zh": "核能"},
                "subtitle": {"en": "Power and peril of the atom", "zh": "原子的力量与危险"},
                "complexity": "medium",
                "estimated_nodes": 30,
            },
            {
                "title": {"en": "Antibiotics", "zh": "抗生素"},
                "subtitle": {"en": "The discovery that saved millions", "zh": "拯救了数百万人的发现"},
                "complexity": "light",
                "estimated_nodes": 18,
            },
            {
                "title": {"en": "Theory of Relativity", "zh": "相对论"},
                "subtitle": {"en": "Einstein's revolution in physics", "zh": "爱因斯坦的物理学革命"},
                "complexity": "light",
                "estimated_nodes": 15,
            },
        ],
    },
]
```

### `backend/app/main.py` (edit)

Add endpoint after existing `list_researches_endpoint`:

```python
from app.data.recommended import RECOMMENDED_TOPICS

@app.get("/api/topics/recommended")
async def get_recommended_topics():
    return RECOMMENDED_TOPICS
```

---

## 2. i18n Updates — `frontend/src/data/landing.ts`

**Remove** from `app` interface and both locale objects:
- `tryLabel`
- `suggestedTopics`

**Add** to `app`:
```ts
explore: string;
noHistory: string;
viewAll: string;
```

Values:
| Key | en | zh |
|-----|----|----|
| `explore` | `"Explore topics"` | `"探索主题"` |
| `noHistory` | `"No research history yet"` | `"暂无调研记录"` |
| `viewAll` | `"View all"` | `"查看全部"` |

---

## 3. RecommendedTopics Component

### 前置：安装 lucide-react

lucide-react 当前**不在** `package.json` 中，需要先安装：
```bash
cd frontend && pnpm add lucide-react
```

### `frontend/src/components/RecommendedTopics.tsx` (new)

**Props:**
```ts
interface Props {
  onSelectTopic: (topic: string) => void;
  locale: Locale;
}
```

**Data fetching:** `useEffect` fetches `GET /api/topics/recommended` on mount. Stores in state as `Category[]`. Shows shimmer skeleton while loading.

**Types** (local to component):
```ts
interface Topic {
  title: Record<string, string>;
  subtitle: Record<string, string>;
  complexity: string;
  estimated_nodes: number;
}

interface Category {
  id: string;
  icon: string;       // lucide icon name, e.g. "cpu"
  label: Record<string, string>;
  topics: Topic[];
}
```

**Icon map** — lucide-react 动态渲染：
```ts
import { Cpu, Landmark, Globe, Atom, type LucideIcon } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  cpu: Cpu,
  landmark: Landmark,
  globe: Globe,
  atom: Atom,
};
```

Tab 渲染时：`const Icon = ICON_MAP[category.icon]`，如果命中则 `<Icon size={14} />`。

**Layout:**

```
<section heading: t.explore>
  <category tabs — horizontal, lucide icon + label>
  <topic cards grid — 3 cols desktop, 2 mobile>
</section>
```

- **Section heading**: `text-chrono-caption text-chrono-text-muted mb-4 tracking-wide uppercase` (matches HistoryList group heading style)
- **Tabs**: `flex gap-2 overflow-x-auto pb-1`, each tab is a `rounded-full border px-3 py-1 text-chrono-caption cursor-pointer flex items-center gap-1.5` pill. Active: `bg-chrono-accent/10 border-chrono-accent text-chrono-accent`. Inactive: `border-chrono-border/50 text-chrono-text-muted hover:border-chrono-accent/50`.
- **Cards**: `grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4`. Each card is a rich TopicCard (see below), not a plain text pill.
- **Click behavior**: `onClick={() => onSelectTopic(topic.title[locale])}` — triggers search directly (same as HistoryList).
- **Default selected tab**: first category (`technology`).

**TopicCard 渲染**：
```
<button className="rounded-lg border border-chrono-border/40 px-4 py-3 text-left
                    hover:border-chrono-accent transition-colors cursor-pointer">
  <div className="text-chrono-body text-chrono-text font-medium">{topic.title[locale]}</div>
  <p className="mt-1 text-chrono-tiny text-chrono-text-muted line-clamp-2">{topic.subtitle[locale]}</p>
  <div className="mt-2 flex items-center gap-2">
    <span className={`rounded-full px-2 py-0.5 text-chrono-tiny font-medium ${BADGE_COLORS[topic.complexity]}`}>
      {topic.complexity}
    </span>
    <span className="text-chrono-tiny text-chrono-text-muted/50">~{topic.estimated_nodes} nodes</span>
  </div>
</button>
```

复用 HistoryList 相同的 `BADGE_COLORS` 配色（`light`/`medium`/`deep`/`epic`），保持一致性。颜色定义直接在组件内重复声明（和 HistoryList 一样的 map），不抽公共模块。

**Loading skeleton**: 2 rows × 3 列的 shimmer card 骨架，每个 card 包含 title + subtitle + badge 三行占位。

---

## 4. SearchInput Layout Refactor

### `frontend/src/components/SearchInput.tsx` (edit)

**Remove:**
- The entire `{/* Suggested topics */}` block (lines 58-75): the `tryLabel` span and `suggestedTopics.map(...)` pills

**Add:**
- `import { RecommendedTopics } from "./RecommendedTopics"`
- After error message, before HistoryList: `<RecommendedTopics onSelectTopic={onSelectTopic} locale={locale} />`

**Layout change:**
- `pt-[12vh]` → `pt-[8vh]` (less wasted space above title)
- **保留** `min-h-[calc(100vh-3.5rem)]`（防止内容少时页面塌缩）
- `items-center` 改为 `items-start`，让内容从顶部开始而非垂直居中（配合 `pt-[8vh]` 控制上方间距）
- RecommendedTopics gets `mt-8 w-full max-w-4xl` wrapper (same width as HistoryList)

New render order:
```
<div min-h-[calc(100vh-3.5rem)] items-start pt-[8vh]>
  <h1>Chrono</h1>
  <p>subtitle</p>
  <form>search input + button</form>
  {error}
  <RecommendedTopics />   ← replaces suggested pills
  <HistoryList />
</div>
```

---

## 5. HistoryList Enhancements

### `frontend/src/components/HistoryList.tsx` (edit)

**Change 1 — Empty state (line 168):**

Current:
```tsx
if (error || (!loading && items.length === 0)) return null;
```

New:
```tsx
if (error) return null;
if (!loading && items.length === 0) {
  return (
    <div className="w-full max-w-4xl mt-10">
      <h2 className="text-chrono-caption text-chrono-text-muted mb-2 tracking-wide uppercase">
        {t.recent}
      </h2>
      <p className="text-chrono-tiny text-chrono-text-muted/50">{t.noHistory}</p>
    </div>
  );
}
```

**Change 2 — 5-item limit in flat list view (line 213-222):**

The flat list view (≤6 items) currently shows all items. Add a 5-item cap with "View all" toggle.

```tsx
const [expanded, setExpanded] = useState(false);
const displayItems = expanded ? items : items.slice(0, 5);
const hasMore = items.length > 5;

// In flat list render:
return (
  <div className="w-full max-w-4xl mt-10">
    <HistoryGroup title={t.recent} items={displayItems} ... />
    {hasMore && !expanded && (
      <button onClick={() => setExpanded(true)}
        className="mt-2 text-chrono-caption text-chrono-text-muted hover:text-chrono-accent transition-colors cursor-pointer">
        {t.viewAll} ({items.length})
      </button>
    )}
  </div>
);
```

Grouped view (>6 items) unchanged — already self-organized.

---

## 6. Execution Order

1. `backend/app/data/recommended.py` — topic data module
2. `backend/app/main.py` — add endpoint
3. `cd frontend && pnpm add lucide-react` — 安装 icon 依赖
4. `frontend/src/data/landing.ts` — i18n changes (remove/add keys)
5. `frontend/src/components/RecommendedTopics.tsx` — new component
6. `frontend/src/components/SearchInput.tsx` — layout refactor
7. `frontend/src/components/HistoryList.tsx` — empty state + 5-item limit
8. Backend: `cd backend && uv run ruff check . && uv run ruff format .`
9. Frontend: `cd frontend && pnpm build && pnpm lint`

---

## 7. Verification

1. `GET /api/topics/recommended` returns 4 categories with bilingual labels
2. `/app` shows compact search bar → recommended topics grid → history list
3. Category tabs filter the topic grid; default tab is "Technology"
4. Clicking a topic card triggers search (same as clicking a history item)
5. Empty history shows `t.noHistory` message (not blank)
6. History with >5 items shows first 5 + "View all (N)" button; clicking expands
7. Both locales (en/zh) render correct labels, topic names, and UI text
8. `pnpm build && pnpm lint` + `ruff check` clean
9. `/app?topic=iPhone` auto-search and `/app?session=...` restore still work
