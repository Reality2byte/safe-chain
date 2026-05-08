import { describe, it, before, beforeEach, afterEach } from "node:test";
import { DockerTestContainer } from "./DockerTestContainer.js";
import assert from "node:assert";

describe("E2E: rush coverage", () => {
  let container;
  const packageManagerConfigs = [
    { name: "pnpm", versionField: "pnpmVersion", version: "latest" },
    { name: "yarn", versionField: "yarnVersion", version: "latest" },
    { name: "npm", versionField: "npmVersion", version: "latest" },
  ];

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

  for (const packageManagerConfig of packageManagerConfigs) {
    it(`safe-chain proxy blocks malicious package downloads during rush update with ${packageManagerConfig.name}`, async () => {
      const shell = await container.openShell("zsh");
      await setupRushWorkspace(shell, {
        packageManagerConfig,
        packageJson: `{
  "name": "test-app",
  "version": "1.0.0",
  "dependencies": {
    "safe-chain-test": "0.0.1-security"
  }
}`,
      });

      const result = await shell.runCommand("cd /testapp/apps/test-app && rush update");

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
  }
});

async function setupRushWorkspace(shell, options = {}) {
  const packageManagerConfig = options.packageManagerConfig ?? {
    versionField: "pnpmVersion",
    version: "11.0.6",
  };
  const packageJson = options.packageJson ?? `{
  "name": "test-app",
  "version": "1.0.0"
}`;
  const rushConfig = {
    $schema: "https://developer.microsoft.com/json-schemas/rush/v5/rush.schema.json",
    rushVersion: "5.175.1",
    [packageManagerConfig.versionField]: packageManagerConfig.version,
    nodeSupportedVersionRange: ">=18.0.0",
    projectFolderMinDepth: 1,
    projectFolderMaxDepth: 2,
    gitPolicy: {},
    repository: {
      url: "https://example.com/testapp.git",
      defaultBranch: "main",
    },
    eventHooks: {
      preRushInstall: [],
      postRushInstall: [],
      preRushBuild: [],
      postRushBuild: [],
    },
    projects: [
      {
        packageName: "test-app",
        projectFolder: "apps/test-app",
      },
    ],
  };

  await shell.runCommand("rm -rf /testapp/common /testapp/apps/test-app");
  await shell.runCommand("mkdir -p /testapp/apps/test-app");
  await writeTextFile(shell, "/testapp/rush.json", JSON.stringify(rushConfig, null, 2));
  await writeTextFile(shell, "/testapp/apps/test-app/package.json", packageJson);
}

async function writeTextFile(shell, filePath, content) {
  const encoded = Buffer.from(content).toString("base64");
  await shell.runCommand(`printf '%s' '${encoded}' | base64 -d > ${filePath}`);
}
