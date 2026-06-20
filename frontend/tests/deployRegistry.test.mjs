import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const repoRoot = new URL("../../", import.meta.url);

describe("deploy registry configuration", () => {
  it("publishes backend and frontend images to Alibaba Cloud ACR", async () => {
    const workflow = await readFile(
      new URL(".github/workflows/deploy.yml", repoRoot),
      "utf8",
    );

    assert.match(
      workflow,
      /ACR_REGISTRY:\s+crpi-77w10wlykpqilmmb\.cn-shenzhen\.personal\.cr\.aliyuncs\.com/,
    );
    assert.match(workflow, /ACR_REPOSITORY:\s+seanfield\/chrono/);
    assert.match(workflow, /ALIYUN_ACR_PASSWORD/);
    assert.match(workflow, /docker login "\$ACR_REGISTRY"/);
    assert.match(workflow, /BACKEND_IMAGE="\$ACR_REGISTRY\/\$ACR_REPOSITORY:backend-\$SHORT_SHA"/);
    assert.match(workflow, /FRONTEND_IMAGE="\$ACR_REGISTRY\/\$ACR_REPOSITORY:frontend-\$SHORT_SHA"/);
    assert.match(workflow, /docker build --pull -t "\$BACKEND_IMAGE" -t "\$BACKEND_STABLE_IMAGE" \.\/backend/);
    assert.match(workflow, /docker build --pull -t "\$FRONTEND_IMAGE" -t "\$FRONTEND_STABLE_IMAGE"/);
    assert.match(workflow, /docker push "\$BACKEND_IMAGE"/);
    assert.match(workflow, /docker push "\$FRONTEND_IMAGE"/);
  });

  it("deploys pulled ACR images instead of rebuilding on the dev host", async () => {
    const [compose, workflow] = await Promise.all([
      readFile(new URL("docker-compose.yml", repoRoot), "utf8"),
      readFile(new URL(".github/workflows/deploy.yml", repoRoot), "utf8"),
    ]);

    assert.match(compose, /image:\s+\$\{CHRONO_BACKEND_IMAGE:-chrono-backend:local\}/);
    assert.match(compose, /image:\s+\$\{CHRONO_FRONTEND_IMAGE:-chrono-frontend:local\}/);
    assert.doesNotMatch(compose, /\.\.?\s*\/backend:\/app/);
    assert.match(workflow, /CHRONO_BACKEND_IMAGE="\$BACKEND_IMAGE"/);
    assert.match(workflow, /CHRONO_FRONTEND_IMAGE="\$FRONTEND_IMAGE"/);
    assert.match(workflow, /docker compose pull backend frontend/);
    assert.match(workflow, /docker compose up -d --no-build backend frontend/);
    assert.doesNotMatch(workflow, /docker compose up -d --build/);
  });

  it("connects the backend to external dependency networks", async () => {
    const compose = await readFile(new URL("docker-compose.yml", repoRoot), "utf8");

    assert.match(compose, /backend:[\s\S]*networks:[\s\S]*-\s+postgres_net/);
    assert.match(compose, /backend:[\s\S]*networks:[\s\S]*-\s+middleware_net/);
    assert.match(compose, /postgres_net:[\s\S]*external:\s+true[\s\S]*name:\s+postgres_default/);
    assert.match(compose, /middleware_net:[\s\S]*external:\s+true[\s\S]*name:\s+middleware_default/);
  });

  it("uses domestic package mirrors during image builds", async () => {
    const [backendDockerfile, frontendDockerfile] = await Promise.all([
      readFile(new URL("backend/Dockerfile", repoRoot), "utf8"),
      readFile(new URL("frontend/Dockerfile", repoRoot), "utf8"),
    ]);

    assert.match(backendDockerfile, /UV_INDEX_URL=https:\/\/mirrors\.aliyun\.com\/pypi\/simple\//);
    assert.match(frontendDockerfile, /COREPACK_NPM_REGISTRY=https:\/\/registry\.npmmirror\.com/);
    assert.match(frontendDockerfile, /pnpm config set registry https:\/\/registry\.npmmirror\.com/);
  });
});
