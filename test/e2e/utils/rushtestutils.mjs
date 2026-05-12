// Helpers for the Rush E2E suites.
//
// What these suites actually test: that safe-chain's shim intercepts `rush`
// and `rushx` invocations correctly. The contents of `rush.json` are just
// fixture noise needed to make Rush run at all — Rush's schema requires
// exact semver for `rushVersion`/`pnpmVersion` and refuses dist-tags like
// "latest", so we resolve those once per suite.
//
//   * `rushVersion` is read from the `rush` binary baked into the image
//     (Dockerfile installs `@microsoft/rush@${RUSH_VERSION:-latest}`).
//   * `pnpmVersion` is pinned to a known-good pnpm 9 release. Rush downloads
//     this internally into `~/.rush/...`; it's unrelated to the system
//     pnpm exercised by the pnpm e2e suite.

const PINNED_PNPM_VERSION = "9.15.9";

/** Resolves the versions to put into `rush.json`. */
export async function resolveRushVersions(shell) {
  return {
    rushVersion: await getInstalledRushVersion(shell),
    pnpmVersion: PINNED_PNPM_VERSION,
  };
}

/** Builds the standard `rush.json` body for the e2e fixtures. */
export function buildRushConfig({ rushVersion, pnpmVersion, projects }) {
  return {
    $schema:
      "https://developer.microsoft.com/json-schemas/rush/v5/rush.schema.json",
    rushVersion,
    pnpmVersion,
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
    projects: projects ?? [
      { packageName: "test-app", projectFolder: "apps/test-app" },
    ],
  };
}

/**
 * Writes a UTF-8 text file inside the container, base64-encoding the payload
 * to avoid shell escaping issues for arbitrary content.
 */
export async function writeTextFile(shell, filePath, content) {
  const encoded = Buffer.from(content).toString("base64");
  await shell.runCommand(`printf '%s' '${encoded}' | base64 -d > ${filePath}`);
}

async function getInstalledRushVersion(shell) {
  const { output } = await shell.runCommand("rush --version");
  const match = output.match(/\b(\d+\.\d+\.\d+)\b/);
  if (!match) {
    throw new Error(
      `Could not determine installed Rush version. Output was:\n${output}`
    );
  }
  return match[1];
}
