/**
 * Inject paired sidecar device metadata into tool execution context (V10 capability guard).
 */

import { getDefaultSidecarDevice, isLocalFsOnServer } from "./pairing.service.js";

/**
 * @param {object} context
 * @returns {Promise<object>}
 */
export async function enrichSidecarToolContext(context = {}) {
  if (context.sidecarCapabilities || isLocalFsOnServer()) return context;

  const device = await getDefaultSidecarDevice();
  if (!device) return context;

  return {
    ...context,
    sidecarCapabilities: device.capabilities || ["fs"],
    sidecarDeviceId: device.id,
    sidecarBaseUrl: device.baseUrl,
  };
}
