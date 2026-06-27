/**
 * V10 — Sidecar terminal safe / power modes (mirrors shell plugin model).
 */

const SAFE_ALLOWLIST =
  "ls,cat,echo,grep,find,head,tail,wc,pwd,git,stat,du,df,ps,whoami,uname,date,which,file";

const POWER_EXTRA =
  "npm,node,python,python3,pip,curl,wget,mkdir,cp,mv,touch,env,printenv,jq,sed,awk,sort,uniq,diff,tar,zip,unzip";

const SAFE_OPERATOR_PATTERNS = [/\|/, /&&/, /\|\|/, /;/, />/, /</, /\$\(/, /`/];

const POWER_COMMANDS = new Set(
  "npm,node,python,python3,pip,curl,wget,docker,kill,env,printenv".split(",").map((s) => s.trim())
);

/**
 * @returns {"safe"|"power"}
 */
export function getSidecarTerminalMode() {
  const raw = (process.env.SIDECAR_TERMINAL_MODE || "").trim().toLowerCase();
  if (raw === "power") return "power";
  if (raw === "safe") return "safe";
  return process.env.NODE_ENV === "production" ? "safe" : "power";
}

export function isSidecarTerminalSafeMode() {
  return getSidecarTerminalMode() === "safe";
}

export function getSidecarTerminalAllowlistSet() {
  const custom = process.env.SIDECAR_TERMINAL_ALLOWLIST?.trim();
  if (custom) {
    return new Set(
      custom
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    );
  }
  const mode = getSidecarTerminalMode();
  const list = mode === "safe" ? SAFE_ALLOWLIST : `${SAFE_ALLOWLIST},${POWER_EXTRA}`;
  return new Set(
    list
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function sidecarTerminalSessionsEnabled() {
  return getSidecarTerminalMode() === "power";
}

/**
 * @param {string} command
 * @returns {string|null}
 */
export function checkSidecarSafeModeOperators(command) {
  if (!isSidecarTerminalSafeMode()) return null;
  for (const re of SAFE_OPERATOR_PATTERNS) {
    if (re.test(command)) {
      return "Shell operators are blocked in sidecar safe mode";
    }
  }
  return null;
}

/**
 * @param {string} command
 * @returns {boolean}
 */
export function isSidecarPowerCommand(command) {
  const first = String(command || "")
    .trim()
    .split(/\s+/)[0]
    ?.replace(/^.*\//, "")
    .toLowerCase();
  return POWER_COMMANDS.has(first);
}

/** @internal */
export function resetSidecarTerminalConfigForTests() {
  delete process.env.SIDECAR_TERMINAL_MODE;
  delete process.env.SIDECAR_TERMINAL_ALLOWLIST;
}
