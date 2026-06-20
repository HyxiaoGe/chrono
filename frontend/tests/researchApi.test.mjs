import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  ResearchApiError,
  clearResearchApiCache,
  createReplaySession,
  createResearch,
  fetchRecommendedTopics,
  fetchResearches,
  fetchResearchStatus,
} from "../src/api/research.ts";

function jsonResponse(data, overrides = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
    ...overrides,
  };
}

describe("research API client", () => {
  beforeEach(() => {
    clearResearchApiCache();
  });

  it("creates research with the expected request payload", async () => {
    const calls = [];
    const fetcher = async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({ session_id: "rs_123", cached: false });
    };

    const result = await createResearch("iPhone history", { fetcher });

    assert.deepEqual(result, { session_id: "rs_123", cached: false });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "/api/research");
    assert.equal(calls[0].init.method, "POST");
    assert.deepEqual(calls[0].init.headers, { "Content-Type": "application/json" });
    assert.deepEqual(JSON.parse(calls[0].init.body), {
      topic: "iPhone history",
      language: "auto",
    });
  });

  it("passes force through when creating a forced research", async () => {
    const calls = [];
    const fetcher = async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({ session_id: "rs_456", cached: false });
    };

    await createResearch("iPhone history", { fetcher, force: true });

    assert.deepEqual(JSON.parse(calls[0].init.body), {
      topic: "iPhone history",
      language: "auto",
      force: true,
    });
  });

  it("fetches existing research status by session id", async () => {
    const calls = [];
    const fetcher = async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({ status: "completed", proposal: { topic: "iPhone" } });
    };

    const result = await fetchResearchStatus("rs_789", { fetcher });

    assert.deepEqual(result, {
      status: "completed",
      proposal: { topic: "iPhone" },
    });
    assert.deepEqual(calls, [{ url: "/api/research/rs_789/status", init: undefined }]);
  });

  it("throws a typed error for failed responses", async () => {
    const fetcher = async () => jsonResponse({}, { ok: false, status: 503 });

    await assert.rejects(
      createResearch("iPhone history", { fetcher }),
      (error) => {
        assert.equal(error instanceof ResearchApiError, true);
        assert.equal(error.status, 503);
        assert.equal(error.message, "Research API request failed with status 503");
        return true;
      },
    );
  });

  it("throws a typed error when replay creation is in maintenance", async () => {
    const fetcher = async () => jsonResponse({}, { ok: false, status: 503 });

    await assert.rejects(
      createReplaySession("research-1", { fetcher }),
      (error) => {
        assert.equal(error instanceof ResearchApiError, true);
        assert.equal(error.status, 503);
        return true;
      },
    );
  });

  it("deduplicates in-flight research list requests by locale and limit", async () => {
    const calls = [];
    let resolveResponse;
    const responsePromise = new Promise((resolve) => {
      resolveResponse = resolve;
    });
    const fetcher = async (url, init) => {
      calls.push({ url, init });
      return responsePromise;
    };

    const first = fetchResearches("zh", { fetcher, limit: 12 });
    const second = fetchResearches("zh", { fetcher, limit: 12 });

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], {
      url: "/api/researches?locale=zh&limit=12",
      init: undefined,
    });

    resolveResponse(jsonResponse([{ id: "r1", topic: "iPhone" }]));

    assert.equal(await first, await second);
    assert.deepEqual(await first, [{ id: "r1", topic: "iPhone" }]);
  });

  it("reuses resolved recommended topic responses and supports refresh", async () => {
    const calls = [];
    const fetcher = async (url, init) => {
      calls.push({ url, init });
      return jsonResponse([{ id: `call-${calls.length}`, topics: [] }]);
    };

    const first = await fetchRecommendedTopics("en", { fetcher });
    const second = await fetchRecommendedTopics("en", { fetcher });
    const refreshed = await fetchRecommendedTopics("en", { fetcher, force: true });

    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0], {
      url: "/api/topics/recommended?locale=en",
      init: undefined,
    });
    assert.deepEqual(first, [{ id: "call-1", topics: [] }]);
    assert.equal(first, second);
    assert.deepEqual(refreshed, [{ id: "call-2", topics: [] }]);
  });

  it("does not cache failed list requests", async () => {
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return jsonResponse([], { ok: false, status: 500 });
    };

    await assert.rejects(fetchResearches("en", { fetcher }));
    await assert.rejects(fetchResearches("en", { fetcher }));

    assert.equal(calls, 2);
  });

  it("invalidates cached home data after creating research", async () => {
    const calls = [];
    const fetcher = async (url, init) => {
      calls.push({ url, init });
      if (url === "/api/research") {
        return jsonResponse({ session_id: "rs_new", cached: false });
      }
      if (String(url).startsWith("/api/researches")) {
        return jsonResponse([{ id: `history-${calls.length}` }]);
      }
      return jsonResponse([{ id: `recommended-${calls.length}`, topics: [] }]);
    };

    const historyBefore = await fetchResearches("en", { fetcher });
    const recommendedBefore = await fetchRecommendedTopics("en", { fetcher });
    await createResearch("iPhone history", { fetcher });
    const historyAfter = await fetchResearches("en", { fetcher });
    const recommendedAfter = await fetchRecommendedTopics("en", { fetcher });

    assert.deepEqual(historyBefore, [{ id: "history-1" }]);
    assert.deepEqual(recommendedBefore, [{ id: "recommended-2", topics: [] }]);
    assert.deepEqual(historyAfter, [{ id: "history-4" }]);
    assert.deepEqual(recommendedAfter, [{ id: "recommended-5", topics: [] }]);
  });
});
