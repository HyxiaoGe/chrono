export const RESEARCH_MAINTENANCE_ENABLED = true;

export function shouldBlockResearchCreation(sessionId: string): boolean {
  return RESEARCH_MAINTENANCE_ENABLED && sessionId === "new";
}
