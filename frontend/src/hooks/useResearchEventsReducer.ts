"use client";

import { useCallback, useReducer } from "react";
import type {
  CompleteData,
  NodeDetailEvent,
  ProgressData,
  SkeletonNodeData,
  SynthesisData,
  TimelineNode,
} from "../types";

export interface ResearchEventsState {
  nodes: TimelineNode[];
  researchPhase: string;
  researchModel: string;
  synthesisData: SynthesisData | null;
  completeData: CompleteData | null;
}

type SkeletonEventData = {
  nodes: SkeletonNodeData[];
  partial?: boolean;
};

export type ResearchEventsAction =
  | { type: "progress"; data: ProgressData }
  | { type: "skeleton"; data: SkeletonEventData }
  | { type: "node_detail"; data: NodeDetailEvent }
  | { type: "synthesis"; data: SynthesisData }
  | { type: "complete"; data: CompleteData };

export function createInitialResearchEventsState(): ResearchEventsState {
  return {
    nodes: [],
    researchPhase: "",
    researchModel: "",
    synthesisData: null,
    completeData: null,
  };
}

function mergePartialSkeletonNodes(
  currentNodes: TimelineNode[],
  skeletonNodes: SkeletonNodeData[],
): TimelineNode[] {
  const merged = [...currentNodes, ...skeletonNodes];
  merged.sort((a, b) => a.date.localeCompare(b.date));
  return merged;
}

function replaceSkeletonNodes(
  currentNodes: TimelineNode[],
  skeletonNodes: SkeletonNodeData[],
): TimelineNode[] {
  const existingMap = new Map(currentNodes.map((node) => [node.id, node]));

  return skeletonNodes.map((node) => {
    const existing = existingMap.get(node.id);
    if (!existing?.details) return { ...node };

    return {
      ...node,
      details: node.details ?? existing.details,
    };
  });
}

export function researchEventsReducer(
  state: ResearchEventsState,
  action: ResearchEventsAction,
): ResearchEventsState {
  switch (action.type) {
    case "progress": {
      const nextNodes =
        action.data.phase === "detail"
          ? state.nodes.map((node) =>
              node.status === "skeleton"
                ? { ...node, status: "loading" as const }
                : node,
            )
          : state.nodes;

      return {
        ...state,
        nodes: nextNodes,
        researchPhase: action.data.phase,
        researchModel: action.data.model ?? state.researchModel,
      };
    }

    case "skeleton":
      return {
        ...state,
        nodes: action.data.partial
          ? mergePartialSkeletonNodes(state.nodes, action.data.nodes)
          : replaceSkeletonNodes(state.nodes, action.data.nodes),
      };

    case "node_detail":
      return {
        ...state,
        nodes: state.nodes.map((node) =>
          node.id === action.data.node_id
            ? {
                ...node,
                details: action.data.details,
                status: "complete" as const,
                sources: [...node.sources, ...action.data.details.sources],
              }
            : node,
        ),
      };

    case "synthesis":
      return {
        ...state,
        synthesisData: action.data,
      };

    case "complete":
      return {
        ...state,
        completeData: action.data,
      };
  }
}

export function useResearchEventsReducer() {
  const [state, dispatch] = useReducer(
    researchEventsReducer,
    undefined,
    createInitialResearchEventsState,
  );

  return {
    ...state,
    onProgress: useCallback(
      (data: ProgressData) => dispatch({ type: "progress", data }),
      [],
    ),
    onSkeleton: useCallback(
      (data: SkeletonEventData) => dispatch({ type: "skeleton", data }),
      [],
    ),
    onNodeDetail: useCallback(
      (data: NodeDetailEvent) => dispatch({ type: "node_detail", data }),
      [],
    ),
    onSynthesis: useCallback(
      (data: SynthesisData) => dispatch({ type: "synthesis", data }),
      [],
    ),
    onComplete: useCallback(
      (data: CompleteData) => dispatch({ type: "complete", data }),
      [],
    ),
  };
}
