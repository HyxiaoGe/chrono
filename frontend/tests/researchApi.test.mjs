import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ResearchApiError,
  createResearch,
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
});
