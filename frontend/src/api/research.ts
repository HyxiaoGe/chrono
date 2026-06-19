import type { ResearchProposal, ResearchProposalResponse } from "../types";

type ResearchFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Pick<Response, "ok" | "status" | "json">>;

interface ResearchRequestOptions {
  fetcher?: ResearchFetch;
}

interface CreateResearchOptions extends ResearchRequestOptions {
  language?: string;
  force?: boolean;
}

export interface ResearchStatusResponse {
  status: string;
  proposal: ResearchProposal;
}

export class ResearchApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Research API request failed with status ${status}`);
    this.name = "ResearchApiError";
    this.status = status;
  }
}

async function readJson<T>(
  response: Pick<Response, "ok" | "status" | "json">,
): Promise<T> {
  if (!response.ok) {
    throw new ResearchApiError(response.status);
  }

  return (await response.json()) as T;
}

export async function createResearch(
  topic: string,
  { fetcher = fetch, force, language = "auto" }: CreateResearchOptions = {},
): Promise<ResearchProposalResponse> {
  const body: { topic: string; language: string; force?: boolean } = {
    topic,
    language,
  };

  if (force) {
    body.force = true;
  }

  const response = await fetcher("/api/research", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return readJson<ResearchProposalResponse>(response);
}

export async function fetchResearchStatus(
  sessionId: string,
  { fetcher = fetch }: ResearchRequestOptions = {},
): Promise<ResearchStatusResponse> {
  const response = await fetcher(`/api/research/${sessionId}/status`);
  return readJson<ResearchStatusResponse>(response);
}
