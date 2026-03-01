"use client";

import { useReducer, useEffect } from "react";
import { demoData } from "@/data/demo";
import type { DemoData } from "@/data/demo";
import type { Locale } from "@/data/landing";
import { messages } from "@/data/landing";
import { TimelineNodeCard } from "./TimelineNode";
import type { TimelineNode } from "@/types";

// --- State machine ---

type DemoPhase =
  | "typing"
  | "typing-out"
  | "proposal"
  | "proposal-out"
  | "skeleton"
  | "detail"
  | "synthesis"
  | "hold"
  | "fadeout";

interface DemoState {
  phase: DemoPhase;
  typedChars: number;
  visibleNodes: number;
  completedNodes: number;
  showSynthesis: boolean;
  scrollY: number;
}

interface Props {
  locale: Locale;
}

const TOPIC = "iPhone";

const NODE_HEIGHTS: Record<string, number> = {
  revolutionary: 120,
  high: 100,
  medium: 70,
};
const VISIBLE_HEIGHT = 340;

type Action =
  | { type: "TICK_CHAR" }
  | { type: "TYPING_OUT" }
  | { type: "SHOW_PROPOSAL" }
  | { type: "PROPOSAL_OUT" }
  | { type: "START_SKELETON" }
  | { type: "ADD_NODE"; nodes: DemoData["nodes"] }
  | { type: "START_DETAIL" }
  | { type: "COMPLETE_NODE"; nodes: DemoData["nodes"] }
  | { type: "SHOW_SYNTHESIS"; nodes: DemoData["nodes"] }
  | { type: "HOLD" }
  | { type: "FADEOUT" }
  | { type: "RESET" };

const initialState: DemoState = {
  phase: "typing",
  typedChars: 0,
  visibleNodes: 0,
  completedNodes: 0,
  showSynthesis: false,
  scrollY: 0,
};

function computeScrollY(
  nodes: DemoData["nodes"],
  activeIndex: number,
): number {
  let total = 0;
  for (let i = 0; i <= activeIndex; i++)
    total += NODE_HEIGHTS[nodes[i].significance] ?? 90;
  return Math.max(0, total - VISIBLE_HEIGHT + 80);
}

function reducer(state: DemoState, action: Action): DemoState {
  switch (action.type) {
    case "TICK_CHAR":
      return { ...state, typedChars: state.typedChars + 1 };
    case "TYPING_OUT":
      return { ...state, phase: "typing-out" };
    case "SHOW_PROPOSAL":
      return { ...state, phase: "proposal" };
    case "PROPOSAL_OUT":
      return { ...state, phase: "proposal-out" };
    case "START_SKELETON":
      return { ...state, phase: "skeleton" };
    case "ADD_NODE": {
      const nextVisible = state.visibleNodes + 1;
      return {
        ...state,
        visibleNodes: nextVisible,
        scrollY: computeScrollY(action.nodes, nextVisible - 1),
      };
    }
    case "START_DETAIL":
      return { ...state, phase: "detail" };
    case "COMPLETE_NODE": {
      const nextCompleted = state.completedNodes + 1;
      return {
        ...state,
        completedNodes: nextCompleted,
        scrollY: computeScrollY(action.nodes, nextCompleted - 1),
      };
    }
    case "SHOW_SYNTHESIS":
      return {
        ...state,
        phase: "synthesis",
        showSynthesis: true,
        scrollY: computeScrollY(
          action.nodes,
          action.nodes.length - 1,
        ),
      };
    case "HOLD":
      return { ...state, phase: "hold" };
    case "FADEOUT":
      return { ...state, phase: "fadeout" };
    case "RESET":
      return { ...initialState };
    default:
      return state;
  }
}

// --- Sub-components ---

function DemoSearch({
  typedChars,
  subtitle,
}: {
  typedChars: number;
  subtitle: string;
}) {
  const text = TOPIC.slice(0, typedChars);
  return (
    <div className="flex h-[340px] flex-col items-center justify-end pb-16 px-4">
      <h1 className="mb-2 text-chrono-title font-bold tracking-wider text-chrono-accent">
        Chrono
      </h1>
      <p className="mb-8 text-chrono-caption text-chrono-text-muted">
        {subtitle}
      </p>
      <div className="flex w-full max-w-xs gap-2">
        <div className="flex-1 rounded-lg border border-chrono-border bg-chrono-surface px-3 py-2 text-chrono-caption text-chrono-text flex items-center">
          <span>{text}</span>
          <span className="animate-cursor-blink text-chrono-accent ml-0.5">
            |
          </span>
        </div>
        <div className="rounded-lg bg-chrono-text px-4 py-2 text-chrono-caption font-medium text-chrono-bg opacity-40">
          Research
        </div>
      </div>
    </div>
  );
}

function DemoProposal({ data, locale }: { data: DemoData; locale: Locale }) {
  const { proposal } = data;
  const activeDots = 1;
  return (
    <div className="flex h-[340px] flex-col items-center justify-end pb-12 px-4">
      <div className="animate-slide-up w-full max-w-sm rounded-xl border border-chrono-border bg-chrono-surface/80 p-5 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <h2 className="text-chrono-body font-bold text-chrono-text">
            {proposal.user_facing.title}
          </h2>
          <div className="flex gap-1">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${
                  i < activeDots ? "bg-chrono-accent" : "bg-chrono-border"
                }`}
              />
            ))}
          </div>
        </div>
        <p className="mt-1.5 text-chrono-caption text-chrono-text-secondary">
          {proposal.user_facing.summary}
        </p>
        <div className="mt-4">
          <h3 className="text-chrono-tiny font-medium uppercase tracking-wider text-chrono-text-muted">
            {messages[locale].demo.researchDimensions}
          </h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {proposal.research_threads.map((thread) => (
              <span
                key={thread.name}
                className="rounded-full border border-chrono-border px-2 py-0.5 text-chrono-tiny text-chrono-text-secondary"
                style={{ opacity: 0.4 + thread.priority * 0.12 }}
              >
                {thread.name}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-4 flex gap-4 text-chrono-tiny text-chrono-text-muted">
          <span>{proposal.user_facing.duration_text}</span>
          <span>{proposal.user_facing.credits_text}</span>
          <span>~{proposal.complexity.estimated_total_nodes} nodes</span>
        </div>
      </div>
    </div>
  );
}

function DemoTimeline({
  data,
  visibleNodes,
  completedNodes,
  scrollY,
  locale,
  showSynthesis,
}: {
  data: DemoData;
  visibleNodes: number;
  completedNodes: number;
  scrollY: number;
  locale: Locale;
  showSynthesis: boolean;
}) {
  const displayNodes: TimelineNode[] = data.nodes
    .slice(0, visibleNodes)
    .map((node, i) => {
      const isComplete = i < completedNodes;
      const detail = data.details[node.id];
      return {
        ...node,
        status: isComplete ? ("complete" as const) : ("skeleton" as const),
        details: isComplete ? detail : undefined,
        sources: isComplete && detail ? detail.sources : [],
      };
    });

  return (
    <div
      className="px-4 py-6"
      style={{
        transform: `translateY(-${scrollY}px)`,
        transition: "transform 0.5s ease-out",
      }}
    >
      <div className="relative">
        <div className="absolute left-16 top-0 bottom-0 w-px bg-chrono-timeline" />
        {displayNodes.map((node) => {
          const dotSize =
            node.significance === "revolutionary"
              ? "h-3 w-3 ring-3 ring-chrono-revolutionary/20"
              : node.significance === "high"
                ? "h-2.5 w-2.5"
                : "h-2 w-2";
          const dotColor =
            node.significance === "revolutionary"
              ? "bg-chrono-revolutionary"
              : node.significance === "high"
                ? "bg-chrono-high"
                : "bg-chrono-medium";

          return (
            <div key={node.id} className="mb-4 flex items-start animate-fade-in">
              <div className="w-14 pt-2 text-right pr-2">
                <span className="text-chrono-tiny text-chrono-text-muted">
                  {node.date.slice(0, 4)}
                </span>
              </div>
              <div className="w-6 flex justify-center pt-2">
                <span className={`rounded-full ${dotSize} ${dotColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <TimelineNodeCard
                  node={node}
                  isSelected={false}
                  isHighlighted={false}
                  connectionCount={0}
                  onSelect={() => {}}
                  language={locale === "zh" ? "zh" : "en"}
                />
              </div>
            </div>
          );
        })}
      </div>
      {showSynthesis && <DemoSynthesis data={data} locale={locale} />}
    </div>
  );
}

function DemoSynthesis({ data, locale }: { data: DemoData; locale: Locale }) {
  const { synthesis } = data;
  return (
    <div className="mx-4 mb-4 animate-fade-in rounded-lg border border-chrono-border bg-chrono-surface p-4">
      <h4 className="text-chrono-tiny font-medium text-chrono-text-muted uppercase tracking-wider mb-2">
        {messages[locale].demo.synthesis}
      </h4>
      <p className="text-chrono-caption text-chrono-text-secondary">
        {synthesis.summary}
      </p>
      <p className="mt-2 text-chrono-tiny text-chrono-accent italic">
        {synthesis.key_insight}
      </p>
      <div className="mt-2 flex gap-3 text-chrono-tiny text-chrono-text-muted">
        <span>{synthesis.timeline_span}</span>
        <span>{synthesis.source_count} sources</span>
      </div>
    </div>
  );
}

// --- Main component ---

export function DemoPlayer({ locale }: Props) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const data = demoData[locale];
  const nodeCount = data.nodes.length;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    switch (state.phase) {
      case "typing":
        if (state.typedChars < TOPIC.length) {
          timer = setTimeout(() => dispatch({ type: "TICK_CHAR" }), 120);
        } else {
          timer = setTimeout(() => dispatch({ type: "TYPING_OUT" }), 600);
        }
        break;
      case "typing-out":
        timer = setTimeout(() => dispatch({ type: "SHOW_PROPOSAL" }), 350);
        break;
      case "proposal":
        timer = setTimeout(() => dispatch({ type: "PROPOSAL_OUT" }), 2500);
        break;
      case "proposal-out":
        timer = setTimeout(() => dispatch({ type: "START_SKELETON" }), 350);
        break;
      case "skeleton":
        if (state.visibleNodes < nodeCount) {
          timer = setTimeout(
            () => dispatch({ type: "ADD_NODE", nodes: data.nodes }),
            300,
          );
        } else {
          timer = setTimeout(() => dispatch({ type: "START_DETAIL" }), 500);
        }
        break;
      case "detail":
        if (state.completedNodes < nodeCount) {
          timer = setTimeout(
            () => dispatch({ type: "COMPLETE_NODE", nodes: data.nodes }),
            650,
          );
        } else {
          timer = setTimeout(
            () => dispatch({ type: "SHOW_SYNTHESIS", nodes: data.nodes }),
            500,
          );
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
  }, [state, data.nodes, nodeCount]);

  const isFadeout = state.phase === "fadeout";
  const showTyping = state.phase === "typing" || state.phase === "typing-out";
  const showProposal =
    state.phase === "proposal" || state.phase === "proposal-out";
  const showTimeline = !showTyping && !showProposal;

  return (
    <div
      className="w-full rounded-2xl border border-chrono-border bg-chrono-surface/50 overflow-hidden"
      style={{
        opacity: isFadeout ? 0 : 1,
        transition: "opacity 0.5s ease",
        boxShadow: "0 0 80px rgba(212,160,80,0.08)",
      }}
    >
      {/* Top bar */}
      <div className="h-8 flex items-center px-3 border-b border-chrono-border/50">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-chrono-border" />
          <span className="h-2.5 w-2.5 rounded-full bg-chrono-border" />
          <span className="h-2.5 w-2.5 rounded-full bg-chrono-border" />
        </div>
        <span className="mx-auto text-chrono-tiny text-chrono-text-muted">
          Chrono
        </span>
      </div>

      {/* Content area */}
      <div className="relative h-[380px] overflow-hidden">
        {/* Typing phase */}
        {showTyping && (
          <div
            style={{
              opacity: state.phase === "typing" ? 1 : 0,
              transition: "opacity 0.3s ease",
            }}
          >
            <DemoSearch
              typedChars={state.typedChars}
              subtitle={messages[locale].demo.subtitle}
            />
          </div>
        )}

        {/* Proposal phase */}
        {showProposal && (
          <div
            style={{
              opacity: state.phase === "proposal" ? 1 : 0,
              transition: "opacity 0.3s ease",
            }}
          >
            <DemoProposal data={data} locale={locale} />
          </div>
        )}

        {/* Timeline phase */}
        {showTimeline && (
          <>
            <div className="sticky top-0 z-10 flex h-8 items-center border-b border-chrono-border/30 bg-chrono-surface/80 px-4 backdrop-blur-sm">
              <span className="text-chrono-tiny font-semibold tracking-wider text-chrono-text-muted">
                Chrono
              </span>
              <span className="ml-3 text-chrono-tiny text-chrono-text-secondary">
                iPhone
              </span>
            </div>
            <div className="h-[340px] overflow-hidden">
              <DemoTimeline
                data={data}
                visibleNodes={state.visibleNodes}
                completedNodes={state.completedNodes}
                scrollY={state.scrollY}
                locale={locale}
                showSynthesis={state.showSynthesis}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
