/**
 * @param {string[]} args
 * @returns {{name: string, version: string | null}[]}
 */
export function parsePackagesFromRushAddArgs(args) {
  const packageSpecs = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) {
      continue;
    }

    if (arg === "--package" || arg === "-p") {
      const next = args[i + 1];
      if (next && !next.startsWith("-")) {
        packageSpecs.push(next);
        i += 1;
      }
      continue;
    }

    if (arg.startsWith("--package=")) {
      const value = arg.slice("--package=".length);
      if (value) {
        packageSpecs.push(value);
      }
    }
  }

  return packageSpecs
    .map((spec) => parsePackageSpec(spec))
    .filter((spec) => spec !== null);
}

/**
 * @param {string} spec
 * @returns {{name: string, version: string | null} | null}
 */
function parsePackageSpec(spec) {
  const value = removeAlias(spec.trim());
  if (!value) {
    return null;
  }

  const lastAtIndex = value.lastIndexOf("@");
  if (lastAtIndex > 0) {
    return {
      name: value.slice(0, lastAtIndex),
      version: value.slice(lastAtIndex + 1),
    };
  }

  return {
    name: value,
    version: null,
  };
}

/**
 * @param {string} spec
 * @returns {string}
 */
function removeAlias(spec) {
  const aliasIndex = spec.indexOf("@npm:");
  if (aliasIndex !== -1) {
    return spec.slice(aliasIndex + 5);
  }

  return spec;
}
