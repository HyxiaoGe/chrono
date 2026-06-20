import type { TimelineConnection } from "../types";

export interface IndexedTimelineConnection {
  connection: TimelineConnection;
  index: number;
}

export interface TimelineConnectionIndexEntry {
  relatedIds: Set<string>;
  connections: IndexedTimelineConnection[];
}

export type TimelineConnectionIndex = Map<string, TimelineConnectionIndexEntry>;

function ensureEntry(
  index: TimelineConnectionIndex,
  nodeId: string,
): TimelineConnectionIndexEntry {
  let entry = index.get(nodeId);
  if (!entry) {
    entry = { relatedIds: new Set(), connections: [] };
    index.set(nodeId, entry);
  }
  return entry;
}

export function buildTimelineConnectionIndex(
  connections: TimelineConnection[],
): TimelineConnectionIndex {
  const index: TimelineConnectionIndex = new Map();

  connections.forEach((connection, connectionIndex) => {
    const fromEntry = ensureEntry(index, connection.from_id);
    fromEntry.relatedIds.add(connection.to_id);
    fromEntry.connections.push({ connection, index: connectionIndex });

    const toEntry = ensureEntry(index, connection.to_id);
    toEntry.relatedIds.add(connection.from_id);
    toEntry.connections.push({ connection, index: connectionIndex });
  });

  return index;
}
