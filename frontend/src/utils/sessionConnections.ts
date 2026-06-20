import type { SynthesisData, TimelineConnection } from "@/types";

type SessionConnectionsInput = Pick<SynthesisData, "connections"> | null | undefined;

const EMPTY_CONNECTIONS: TimelineConnection[] = [];

export function getSessionConnections(
  synthesisData: SessionConnectionsInput,
): TimelineConnection[] {
  return synthesisData?.connections ?? EMPTY_CONNECTIONS;
}
