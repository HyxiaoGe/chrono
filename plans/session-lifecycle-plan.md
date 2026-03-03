# Session Lifecycle Hardening — Plan

## Research Findings

### Problem 1: `_detail_contexts` Concurrency Bug

**Current state:**

`orchestrator` is a module-level singleton (`main.py:35`). `self._detail_contexts` is an instance-level dict shared across ALL concurrent `execute_research()` calls.

4 usage points in `orchestrator.py`:
| Line | Usage | Problem |
|------|-------|---------|
| 476 | `self._detail_contexts: dict[str, str] = {}` — init | Shared state |
| 665 | `self._detail_contexts[node["id"]] = search_context` — write in `_enrich_node` | Session A and B write to same dict |
| 580 | `ctx = self._detail_contexts.get(node["id"], ...)` — read in `_filter_hallucinations` | Session B may read Session A's context |
| 599 | `self._detail_contexts.clear()` — finally in `_filter_hallucinations` | Session A's clear wipes Session B's data |

**Key observation:** `_enrich_node` is already a closure defined inside `execute_research()` (line 649). It already captures local variables (`detail_completed`, `session`, `proposal`, `sem`, `total`, `nodes`) via closure. Adding `detail_contexts` as another captured local is trivial.

`_filter_hallucinations` is a method on `self` (line 573). It needs to accept `detail_contexts` as a parameter instead of reading `self._detail_contexts`.

### Problem 2: SSE Reconnection

**Current backend state:**

- `ResearchSession.push()` (session.py:29-31): Pushes `(event_type, data)` tuple to `asyncio.Queue`. Guard: skips if COMPLETED/FAILED. No history.
- `ResearchSession.event_generator()` (session.py:36-53): Reads from queue in a loop. Checks `request.is_disconnected()` every 5s. Yields `ServerSentEvent`. Breaks on `None` sentinel.
- `ResearchSession.close()` (session.py:33-34): Pushes `None` to queue, which tells `event_generator` to stop.
- `/stream` endpoint (main.py:100-118): Returns 404 if session unknown, 409 if `status != PROPOSAL_READY`. Creates background task (`execute_research` or `replay_research`), returns `EventSourceResponse`.

**Problem:** If EventSource disconnects mid-stream, the backend task keeps running and pushes events into the queue. But `event_generator` has already exited. When client reconnects, `/stream` returns 409 because status is `EXECUTING` (no longer `PROPOSAL_READY`). Events pushed during disconnect are lost in the queue — nobody consumes them.

**Current frontend state:**

- `useResearchStream.ts`: Creates `EventSource` on sessionId change. On `onerror`, calls `onConnectionError?.()` and `es.close()`. No retry.
- `ChronoApp.tsx`: No `onConnectionError` handler registered at all — connection errors are silently ignored.

### Problem 3: URL State Persistence

**Current state:**

- URL is updated to `/app?topic=xxx` only in `handleConfirm()` (ChronoApp.tsx:80) — after user clicks "start research" on proposal card.
- On init, `autoTopic` reads `topic` param from URL (line 32-35). If found, fires a fresh `POST /api/research`. This gets a new proposal (or cache hit), shows proposal card again. User must click confirm again.
- No `session` param in URL. Session ID is only in React state. Page refresh = lost.

**`replay_research`** (replay.py): Already implements full event replay from DB via `session.push()` (lines 39, 44, 54, 57). Since it calls `push()`, once we add `_event_history` recording to `push()`, cache replay events are automatically captured in history. No changes needed to `replay.py`.

---

## Implementation Plan

### Step 1: Fix `_detail_contexts` Concurrency Bug

**File:** `backend/app/orchestrator/orchestrator.py`

Changes:
1. Remove `self._detail_contexts: dict[str, str] = {}` from `__init__` (line 476)
2. In `execute_research()`, create local variable before Phase 2:
   ```python
   detail_contexts: dict[str, str] = {}
   ```
3. In `_enrich_node` closure, replace `self._detail_contexts[node["id"]] = search_context` with `detail_contexts[node["id"]] = search_context` — the closure already captures locals naturally.
4. Change `_filter_hallucinations` signature from `(self, nodes)` to `(self, nodes, detail_contexts)`:
   - Replace `self._detail_contexts.get(...)` with `detail_contexts.get(...)`
   - Remove the `finally: self._detail_contexts.clear()` block — the dict is local, GC handles it
5. Update the call site (line 689): `await self._filter_hallucinations(nodes, detail_contexts)`

**Validation:** grep for `_detail_contexts` — should find 0 references to `self._detail_contexts` after the change.

### Step 2: Backend Event History + Reconnection Support

**File:** `backend/app/models/session.py`

Changes to `ResearchSession`:

1. Add `_event_history` list to `__init__`:
   ```python
   self._event_history: list[tuple[SSEEventType, dict[str, Any]]] = []
   ```

2. Modify `push()` to also record events:
   ```python
   async def push(self, event_type: SSEEventType, data: dict[str, Any]) -> None:
       self._event_history.append((event_type, data))
       if self.status not in (SessionStatus.COMPLETED, SessionStatus.FAILED):
           await self.queue.put((event_type, data))
   ```
   Note: We record to history unconditionally (even for COMPLETED/FAILED), but only push to queue when still running. Actually — looking at this more carefully, the guard currently prevents pushing to queue after COMPLETED/FAILED. But `push()` is called BEFORE status is set to COMPLETED (see orchestrator.py:776-783: COMPLETE event is pushed first, then status set). So the guard only matters for the edge case where something tries to push after `session.close()`. The history should record everything regardless.

3. Add `event_generator` variant that replays history first:
   ```python
   async def replay_and_stream(self, request: Request):
       """Replay all historical events, then switch to live queue if still executing."""
       try:
           # Phase 1: Replay history
           for event_type, data in self._event_history:
               if await request.is_disconnected():
                   return
               yield ServerSentEvent(
                   data=json.dumps(data, ensure_ascii=False),
                   event=event_type.value,
               )

           # If already done, stop here
           if self.status in (SessionStatus.COMPLETED, SessionStatus.FAILED):
               return

           # Phase 2: Live queue (same as event_generator)
           while True:
               if await request.is_disconnected():
                   break
               try:
                   item = await asyncio.wait_for(self.queue.get(), timeout=5.0)
               except TimeoutError:
                   continue
               if item is None:
                   break
               event_type, data = item
               yield ServerSentEvent(
                   data=json.dumps(data, ensure_ascii=False),
                   event=event_type.value,
               )
       except asyncio.CancelledError:
           raise
   ```

   **Issue:** When reconnecting, the live queue may have already had events pushed to it that were consumed by the old (disconnected) generator, or events that were pushed but never consumed. The queue is not replayable — once consumed, items are gone.

   **Solution:** Don't rely on the queue for reconnection at all. The history list is the source of truth. For live events arriving after reconnection, we need a different approach:

   **Revised approach — use a secondary queue for reconnectors:**

   Actually, the cleanest solution: on reconnect, create a NEW queue for the reconnecting client. The `push()` method needs to write to ALL active queues. This is overly complex.

   **Simplest correct approach:** Use the event history as the replay source. For live events after replay, we need to track where we left off. Since `_event_history` is append-only:

   ```python
   async def replay_and_stream(self, request: Request):
       try:
           idx = 0
           while True:
               if await request.is_disconnected():
                   return

               # Drain any new history entries
               while idx < len(self._event_history):
                   event_type, data = self._event_history[idx]
                   idx += 1
                   yield ServerSentEvent(
                       data=json.dumps(data, ensure_ascii=False),
                       event=event_type.value,
                   )

               # If session is done, we've replayed everything
               if self.status in (SessionStatus.COMPLETED, SessionStatus.FAILED):
                   return

               # Wait a bit for new events
               await asyncio.sleep(0.3)
       except asyncio.CancelledError:
           raise
   ```

   This polls `_event_history` length. `push()` appends to the list; `replay_and_stream` reads by index. No queue needed for reconnectors. The 0.3s sleep is acceptable latency for a reconnection scenario.

**File:** `backend/app/main.py`

Change `/api/research/{session_id}/stream` endpoint logic:

```python
@app.get("/api/research/{session_id}/stream")
async def stream_research(session_id: str, request: Request) -> EventSourceResponse:
    session = session_manager.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status == SessionStatus.FAILED:
        raise HTTPException(status_code=410, detail="Session failed")

    if session.status == SessionStatus.PROPOSAL_READY:
        # First connect — start execution
        if session.cached_research_id is not None:
            session.task = asyncio.create_task(replay_research(session, session.cached_research_id))
        else:
            session.task = asyncio.create_task(orchestrator.execute_research(session))
        return EventSourceResponse(
            session.event_generator(request),
            ping=15,
            send_timeout=30,
            headers={"X-Accel-Buffering": "no"},
        )

    # EXECUTING or COMPLETED — reconnection / replay
    return EventSourceResponse(
        session.replay_and_stream(request),
        ping=15,
        send_timeout=30,
        headers={"X-Accel-Buffering": "no"},
    )
```

### Step 3: Frontend SSE Reconnection

**File:** `frontend/src/hooks/useResearchStream.ts`

Replace single EventSource with reconnection logic:

```typescript
export function useResearchStream(
  sessionId: string | null,
  callbacks: StreamCallbacks,
) {
  const cbRef = useRef(callbacks);
  useEffect(() => {
    cbRef.current = callbacks;
  });

  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    let attempt = 0;
    let closed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (closed) return;
      const es = new EventSource(`/api/research/${sessionId}/stream`);
      esRef.current = es;

      function listen<T>(event: string, handler: (data: T) => void) {
        es.addEventListener(event, (e) => {
          try {
            handler(JSON.parse((e as MessageEvent).data));
          } catch {
            /* malformed JSON */
          }
        });
      }

      listen<ProgressData>("progress", (d) => cbRef.current.onProgress?.(d));
      listen<{ nodes: SkeletonNodeData[] }>("skeleton", (d) =>
        cbRef.current.onSkeleton?.(d),
      );
      listen<NodeDetailEvent>("node_detail", (d) =>
        cbRef.current.onNodeDetail?.(d),
      );
      listen<SynthesisData>("synthesis", (d) =>
        cbRef.current.onSynthesis?.(d),
      );
      listen<CompleteData>("complete", (d) => {
        cbRef.current.onComplete?.(d);
        closed = true;
        es.close();
      });
      listen<{ error: string; message: string }>("research_error", (d) => {
        cbRef.current.onResearchError?.(d);
        closed = true;
        es.close();
      });

      es.onopen = () => {
        attempt = 0; // reset on successful connection
      };

      es.onerror = () => {
        es.close();
        if (closed) return;
        attempt++;
        if (attempt > 5) {
          closed = true;
          cbRef.current.onConnectionError?.();
          return;
        }
        const delay = Math.min(1000 * 2 ** (attempt - 1), 8000);
        retryTimer = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      esRef.current?.close();
    };
  }, [sessionId]);

  return {
    close: useCallback(() => {
      esRef.current?.close();
    }, []),
  };
}
```

Key behaviors:
- On `onerror`: close current ES, retry after exponential backoff (1s → 2s → 4s → 8s → 8s), max 5 attempts
- On `onopen`: reset attempt counter
- On `complete` or `research_error`: set `closed = true`, no retry
- After 5 failed attempts: set `closed = true`, call `onConnectionError` (no more retries)
- Cleanup on unmount: set `closed = true`, clear timer, close ES

**Idempotency of callbacks** — already verified:
- `onSkeleton`: Map-based merge (ChronoApp.tsx:143-157) — replayed skeleton events just overwrite the map, producing the same result
- `onNodeDetail`: Updates by node_id (ChronoApp.tsx:159-172) — replayed details just re-set the same values
- `onSynthesis`: Simple setter (ChronoApp.tsx:174-176) — replayed synthesis replaces previous value
- `onComplete`: Simple setter (ChronoApp.tsx:178-181) — idempotent
- `onProgress`: Simple setter (ChronoApp.tsx:132-141) — sets `progressMessage` + marks nodes as `loading`. On replay this may re-trigger the skeleton → loading transition, but since detail events follow immediately, the nodes end up `complete` anyway.

**P3 note (progress flash on reconnect):** Replay sends all progress events in sequence, causing a brief flash of early-stage messages ("Building timeline skeleton..." → current stage). Not a bug, but suboptimal UX. Simplest fix would be to skip `progress` events in `replay_and_stream`, but this is P3 — not implemented in this round.

### Step 4: URL State Persistence + Expired Session Degradation

**File:** `frontend/src/components/ChronoApp.tsx`

Changes:

1. Read both `topic` and `session` from URL on init:
   ```typescript
   const [initialParams] = useState(() => {
     if (typeof window === "undefined") return { topic: null, session: null };
     const params = new URLSearchParams(window.location.search);
     return {
       topic: params.get("topic"),
       session: params.get("session"),
     };
   });
   ```

2. Replace the `autoTopic` useEffect with a unified initialization effect:
   ```typescript
   useEffect(() => {
     if (didAutoSearch.current) return;
     didAutoSearch.current = true;

     if (initialParams.session) {
       // Reconnect to existing session
       setStreamSessionId(initialParams.session);
       setSessionId(initialParams.session);
       setPhase("research");
       return;
     }

     if (initialParams.topic) {
       // Fresh search by topic (same as current autoTopic behavior)
       fetch("/api/research", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ topic: initialParams.topic, language: "auto" }),
       })
         .then((res) => {
           if (!res.ok) throw new Error();
           return res.json();
         })
         .then((data) => {
           setSessionId(data.session_id);
           setProposal(data.proposal);
           setPhase("proposal");
         })
         .catch(() => {
           setError("Service temporarily unavailable. Please try again.");
         });
     }
   }, [initialParams]);
   ```

3. Update URL at key moments:
   - `handleConfirm()`: Write both topic and session:
     ```typescript
     window.history.replaceState(
       null, "",
       `/app?topic=${encodeURIComponent(proposal.topic)}&session=${sessionId}`,
     );
     ```
   - `handleCancel()`: Already clears to `/app` — no change needed.

4. For the reconnection case (`initialParams.session`), we go directly to `phase: "research"` without a proposal. The `Timeline` component receives `proposal={null}`, which is already handled (it's used for displaying research threads in the header, which is optional). The `language` fallback `proposal?.language ?? "en"` also handles this.

   **Edge case:** On reconnect, we don't have the proposal in state. The synthesis event from replay will fill `synthesisData`. The only gap is: the AppShell `topic` prop (used in the research bar) will be `undefined`. We could read it from `initialParams.topic` as a fallback.

   ```typescript
   // In the return JSX:
   topic={proposal?.topic ?? initialParams.topic ?? undefined}
   ```

5. **Expired session degradation** — register `onConnectionError` callback:

   When URL contains `?session=xxx` but the backend session no longer exists (server restart, session expired), the EventSource will get 404, retry 5 times, then fire `onConnectionError`. Without handling, user is stuck on a blank research phase.

   ```typescript
   onConnectionError: useCallback(() => {
     // Clear stale session from URL, keep topic if present
     const topic = initialParams.topic;
     window.history.replaceState(
       null, "",
       topic ? `/app?topic=${encodeURIComponent(topic)}` : "/app",
     );
     // Reset to input phase
     setPhase("input");
     setStreamSessionId(null);
     setSessionId(null);
     setNodes([]);
     setProgressMessage("");
     setSynthesisData(null);
     setCompleteData(null);
     setError("Session expired. Please search again.");
   }, [initialParams.topic]),
   ```

   This clears all research state, falls back to search input, preserves topic in URL (but does NOT auto-trigger a new search — user must click "Research" themselves), and shows an error message.

---

## File Change Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `backend/app/orchestrator/orchestrator.py` | Edit | Remove `self._detail_contexts`, make it local to `execute_research()`, pass to `_filter_hallucinations` |
| `backend/app/models/session.py` | Edit | Add `_event_history`, modify `push()` to record, add `replay_and_stream()` |
| `backend/app/main.py` | Edit | Modify `/stream` endpoint to support reconnection (EXECUTING/COMPLETED states) |
| `frontend/src/hooks/useResearchStream.ts` | Edit | Add exponential backoff reconnection on `onerror` |
| `frontend/src/components/ChronoApp.tsx` | Edit | Read `session` param from URL, support direct reconnection on page load, write session to URL |

**Not changed:** All agent files, SSE event types/data format, DB models, `replay.py` (already uses `session.push()` — history recording is automatic), landing page components, globals.css.

---

## Execution Order

1. `_detail_contexts` fix in `orchestrator.py` (standalone, zero dependencies)
2. `_event_history` + `replay_and_stream` in `session.py`
3. `/stream` endpoint multi-status logic in `main.py`
4. `useResearchStream.ts` reconnection
5. `ChronoApp.tsx` URL persistence
6. `ruff check . && ruff format . && pnpm build && pnpm lint`

---

## Todo List

- [x] 1. Remove `self._detail_contexts` from Orchestrator, make local, update `_filter_hallucinations` signature
- [x] 2. Add `_event_history` to `ResearchSession`, modify `push()`, add `replay_and_stream()`
- [x] 3. Modify `/stream` endpoint to handle EXECUTING/COMPLETED states for reconnection
- [x] 4. Rewrite `useResearchStream.ts` with exponential backoff retry
- [x] 5. Add `session` URL param to `ChronoApp.tsx`, support reconnection on page load, add `onConnectionError` degradation for expired sessions
- [x] 6. Run `ruff check && ruff format && pnpm build && pnpm lint`
