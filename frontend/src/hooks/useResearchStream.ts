"use client";

import { useEffect, useRef, useCallback } from "react";
import type {
  ProgressData,
  SkeletonNodeData,
  NodeDetailEvent,
  CompleteData,
} from "@/types";

interface StreamCallbacks {
  onProgress?: (data: ProgressData) => void;
  onSkeleton?: (data: { nodes: SkeletonNodeData[] }) => void;
  onNodeDetail?: (data: NodeDetailEvent) => void;
  onComplete?: (data: CompleteData) => void;
  onResearchError?: (data: { error: string; message: string }) => void;
  onConnectionError?: () => void;
}

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

    const es = new EventSource(`/api/research/${sessionId}/stream`);
    esRef.current = es;

    function listen<T>(event: string, handler: (data: T) => void) {
      es.addEventListener(event, (e) => {
        try {
          handler(JSON.parse((e as MessageEvent).data));
        } catch {
          /* malformed JSON — ignore */
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
    listen<CompleteData>("complete", (d) => {
      cbRef.current.onComplete?.(d);
      es.close();
    });
    listen<{ error: string; message: string }>("research_error", (d) =>
      cbRef.current.onResearchError?.(d),
    );

    es.onerror = () => {
      cbRef.current.onConnectionError?.();
      es.close();
    };

    return () => {
      es.close();
    };
  }, [sessionId]);

  return {
    close: useCallback(() => esRef.current?.close(), []),
  };
}
