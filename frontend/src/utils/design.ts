export function sigColor(significance: string): string {
  if (significance === "revolutionary") return "#f0c060";
  if (significance === "high") return "#8a9ab0";
  return "#71717a";
}

export function connColor(type: string): string {
  if (type === "caused") return "#e07050";
  if (type === "enabled") return "#5090d0";
  if (type === "inspired") return "#50b080";
  return "#9070c0";
}

export function connDash(type: string): string {
  if (type === "caused") return "0";
  if (type === "enabled") return "6 4";
  if (type === "inspired") return "2 4";
  return "1 3";
}
