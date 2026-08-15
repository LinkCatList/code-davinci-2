# Deep Plan: определить язык сниппета

**Дата:** 2026-08-15  
**Источник:** скрин онбординга (Telegram `pre` с заголовком `rust` → всё равно спрашиваем язык); `src/flows/onboarding.ts`, `src/flows/profile.ts`, `src/snippet-languages.ts`; PRD §6.1  
**Статус:** утверждён.  
**Ответы пользователя:** Q1 = только Telegram `pre.language` + markdown-fence; Q2 = пропустить вопрос; Q3 = да, отдельный файл плана.

Разбиение на срезы **не нужно**: одна пользовательская цель, один flow, один набор файлов.

---

## 1. Постановка задачи

После вставки сниппета бот всегда спрашивает «Which language is that?» / «На каком это языке?» сеткой из 12 кнопок. Если пользователь уже прислал оформленный code block (на скрине Telegram сам рисует `rust`) или вставил ` ```rust ` fence, этот шаг лишний.

Нужно один раз прочитать уже существующий тег языка, смапить на `SNIPPET_LANGUAGES` и сохранить сниппет без вопроса. Если тега нет или он не из списка — оставить текущую клавиатуру.

## 2. Текущее поведение

Язык никогда не выводится из сообщения.

1. `askSnippetText` берёт только `message.text`, 1–1500 символов, сущности игнорирует.
2. `askSnippetLanguage` всегда шлёт `onboardingSnippetLang` + `snippetLangKeyboard()` и ждёт `ob:slang:<Language>`.
3. `saveSnippet(content, language, position)`.

Те же хелперы в трёх местах:

- первый сниппет онбординга;
- «ещё сниппет» в `askMoreSnippets`;
- добавление в профиле (`editSnippets`).

Список языков фиксирован в `src/snippet-languages.ts`. В исходящих карточках уже есть обратный маппинг `FENCE_IDS` (`Rust` → `rust` и т.д.). Входящий тег Telegram (`MessageEntity` `type: "pre"`, поле `language?: string`) не читается.

## 3. Целевое поведение

После валидного текста сниппета:

| Вход | Результат |
|---|---|
| `pre` entity с языком, который мапится на наши 12 | сохранить сразу, вопрос не показывать |
| весь текст — один markdown-fence ` ```lang ` / закрывающий ` ``` ` опционален, `lang` мапится | сохранить **внутренность** fence (без обёртки), вопрос не показывать |
| нет тега, тег пустой, тег вне списка (`bash`, `c`, `jsx`, `sql`, …), обычный текст | как сейчас: «Which language is that?» + сетка |

Тишина: отдельного «Saved as Rust» нет (ответ Q2). Ошибку правит удаление/добавление сниппета.

## 4. Принятые решения

| # | Решение | Итог |
|---|---|---|
| Q1 | Источник | Только Telegram `pre.language` и wrapping markdown-fence. Без эвристик по коду, библиотек и LLM. |
| Q2 | UX | Пропустить вопрос, сразу `saveSnippet`. |
| Q3 | Файл плана | `.temp/detect-snippet-language/deep-plan.md`. |
| D1 | Алиасы | Invert `FENCE_IDS` + однозначные синонимы. Не мапить `c`, `cs`, `jsx`, `tsx`, `rs`. |
| D2 | Приоритет | Сначала `pre.language`, иначе fence. Контент при entity — весь `message.text` (Telegram уже не кладёт слово `rust` в текст). |
| D3 | Стрип fence | Только если язык из fence успешно смапился. Неразмеченный ` ```\ncode\n``` ` не трогаем. |
| D4 | Пусто после стрипа | Как плохой сниппет: `onboardingSnippetBad`, заново. |
| D5 | Схема / i18n / деплой | Без изменений схемы и словарей. Деплой только по отдельной просьбе. |

## 5. Открытые вопросы

Блокирующих нет. Неблокирующие дефолты выше (D1–D5).

## 6. Constraints и non-goals

- Cloudflare Worker, без новых зависимостей и внешних вызовов (детекция чистая, безопасна для replay conversations).
- Список из 12 языков не расширяем.
- Не угадываем язык по синтаксису. `let a = 10;` без тега → клавиатура.
- Не принимаем документы/файлы `.rs`.
- Не пишем тесты, пока не попросят.
- Не меняем рендер карточки, фильтры, сиды, клавиатуру языков.
- Не добавляем confirm / «похоже на Rust».
- Не меняем PRD-файл, пока не попросят.

Simplification gate: отдельный сервис/файл-парсер/AI не нужен. Хватит одной функции рядом с `FENCE_IDS` и смены контракта `askSnippetText`.

## 7. Затронутые места

| Файл | Что |
|---|---|
| `.temp/detect-snippet-language/deep-plan.md` | этот план |
| `src/snippet-languages.ts` | алиасы + `snippetLanguageFromTag` + `detectSnippetLanguage` |
| `src/flows/onboarding.ts` | `askSnippetText` возвращает `{ content, language }`; 2 call site'а |
| `src/flows/profile.ts` | 1 call site в `editSnippets` |

`askSnippetLanguage` остаётся как fallback.

## 8. UX-состояния

1. **Тег есть и наш** — вопрос языка не появляется; дальше «ещё сниппет / готово» или возврат в редактор сниппетов.
2. **Тега нет / чужой** — текущий вопрос и сетка, копирайт тот же.
3. **Пустое тело после снятия fence** — `onboardingSnippetBad`, ждём новый текст.
4. **Зарезервированный ввод / фото / длина** — без изменений.

## 9. Поток данных

```
message.text + message.entities
        │
        ▼
detectSnippetLanguage(text, entities)
        │
        ├─ pre.language → snippetLanguageFromTag
        │     hit  → { content: text, language }
        │     miss → дальше
        │
        ├─ wrapping ```lang\n…[\n```]
        │     hit  → { content: inner, language }
        │     miss → { content: text, language: null }
        │
        ▼
language ?? askSnippetLanguage(...)
        │
        ▼
saveSnippet(content, language, position)
```

Маппинг тега (trim + lower):

| Вход | Язык |
|---|---|
| `rust` | Rust |
| `cpp`, `c++`, `cxx` | C++ |
| `java` | Java |
| `python`, `py` | Python |
| `js`, `javascript` | JS |
| `ts`, `typescript` | TS |
| `csharp`, `c#` | C# |
| `go`, `golang` | Go |
| `swift` | Swift |
| `kotlin`, `kt` | Kotlin |
| `ruby`, `rb` | Ruby |
| `php` | PHP |
| точное имя из `SNIPPET_LANGUAGES` без учёта регистра (`Rust`, `JS`, …) | как в enum |
| `c`, `cs`, `jsx`, `tsx`, `rs`, `bash`, `sql`, пусто | нет |

Типы хелпера без импорта grammy:

```ts
type CodeEntityHint = { type: string; language?: string };

detectSnippetLanguage(
  text: string,
  entities?: ReadonlyArray<CodeEntityHint>,
): { content: string; language: SnippetLanguage | null }
```

Fence: начало строки, три бэктика, опциональный язык `[A-Za-z0-9+#._-]`, перевод строки (`\n` / `\r\n`), тело, опционально закрывающие ``` в конце. Не четыре бэктика, не `~~~`.

## 10. Шаги реализации

1. Записать этот план в `.temp/detect-snippet-language/deep-plan.md`.
2. В `snippet-languages.ts`: `ALIASES`, `snippetLanguageFromTag`, `detectSnippetLanguage`.
3. `askSnippetText` → после прохождения length/reserved прогнать детектор; пустой `content` после стрипа — bad; вернуть `{ content, language }`.
4. Три call site'а: `const language = detected ?? await askSnippetLanguage(...)`.
5. `pnpm typecheck`.

## 11. Проверка

Живой Telegram в этой сессии не гоняем (деплой не в скоупе). Проверка после кода:

- `pnpm typecheck`.
- Логика по таблице (можно прогнать хелпер в REPL, тесты не добавляем):

| Кейс | Ожидание |
|---|---|
| `pre.language = "rust"`, текст `let a = 10;\nlet b = 20;` | Rust, текст как есть, без вопроса |
| `pre.language = "javascript"` | JS |
| `pre.language = "bash"` | вопрос, контент как есть |
| текст fence `ts` | TS, контент без обёртки |
| текст fence без языка | вопрос, текст целиком |
| голый `let a = 10;` | вопрос |
| пустой fence `rust` | bad snippet |
| фото / команда / >1500 | как сейчас |

Регрессия: онбординг и профиль без тега по-прежнему спрашивают язык.

## 12. Риски и края

- Telegram может прислать другое написание (`Rust`, `JS`). Лечится lower + имена enum.
- Короткий неразмеченный код неоднозначен — **намеренно** не угадываем.
- Ложный skip только если пользователь сам поставил чужой тег (` ```python ` на Rust). Тогда удалить сниппет.
- Сообщение «преамбула + pre» сохранит преамбулу в контенте — как сейчас с `message.text`.
- Replay conversations безопасен: нет I/O и часов.

## 13. Confidence

- **Plan confidence: 92%** — flow, типы Telegram `pre.language` и три call site просмотрены; Q1–Q3 закрыты. Минус: живой апдейт Telegram в этой сессии не снимали, полный список alias'ов Telegram не сверяли по libprisma (SSRF на github).
- **Implementation confidence: 93%** — локальный хелпер + смена возврата одной функции, без схемы и i18n. Минус: варианты fence (CRLF, info-string) и пустое тело после стрипа.

Что подняло бы уверенность: один живой апдейт с formatted code block и печать `message.entities`. Для утверждения плана не блокирует.

Что намеренно не делается — §6.
