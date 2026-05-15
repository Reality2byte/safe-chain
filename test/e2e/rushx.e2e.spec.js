import { describe, it, before, beforeEach, afterEach } from "node:test";
import { DockerTestContainer } from "./DockerTestContainer.js";
import {
  buildRushConfig,
  resolveRushVersions,
  writeTextFile,
} from "./utils/rushtestutils.mjs";
import assert from "node:assert";

describe("E2E: rushx coverage", () => {
  let container;
  /** @type {{ rushVersion: string, pnpmVersion: string } | undefined} */
  let resolvedVersions;

  before(async () => {
    DockerTestContainer.buildImage();
  });

  beforeEach(async () => {
    container = new DockerTestContainer();
    await container.start();

    const installationShell = await container.openShell("zsh");
    await installationShell.runCommand("safe-chain setup");

    if (!resolvedVersions) {
      resolvedVersions = await resolveRushVersions(installationShell);
    }

    await setupRushWorkspace(installationShell, { resolvedVersions });
  });

  afterEach(async () => {
    if (container) {
      await container.stop();
      container = null;
    }
  });

  it("safe-chain successfully scans safe package downloads from rushx scripts", async () => {
    const shell = await container.openShell("zsh");
    const result = await shell.runCommand(
      "cd /testapp/apps/test-app && rushx install-safe --safe-chain-logging=verbose"
    );

    assert.ok(
      result.output.includes("no malware found."),
      `Output did not include expected text. Output was:\n${result.output}`
    );
  });

  it("safe-chain blocks malicious package downloads from rushx scripts", async () => {
    const shell = await container.openShell("zsh");
    const result = await shell.runCommand(
      "cd /testapp/apps/test-app && rushx install-malicious"
    );

    assert.match(
      result.output,
      /blocked [1-9]\d* malicious package downloads/,
      `Output did not include expected text. Output was:\n${result.output}`
    );
    assert.ok(
      result.output.includes("- safe-chain-test"),
      `Output did not include expected text. Output was:\n${result.output}`
    );
    assert.ok(
      result.output.includes("Exiting without installing malicious packages."),
      `Output did not include expected text. Output was:\n${result.output}`
    );
  });
});

async function setupRushWorkspace(shell, { resolvedVersions }) {
  const rushConfig = buildRushConfig({
    rushVersion: resolvedVersions.rushVersion,
    pnpmVersion: resolvedVersions.pnpmVersion,
  });

  await shell.runCommand(
    "mkdir -p /testapp/common/config/rush /testapp/apps/test-app"
  );
  await writeTextFile(
    shell,
    "/testapp/rush.json",
    JSON.stringify(rushConfig, null, 2)
  );
  await writeTextFile(
    shell,
    "/testapp/apps/test-app/package.json",
    `{
  "name": "test-app",
  "version": "1.0.0",
  "scripts": {
    "install-safe": "npm install axios@1.13.0",
    "install-malicious": "npm install safe-chain-test@0.0.1-security"
  }
}`
  );
}
