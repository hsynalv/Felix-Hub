/**
 * V8 Faz B — agent loop contract (observe → plan → act → wait → reflect → stop).
 */

/** @type {readonly string[]} */
export const AGENT_LOOP_PHASES = ["observe", "plan", "act", "wait", "reflect", "stop"];

export const AGENT_LOOP_FLOW_SECTION = `## Agent loop (each user message)
Work in this cycle — do not skip **reflect** before starting another tool round:

1. **observe** — read user message, Brain/Project context, and tool planning hints.
2. **plan** — decide if tools are needed; pick intent-aligned tools; read before write.
3. **act** — call the smallest sufficient tool set (avoid duplicate calls).
4. **wait** — if approval or async job is required, pause until resolved.
5. **reflect** — synthesize a clear answer from tool results; cite sources.
6. **stop** — end the turn when the user question is answered; do not loop the same tool.

After **reflect**, if no new user input is needed, **stop** — do not call more tools.`;

/**
 * @returns {{ current: string; history: string[] }}
 */
export function createAgentLoopState() {
  return { current: "observe", history: ["observe"] };
}

/**
 * @param {{ agentLoop?: { current: string; history: string[] } }} context
 * @param {string} phase
 */
export function setAgentLoopPhase(context, phase) {
  if (!AGENT_LOOP_PHASES.includes(phase)) return;
  if (!context.agentLoop) context.agentLoop = createAgentLoopState();
  context.agentLoop.current = phase;
  context.agentLoop.history.push(phase);
}

/**
 * @param {{ agentLoop?: { current: string; history: string[] } }} context
 */
export function getAgentLoopSnapshot(context) {
  const state = context.agentLoop || createAgentLoopState();
  return {
    phase: state.current,
    history: [...state.history],
  };
}

/**
 * Short hint for injected context (turn start).
 * @param {string} [phase]
 */
export function buildAgentLoopHint(phase = "observe") {
  return `_Agent loop: currently in **${phase}** phase._`;
}
