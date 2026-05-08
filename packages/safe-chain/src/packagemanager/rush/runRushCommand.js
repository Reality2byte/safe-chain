import { mergeSafeChainProxyEnvironmentVariables } from "../../registryProxy/registryProxy.js";
import { safeSpawn } from "../../utils/safeSpawn.js";
import { reportCommandExecutionFailure } from "../_shared/commandErrors.js";

/**
 * @param {"rush" | "rushx"} executableName
 * @param {string[]} args
 * @returns {Promise<{status: number}>}
 */
export async function runRushCommand(executableName, args) {
  try {
    const env = prepareRushEnvironmentVariables(
      mergeSafeChainProxyEnvironmentVariables(process.env),
    );

    const result = await safeSpawn(executableName, args, {
      stdio: "inherit",
      env,
    });

    return { status: result.status };
  } catch (/** @type any */ error) {
    return reportCommandExecutionFailure(error, executableName);
  }
}

/**
 * @param {Record<string, string>} env
 * @returns {Record<string, string>}
 */
function prepareRushEnvironmentVariables(env) {
  const prepared = {
    ...env,
  };

  if (prepared.HTTPS_PROXY && !prepared.HTTP_PROXY) {
    prepared.HTTP_PROXY = prepared.HTTPS_PROXY;
  }

  return prepared;
}
