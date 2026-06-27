/**
 * Shell plugin mode configuration — safe (read-only) vs power (full allowlist + sessions).
 */

const SAFE_ALLOWLIST =
  "ls,cat,echo,grep,find,head,tail,wc,stat,du,df,ps,uname,whoami,pwd,git";

const POWER_DEFAULT_ALLOWLIST =
  "ls,cat,echo,grep,find,head,tail,wc,stat,du,df,ps,uname,whoami,pwd,mkdir,cp,mv,git,npm,node,python,python3,pip,which,whereis,date,uptime,curl,wget,jq,sed,awk,sort,uniq,cut,tr,xargs,diff,tar,zip,unzip,touch,file,env,printenv,test";

const SAFE_OPERATOR_PATTERNS = [
  /\|/,
  /&&/,
  /\|\|/,
  /;/,
  />/,
  /</,
  /\$\(/,
  /`/,
];

/**
 * @returns {"safe"|"power"}
 */
export function getShellMode() {
  const raw = (process.env.SHELL_MODE || "").trim().toLowerCase();
  if (raw === "power") return "power";
  if (raw === "safe") return "safe";
  return process.env.NODE_ENV === "production" ? "safe" : "power";
}

export function isSafeShellMode() {
  return getShellMode() === "safe";
}

export function getShellAllowlistSet() {
  const mode = getShellMode();
  const custom = process.env.SHELL_ALLOWLIST?.trim();
  if (custom) {
    return new Set(
      custom
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    );
  }
  const list = mode === "safe" ? SAFE_ALLOWLIST : POWER_DEFAULT_ALLOWLIST;
  return new Set(
    list
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function shellSessionsEnabled() {
  return getShellMode() === "power";
}

export function shellBackgroundEnabled() {
  return getShellMode() === "power";
}

export function shellStreamingEnabled() {
  return getShellMode() === "power";
}

/**
 * @param {string} command
 * @returns {string|null} error message or null if ok
 */
export function checkSafeModeOperators(command) {
  if (!isSafeShellMode()) return null;
  for (const re of SAFE_OPERATOR_PATTERNS) {
    if (re.test(command)) {
      return "Shell operators (pipes, redirects, substitution) are blocked in safe mode";
    }
  }
  return null;
}
