# Refactor Baseline Hardening Plan

## Goal

Make the repo safer for the next larger Chrono refactor by restoring a clean verification baseline and adding focused contract tests around session/SSE/replay behavior.

## Scope

This plan implements the P0 slice from `plans/refactor-readiness-research.md`:

- Fix current frontend lint errors.
- Update stale dedup evaluation script imports after the backend runtime split.
- Add minimal backend tests for SSE event history and DB replay event order.
- Preserve current API routes, SSE event names, payload shapes, and replay semantics.

## Non-goals

- Do not redesign the research pipeline.
- Do not change Pydantic AI agent behavior.
- Do not change user-facing UI layout.
- Do not introduce schema generation yet.

## Files

- Modify: `frontend/src/components/EraNavigator.tsx`
- Modify: `frontend/src/components/HistoryList.tsx`
- Modify: `frontend/src/components/RecommendedTopics.tsx`
- Modify: `frontend/src/hooks/useActiveNode.ts`
- Modify: `scripts/test_dedup_models.py`
- Create: `backend/tests/test_session_events.py`
- Create: `backend/tests/test_replay_contract.py`

## Implementation Todo

- [x] Confirm the existing frontend lint failures are reproducible with `pnpm lint`.
- [x] Fix `EraNavigator.tsx` by computing marker positions without mutating render-local state in JSX.
- [x] Fix `HistoryList.tsx` and `RecommendedTopics.tsx` effect patterns without changing fetch behavior.
- [x] Fix `useActiveNode.ts` by updating the ref after render through an effect.
- [x] Re-run `pnpm lint` and confirm the frontend lint baseline is clean.
- [x] Write failing backend tests for `ResearchSession.push()`, `event_generator()`, and `replay_and_stream()`.
- [x] Run the new session tests and confirm they fail or expose missing test scaffolding before production changes.
- [x] Add or adjust only the minimal code needed for session tests to pass.
- [x] Write failing backend replay contract test that verifies event order: `skeleton`, `node_detail`, `synthesis`, `complete`.
- [x] Fix stale imports in `scripts/test_dedup_models.py` by importing dedup helpers from `app.orchestrator.dedup`.
- [x] Run targeted backend tests.
- [x] Run `python3 backend/scripts/check_architecture.py`.
- [x] Run `uv run ruff check .` and `uv run ruff format --check .` in `backend/`.
- [x] Run final `pnpm lint` in `frontend/`.

## Test Strategy

Frontend changes are validated by the existing ESLint/React compiler rules. The current lint failures are the red state; the expected green state is `pnpm lint` exiting with code 0.

Backend tests should avoid real LLM, Tavily, Redis, and Postgres network calls. Session tests use `ResearchSession` directly. Replay contract tests monkeypatch the DB session factory and repository calls so the replay function can be exercised as an event-order contract without a live database.

## Approval

The user explicitly said “开始实现吧”, so this plan is approved for inline implementation.
