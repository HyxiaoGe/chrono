"use client";

import { useEffect, useRef, useCallback } from "react";
import type {
  ProgressData,
  NodeProgressData,
  SkeletonNodeData,
  NodeDetailEvent,
  SynthesisData,
  CompleteData,
} from "@/types";

interface StreamCallbacks {
  onProgress?: (data: ProgressData) => void;
  onNodeProgress?: (data: NodeProgressData) => void;
  onSkeleton?: (data: { nodes: SkeletonNodeData[]; partial?: boolean }) => void;
  onNodeDetail?: (data: NodeDetailEvent) => void;
  onSynthesis?: (data: SynthesisData) => void;
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
            /* malformed JSON — ignore */
          }
        });
      }

      listen<ProgressData>("progress", (d) => cbRef.current.onProgress?.(d));
      listen<NodeProgressData>("node_progress", (d) =>
        cbRef.current.onNodeProgress?.(d),
      );
      listen<{ nodes: SkeletonNodeData[]; partial?: boolean }>("skeleton", (d) =>
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
        attempt = 0;
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
    close: useCallback(() => esRef.current?.close(), []),
  };
}
