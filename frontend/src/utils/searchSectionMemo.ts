export interface SearchSectionMemoProps {
  onSelectTopic: (topic: string) => void;
  locale: string;
  disabled?: boolean;
}

export function areSearchSectionPropsEqual(
  prev: SearchSectionMemoProps,
  next: SearchSectionMemoProps,
): boolean {
  return (
    prev.onSelectTopic === next.onSelectTopic &&
    prev.locale === next.locale &&
    prev.disabled === next.disabled
  );
}
