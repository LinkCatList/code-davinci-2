## Project Session Naming Helper

Если пользователь сам спрашивает, как назвать сессию проекта, создать новую сессию, использовать текущую, переименовать текущую или формулирует аналогичный вопрос — помоги выбрать короткое название и сразу дай готовую команду для выполнения в pi.

Если нужно создать новую сессию:

```text
/new
/name <session-name>
```

Если нужно использовать текущую сессию, но переименовать её:

```text
/name <session-name>
```

Примеры хороших названий сессий:

```text
CRS-555 - исправить расчет комиссии при выводе
VOCALAI-1234 - добавить валидацию номера телефона
RD-281 - синхронизировать stage с main
NOTIX-42 - починить авторизацию через Telegram
COIN-77 - оптимизировать анимацию волны
```

Название должно быть коротким, понятным и желательно начинаться с тикета, если он есть.

- не пиши тесты, если тебя не просят об этом;
- не принимай решения самостоятельно, лучше лишний раз уточни

## Project Conventions First

Когда пользователь спрашивает о локальных соглашениях проекта, например о стиле `commit message`, именовании, структуре файлов или принятых паттернах, сначала проверь реальные артефакты этого проекта.
Для соглашений, связанных с git, опирайся на реальную историю этого репозитория, а не на общие практики или предположения.
Если по артефактам проекта соглашение не читается уверенно, прямо скажи об этом и не выдумывай правило.

## Bug Reproduction First

Пользователь предпочитает, чтобы работа над багами начиналась с реального воспроизведения на текущей версии.
Сначала проверь баг на текущем коде и зафиксируй фактическое поведение, и только потом обсуждай или предлагай исправление.
Если воспроизвести баг сейчас нельзя, явно укажи, что именно мешает воспроизведению.

### Bug Reproduction Method

При работе над багом сначала воспроизведи его на текущей версии тем способом, который ближе всего к реальному сценарию пользователя в этом проекте.

Приоритет способов воспроизведения:

1. Тот же пользовательский сценарий и точка входа, где баг был замечен.
2. Минимальный локальный воспроизводимый сценарий в текущем приложении.
3. Для backend/API-багов — канонический HTTP-repro (`curl`/HTTP sequence), если он полноценно покрывает баг; такие запросы можно и стоит сохранять в файлы, чтобы их было легко повторно запускать и использовать для проверки фикса.
4. Для frontend/UI-багов — воспроизведение через реальный интерфейс с точными шагами; при необходимости можно использовать Playwright MCP.
5. Если баг нельзя честно воспроизвести локально, явно укажи, что мешает, какие данные, доступы или окружение отсутствуют, и не переходи к обсуждению исправления как подтвержденного.

Не подменяй реальное воспроизведение косвенными догадками, чтением кода или предполагаемой причиной.

### Tight Feedback Loop

До анализа причины нужно получить один воспроизводимый способ проверки симптома:

- он проходит через реальный пользовательский сценарий;
- проверяет именно заявленный симптом;
- может упасть до фикса и пройти после фикса;
- выполняется быстро и детерминированно.

Это может быть Playwright-сценарий, curl-последовательность, CLI-команда или тест. `lint` и `typecheck` сами по себе не считаются feedback loop для поведенческого бага.

Если такой loop невозможно построить, явно зафиксировать блокер и не выдавать гипотезу за подтверждённую причину.

## Deep Curl Workflow

**Trigger phrase:** "deep curl", "действуем по deep curl", "сначала deep curl"

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
15. After implementation — ask: "Провести deep review?"

### Output format

- Preconditions
- Reproduction requests
- Expected vs actual behavior
- Open questions
- Then "deep plan"
- After implementation — rerun the same requests and report the results
- At the very end — ask whether the user wants to see the important parts of the real responses from the verification rerun

## Deep Plan Workflow

**Trigger phrase:** "deep plan", "действуем по deep plan", "по нашему воркфлоу"

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
   - можно ли удалить часть требования;
   - есть ли уже подходящий helper, компонент или паттерн;
   - решается ли задача средствами существующей библиотеки или платформы;
   - какой минимальный набор файлов и изменений действительно нужен.

   В плане явно указать, что намеренно не делается.
8. Build a detailed implementation plan before writing code
9. Get user approval on the plan before implementation
10. После утверждения нетривиального плана проверить, есть ли в нём несколько самостоятельных проверяемых срезов. Если да, спросить: «План утверждён. Вижу несколько самостоятельных срезов. Разбить его на слайсы/подзадачи и зафиксировать отдельными файлами?» Для маленьких задач и плана с одной целью этот вопрос не задавать; сообщить, что разбиение не требуется.
11. Если пользователь согласил декомпозицию, считать слова «срезы», «слайсы», «подзадачи» и «сабтаски» синонимами. Если файл плана был создан, зафиксировать каждый срез отдельным файлом в `.temp/<task>/slices/NN-<slug>.md`, а в `deep-plan.md` оставить список ссылок и зависимостей. Каждый срез должен иметь одну проверяемую цель, зависимости, контекст, scope, non-goals, acceptance criteria и способ проверки. Если файл плана не создавался, сначала показать декомпозицию в чате и не создавать файлы без отдельной просьбы. Если пользователь отказался, продолжить реализацию утверждённого плана без декомпозиции.

   Срез — это не отдельный технический шаг и не каждый пункт чеклиста. Объединять мелкие шаги в один срез, если они решают одну пользовательскую цель, затрагивают один flow или связанный набор файлов, не имеют самостоятельной демонстрации или проверки, выполняются одним владельцем и не дают пользы от параллельного выполнения. Изменение TSX, SCSS, локализации и typecheck обычно являются одним срезом. Разделять задачи, если у них разные пользовательские результаты, независимые зависимости, разные способы проверки или возможность параллельного выполнения. Один срез должен быть достаточно крупным для самостоятельного результата и достаточно маленьким для отдельного выполнения и проверки.
12. Implement only the approved scope. The approved plan and the original request are the scope boundary. If a new feature, API change, file, or behavior outside that boundary appears during implementation, stop and request approval.
13. If scope changes during implementation, stop, explain the delta, and get approval before continuing
14. Run the minimal relevant verification for the task: typecheck if applicable, plus any task-specific checks that actually validate the change
15. After implementation — ask: "Провести deep review?" before reporting the task as done

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

**Trigger phrase:** "deep review", "проведи ревью"

Standalone review process — can be called independently or after "deep plan" implementation.

### Scope

- changed files from `git diff`, OR
- specific files/components the user points to, OR
- the implemented scope against the approved plan

### Review Rules

Before other review checks, verify scope compliance:

- всё ли из утверждённого плана реализовано;
- нет ли лишних изменений;
- не изменилось ли поведение, которое не просили менять.

Лишние изменения явно отмечать как scope creep.

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

After "deep plan" implementation completes — always ask user: "Провести deep review?"

### Output format

- List findings grouped by severity (bugs > warnings > suggestions)
- Open questions or assumptions
- Residual risks / unverified areas
- Short summary only after findings

## Subagents

Запускать субагентов (subagent/chain/parallel, в т.ч. в фоне) **только если пользователь явно попросил или разрешил это**.
Не предлагай и не запускай субагентов по собственной инициативе.
Если задача потенциально выигрывает от делегирования — сначала спроси разрешения и дождись ответа, прежде чем запускать.

Если пользователь разрешил делегирование, выбирать задачи из уже определённых вертикальных срезов. Если срезы зафиксированы в файлах, передавать агенту соответствующий файл; не менять согласованный scope и не делить срез повторно без согласования.

Каждая делегируемая задача должна иметь:

- одну конкретную цель;
- список доступного контекста;
- ожидаемый результат;
- acceptance criteria;
- способ проверки.

Не делегировать мелкие задачи. Не давать нескольким агентам писать в один worktree одновременно. Родительский агент остаётся ответственным за синтез, итоговый diff и финальную проверку.
