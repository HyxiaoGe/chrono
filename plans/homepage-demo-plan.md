# Homepage Hero Demo Animation — Plan

## File Changes

| File | Action |
|------|--------|
| `frontend/src/data/demo.ts` | New — mock data |
| `frontend/src/components/DemoPlayer.tsx` | New — demo player component |
| `frontend/src/components/SearchInput.tsx` | Edit — layout + import DemoPlayer |
| `frontend/src/app/globals.css` | Edit — add cursor blink keyframe |

Not modified: Timeline.tsx, TimelineNode.tsx, ChronoApp.tsx, ProposalCard.tsx, AppShell.tsx, backend.

---

## 1. Mock Data (`frontend/src/data/demo.ts`)

Single default export object with `proposal`, `nodes`, `details`, `synthesis`.

### Proposal

```ts
export const demoData = {
  proposal: {
    topic: "iPhone",
    topic_type: "product" as const,
    language: "en",
    complexity: {
      level: "light" as const,
      time_span: "2007 – 2024",
      parallel_threads: 1,
      estimated_total_nodes: 8,
      reasoning: "Well-documented consumer product with clear milestones",
    },
    research_threads: [
      { name: "Product Launches", description: "Major iPhone releases", priority: 5, estimated_nodes: 4 },
      { name: "Technology Innovation", description: "Key technology introductions", priority: 4, estimated_nodes: 3 },
      { name: "Market Impact", description: "Industry-shifting moments", priority: 3, estimated_nodes: 1 },
    ],
    estimated_duration: { min_seconds: 60, max_seconds: 120 },
    credits_cost: 1,
    user_facing: {
      title: "iPhone",
      summary: "From the revolutionary 2007 unveiling to today's AI-powered devices — a complete timeline.",
      duration_text: "~2 min",
      credits_text: "1 credit",
      thread_names: ["Product Launches", "Technology Innovation", "Market Impact"],
    },
  },

  nodes: [ /* 8 nodes — see table below */ ],
  details: { /* keyed by node id */ },
  synthesis: { /* ... */ },
};
```

### 8 Nodes

```ts
nodes: [
  {
    id: "ms_001", date: "2007-01-09", title: "iPhone Announcement",
    subtitle: "Macworld 2007", significance: "revolutionary",
    description: "Steve Jobs unveiled the first iPhone at Macworld, combining a phone, widescreen iPod, and internet communicator into one device.",
    sources: [], phase_name: "Product Launches",
  },
  {
    id: "ms_002", date: "2007-06-29", title: "iPhone Launch",
    subtitle: "US market release", significance: "high",
    description: "The original iPhone went on sale at $499, with customers lining up for days.",
    sources: [], phase_name: "Product Launches",
  },
  {
    id: "ms_003", date: "2008-07-11", title: "App Store Launch",
    subtitle: "Third-party app ecosystem", significance: "revolutionary",
    description: "Apple opened the App Store with 500 apps, creating the mobile app economy.",
    sources: [], phase_name: "Technology Innovation",
  },
  {
    id: "ms_004", date: "2010-06-07", title: "iPhone 4 & Retina Display",
    subtitle: "New industrial design", significance: "high",
    description: "Introduced the Retina Display and a glass-and-steel industrial design that set the standard.",
    sources: [], phase_name: "Technology Innovation",
  },
  {
    id: "ms_005", date: "2013-09-10", title: "Touch ID & iPhone 5s",
    subtitle: "Biometric authentication", significance: "high",
    description: "First fingerprint sensor in a mainstream smartphone, enabling secure mobile payments.",
    sources: [], phase_name: "Technology Innovation",
  },
  {
    id: "ms_006", date: "2017-09-12", title: "iPhone X & Face ID",
    subtitle: "Edge-to-edge display era", significance: "revolutionary",
    description: "Removed the home button and introduced Face ID and an edge-to-edge OLED display.",
    sources: [], phase_name: "Product Launches",
  },
  {
    id: "ms_007", date: "2020-10-13", title: "iPhone 12 & 5G",
    subtitle: "5G connectivity", significance: "high",
    description: "Apple's first 5G-capable iPhone lineup, with a flat-edge design reminiscent of iPhone 4.",
    sources: [], phase_name: "Market Impact",
  },
  {
    id: "ms_008", date: "2024-09-09", title: "iPhone 16 & Apple Intelligence",
    subtitle: "On-device AI", significance: "medium",
    description: "Integrated on-device AI features across the iPhone lineup.",
    sources: [], phase_name: "Technology Innovation",
  },
],
```

### Node Details (keyed by node id)

```ts
details: {
  ms_001: {
    key_features: ["Multi-touch interface", "Visual voicemail", "Mobile Safari"],
    impact: "Redefined the smartphone category and forced competitors to abandon physical keyboards.",
    key_people: ["Steve Jobs", "Scott Forstall", "Tony Fadell"],
    context: "RIM's BlackBerry and Nokia's Symbian dominated the market at the time.",
    sources: ["https://apple.com"],
  },
  ms_002: {
    key_features: ["2MP camera", "4GB/8GB storage", "EDGE network"],
    impact: "Sold 270,000 units in the first 30 hours despite the premium price.",
    key_people: ["Steve Jobs", "AT&T partnership"],
    context: "Exclusive carrier deal with AT&T (Cingular) in the US.",
    sources: ["https://apple.com"],
  },
  ms_003: {
    key_features: ["500 launch apps", "70/30 revenue split", "SDK for developers"],
    impact: "Created an entirely new software economy worth hundreds of billions.",
    key_people: ["Steve Jobs", "Scott Forstall"],
    context: "Initially Apple resisted third-party apps, favoring web apps.",
    sources: ["https://apple.com"],
  },
  ms_004: {
    key_features: ["Retina Display (326 ppi)", "A4 chip", "Stainless steel frame"],
    impact: "Set a new standard for display quality on mobile devices.",
    key_people: ["Steve Jobs", "Jony Ive"],
    context: "The 'Antennagate' controversy briefly overshadowed the launch.",
    sources: ["https://apple.com"],
  },
  ms_005: {
    key_features: ["Touch ID sensor", "A7 64-bit chip", "M7 motion coprocessor"],
    impact: "Brought biometric security to the mainstream, later enabling Apple Pay.",
    key_people: ["Tim Cook", "Phil Schiller"],
    context: "Apple acquired AuthenTec in 2012 specifically for fingerprint technology.",
    sources: ["https://apple.com"],
  },
  ms_006: {
    key_features: ["Face ID", "OLED Super Retina display", "Animoji"],
    impact: "Eliminated the home button paradigm that defined smartphones for a decade.",
    key_people: ["Tim Cook", "Jony Ive", "Craig Federighi"],
    context: "Released alongside iPhone 8/8 Plus as Apple's '10th anniversary' device.",
    sources: ["https://apple.com"],
  },
  ms_007: {
    key_features: ["5G connectivity", "A14 Bionic", "Ceramic Shield", "MagSafe"],
    impact: "Accelerated global 5G adoption as millions of iPhone users upgraded.",
    key_people: ["Tim Cook"],
    context: "Launched during the COVID-19 pandemic, later than usual (October vs September).",
    sources: ["https://apple.com"],
  },
  ms_008: {
    key_features: ["Apple Intelligence", "Camera Control button", "A18 chip"],
    impact: "Positioned the iPhone as an AI-first device with on-device processing.",
    key_people: ["Tim Cook", "Craig Federighi"],
    context: "Apple's response to the generative AI wave led by ChatGPT and Google Gemini.",
    sources: ["https://apple.com"],
  },
},
```

### Synthesis

```ts
synthesis: {
  summary: "The iPhone transformed from a revolutionary smartphone into a platform that redefined mobile computing, app ecosystems, and digital interaction.",
  key_insight: "Each major iPhone generation didn't just improve hardware — it created entirely new categories of user behavior.",
  timeline_span: "2007 – 2024",
  source_count: 48,
  verification_notes: [],
},
```

---

## 2. DemoPlayer State Machine

### States

```
"typing" → "proposal" → "skeleton" → "detail" → "synthesis" → "hold" → "fadeout" → "typing" (loop)
```

### State type + reducer

```ts
type DemoPhase = "typing" | "proposal" | "skeleton" | "detail" | "synthesis" | "hold" | "fadeout";

interface DemoState {
  phase: DemoPhase;
  typedChars: number;       // 0..6 ("iPhone" = 6 chars)
  showProposal: boolean;
  visibleNodes: number;     // 0..8
  completedNodes: number;   // 0..8
  showSynthesis: boolean;
  scrollY: number;          // px, for translateY
}
```

Use `useReducer` with actions:
- `TICK_CHAR` — increment typedChars
- `SHOW_PROPOSAL` — phase → proposal, showProposal = true
- `START_SKELETON` — phase → skeleton, showProposal = false
- `ADD_NODE` — visibleNodes++
- `START_DETAIL` — phase → detail
- `COMPLETE_NODE` — completedNodes++, update scrollY
- `SHOW_SYNTHESIS` — phase → synthesis, showSynthesis = true
- `HOLD` — phase → hold
- `FADEOUT` — phase → fadeout
- `RESET` — back to initial state, phase → typing

### Orchestration via useEffect + setTimeout chain

Single `useEffect` that watches `state` and schedules the next action:

```ts
useEffect(() => {
  let timer: ReturnType<typeof setTimeout>;

  switch (state.phase) {
    case "typing":
      if (state.typedChars < 6) {
        timer = setTimeout(() => dispatch({ type: "TICK_CHAR" }), 120);
      } else {
        timer = setTimeout(() => dispatch({ type: "SHOW_PROPOSAL" }), 600);
      }
      break;

    case "proposal":
      timer = setTimeout(() => dispatch({ type: "START_SKELETON" }), 2500);
      break;

    case "skeleton":
      if (state.visibleNodes < 8) {
        timer = setTimeout(() => dispatch({ type: "ADD_NODE" }), 300);
      } else {
        timer = setTimeout(() => dispatch({ type: "START_DETAIL" }), 500);
      }
      break;

    case "detail":
      if (state.completedNodes < 8) {
        timer = setTimeout(() => dispatch({ type: "COMPLETE_NODE" }), 650);
      } else {
        timer = setTimeout(() => dispatch({ type: "SHOW_SYNTHESIS" }), 500);
      }
      break;

    case "synthesis":
      timer = setTimeout(() => dispatch({ type: "HOLD" }), 2000);
      break;

    case "hold":
      timer = setTimeout(() => dispatch({ type: "FADEOUT" }), 2500);
      break;

    case "fadeout":
      timer = setTimeout(() => dispatch({ type: "RESET" }), 600);
      break;
  }

  return () => clearTimeout(timer);
}, [state]);
```

Total timing per cycle:
- Typing: 6 × 120ms + 600ms = ~1.3s
- Proposal: 2.5s
- Skeleton: 8 × 300ms + 500ms = 2.9s
- Detail: 8 × 650ms + 500ms = 5.7s
- Synthesis: 2.0s
- Hold: 2.5s
- Fadeout: 0.6s
- **Total: ~17.5s per cycle**

---

## 3. ScrollY Calculation

Container content area height: ~380px (450px total - 32px top bar - ~38px padding).

Each node's approximate height:
- Revolutionary skeleton: ~80px + 24px mb = 104px
- High skeleton: ~64px + 24px = 88px
- Medium skeleton: ~40px + 24px = 64px
- Revolutionary complete: ~100px + 24px = 124px
- High complete: ~80px + 24px = 104px
- Medium complete: ~48px + 24px = 72px

We compute a rough cumulative height table. When content exceeds the visible area, we set scrollY so that the "active" element (latest skeleton appearing or latest node being completed) stays in view.

Reducer logic for scrollY on `ADD_NODE` and `COMPLETE_NODE`:

```ts
// Approximate per-node height (simplified)
const NODE_HEIGHT = 90; // average across significance levels
const VISIBLE_HEIGHT = 380;

function computeScrollY(activeIndex: number): number {
  const contentBottom = (activeIndex + 1) * NODE_HEIGHT;
  const overflow = contentBottom - VISIBLE_HEIGHT + 60; // 60px breathing room
  return Math.max(0, overflow);
}
```

Applied as CSS:
```tsx
<div style={{ transform: `translateY(-${state.scrollY}px)`, transition: "transform 0.6s ease-out" }}>
  {/* nodes */}
</div>
```

---

## 4. DemoPlayer Component Structure

```tsx
export function DemoPlayer() {
  const [state, dispatch] = useReducer(demoReducer, initialState);

  // setTimeout orchestration useEffect (see §2)

  const containerOpacity = state.phase === "fadeout" ? 0 : 1;

  return (
    <div
      className="w-full max-w-2xl mx-auto rounded-2xl border border-chrono-border
                 bg-chrono-surface/50 overflow-hidden"
      style={{ opacity: containerOpacity, transition: "opacity 0.5s ease" }}
    >
      {/* Top bar */}
      <div className="h-8 flex items-center px-3 border-b border-chrono-border/50">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-chrono-border" />
          <span className="h-2.5 w-2.5 rounded-full bg-chrono-border" />
          <span className="h-2.5 w-2.5 rounded-full bg-chrono-border" />
        </div>
        <span className="mx-auto text-chrono-tiny text-chrono-text-muted">Chrono</span>
      </div>

      {/* Content area */}
      <div className="relative h-[420px] overflow-hidden">
        <div
          className="p-6"
          style={{
            transform: `translateY(-${state.scrollY}px)`,
            transition: "transform 0.6s ease-out",
          }}
        >
          {/* Phase-conditional rendering */}
          {state.phase === "typing" && <DemoSearch typedChars={state.typedChars} />}
          {state.showProposal && <DemoProposal />}
          {state.visibleNodes > 0 && !state.showProposal && (
            <DemoTimeline
              visibleNodes={state.visibleNodes}
              completedNodes={state.completedNodes}
            />
          )}
          {state.showSynthesis && <DemoSynthesis />}
        </div>
      </div>
    </div>
  );
}
```

### Sub-components (all inline in DemoPlayer.tsx, not exported)

**DemoSearch** — fake search bar with typed text + blinking cursor

```tsx
function DemoSearch({ typedChars }: { typedChars: number }) {
  const text = "iPhone".slice(0, typedChars);
  return (
    <div className="flex items-center justify-center h-[380px]">
      <div className="w-full max-w-xs">
        <div className="rounded-lg border border-chrono-border bg-chrono-bg px-4 py-3 flex items-center">
          <span className="text-chrono-text">{text}</span>
          <span className="animate-cursor-blink text-chrono-accent ml-0.5">|</span>
        </div>
      </div>
    </div>
  );
}
```

**DemoProposal** — simplified ProposalCard (no buttons)

```tsx
function DemoProposal() {
  const { proposal } = demoData;
  return (
    <div className="flex items-center justify-center h-[380px]">
      <div className="animate-slide-up w-full max-w-sm rounded-2xl border border-chrono-border
                      bg-chrono-surface/80 p-6 backdrop-blur-sm">
        <h3 className="text-chrono-title font-bold text-chrono-text">
          {proposal.user_facing.title}
        </h3>
        <p className="mt-2 text-chrono-caption text-chrono-text-secondary">
          {proposal.user_facing.summary}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {proposal.user_facing.thread_names.map((name) => (
            <span key={name} className="rounded-full border border-chrono-border
                                        px-2.5 py-0.5 text-chrono-tiny text-chrono-text-secondary">
              {name}
            </span>
          ))}
        </div>
        <div className="mt-4 flex gap-4 text-chrono-tiny text-chrono-text-muted">
          <span>{proposal.user_facing.duration_text}</span>
          <span>{proposal.complexity.estimated_total_nodes} nodes</span>
        </div>
      </div>
    </div>
  );
}
```

**DemoTimeline** — mini timeline with TimelineNodeCard

```tsx
function DemoTimeline({ visibleNodes, completedNodes }: { visibleNodes: number; completedNodes: number }) {
  const displayNodes = demoData.nodes.slice(0, visibleNodes).map((node, i) => {
    const isComplete = i < completedNodes;
    return {
      ...node,
      status: isComplete ? ("complete" as const) : ("skeleton" as const),
      details: isComplete ? demoData.details[node.id] : undefined,
      sources: isComplete ? demoData.details[node.id].sources : [],
    };
  });

  return (
    <div className="relative">
      {/* Timeline vertical line */}
      <div className="absolute left-20 top-0 bottom-0 w-px bg-chrono-timeline" />

      {displayNodes.map((node) => {
        const dotSize = node.significance === "revolutionary"
          ? "h-4 w-4 ring-4 ring-chrono-revolutionary/20"
          : node.significance === "high"
            ? "h-3 w-3"
            : "h-2 w-2";
        const dotColor = node.significance === "revolutionary"
          ? "bg-chrono-revolutionary"
          : node.significance === "high"
            ? "bg-chrono-high"
            : "bg-chrono-medium";

        return (
          <div key={node.id} className="mb-6 flex items-start animate-fade-in">
            <div className="w-16 pt-2 text-right pr-2">
              <span className="text-chrono-tiny text-chrono-text-muted">
                {node.date.slice(0, 4)}
              </span>
            </div>
            <div className="w-8 flex justify-center pt-2">
              <span className={`rounded-full ${dotSize} ${dotColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <TimelineNodeCard
                node={node}
                isSelected={false}
                isHighlighted={false}
                connectionCount={0}
                onSelect={() => {}}
                language="en"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

**DemoSynthesis** — summary block

```tsx
function DemoSynthesis() {
  const { synthesis } = demoData;
  return (
    <div className="mt-8 animate-fade-in rounded-xl border border-chrono-border bg-chrono-surface p-5">
      <h4 className="text-chrono-caption font-medium text-chrono-text-muted uppercase tracking-wider mb-3">
        Synthesis
      </h4>
      <p className="text-chrono-body text-chrono-text-secondary">{synthesis.summary}</p>
      <p className="mt-3 text-chrono-caption text-chrono-accent italic">
        {synthesis.key_insight}
      </p>
      <div className="mt-3 flex gap-4 text-chrono-tiny text-chrono-text-muted">
        <span>{synthesis.timeline_span}</span>
        <span>{synthesis.source_count} sources</span>
      </div>
    </div>
  );
}
```

---

## 5. Cycle Reset (Fade-out / Reset / Fade-in)

The container's `opacity` is controlled by state:

```ts
case "FADEOUT":
  return { ...state, phase: "fadeout" };

case "RESET":
  return { ...initialState }; // phase: "typing", everything zeroed
```

CSS transition on container: `transition: "opacity 0.5s ease"`.

Timeline:
1. `HOLD` state (2.5s) → dispatch `FADEOUT`
2. Container opacity → 0 (0.5s CSS transition)
3. After 600ms timeout → dispatch `RESET`
4. State resets to initial (phase: "typing", all zeroed)
5. Container opacity → 1 (since phase is no longer "fadeout")
6. Typing begins again

---

## 6. globals.css Addition

One new keyframe for the blinking cursor:

```css
@keyframes cursor-blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.animate-cursor-blink {
  animation: cursor-blink 0.8s step-end infinite;
}
```

---

## 7. SearchInput.tsx Layout Changes

Current:
```tsx
<div className="flex min-h-screen flex-col items-center justify-center px-4">
  <h1>Chrono</h1>
  <p>subtitle</p>
  <form>...</form>
  {error}
  <HistoryList />
</div>
```

New:
```tsx
<div className="flex min-h-screen flex-col items-center px-4 pt-12 sm:pt-16">
  {/* Demo */}
  <div className="mb-12 w-full max-w-2xl">
    <DemoPlayer />
  </div>

  {/* Search area */}
  <h1 className="mb-2 text-chrono-hero font-bold tracking-wider text-chrono-accent">
    Chrono
  </h1>
  <p className="mb-10 text-chrono-text-muted">
    Enter any topic. AI researches its timeline.
  </p>
  <form>...</form>
  {error}
  <HistoryList />
</div>
```

Changes:
- `justify-center` → removed (content starts from top now since demo adds significant height)
- Add `pt-12 sm:pt-16` for top padding
- Insert `<DemoPlayer />` before the title, wrapped in `mb-12 w-full max-w-2xl`
- Title, subtitle, form, HistoryList remain unchanged

---

## 8. Execution Order

1. `frontend/src/app/globals.css` — add `cursor-blink` keyframe + utility class
2. `frontend/src/data/demo.ts` — create mock data file
3. `frontend/src/components/DemoPlayer.tsx` — create component with all sub-components
4. `frontend/src/components/SearchInput.tsx` — update layout
5. `pnpm build && pnpm lint` — verify
