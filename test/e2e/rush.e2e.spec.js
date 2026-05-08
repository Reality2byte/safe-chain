import { describe, it, before, beforeEach, afterEach } from "node:test";
import { DockerTestContainer } from "./DockerTestContainer.js";
import assert from "node:assert";

describe("E2E: rush coverage", () => {
  let container;

  before(async () => {
    DockerTestContainer.buildImage();
  });

  beforeEach(async () => {
    container = new DockerTestContainer();
    await container.start();

    const installationShell = await container.openShell("zsh");
    await installationShell.runCommand("safe-chain setup");
    await setupRushWorkspace(installationShell);
  });

  afterEach(async () => {
    if (container) {
      await container.stop();
      container = null;
    }
  });

  it("safe-chain successfully adds safe packages", async () => {
    const shell = await container.openShell("zsh");
    const result = await shell.runCommand(
      "cd /testapp/apps/test-app && rush add --package axios@1.13.0 --exact --skip-update --safe-chain-logging=verbose"
    );

    assert.ok(
      result.output.includes("no malware found."),
      `Output did not include expected text. Output was:\n${result.output}`
    );
  });

  it("safe-chain blocks rush add of malicious packages", async () => {
    const shell = await container.openShell("zsh");
    const result = await shell.runCommand(
      "cd /testapp/apps/test-app && rush add --package safe-chain-test --skip-update"
    );

    assert.ok(
      result.output.includes("Malicious changes detected:"),
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

    const packageJson = await shell.runCommand(
      "cat /testapp/apps/test-app/package.json"
    );

    assert.ok(
      !packageJson.output.includes("safe-chain-test"),
      `Malicious package was added despite safe-chain protection. Output was:\n${packageJson.output}`
    );
  });
});

async function setupRushWorkspace(shell) {
  await shell.runCommand("mkdir -p /testapp/common/config/rush /testapp/apps/test-app");
  await shell.runCommand(`cat > /testapp/common/config/rush/rush.json <<'EOF'
{
  "$schema": "https://developer.microsoft.com/json-schemas/rush/v5/rush.schema.json",
  "rushVersion": "5.175.1",
  "pnpmVersion": "11.0.6",
  "nodeSupportedVersionRange": ">=18.0.0",
  "projectFolderMinDepth": 1,
  "projectFolderMaxDepth": 2,
  "gitPolicy": {},
  "repository": {
    "url": "https://example.com/testapp.git",
    "defaultBranch": "main"
  },
  "eventHooks": {
    "preRushInstall": [],
    "postRushInstall": [],
    "preRushBuild": [],
    "postRushBuild": []
  },
  "projects": [
    {
      "packageName": "test-app",
      "projectFolder": "apps/test-app"
    }
  ]
}
EOF`);
  await shell.runCommand(`cat > /testapp/apps/test-app/package.json <<'EOF'
{
  "name": "test-app",
  "version": "1.0.0"
}
EOF`);
}
