import type {
  ResearchProposal,
  ResearchProposalResponse,
  ResearchSummary,
} from "../types";

type ResearchFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Pick<Response, "ok" | "status" | "json">>;

interface ResearchRequestOptions {
  fetcher?: ResearchFetch;
}

interface CachedResearchRequestOptions extends ResearchRequestOptions {
  force?: boolean;
}

interface CreateResearchOptions extends ResearchRequestOptions {
  language?: string;
  force?: boolean;
}

interface FetchResearchesOptions extends CachedResearchRequestOptions {
  limit?: number;
}

export interface RecommendedTopic {
  title: string | Record<string, string>;
  subtitle: string | Record<string, string>;
  complexity: string;
  estimated_nodes: number;
  cached?: boolean;
}

export interface RecommendedCategory {
  id: string;
  icon: string;
  label: string | Record<string, string>;
  topics: RecommendedTopic[];
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

const responseCache = new Map<string, Promise<unknown>>();

async function readJson<T>(
  response: Pick<Response, "ok" | "status" | "json">,
): Promise<T> {
  if (!response.ok) {
    throw new ResearchApiError(response.status);
  }

  return (await response.json()) as T;
}

function readCachedJson<T>(
  key: string,
  url: string,
  { fetcher = fetch, force = false }: CachedResearchRequestOptions = {},
): Promise<T> {
  if (force) {
    responseCache.delete(key);
  }

  const cached = responseCache.get(key);
  if (cached) {
    return cached as Promise<T>;
  }

  const request = fetcher(url)
    .then((response) => readJson<T>(response))
    .catch((error) => {
      responseCache.delete(key);
      throw error;
    });
  responseCache.set(key, request);
  return request;
}

export function clearResearchApiCache(): void {
  responseCache.clear();
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

  const data = await readJson<ResearchProposalResponse>(response);
  clearResearchApiCache();
  return data;
}

export async function fetchResearchStatus(
  sessionId: string,
  { fetcher = fetch }: ResearchRequestOptions = {},
): Promise<ResearchStatusResponse> {
  const response = await fetcher(`/api/research/${sessionId}/status`);
  return readJson<ResearchStatusResponse>(response);
}

export async function createReplaySession(
  researchId: string,
  { fetcher = fetch }: ResearchRequestOptions = {},
): Promise<ResearchProposalResponse> {
  const response = await fetcher(`/api/researches/${researchId}/replay`, {
    method: "POST",
  });
  return readJson<ResearchProposalResponse>(response);
}

export function fetchResearches(
  locale: string,
  { limit = 50, ...options }: FetchResearchesOptions = {},
): Promise<ResearchSummary[]> {
  const params = new URLSearchParams({ locale, limit: String(limit) });
  return readCachedJson<ResearchSummary[]>(
    `researches:${locale}:${limit}`,
    `/api/researches?${params.toString()}`,
    options,
  );
}

export function fetchRecommendedTopics(
  locale: string,
  options: CachedResearchRequestOptions = {},
): Promise<RecommendedCategory[]> {
  const params = new URLSearchParams({ locale });
  return readCachedJson<RecommendedCategory[]>(
    `recommended:${locale}`,
    `/api/topics/recommended?${params.toString()}`,
    options,
  );
}
