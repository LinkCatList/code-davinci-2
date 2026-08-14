# Срез 02 — онбординг `/start`

**Дата:** 2026-08-14  
**Родитель:** [../deep-plan.md](../deep-plan.md) (§10.2, M2 шаг 1–2 без `/profile` edit)  
**Статус:** реализован, деплой не делали  
**Ответы пользователя:** scope A (только онбординг), после confirm — своя карточка (2A), деплой только по отдельной просьбе

---

## Цель (одна, проверяемая)

Пользователь проходит `/start` от языка до подтверждения превью, профиль пишется в D1 (`state = NULL`), бот показывает **свою** карточку (HTML, первый сниппет, без фото). `/cancel` и повторный `/start` не ломают поток.

## Зависимости

- M1 готов: Worker, webhook, D1-схема, `upsertUser`, словари, деплой.
- Не зависит от M3 (лента), M4 (мэтчи), среза `/profile` edit.

## Контекст

Сейчас `/start` шлёт заглушку `startWelcome`. `upsertUser` ставит `state = "onboarding"` и останавливается. `@grammyjs/conversations` и таблица `sessions` не подключены. `now.ts` нет.

Решения из родительского плана, которые этот срез не переоткрывает:

- conversations v2 + D1, без `session()` middleware
- D1 / `Date.now()` внутри диалога только через `conversation.external()` / `conversation.now()`
- `users.state`: `'onboarding'` | `NULL`
- языки сниппетов: Rust, C++, Java, Python, JS, TS, C#, Go, Swift, Kotlin, Ruby, PHP
- пол: `0` male / `1` female
- 18+ hard-stop; следующий `/start` можно начать заново
- геокодинга нет
- нет `@username` — предупреждение, не блокер

## Scope

- Подключить `conversations({ storage })` + `createConversation(onboarding)`.
- Диалог: язык → имя → год → пол → био → локация → фото → 1–3 сниппета → превью → confirm.
- `/start`: незавершённый профиль → войти/продолжить; готовый → своя карточка + короткое меню.
- `/cancel`: выйти из диалога, `state` остаётся `onboarding`.
- События `onboarding_start` (один раз) и `profile_complete` (один раз).
- RU/EN копия на каждый шаг.
- `src/now.ts` (epoch-seconds) и перевод `upsertUser` на него.
- Хелпер рендера своей карточки (тот же HTML, что потом уйдёт в ленту).

## Non-goals

- Деплой (только после явной просьбы).
- `/feed`, like/skip, `/filters`, `/matches`, дайджест, сиды.
- `/profile` и поэлементное редактирование.
- Новые таблицы / новая миграция.
- Тесты.
- Реализация остальных команд меню (только текст «лента будет дальше»).

## Поведение / UX

### Вход

| Состояние | `/start` |
|---|---|
| нет строки / `state = "onboarding"`, диалога нет | `enter("onboarding")` |
| диалог уже активен | не `enter` повторно; апдейт попадает в текущий `wait` → **переспросить текущий шаг**, не сбрасывать |
| `state = NULL` | своя карточка + «профиль готов» + список команд без обещания, что `/feed` уже работает |

Потерянная session при `state = "onboarding"`: новый `enter`, шаги с уже заполненными полями пропускаются (чтение строки через `external`).

### Шаги

1. **Язык** — inline 🇷🇺 RU / 🇬🇧 EN, текущая локаль помечена. Выбор пишет `users.locale`. Дальше `t()` с этой локалью.
2. **Имя** — trim, 1…50, не команда, не пустой whitespace.
3. **Год** — целое; `currentYear-100 ≤ y ≤ currentYear-18`.  
   `currentYear` из `conversation.now()` (не сырой `Date.now()`).  
   Младше 18: сообщение hard-stop, `halt`, `state` остаётся `onboarding`.  
   Слишком старый / не число: re-prompt.
4. **Пол** — две inline-кнопки. Обязательно.
5. **Био** — ≤300; whitespace-only или кнопка Skip → `NULL`.
6. **Локация** — `message.location` (lat/lng, city NULL) **или** любой непустой текст города **или** Skip. Без геокодинга.
7. **Фото** — только photo; `file_id` самого большого размера. Текст/документ/скип — re-prompt. Ровно одно.
8. **Сниппеты** — вставить текст ≤1500 непустой → inline-язык из фиксированного списка → после первого «ещё» / «готово»; максимум 3; `position` 0..2. Фото на этом шаге — re-prompt.
9. **Превью** — своя карточка (HTML, первый сниппет по `position`, без фото, все поля экранированы). Кнопки: Confirm / Start over.  
   Start over: обнулить name, birth_year, gender, bio, photo, city, lat, lng и все snippets; locale оставить; начать диалог с имени. Нужно, потому что `/profile` edit в этом срезе нет.

### Команды внутри `wait`

- `/start` — не halt, переспросить текущий шаг.
- любая другая `/команда` — `halt({ next: true })`.
- `/cancel` снаружи: «отменено, `/start` чтобы продолжить».
- Прочие команды при `state = "onboarding"`: коротко «сначала закончи профиль или /cancel» (без реализации ленты).

### После Confirm

Через `external`: записать недостающие поля, `state = NULL`, `profile_complete` если ещё нет. Если нет `@username` — предупреждение. Показать карточку + текст готовности.

Каждый шаг после валидного ответа сразу пишет поле в `users` / `snippets` через `external` (replay не дублирует инсерты).

## Потоки данных

```
Telegram /start
  → upsertUser (locale, state=onboarding при insert)
  → conversations storage key = String(from.id)
  → enter("onboarding") | resume wait
  → external: event onboarding_start (если нет)
  → шаги + persist
  → confirm → state=NULL, profile_complete, карточка
```

Ключ storage: `from.id`, не дефолтный `chatId` (в private совпадает, явный ключ проще для `/delete` потом).

`d1SessionStorage` хранит JSON `VersionedState` conversations v2 (`read`/`write`/`delete`). Не подключать grammY `session()`.

Версия storage: `1`. Смена шагов диалога = бамп версии (старые сессии сбросятся, поля в `users` останутся, skip сработает).

## Файлы

| Файл | Действие |
|---|---|
| `src/now.ts` | новый: `now()` → epoch-seconds |
| `src/flows/onboarding.ts` | новый: conversation + хендлеры шагов |
| `src/flows/card.ts` | новый: `escapeHtml` + `renderOwnCard` (один HTML) |
| `src/snippet-languages.ts` | новый: константа списка языков |
| `src/bot.ts` | conversations, `/start`, `/cancel`, гейт «закончи профиль» |
| `src/db/session-storage.ts` | тип под `VersionedStateStorage`, та же SQL |
| `src/db/queries.ts` | getUser, patchUser, insertSnippet, clearOnboardingFields, hasEvent, insertEvent; `upsertUser` → `now()` |
| `src/i18n/en.ts`, `src/i18n/ru.ts` | строки шагов, валидации, превью, меню |
| `src/index.ts` | без изменений, если `createBot` уже получает `env`/`executionCtx` |

Миграций нет.

## Шаги реализации

1. `now.ts` + `upsertUser` на него.
2. Адаптер `sessions` под conversations v2.
3. queries: чтение/патч пользователя, сниппеты, события с защитой от дубля (проверка перед insert).
4. `snippet-languages.ts`, `card.ts`.
5. `onboarding.ts`: все шаги, `external`/`now`, halt-правила.
6. `bot.ts`: порядок middleware = private → upsert → `conversations` → `createConversation` → команды.
7. Словари RU/EN.
8. `pnpm typecheck`.

## Acceptance criteria

- Первый `/start` ведёт по всем шагам; после Confirm в D1: заполнены name, birth_year, gender, photo_file_id, ≥1 snippet; `state IS NULL`; есть ровно одно `onboarding_start` и одно `profile_complete`.
- Повторный `/start` после Confirm показывает ту же карточку, не начинает онбординг заново.
- `/start` посреди имени не записывает `"/start"` в `name` и не сбрасывает уже введённое.
- `/feed` посреди имени не становится именем (halt + гейт).
- Год > currentYear-18 → hard-stop; следующий `/start` снова спрашивает год.
- Нет `@username` → предупреждение, профиль всё равно завершается.
- Skip био и локации допустим; фото и хотя бы один сниппет — нет.
- Start over на превью чистит поля и сниппеты, locale остаётся.
- `pnpm typecheck` чистый.
- Деплой не выполняется в этом срезе.

## Проверка

- `pnpm typecheck`.
- Живой прогон на `@code_davinci_bot` — **только после** отдельной просьбы задеплоить.
- Пока деплоя нет: среза на проде не видно; локальный `wrangler dev` не получает Telegram (webhook смотрит на workers.dev). Это зафиксированный блокер проверки в Telegram.

После деплоя (отдельная задача): один полный `/start`; повторный `/start`; `/cancel` + `/start`; 18−; команда посреди шага; проверить D1 через wrangler/explorer.

## Риски

| Риск | Обработка |
|---|---|
| Replay conversations без `external` → дубли | все записи только в `external`; события — insert если ещё нет |
| `d1SessionStorage` как session-адаптер, не VersionedState | хранить JSON как есть; тип поправить |
| `/start` + активный диалог → `enter` бросает | сначала `active()`, enter только если 0 |
| Нельзя проверить в Telegram без деплоя | явно в AC; не объявлять срез «проверен в боте» до деплоя |
| Пользователь уже есть в remote D1 со `state=onboarding` | после деплоя `/start` войдёт в диалог |

## Confidence

- **Plan confidence: 90%** — скоуп закрыт ответами 1A/2A; родительский план детален; API conversations v2 (`enter`/`halt({ next })`/`external`/`now`/`active`) сверен с `.d.ts`.
- **Implementation confidence: 83%** — replay на Workers в этом репо ещё не гоняли; адаптер storage ещё не подключён.

Снижает: живой диалог + деплой сознательно отложены. Поднимет: typecheck + один полный прогон после деплоя без дублей в D1.

Не 100%: serverless replay нельзя закрыть на бумаге.
