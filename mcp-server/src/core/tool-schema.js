/**
 * Shared tool inputSchema helpers for write/destructive tools.
 */

import { isStrictToolSchema } from "./plugin-strict.js";

export const EXPLANATION_FIELD = {
  type: "string",
  description: "Human-readable reason for invoking this write/destructive tool (audit trail)",
};

const WRITE_TAGS = new Set(["write", "destructive", "WRITE", "DESTRUCTIVE"]);

/**
 * @param {Object} tool
 * @returns {boolean}
 */
export function isWriteOrDestructiveTool(tool) {
  const tags = tool.tags || [];
  return tags.some((tag) => WRITE_TAGS.has(tag));
}

/**
 * Ensure write/destructive tools expose an explanation field in inputSchema.
 * In strict mode, explanation becomes required.
 * @param {Object} tool
 * @returns {Object}
 */
export function ensureWriteToolExplanation(tool) {
  if (!isWriteOrDestructiveTool(tool)) {
    return tool;
  }

  const inputSchema =
    tool.inputSchema && typeof tool.inputSchema === "object"
      ? { ...tool.inputSchema }
      : { type: "object", properties: {} };

  const properties = { ...(inputSchema.properties || {}) };
  if (!properties.explanation) {
    properties.explanation = { ...EXPLANATION_FIELD };
  }

  inputSchema.properties = properties;
  inputSchema.type = inputSchema.type || "object";

  if (isStrictToolSchema()) {
    const required = new Set(inputSchema.required || []);
    required.add("explanation");
    inputSchema.required = [...required];
  }

  return { ...tool, inputSchema };
}
