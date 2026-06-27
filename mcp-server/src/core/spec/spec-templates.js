/**
 * V8 Faz C — spec workflow artifact templates (Felix-authored).
 */

export const SPEC_STAGES = ["requirements", "design", "tasks", "complete"];

/**
 * @param {string} stage
 * @param {{ title?: string; idea?: string }} ctx
 */
export function buildStageSkeleton(stage, ctx = {}) {
  const title = ctx.title || "Feature";
  const idea = ctx.idea || "";

  switch (stage) {
    case "requirements":
      return `# ${title} — Requirements

## Idea
${idea}

## Scope
- [ ] Define in-scope / out-of-scope

## User stories
- As a user, I want … so that …

## Acceptance criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Open questions
- `;

    case "design":
      return `# ${title} — Design

## Architecture
- Components affected:
- Data flow:

## Risks
- 

## Dependencies
- 

## API / UI notes
- `;

    case "tasks":
      return `# ${title} — Tasks

## Phase 1 — Backend
- [ ] Task 1

## Phase 2 — Frontend
- [ ] Task 1

## Phase 3 — Tests & docs
- [ ] Tests
- [ ] Docs

## Verification
- [ ] Manual test steps
`;

    default:
      return "";
  }
}

/**
 * Parse markdown checkbox tasks for workflow draft.
 * @param {string} markdown
 */
export function parseTasksFromMarkdown(markdown) {
  const tasks = [];
  const re = /^-\s+\[\s*\]\s+(.+)$/gm;
  let match;
  while ((match = re.exec(markdown || "")) !== null) {
    tasks.push({ title: match[1].trim(), done: false });
  }
  return tasks;
}

/**
 * @param {{ title: string; artifacts: Record<string, { content: string }> }} session
 */
export function buildWorkflowDraftFromSpec(session) {
  const tasksMd = session.artifacts?.tasks?.content || "";
  const parsed = parseTasksFromMarkdown(tasksMd);
  return {
    name: `spec-${session.title || "feature"}`.slice(0, 80),
    description: `Draft from spec session ${session.id}`,
    parameters: [{ name: "featureName", type: "string", default: session.title || "feature" }],
    steps: parsed.slice(0, 12).map((t, i) => ({
      type: "tool",
      name: `task-${i + 1}`,
      toolName: "repo_analyze",
      args: { explanation: `Spec task: ${t.title}` },
    })),
    taskCount: parsed.length,
  };
}
