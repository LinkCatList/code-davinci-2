## Project Session Naming Helper

If the user asks how to name a project session, create a new session, use the current one, rename the current one, or asks a similar question — help choose a short name and immediately provide the ready-to-run command for pi.

If a new session needs to be created:

```text
/new
/name <session-name>
```

If the current session should be used but renamed:

```text
/name <session-name>
```

Examples of good session names:

```text
CRS-555 - fix fee calculation on withdrawal
VOCALAI-1234 - add phone number validation
RD-281 - sync stage with main
NOTIX-42 - fix Telegram authentication
COIN-77 - optimize wave animation
```

The name should be short, clear, and preferably start with the ticket number if there is one.

- do not write tests unless asked to;
- do not make decisions on your own; it is better to clarify once more.

## Project Conventions First

When the user asks about local project conventions, such as `commit message` style, naming, file structure, or established patterns, first inspect the actual artifacts of this project.
For conventions related to git, rely on the actual history of this repository rather than general practices or assumptions.
If the project artifacts do not provide enough evidence to determine a convention confidently, say so explicitly and do not invent a rule.

## Bug Reproduction First

The user prefers bug work to begin with actual reproduction on the current version.
First verify the bug against the current code and record the observed behavior, and only then discuss or propose a fix.
If the bug cannot be reproduced now, explicitly state what prevents reproduction.

### Bug Reproduction Method

When working on a bug, first reproduce it on the current version using the method that is closest to the real user scenario in this project.

Priority of reproduction methods:

1. The same user scenario and entry point where the bug was observed.
2. A minimal local reproducible scenario in the current application.
3. For backend/API bugs — a canonical HTTP repro (`curl`/HTTP sequence), if it fully covers the bug; such requests can and should be saved to files so they are easy to rerun and use to verify the fix.
4. For frontend/UI bugs — reproduce through the real interface with exact steps; use Playwright MCP when necessary.

### Playwright MCP (Telegram Web)

Project MCP: `opencode.json` → `playwright`. Restart opencode after changing the config.
Login profile: `.playwright/telegram-profile` (not in git). The first time, open `https://web.telegram.org/k/` in a headed browser and log in; afterward, the session persists between runs.
For bot bugs, reproduce the scenario in Telegram Web rather than replacing it with code inspection. Do not close the browser between steps of the same scenario.
5. If a bug cannot be honestly reproduced locally, explicitly state what is blocking reproduction, which data, access, or environment is missing, and do not move on to discussing a fix as if the cause were confirmed.

Do not replace real reproduction with indirect guesses, code inspection, or an assumed cause.

### Tight Feedback Loop

Before analyzing the cause, establish one reproducible way to verify the symptom:

- it goes through the real user scenario;
- it checks the exact reported symptom;
- it can fail before the fix and pass after the fix;
- it runs quickly and deterministically.

This can be a Playwright scenario, curl sequence, CLI command, or test. `lint` and `typecheck` by themselves do not count as a feedback loop for a behavioral bug.

If such a loop cannot be created, explicitly record the blocker and do not present a hypothesis as a confirmed cause.

## Deep Curl Workflow

**Trigger phrase:** "deep curl", "let's do deep curl", "start with deep curl"

Always follow this structured workflow before "deep plan" when a bug can be reliably reproduced with HTTP requests, unless the user explicitly says to skip it.

### Entry Criteria

Use "deep curl" for:

- API bugs
- backend validation issues
- auth/session issues reproducible over HTTP
- integration bugs that can be isolated with HTTP requests

Skip "deep curl" if:

- the bug cannot be reproduced reliably with HTTP requests alone
- the user explicitly says to skip "deep curl"

### Workflow

1. Start from reproduction first — do not discuss fixes before the bug is reproduced
2. Define reproduction preconditions: environment, auth, required entities, headers, feature flags, and request order
3. Write `curl` requests that reliably reproduce the bug
4. Find the minimal repro request or minimal repro sequence
5. Capture the canonical repro set and do not change it during the task unless the user agrees
6. For each repro request, document:
   - method, URL, headers, query params, and body
   - expected result
   - actual result
   - status code and key response details
7. Separate the requests into:
   - minimal repro
   - edge cases / nearby variants
8. Ask the user to verify that the repro matches the real bug before moving to solution design
9. Only after reproduction is confirmed, move to root-cause analysis
10. Only after reproduction is confirmed, move to "deep plan"
11. During "deep plan", use the approved canonical repro set as the main verification baseline
12. After implementation, rerun the exact same minimal repro request or sequence in the same conditions
13. Then rerun the edge-case requests to verify the fix is not narrow
14. Confirm the original bug no longer reproduces and the covered edge cases behave as expected before reporting the task as done
15. After implementation — ask: "Run a deep review?"

### Output format

- Preconditions
- Reproduction requests
- Expected vs actual behavior
- Open questions
- Then "deep plan"
- After implementation — rerun the same requests and report the results
- At the very end — ask whether the user wants to see the important parts of the real responses from the verification rerun

## Deep Plan Workflow

**Trigger phrase:** "deep plan", "let's do deep plan", "follow our workflow"

Always follow this structured workflow for non-trivial tasks unless the user explicitly asks for a faster lightweight approach.

### Entry Criteria

Use "deep plan" for:

- non-trivial features
- bug fixes with multiple possible causes or affected areas
- refactors that change behavior, contracts, or structure
- tasks with unclear requirements, edge cases, or tradeoffs

Skip "deep plan" for:

- tiny isolated changes
- straightforward text/content fixes
- simple mechanical edits with no meaningful product or architectural decisions

### Workflow

1. Start with deep analysis of the existing code, architecture, and affected flows
2. Define the current behavior, the target behavior, and the real problem being solved
3. Identify gaps, edge cases, constraints, dependencies, and open questions
4. Ask clarifying questions before making decisions — never assume when the answer changes scope, UX, or architecture
5. If the task is a bug and it can be reliably reproduced with HTTP requests, use "deep curl" before "deep plan" unless the user explicitly says to skip it
6. During "deep plan", ask whether a separate plan file should be created; propose a save path; write such plans in Russian as separate Markdown files; if `.temp/<task>/` exists, save the plan there. This question is blocking: keep asking until the user gives an explicit yes/no answer before proceeding.
7. Before writing the plan, apply a simplification gate:
   - can part of the requirement be removed;
   - is there already a suitable helper, component, or pattern;
   - can the task be solved using the existing library or platform;
   - what is the minimum set of files and changes that is actually needed.

   Explicitly state in the plan what is intentionally not being done.
8. Build a detailed implementation plan before writing code
9. Get user approval on the plan before implementation
10. After a non-trivial plan is approved, check whether it contains several independent, verifiable slices. If yes, ask: "Plan approved. I see several independent slices. Should I split it into slices/subtasks and record them in separate files?" For small tasks and plans with one goal, do not ask this question; state that decomposition is not needed.
11. If the user agrees to decomposition, treat the words "slices", "sub-slices", "subtasks", and "subtasks" as synonyms. If a plan file was created, record each slice in a separate file under `.temp/<task>/slices/NN-<slug>.md`, and keep the list of links and dependencies in `deep-plan.md`. Each slice must have one verifiable goal, dependencies, context, scope, non-goals, acceptance criteria, and a verification method. If no plan file was created, first show the decomposition in chat and do not create files without a separate request. If the user declines, continue implementing the approved plan without decomposition.

   A slice is not a separate technical step and not every checklist item. Combine small steps into one slice when they solve the same user goal, affect one flow or a related set of files, have no independent demonstration or verification, are performed by one owner, and gain no benefit from parallel execution. Changes to TSX, SCSS, localization, and typecheck are usually one slice. Split tasks when they have different user outcomes, independent dependencies, different verification methods, or can be executed in parallel. A slice should be large enough to produce an independent result and small enough to be executed and verified separately.
12. Implement only the approved scope. The approved plan and the original request are the scope boundary. If a new feature, API change, file, or behavior outside that boundary appears during implementation, stop and request approval.
13. If scope changes during implementation, stop, explain the delta, and get approval before continuing
14. Run the minimal relevant verification for the task: typecheck if applicable, plus any task-specific checks that actually validate the change
15. After implementation — ask: "Run a deep review?" before reporting the task as done

### Confidence Requirement

Every "deep plan" must include a confidence assessment before implementation approval:

- `Plan confidence: NN%` — confidence that the plan is complete, technically sound, and covers the known requirements, constraints, edge cases, and affected areas.
- `Implementation confidence: NN%` — confidence that the implementation can be completed within the approved plan without major scope changes or unknown blockers.

Confidence must be based on concrete evidence: files inspected, flows analyzed, repro results if any, known contracts, and available verification steps.

Do not use `100%` unless the task is trivial and fully deterministic. If either confidence is below `90%`, explicitly list what reduces confidence and what information, checks, or decisions would raise it before implementation.

### Required Plan Output

Every "deep plan" must include:

- problem statement
- current behavior
- target behavior
- open questions
- constraints and non-goals
- affected areas
- UX states if relevant
- data flow / API / state mapping if relevant
- implementation steps
- verification steps
- risks and edge cases
- confidence assessment: plan confidence %, implementation confidence %, and reasons for any uncertainty

### Output format

- Analysis first
- Then open questions
- Then confidence assessment
- Then the proposed plan
- No code before plan approval

## Deep Review

**Trigger phrase:** "deep review", "run a review"

Standalone review process — can be called independently or after "deep plan" implementation.

### Scope

- changed files from `git diff`, OR
- specific files/components the user points to, OR
- the implemented scope against the approved plan

### Review Rules

Before other review checks, verify scope compliance:

- is everything from the approved plan implemented;
- are there any unnecessary changes;
- has any behavior changed that the user did not ask to change.

Explicitly flag unnecessary changes as scope creep.

1. Findings come first, ordered by severity
2. Check only categories relevant to the task — do not force irrelevant frontend or backend checks
3. If a plan exists, verify full plan compliance:
   - nothing missed
   - nothing extra added without approval
4. If "deep curl" was used, verify that the original repro and covered edge cases are still closed
5. Fix critical bugs immediately only in your own fresh changes when the fix is small and clearly within scope
6. Otherwise report findings and ask before expanding scope
7. If no findings exist, say so explicitly
8. Always mention residual risks, unverified areas, or checks that were not run

### Checklist

1. **Plan compliance**: approved requirements implemented fully, nothing extra added
2. **Logic bugs**: race conditions, null/undefined access, stale closures, off-by-one, broken branching, wrong assumptions
3. **Edge cases**: empty values, 0 values, missing optional fields, invalid input, error states, loading states
4. **Type safety**: `tsc --noEmit` if applicable, unsafe casts, `any`, weak typing
5. **Leftover junk**: mocks, hardcoded data, `console.log`, TODO/FIXME, commented-out code
6. **Project patterns**: follows local conventions and project-specific rules
7. **Contracts**: API shape, backward compatibility, migrations, config/env impact
8. **Security**: auth, permissions, secret exposure, unsafe trust of client input
9. **Performance**: unnecessary re-renders, redundant fetches, N+1, avoidable heavy work
10. **Observability**: meaningful errors, logging, debuggability where relevant
11. **Accessibility**: keyboard navigation, focus, aria, contrast where relevant
12. **Responsive/UI states**: overflow, breakpoints, empty/loading/error states where relevant

### Auto-trigger

After "deep plan" implementation completes — always ask the user: "Run a deep review?"

### Output format

- List findings grouped by severity (bugs > warnings > suggestions)
- Open questions or assumptions
- Residual risks / unverified areas
- Short summary only after findings

## Subagents

Run subagents (subagent/chain/parallel, including in the background) **only if the user explicitly asks for or allows it**.
Do not suggest or launch subagents on your own initiative.
If the task could potentially benefit from delegation, first ask for permission and wait for the answer before launching any.

If the user allows delegation, choose tasks from the already-defined vertical slices. If the slices are recorded in files, pass the corresponding file to the agent; do not change the agreed scope or split a slice again without approval.

Every delegated task must have:

- one specific goal;
- a list of available context;
- the expected result;
- acceptance criteria;
- a verification method.

Do not delegate small tasks. Do not have multiple agents write to the same worktree simultaneously. The parent agent remains responsible for synthesis, the final diff, and the final verification.
