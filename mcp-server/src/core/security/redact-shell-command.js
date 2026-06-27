/**
 * Redact secrets from shell commands before audit logging.
 */

const REDACTION_PATTERNS = [
  [/(--password|--pass|--token|--api-key)\s+\S+/gi, "$1 ***"],
  [/\b(password|passwd|token|secret|apikey|api_key)\s*=\s*\S+/gi, "$1=***"],
  [/\bAuthorization:\s*Bearer\s+\S+/gi, "Authorization: Bearer ***"],
  [/\bsk-[a-zA-Z0-9_-]{10,}/g, "sk-***"],
  [/\bghp_[a-zA-Z0-9]{20,}/g, "ghp_***"],
  [/\bgho_[a-zA-Z0-9]{20,}/g, "gho_***"],
  [/\bxox[baprs]-[a-zA-Z0-9-]{10,}/g, "xox***"],
  [/(mongodb(\+srv)?:\/\/)[^\s]+/gi, "$1***"],
  [/(postgres(ql)?:\/\/)[^\s]+/gi, "$1***"],
  [/(mysql:\/\/)[^\s]+/gi, "$1***"],
];

/**
 * @param {string} command
 * @returns {string}
 */
export function redactShellCommand(command) {
  if (!command || typeof command !== "string") return command;
  let out = command;
  for (const [re, repl] of REDACTION_PATTERNS) {
    out = out.replace(re, repl);
  }
  return out;
}
