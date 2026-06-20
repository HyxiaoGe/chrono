import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("frontend Docker toolchain", () => {
  it("pins pnpm and builds with a Node version compatible with it", async () => {
    const [dockerfile, packageJsonSource, workspaceSource] = await Promise.all([
      readFile(new URL("../Dockerfile", import.meta.url), "utf8"),
      readFile(new URL("../package.json", import.meta.url), "utf8"),
      readFile(new URL("../pnpm-workspace.yaml", import.meta.url), "utf8"),
    ]);
    const packageJson = JSON.parse(packageJsonSource);
    const baseImages = [...dockerfile.matchAll(/^FROM\s+(node:\S+)/gm)].map(
      (match) => match[1],
    );

    assert.deepEqual(baseImages, [
      "node:22-alpine",
      "node:22-alpine",
      "node:22-alpine",
    ]);
    assert.match(packageJson.packageManager, /^pnpm@\d+\.\d+\.\d+$/);
    assert.match(workspaceSource, /^onlyBuiltDependencies:/m);
    assert.doesNotMatch(workspaceSource, /^ignoredBuiltDependencies:/m);
    assert.match(workspaceSource, /^\s+- sharp$/m);
    assert.match(workspaceSource, /^\s+- unrs-resolver$/m);
  });
});
