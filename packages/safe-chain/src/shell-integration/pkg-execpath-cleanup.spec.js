import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");

describe("PKG_EXECPATH cleanup", () => {
  it("unix shim template unsets PKG_EXECPATH before invoking safe-chain", () => {
    const file = path.join(
      repoRoot,
      "src/shell-integration/path-wrappers/templates/unix-wrapper.template.sh",
    );
    const content = fs.readFileSync(file, "utf-8");
    assert.match(
      content,
      /unset PKG_EXECPATH[\s\S]*exec safe-chain/,
      "unix-wrapper.template.sh must `unset PKG_EXECPATH` before `exec safe-chain`",
    );
  });

  it("posix shell function unsets PKG_EXECPATH before invoking safe-chain", () => {
    const file = path.join(
      repoRoot,
      "src/shell-integration/startup-scripts/init-posix.sh",
    );
    const content = fs.readFileSync(file, "utf-8");
    // Scoped subshell so we don't mutate the user's interactive env.
    assert.match(
      content,
      /\(unset PKG_EXECPATH;\s*safe-chain "\$@"\)/,
      "init-posix.sh must invoke safe-chain in a subshell that unsets PKG_EXECPATH",
    );
  });

  it("fish shell function unsets PKG_EXECPATH before invoking safe-chain", () => {
    const file = path.join(
      repoRoot,
      "src/shell-integration/startup-scripts/init-fish.fish",
    );
    const content = fs.readFileSync(file, "utf-8");
    assert.match(
      content,
      /env -u PKG_EXECPATH safe-chain/,
      "init-fish.fish must invoke safe-chain via `env -u PKG_EXECPATH`",
    );
  });

  it("safe-chain entry point deletes PKG_EXECPATH from process.env", () => {
    const file = path.join(repoRoot, "bin/safe-chain.js");
    const content = fs.readFileSync(file, "utf-8");
    assert.match(
      content,
      /delete process\.env\.PKG_EXECPATH/,
      "bin/safe-chain.js must delete process.env.PKG_EXECPATH so spawned children don't inherit it",
    );
  });
});
