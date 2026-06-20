import { useMemo } from "react";
import type { TimelineConnection, TimelineNode } from "@/types";

export interface NodeConnectionInfo {
  outgoing: {
    targetId: string;
    targetTitle: string;
    relationship: string;
    type: string;
  }[];
  incoming: {
    sourceId: string;
    sourceTitle: string;
    relationship: string;
    type: string;
  }[];
}

export type ConnectionMap = ReadonlyMap<string, NodeConnectionInfo>;

const EMPTY_CONNECTION_MAP: ConnectionMap = new Map();

function buildConnectionMap(
  connections: TimelineConnection[],
  nodes: TimelineNode[],
): ConnectionMap {
  const titleMap = new Map(nodes.map((n) => [n.id, n.title]));
  const map = new Map<string, NodeConnectionInfo>();

  function ensure(id: string): NodeConnectionInfo {
    let info = map.get(id);
    if (!info) {
      info = { outgoing: [], incoming: [] };
      map.set(id, info);
    }
    return info;
  }

  for (const conn of connections) {
    ensure(conn.from_id).outgoing.push({
      targetId: conn.to_id,
      targetTitle: titleMap.get(conn.to_id) ?? conn.to_id,
      relationship: conn.relationship,
      type: conn.type,
    });
    ensure(conn.to_id).incoming.push({
      sourceId: conn.from_id,
      sourceTitle: titleMap.get(conn.from_id) ?? conn.from_id,
      relationship: conn.relationship,
      type: conn.type,
    });
  }

  return map;
}

export function getConnectionMap(
  connections: TimelineConnection[] | undefined,
  nodes: TimelineNode[],
): ConnectionMap {
  if (!connections || connections.length === 0) return EMPTY_CONNECTION_MAP;
  return buildConnectionMap(connections, nodes);
}

export function useConnections(
  connections: TimelineConnection[] | undefined,
  nodes: TimelineNode[],
): ConnectionMap {
  return useMemo(() => getConnectionMap(connections, nodes), [connections, nodes]);
}
