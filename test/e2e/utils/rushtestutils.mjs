// Helpers for the Rush E2E suites.
//
// What these suites actually test: that safe-chain's shim intercepts `rush`
// and `rushx` invocations correctly. The contents of `rush.json` are just
// fixture noise needed to make Rush run at all — Rush's schema requires
// exact semver for `rushVersion`/`pnpmVersion` and refuses dist-tags like
// "latest", so we read both back from the binaries baked into the image.
//
//   * `rushVersion` ← `rush --version` (image installs
//     `@microsoft/rush@${RUSH_VERSION:-latest}`).
//   * `pnpmVersion` ← `pnpm --version` (image installs
//     `pnpm@${PNPM_VERSION:-latest}`). Rush downloads its own copy of this
//     into `~/.rush/...`; using the same exact version as the system pnpm
//     just keeps the fixture in lockstep with whatever the CI matrix picks.

/** Resolves the versions to put into `rush.json`. */
export async function resolveRushVersions(shell) {
  // Sequential: the helper drives a single PTY shell.
  const rushVersion = await getInstalledVersion(shell, "rush");
  const pnpmVersion = await getInstalledVersion(shell, "pnpm");
  return { rushVersion, pnpmVersion };
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

async function getInstalledVersion(shell, command) {
  const { output } = await shell.runCommand(`${command} --version`);
  const match = output.match(/\b(\d+\.\d+\.\d+)\b/);
  if (!match) {
    throw new Error(
      `Could not determine installed ${command} version. Output was:\n${output}`
    );
  }
  return match[1];
}
