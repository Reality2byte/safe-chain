import { describe, it, before, beforeEach, afterEach } from "node:test";
import { DockerTestContainer } from "./DockerTestContainer.js";
import {
  buildRushConfig,
  resolveRushVersions,
  writeTextFile,
} from "./utils/rushtestutils.mjs";
import assert from "node:assert";

// These tests cover safe-chain's Rush wrapper: pre-scanning `rush add` and
// blocking malicious packages downloaded during `rush update` via the MITM
// proxy. They use a single Rush-internal package manager (pnpm) — see
// `utils/rushtestutils.mjs` for why this suite isn't parameterised over the
// CI matrix's NPM_VERSION/PNPM_VERSION/YARN_VERSION values.

describe("E2E: rush coverage", () => {
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

  it("safe-chain proxy blocks malicious package downloads during rush update", async () => {
    const shell = await container.openShell("zsh");
    await setupRushWorkspace(shell, {
      resolvedVersions,
      packageJson: `{
  "name": "test-app",
  "version": "1.0.0",
  "dependencies": {
    "safe-chain-test": "0.0.1-security"
  }
}`,
    });

    // `--safe-chain-skip-minimum-package-age` is needed because Rush's
    // internal pnpm bootstrap (`npm install pnpm@<resolvedVersion>`) goes
    // through the safe-chain proxy. When the CI matrix selects pnpm
    // `latest`, the just-released version can be below the minimum age
    // threshold and Rush's install would otherwise be blocked before our
    // malicious-download assertion is reached.
    const result = await shell.runCommand(
      "cd /testapp/apps/test-app && rush update --safe-chain-skip-minimum-package-age"
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

async function setupRushWorkspace(shell, { resolvedVersions, packageJson }) {
  const rushConfig = buildRushConfig({
    rushVersion: resolvedVersions.rushVersion,
    pnpmVersion: resolvedVersions.pnpmVersion,
  });

  await shell.runCommand("rm -rf /testapp/common /testapp/apps/test-app");
  await shell.runCommand("mkdir -p /testapp/apps/test-app");
  await writeTextFile(
    shell,
    "/testapp/rush.json",
    JSON.stringify(rushConfig, null, 2)
  );
  await writeTextFile(
    shell,
    "/testapp/apps/test-app/package.json",
    packageJson ??
      `{
  "name": "test-app",
  "version": "1.0.0"
}`
  );
}
