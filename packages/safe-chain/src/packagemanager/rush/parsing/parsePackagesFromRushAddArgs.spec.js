import { describe, it } from "node:test";
import assert from "node:assert";
import { parsePackagesFromRushAddArgs } from "./parsePackagesFromRushAddArgs.js";

describe("parsePackagesFromRushAddArgs", () => {
  it("returns an empty array when no packages are provided", () => {
    const result = parsePackagesFromRushAddArgs([]);

    assert.deepEqual(result, []);
  });

  it("parses packages from --package arguments", () => {
    const result = parsePackagesFromRushAddArgs([
      "--package",
      "axios@1.9.0",
      "--package",
      "@scope/tool@2.0.0",
    ]);

    assert.deepEqual(result, [
      { name: "axios", version: "1.9.0" },
      { name: "@scope/tool", version: "2.0.0" },
    ]);
  });

  it("parses packages from -p arguments", () => {
    const result = parsePackagesFromRushAddArgs(["-p", "axios"]);

    assert.deepEqual(result, [{ name: "axios", version: null }]);
  });

  it("parses packages from --package=value arguments", () => {
    const result = parsePackagesFromRushAddArgs(["--package=axios@^1.9.0"]);

    assert.deepEqual(result, [{ name: "axios", version: "^1.9.0" }]);
  });

  it("ignores positional packages because rush add requires --package", () => {
    const result = parsePackagesFromRushAddArgs(["axios", "--dev"]);

    assert.deepEqual(result, []);
  });

  it("parses aliases", () => {
    const result = parsePackagesFromRushAddArgs(["--package", "server@npm:axios@1.9.0"]);

    assert.deepEqual(result, [{ name: "axios", version: "1.9.0" }]);
  });
});
