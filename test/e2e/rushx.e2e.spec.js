import { describe, it, before, beforeEach, afterEach } from "node:test";
import { DockerTestContainer } from "./DockerTestContainer.js";
import assert from "node:assert";

describe("E2E: rushx coverage", () => {
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

    assert.ok(
      result.output.includes("blocked 1 malicious package downloads"),
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
  "version": "1.0.0",
  "scripts": {
    "install-safe": "npm install axios@1.13.0",
    "install-malicious": "npm install safe-chain-test@0.0.1-security"
  }
}
EOF`);
}
