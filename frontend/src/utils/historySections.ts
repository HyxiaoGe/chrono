import type { ResearchSummary } from "@/types";

export type HistorySections =
  | {
      mode: "grouped";
      tech: ResearchSummary[];
      history: ResearchSummary[];
    }
  | {
      mode: "compact";
      items: ResearchSummary[];
      hasMore: boolean;
    };

export function deriveHistorySections(
  items: ResearchSummary[],
  options: { expanded?: boolean } = {},
): HistorySections {
  if (items.length > 6) {
    const tech: ResearchSummary[] = [];
    const history: ResearchSummary[] = [];
    for (const item of items) {
      if (item.topic_type === "product" || item.topic_type === "technology") {
        tech.push(item);
      } else if (item.topic_type === "historical_event" || item.topic_type === "culture") {
        history.push(item);
      }
    }
    return { mode: "grouped", tech, history };
  }

  const hasMore = items.length > 5;
  return {
    mode: "compact",
    items: options.expanded ? items : items.slice(0, 5),
    hasMore,
  };
}
