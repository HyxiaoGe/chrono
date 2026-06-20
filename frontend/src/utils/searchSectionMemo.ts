import type { ResearchSummary } from "@/types";

export interface SearchSectionMemoProps {
  onSelectTopic?: (topic: string) => void;
  onOpenResearch?: (research: ResearchSummary) => void;
  locale: string;
  disabled?: boolean;
}

export function areSearchSectionPropsEqual(
  prev: SearchSectionMemoProps,
  next: SearchSectionMemoProps,
): boolean {
  return (
    prev.onSelectTopic === next.onSelectTopic &&
    prev.onOpenResearch === next.onOpenResearch &&
    prev.locale === next.locale &&
    prev.disabled === next.disabled
  );
}
