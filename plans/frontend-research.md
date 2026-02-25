# Frontend Research — Next.js 15 + React 19 + SSE + Tailwind

## 1. EventSource in React 19

### 1.1 Core Pattern: useEffect + Cleanup

EventSource belongs in `useEffect`. The cleanup function must call `es.close()` to terminate the connection on unmount. Without it, the browser keeps the connection open and continues trying to reconnect even after the component is gone.

Key facts:
- `EventSource` only supports GET. No workaround for POST. Our architecture already handles this correctly: `POST /api/research` creates the session, `GET /api/research/{id}/stream` is the SSE stream.
- EventSource auto-reconnects on error by default (browser behavior). To disable, call `es.close()` inside the `onerror` handler.
- Named events use `addEventListener`, not `onmessage`. The `onmessage` handler only fires for events with no `event:` field (or `event: message`). All our events have custom types so they must use `addEventListener`.

### 1.2 Complete Custom Hook

This hook is purpose-built for Chrono's event types. It accumulates state per event type (since each `node_detail` event is a separate payload that we want to collect, not replace).

```typescript
// src/hooks/useResearchStream.ts
"use client";

import { useEffect, useRef, useCallback } from "react";

// Mirror the SSE event types from backend SSEEventType
type ProgressEvent = { phase: string; message: string; percent: number };
type SkeletonNode = {
  id: string;
  date: string;
  title: string;
  subtitle: string;
  significance: "revolutionary" | "high" | "medium";
  description: string;
  sources: string[];
  status: "skeleton";
};
type SkeletonEvent = { nodes: SkeletonNode[] };
type NodeDetailEvent = {
  node_id: string;
  details: {
    key_features: string[];
    impact: string;
    key_people: string[];
    context: string;
    sources: string[];
  };
};
type CompleteEvent = { total_nodes: number };
type ErrorEvent = { error: string; message: string };

interface ResearchStreamCallbacks {
  onProgress?: (data: ProgressEvent) => void;
  onSkeleton?: (data: SkeletonEvent) => void;
  onNodeDetail?: (data: NodeDetailEvent) => void;
  onComplete?: (data: CompleteEvent) => void;
  onError?: (data: ErrorEvent) => void;
  onConnectionError?: (event: Event) => void;
}

export function useResearchStream(
  sessionId: string | null,
  callbacks: ResearchStreamCallbacks
) {
  // Store callbacks in a ref so we never need to close/reopen the connection
  // when the parent re-renders with a new callback reference.
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  // Keep a ref to the EventSource so we can close it imperatively if needed
  const esRef = useRef<EventSource | null>(null);

  const close = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    const url = `/api/research/${sessionId}/stream`;
    const es = new EventSource(url);
    esRef.current = es;

    // Helper to parse and dispatch
    function handle<T>(handler: ((data: T) => void) | undefined) {
      return (e: MessageEvent) => {
        if (!handler) return;
        try {
          handler(JSON.parse(e.data) as T);
        } catch {
          // Malformed JSON from backend — ignore
        }
      };
    }

    es.addEventListener("progress", handle<ProgressEvent>(callbacksRef.current.onProgress));
    es.addEventListener("skeleton", handle<SkeletonEvent>(callbacksRef.current.onSkeleton));
    es.addEventListener("node_detail", handle<NodeDetailEvent>(callbacksRef.current.onNodeDetail));
    es.addEventListener("complete", handle<CompleteEvent>((data) => {
      callbacksRef.current.onComplete?.(data);
      // Close after complete — no need to keep connection alive
      es.close();
      esRef.current = null;
    }));
    es.addEventListener("error_event", handle<ErrorEvent>(callbacksRef.current.onError));

    // Connection-level error (network error, server down, etc.)
    // EventSource auto-reconnects; we disable that by closing on error.
    es.onerror = (event) => {
      callbacksRef.current.onConnectionError?.(event);
      es.close();
      esRef.current = null;
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [sessionId]); // Only re-run when sessionId changes

  return { close };
}
```

Usage in a component:

```typescript
// src/app/page.tsx (client component)
"use client";

import { useState, useCallback } from "react";
import { useResearchStream } from "@/hooks/useResearchStream";

type NodeStatus = "skeleton" | "loading" | "complete";

interface TimelineNode {
  id: string;
  date: string;
  title: string;
  subtitle: string;
  significance: "revolutionary" | "high" | "medium";
  description: string;
  sources: string[];
  status: NodeStatus;
  details?: {
    key_features: string[];
    impact: string;
    key_people: string[];
    context: string;
  };
}

export default function HomePage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<TimelineNode[]>([]);
  const [progressMessage, setProgressMessage] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  useResearchStream(sessionId, {
    onProgress: useCallback(({ message }) => {
      setProgressMessage(message);
    }, []),

    onSkeleton: useCallback(({ nodes: skeletonNodes }) => {
      setNodes(skeletonNodes.map((n) => ({ ...n, status: "skeleton" as NodeStatus })));
    }, []),

    onNodeDetail: useCallback(({ node_id, details }) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === node_id ? { ...n, details, status: "complete" as NodeStatus } : n
        )
      );
    }, []),

    onComplete: useCallback(() => {
      setIsComplete(true);
    }, []),
  });

  async function startResearch(topic: string) {
    const res = await fetch("/api/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic }),
    });
    const { session_id } = await res.json();
    setSessionId(session_id); // triggers useEffect in hook
  }

  return (
    <main>
      {/* ... */}
    </main>
  );
}
```

### 1.3 Critical Gotchas

**Named events need `addEventListener`, not `onmessage`.**
`onmessage` only fires for the default `message` event type. This is the most common mistake:

```typescript
// WRONG — will never fire for "skeleton" events
es.onmessage = (e) => { ... };

// CORRECT
es.addEventListener("skeleton", (e) => { ... });
```

**Callbacks ref pattern prevents stale closures.**
If you put callbacks directly in the `useEffect` dependency array, the effect re-runs on every render (if the parent recreates the callbacks). Storing callbacks in a `useRef` lets you update them on every render without reopening the connection.

**Auto-reconnect is browser-default, not always what you want.**
When `onerror` fires, the browser waits `retry` milliseconds (default 3 seconds) then reconnects automatically. For a one-shot research session, this is wrong — close the connection on error.

**EventSource doesn't support custom request headers.**
No `Authorization` header, no `Content-Type`. Authentication must be done via cookies or query params. Not relevant for Chrono now, but worth knowing for when auth is added.

**Next.js App Router: must be a client component.**
EventSource is a browser API. Any component or hook that uses it needs `"use client"` at the top of the file. This is different from React Server Components which run on the server.

**TypeScript: the event in `addEventListener` is `Event`, not `MessageEvent`.**
Cast it to `MessageEvent` to access `.data`:

```typescript
es.addEventListener("skeleton", (e: Event) => {
  const { nodes } = JSON.parse((e as MessageEvent).data);
});
```

Or type it directly — a cleaner option is to declare the handler as `(e: MessageEvent) => void` and use that type in addEventListener (TypeScript accepts the covariant cast).

---

## 2. Next.js 15 API Rewrites (Proxy)

### 2.1 next.config.ts Syntax

The rewrites API uses `async rewrites()` returning an array of `{ source, destination }` objects. For proxying the entire `/api/*` namespace to the FastAPI backend:

```typescript
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

For production, use an environment variable:

```typescript
// next.config.ts
import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
```

### 2.2 Does This Work for SSE?

Yes, with caveats. The `rewrites` in next.config.ts go through Next.js's built-in proxy infrastructure. For SSE specifically:

**What works:** The rewrite correctly forwards the `GET /api/research/{id}/stream` request to FastAPI and pipes the streaming response back to the browser. The long-lived connection is maintained.

**Potential issue — response buffering:** Next.js 15 (and Node.js HTTP) may buffer the response body before forwarding chunks to the browser. This breaks SSE because events get held back instead of forwarded immediately.

**Fix — disable compression:** Add `compress: false` to the Next.js config. Gzip compression is the primary cause of buffering because Node.js buffers until it has enough data to compress efficiently.

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  compress: false, // Prevents response buffering that breaks SSE
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};
```

**The backend already sends `X-Accel-Buffering: no`** (see `sse-research.md`), which handles Nginx buffering. That header doesn't affect Next.js's Node.js proxy.

**Alternative if rewrites don't cut it:** Write a thin Next.js Route Handler that proxies to the backend by directly piping the body:

```typescript
// src/app/api/research/[sessionId]/stream/route.ts
import { NextRequest } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const upstream = await fetch(
    `${BACKEND_URL}/api/research/${sessionId}/stream`,
    { headers: { Accept: "text/event-stream" } }
  );

  // Pipe the body directly — no buffering
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
```

This avoids the compression/buffering issue entirely because you're manually piping the `ReadableStream`. The `export const dynamic = "force-dynamic"` prevents Next.js from trying to statically optimize the route.

**Recommendation for Chrono:** Start with `rewrites` + `compress: false`. If events are delayed in dev, switch to the Route Handler proxy above.

### 2.3 Timeout Issues

`rewrites` in Next.js use Node.js HTTP under the hood, which has no default timeout. The connection will stay open as long as the browser and FastAPI keep it alive. The FastAPI backend's keepalive pings (every 15 seconds from sse-starlette) prevent proxy timeouts.

When deployed on Vercel: Vercel Serverless Functions have a maximum execution time (60 seconds on Pro, 10 seconds on Hobby). SSE streams would be killed after that limit. This is why the CLAUDE.md architecture decision says: "后端不部署在 Vercel，用 Railway/Fly.io". The Next.js frontend on Vercel only acts as a static/RSC host; the SSE traffic flows directly from the browser to the Railway/Fly.io backend (the proxy rewrites are for development only).

---

## 3. Tailwind CSS Animations

### 3.1 Shimmer/Skeleton Effect

Two approaches: `animate-pulse` (built-in, simpler) or a custom shimmer gradient (more polished).

**`animate-pulse` (simplest, good enough for MVP):**

```tsx
// components/SkeletonNode.tsx
export function SkeletonNode() {
  return (
    <div className="animate-pulse">
      <div className="h-4 w-1/3 rounded bg-slate-200" />
      <div className="mt-2 h-3 w-full rounded bg-slate-200" />
      <div className="mt-1 h-3 w-4/5 rounded bg-slate-200" />
    </div>
  );
}
```

**Custom shimmer (moving gradient, more polished):**

Tailwind CSS v3 doesn't ship a shimmer animation. You define it in `tailwind.config.ts`:

```typescript
// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        shimmer: "shimmer 1.5s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
```

Then use it with a gradient background:

```tsx
// The key: backgroundSize must be 200% so the gradient has room to move
function ShimmerBar({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%] ${className ?? ""}`}
    />
  );
}

export function SkeletonTimelineCard() {
  return (
    <div className="space-y-2 rounded-xl border border-slate-100 p-4 shadow-sm">
      <ShimmerBar className="h-4 w-24" />       {/* date */}
      <ShimmerBar className="h-5 w-48" />       {/* title */}
      <ShimmerBar className="h-3 w-full" />     {/* description line 1 */}
      <ShimmerBar className="h-3 w-4/5" />      {/* description line 2 */}
    </div>
  );
}
```

### 3.2 Fade-in / Slide-in on Mount

**Option A: `tailwindcss-animate` plugin (recommended, used by shadcn/ui)**

Install:
```bash
pnpm add -D tailwindcss-animate
```

Add to `tailwind.config.ts`:
```typescript
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  plugins: [tailwindcssAnimate],
};
```

Available utilities for entrance:
```
animate-in          — triggers the entrance animation
fade-in             — starts at opacity-0, ends at current opacity
fade-in-0           — alias for fade-in
slide-in-from-bottom-4  — slides up 4 units from below
slide-in-from-top-4     — slides down from above
zoom-in-95          — starts at 95% scale
duration-300        — controls animation speed
```

**Option B: Pure Tailwind with custom keyframes (no plugin)**

Add to `tailwind.config.ts`:

```typescript
keyframes: {
  "fade-in": {
    "0%": { opacity: "0" },
    "100%": { opacity: "1" },
  },
  "slide-up": {
    "0%": { opacity: "0", transform: "translateY(12px)" },
    "100%": { opacity: "1", transform: "translateY(0)" },
  },
},
animation: {
  "fade-in": "fade-in 0.3s ease-out forwards",
  "slide-up": "slide-up 0.4s ease-out forwards",
},
```

Usage:
```tsx
<div className="animate-slide-up">newly appeared content</div>
```

### 3.3 Triggering Animations on Status Change

The challenge: CSS animations only fire when the element first mounts (or when the class is added). When a node transitions from `skeleton` to `complete`, we want a fade-in for the newly revealed content.

**Pattern 1: Key-based remount (simplest)**

Force React to unmount/remount the content element by changing its `key`:

```tsx
function TimelineCard({ node }: { node: TimelineNode }) {
  if (node.status === "skeleton") {
    return <SkeletonTimelineCard />;
  }

  return (
    // key change causes unmount → remount → animation fires again
    <div key={`complete-${node.id}`} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <h3>{node.title}</h3>
      <p>{node.description}</p>
      {node.details && <NodeDetails details={node.details} />}
    </div>
  );
}
```

**Pattern 2: CSS class toggle with useEffect**

When you want the animation to trigger on a prop change without remounting:

```tsx
import { useEffect, useRef } from "react";

function NodeContent({ node }: { node: TimelineNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (node.status === "complete" && ref.current) {
      // Remove then re-add the animation class to retrigger it
      ref.current.classList.remove("animate-fade-in");
      // Force reflow
      void ref.current.offsetHeight;
      ref.current.classList.add("animate-fade-in");
    }
  }, [node.status]);

  return (
    <div ref={ref} className="opacity-0">
      {node.title}
    </div>
  );
}
```

This pattern is fiddlier. Pattern 1 (key remount) is cleaner and more idiomatic React.

**Pattern 3: Conditional class with `tailwindcss-animate`**

Using the plugin's data-attribute variant support:

```tsx
<div
  data-state={node.status}
  className="data-[state=complete]:animate-in data-[state=complete]:fade-in data-[state=complete]:slide-in-from-bottom-4 duration-500"
>
  {node.status === "complete" && <NodeDetails details={node.details} />}
</div>
```

**Recommendation for Chrono:** Use Pattern 1 (key remount) + `tailwindcss-animate`. It's the cleanest and matches how shadcn/ui handles transitions.

```tsx
// Complete TimelineCard component pattern
import { cn } from "@/lib/utils"; // shadcn's cn helper

function TimelineCard({ node }: { node: TimelineNode }) {
  const isLoading = node.status === "skeleton" || node.status === "loading";

  if (isLoading) {
    return <SkeletonTimelineCard />;
  }

  return (
    <div
      key={`filled-${node.id}`}
      className={cn(
        "rounded-xl border border-slate-100 p-4 shadow-sm",
        "animate-in fade-in slide-in-from-bottom-4 duration-500"
      )}
    >
      <time className="text-xs text-slate-400">{node.date}</time>
      <h3 className="mt-1 font-semibold">{node.title}</h3>
      <p className="mt-1 text-sm text-slate-600">{node.description}</p>
    </div>
  );
}
```

---

## 4. Next.js 15 App Router Specifics

### 4.1 Server Component vs Client Component for page.tsx

The recommended pattern is: **thin server component `page.tsx` + fat client component for all interactive logic.**

**Do not** mark `page.tsx` as `"use client"`. This would exclude the page from server-side rendering (no HTML shell, no SEO metadata, larger initial bundle).

Instead:

```tsx
// src/app/page.tsx — Server Component (no "use client")
import { ChronoApp } from "@/components/ChronoApp";

export default function Page() {
  // Server-side work here (metadata, initial data fetching, etc.)
  // For Chrono, there's nothing to fetch server-side, so this is just a shell
  return <ChronoApp />;
}
```

```tsx
// src/components/ChronoApp.tsx — Client Component
"use client";

import { useState, useCallback } from "react";
import { useResearchStream } from "@/hooks/useResearchStream";
// ... all interactive logic here
```

**Why this matters:** Even if the page component is effectively trivial (just renders `<ChronoApp />`), keeping it as a server component:
1. Preserves the ability to add `export const metadata` for SEO later
2. Lets Next.js pre-render the HTML shell with zero JS (better FCP)
3. Keeps the mental model clean — the "use client" boundary is at the component that actually needs it

For Chrono specifically, this is mostly academic since the whole app is interactive. But it's the established convention and costs nothing.

### 4.2 React 19 Features Worth Using

**`useTransition` — most useful for Chrono**

When the user submits a research topic, the `POST /api/research` fetch takes a few seconds (Orchestrator evaluates the topic). Wrapping that in `startTransition` marks the state update as non-urgent, keeping the UI responsive:

```tsx
"use client";

import { useTransition } from "react";

function SearchForm() {
  const [isPending, startTransition] = useTransition();
  const [proposal, setProposal] = useState(null);

  function handleSubmit(topic: string) {
    startTransition(async () => {
      const res = await fetch("/api/research", {
        method: "POST",
        body: JSON.stringify({ topic }),
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      setProposal(data.proposal);
    });
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSubmit(/* ... */); }}>
      <button disabled={isPending}>
        {isPending ? "Analyzing..." : "Research"}
      </button>
    </form>
  );
}
```

`isPending` is true during the async transition — use it to disable the submit button and show a spinner.

**`useOptimistic` — less applicable for Chrono**

`useOptimistic` is for showing immediate fake state while an async operation runs, then reconciling with the real result. The canonical use case is a like button that increments immediately before the server confirms.

For Chrono, the SSE stream IS the incremental state — we don't need to optimistically fake it. `useOptimistic` isn't a natural fit here.

**`useActionState` — not needed**

`useActionState` is designed for Server Actions (form submissions that call server-side functions). Chrono uses regular `fetch` to a separate FastAPI backend, not Next.js Server Actions.

**`use(promise)` — potentially useful**

The new `use()` hook can unwrap a Promise inside a client component during render (with Suspense). If we ever want to pre-fetch the research proposal in a server component and pass the Promise to a client component, this is how:

```tsx
// page.tsx (server)
export default function Page() {
  const proposalPromise = fetchProposal(); // async, not awaited
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ProposalDisplay promise={proposalPromise} />
    </Suspense>
  );
}

// ProposalDisplay.tsx (client)
"use client";
import { use } from "react";

function ProposalDisplay({ promise }: { promise: Promise<Proposal> }) {
  const proposal = use(promise); // suspends until resolved
  return <div>{proposal.topic}</div>;
}
```

Not needed for MVP, but worth knowing.

### 4.3 Summary: What to Actually Use in Chrono

| Feature | Use it? | Reason |
|---------|---------|--------|
| `useTransition` | Yes | Wrap the POST /api/research call for pending state |
| `useOptimistic` | No | SSE stream handles progressive state natively |
| `useActionState` | No | For Server Actions, not fetch() |
| `use(promise)` | Maybe later | If we add server-side data prefetching |
| Thin page.tsx + client component | Yes | Standard App Router pattern |

---

## 5. `tailwind.config.ts` Tailwind v4 Note

As of Tailwind CSS v4 (released 2025), the config format has changed. Tailwind v4 uses CSS-based configuration (via `@theme` directives in CSS files) instead of `tailwind.config.ts`. Custom keyframes are defined in CSS:

```css
/* globals.css */
@import "tailwindcss";

@theme {
  --animate-shimmer: shimmer 1.5s linear infinite;

  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
}
```

The `tailwindcss-animate` plugin is not yet updated for v4 — use `tw-animate-css` instead (a drop-in v4 replacement):

```bash
pnpm add -D tw-animate-css
```

```css
@import "tailwindcss";
@import "tw-animate-css";
```

**Check which version Next.js 15 installs:** `create-next-app` currently installs Tailwind v3 by default. Verify with `pnpm list tailwindcss`. If it's v3, use `tailwind.config.ts`. If v4, use CSS config.

---

## Sources

- [EventSource React hook — OneUptime Blog](https://oneuptime.com/blog/post/2026-01-15-server-sent-events-sse-react/view)
- [Next.js rewrites API reference](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites)
- [Next.js proxy (middleware) docs](https://nextjs.org/docs/app/getting-started/proxy)
- [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [SSE don't work in Next.js API routes — Discussion #48427](https://github.com/vercel/next.js/discussions/48427)
- [Fixing slow SSE streaming in Next.js and Vercel — Medium](https://medium.com/@oyetoketoby80/fixing-slow-sse-server-sent-events-streaming-in-next-js-and-vercel-99f42fbdb996)
- [tailwindcss-animate — GitHub](https://github.com/jamiebuilds/tailwindcss-animate)
- [tw-animate-css (Tailwind v4 replacement) — GitHub](https://github.com/Wombosvideo/tw-animate-css)
- [React 19 blog post](https://react.dev/blog/2024/12/05/react-19)
- [useOptimistic — React docs](https://react.dev/reference/react/useOptimistic)
- [useActionState — React docs](https://react.dev/reference/react/useActionState)
- [Tailwind CSS animation docs](https://tailwindcss.com/docs/animation)
