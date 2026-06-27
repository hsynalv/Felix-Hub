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

/** Read-only git subcommands allowed in safe mode (binary allowlist is not enough). */
const SAFE_GIT_SUBCOMMANDS = new Set([
  "status",
  "diff",
  "log",
  "show",
  "branch",
  "rev-parse",
  "describe",
  "shortlog",
]);

const BLOCKED_GIT_SUBCOMMANDS = new Set([
  "config",
  "remote",
  "push",
  "pull",
  "fetch",
  "clone",
  "submodule",
  "update",
  "checkout",
  "switch",
  "reset",
  "rebase",
  "merge",
  "commit",
  "add",
  "apply",
  "am",
  "cherry-pick",
  "init",
  "gc",
  "filter-branch",
  "hook",
  "send-email",
  "daemon",
  "upload-pack",
  "receive-pack",
]);

/**
 * Safe mode: restrict `git` to read-only subcommands (status, diff, log, …).
 * @param {string} command
 * @returns {string|null}
 */
export function checkSafeGitSubcommand(command) {
  if (!isSafeShellMode()) return null;
  const trimmed = command.trim();
  if (!/^git\b/i.test(trimmed)) return null;

  if (/\bgit\s+(-C|--work-tree|--git-dir)\s+\S+/i.test(trimmed)) {
    // -C is allowed only with read subcommands; validated below via subcommand
  }

  const parts = trimmed.split(/\s+/);
  let i = 1;
  while (i < parts.length) {
    const p = parts[i];
    if (p === "-C" || p === "-c" || p === "--work-tree" || p === "--git-dir") {
      i += 2;
      continue;
    }
    if (p.startsWith("-")) {
      i += 1;
      continue;
    }
    break;
  }

  const sub = parts[i]?.toLowerCase();
  if (!sub) {
    return "Git command requires a subcommand in safe mode";
  }

  if (sub === "branch" && /\s(-D|-d|-m|--delete|--move|-M)\b/i.test(trimmed)) {
    return "git branch write operations are blocked in safe mode";
  }

  if (sub === "stash") {
    if (!/^git(\s+\S+)*\s+stash\s+(list|show)\b/i.test(trimmed)) {
      return "Only git stash list/show allowed in safe mode";
    }
    return null;
  }

  if (BLOCKED_GIT_SUBCOMMANDS.has(sub)) {
    return `git ${sub} is blocked in safe mode`;
  }

  if (!SAFE_GIT_SUBCOMMANDS.has(sub)) {
    return `git ${sub} is not in safe-mode subcommand allowlist`;
  }

  return null;
}

/** Power mode is admin-only — full allowlist + shell:true spawn. */
export function isPowerShellMode() {
  return getShellMode() === "power";
}

/**
 * HTTP / tool scope required for shell write operations.
 * @returns {"read"|"write"|"admin"}
 */
export function shellWriteRequiredScope() {
  return isPowerShellMode() ? "admin" : "write";
}

/**
 * @param {string[]} scopes
 * @returns {string|null}
 */
export function checkPowerShellAdminScope(scopes) {
  if (!isPowerShellMode()) return null;
  const rank = { read: 0, write: 1, admin: 2 };
  let max = -1;
  for (const s of scopes || []) {
    const n = String(s).toLowerCase() === "danger" ? "admin" : String(s).toLowerCase();
    if (rank[n] !== undefined && rank[n] > max) max = rank[n];
  }
  if (max < rank.admin) {
    return "Power shell mode requires admin scope and explicit policy approval";
  }
  return null;
}
