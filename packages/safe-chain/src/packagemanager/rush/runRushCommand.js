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
    const result = await safeSpawn(executableName, args, {
      stdio: "inherit",
      env: mergeSafeChainProxyEnvironmentVariables(process.env),
    });

    return { status: result.status };
  } catch (/** @type any */ error) {
    return reportCommandExecutionFailure(error, executableName);
  }
}
