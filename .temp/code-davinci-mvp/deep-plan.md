# Deep Plan: code-davinci MVP (M1–M5)

**Дата:** 2026-08-14
**Источник:** `PRD.md` (Draft v1)
**Статус:** утверждён (rev.2). В работе: M1.
**Скоуп:** полный MVP, милестоуны M1–M5 по §12 PRD

Изменения rev.2 — см. §16.

---

## 1. Постановка задачи

Построить Telegram-бота code-davinci с нуля: знакомство/нетворкинг программистов через свайп кода, а не фото. Фото и контакт (@username) раскрываются только после взаимного лайка. Главный анти-паттерн — overengineering v1 (DI, Docker, инфраструктура до первого работающего флоу).

## 2. Текущее поведение

Ничего нет: директория содержит только `PRD.md` и `AGENTS.md`. Greenfield.

## 3. Целевое поведение

Работающий бот на Cloudflare Workers, в котором:

1. пользователь проходит онбординг (язык → имя → год рождения 18+ → пол → био → локация → фото → 1–3 сниппета → превью);
2. листает ленту карточек со сниппетами (без фото) через `/feed` или после онбординга, лайкает/скипает, настраивает фильтры (дистанция, язык сниппета);
3. при взаимном лайке оба получают reveal: фото + данные + сниппеты + ссылка `t.me/<username>`;
4. лайки приходят дайджестом «у вас N новых лайков» не чаще 1 раза в 24ч;
5. есть `/feed`, `/profile`, `/matches`, `/filters`, `/delete`, `/language`, `/cancel`;
6. холодный старт закрыт сид-профилями (§6.6 PRD): фейки показываются только когда реальные кандидаты кончились, никогда не мэтчатся;
7. пишутся события `onboarding_start`, `profile_complete`, `like`, `skip`, `match` для фаннела §3.

## 4. Принятые решения

| Решение | Итог | Источник |
|---|---|---|
| Стек | Cloudflare Workers + grammY + D1 + Drizzle | PRD §9.1, §14 |
| Состояние диалогов | **grammY conversations plugin v2** + D1-адаптер, подключённый в `conversations({ storage })` (без session-middleware) | ответ пользователя + deep review |
| Пакетный менеджер | **pnpm** | ответ пользователя |
| План-файл | `.temp/code-davinci-mvp/deep-plan.md` | ответ пользователя |
| Лайк-нотификации | дайджест, max 1/24ч, event-driven | PRD §6.3, §14 |
| Фото | только Telegram `file_id`, без R2 | PRD §9.1 |
| Метрики | ad-hoc SQL по D1, без внешней аналитики | PRD §3 |
| Пин версий | `grammy ^1.45`, `@grammyjs/conversations ^2.1`, `wrangler ^4`, `drizzle-orm 0.45.x` (не `@rc`), `drizzle-kit 0.31.x` | deep review |
| Время в БД | везде epoch-seconds через один хелпер `now()` | deep review |

## 5. Simplification gate — что намеренно НЕ делаем

- ❌ Тесты (по конвенции проекта — не пишем, пока не попросят). Проверка — ручная, через живого бота.
- ❌ CI/CD, Docker, staging-окружение, DI-контейнеры, слои `services/`/`repositories/`.
- ❌ Свой миграционный инструмент — только `drizzle-kit generate` → `wrangler d1 migrations apply`.
- ❌ Cron / Workers Cron Triggers.
- ❌ Rate limiting, кап лайков, модерация, репорты (P1+).
- ❌ i18n-фреймворк — два словаря + `t()`.
- ❌ AI-генерация сид-профилей, внешние API.
- ❌ Mini App, web-интерфейс, GitHub OAuth.
- ❌ Абстракция над отправкой сообщений.
- ❌ grammY `session()` middleware — плагин conversations v2 хранит своё состояние сам.
- ❌ SQL-haversine (D1 math-функции есть, но сортировка/фильтр и так в коде — SQL оставляем простым).
- ❌ Геокодинг города: произвольный текст города принимается как есть.

## 6. Открытые вопросы (с предлагаемыми дефолтами)

Неблокирующие: дефолт применяется, если пользователь не возразит при утверждении.

1. **Фильтр `max_dist_km`.** Если у зрителя нет coords — фильтр дистанции игнорируется (иначе лента пустая навсегда). Если coords есть — кандидаты без вычислимой дистанции исключаются.
2. **N в дайджесте.** Лайки с `created_at > last_like_notif_at`, исключая те, по которым уже есть `matches` (не считаем человека, с которым только что сматчились).
3. **Возраст.** `currentYear - birth_year` (без дня рождения).
4. **Сид-профили.** ~150.
5. **`users.state`.** `'onboarding'` = не завершён; `NULL` = профиль готов. Шаги живут в `sessions`.
6. **18+ hard-stop.** Следующий `/start` снова открывает онбординг — гейт обходится сменой года. Принимаем для MVP, без дополнительной блокировки.
7. **`/profile` edit.** Редактируются все поля онбординга, включая `birth_year` (повторная проверка 18+) и `gender`.
8. **После `/delete` у партнёра.** Мэтч исчезает из `/matches` контрагента. Принимаем для MVP.

## 7. Ограничения и non-goals

- Всё §4 PRD — контракт. Любое отклонение = стоп и согласование.
- Бюджет $0: только free tier Workers + D1.
- Никакой абстракции, пока не заболит дважды (§11 PRD).

## 8. Затрагиваемые области

```
src/
  index.ts        -- worker entry, webhook wiring, прокидывание ExecutionContext
  bot.ts          -- grammY setup, middleware
  flows/          -- onboarding.ts, feed.ts, match.ts, profile.ts
  db/             -- schema.ts, queries.ts, session-storage.ts
  i18n/           -- ru.ts, en.ts
  t.ts            -- t() helper
  now.ts          -- now() → epoch-seconds
scripts/
  seed.ts
  set-webhook.ts
drizzle/
wrangler.toml
drizzle.config.ts
package.json, tsconfig.json
```

Отличия от §9.3 PRD: `+db/session-storage.ts`, `+scripts/set-webhook.ts`, `+now.ts`, `+drizzle/`, `+drizzle.config.ts`. Минимально необходимые добавления.

## 9. Модель данных (финальная)

Правки к драфту PRD §9.2:

1. **+таблица `skips`** — скипы негде хранить, а §6.2/§6.3 требуют постоянных скипов.
2. **+таблица `sessions`** — backing store conversations plugin (ключ = telegram user id).
3. **Инвариант `matches.user_a < user_b`** — иначе UNIQUE не защищает от (A,B)/(B,A).
4. **`name` / `birth_year` / `gender` nullable** — строка создаётся на первом апдейте, до онбординга. Feed-фильтр `state IS NULL` скрывает незавершённые профили.
5. **Все INTEGER-таймстемпы — epoch-seconds** через `now()`.
6. **Событие `onboarding_start`** — иначе знаменатель «started onboarding» (§3) не вычислим.

```sql
users(
  id INTEGER PRIMARY KEY,              -- Telegram user id
  username TEXT,
  locale TEXT NOT NULL,                -- 'ru' | 'en'
  state TEXT,                          -- 'onboarding' | NULL(=готов)
  name TEXT,                           -- NOT NULL после онбординга
  birth_year INTEGER,                  -- NOT NULL после онбординга
  gender INTEGER,                      -- 0=male, 1=female; NOT NULL после онбординга
  bio TEXT,
  photo_file_id TEXT,
  city TEXT,
  lat REAL, lng REAL,
  max_dist_km INTEGER,                 -- NULL = any
  lang_filter TEXT,                    -- NULL = any
  is_active INTEGER NOT NULL DEFAULT 1,
  is_fake INTEGER NOT NULL DEFAULT 0,
  last_active_at INTEGER NOT NULL,     -- epoch-seconds
  last_like_notif_at INTEGER,          -- epoch-seconds
  created_at INTEGER NOT NULL          -- epoch-seconds
)

snippets(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL,
         language TEXT NOT NULL, content TEXT NOT NULL, position INTEGER NOT NULL)

likes(id INTEGER PRIMARY KEY, from_user INTEGER NOT NULL, to_user INTEGER NOT NULL,
      created_at INTEGER NOT NULL, UNIQUE(from_user, to_user))

skips(id INTEGER PRIMARY KEY, from_user INTEGER NOT NULL, to_user INTEGER NOT NULL,
      created_at INTEGER NOT NULL, UNIQUE(from_user, to_user))

matches(id INTEGER PRIMARY KEY, user_a INTEGER NOT NULL, user_b INTEGER NOT NULL,
        revealed_a INTEGER NOT NULL DEFAULT 0, revealed_b INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL, UNIQUE(user_a, user_b))
        -- инвариант: user_a < user_b

events(id INTEGER PRIMARY KEY, user_id INTEGER, type TEXT NOT NULL, created_at INTEGER NOT NULL)
       -- type: 'onboarding_start' | 'profile_complete' | 'like' | 'skip' | 'match'
       -- user_id nullable: при /delete обнуляем, строку оставляем

sessions(key TEXT PRIMARY KEY, value TEXT NOT NULL)
```

Миграции: схема целиком на M1 → `pnpm drizzle-kit generate` → `wrangler d1 migrations apply`. Одна начальная миграция.

## 10. Потоки данных / state mapping

### 10.1 Pipeline middleware (`bot.ts`, порядок важен)

1. Ранний drop: только `chat.type === 'private'`. Группы игнорируем.
2. **User middleware**: upsert по `from.id`. Первое появление: `locale` из `language_code` (`ru*` → 'ru', иначе 'en'), `state='onboarding'`, `created_at=now()`, nullable поля = NULL. Каждый апдейт: `username`, `last_active_at=now()`, `is_active=1` (реактивация после unblock).
3. **Pending-reveal middleware**: на каждом апдейте — сканировать мэтчи, где `revealed_me=0 AND counterpart.username IS NOT NULL` (и зеркально для контрагента). Флаг — единственный источник правды, не «переход username». См. 10.4. Не слать, если `is_active=0` у получателя.
4. `conversations({ storage: { type: 'key', adapter: d1Adapter, version: 1 } })` + диалоги. **Без** `session()`.
5. Хендлеры команд и callback-кнопок.

`ExecutionContext`: в `fetch(request, env, execCtx)` бот собирается на каждый запрос; `execCtx` прокидывается 3-строчным middleware (`ctx.executionCtx = execCtx`). `botInfo` кэшируется в module-scope (иначе `getMe` на каждый webhook).

Золотое правило conversations: любой D1 read/write, `Date.now()`, `Math.random()` внутри диалога — только через `conversation.external()` / `conversation.now()`. Иначе replay дублирует инсерты.

В каждом `wait` диалога: если `ctx.message.text` начинается с `/` → `conversation.halt()` и дать хендлеру команды обработать (иначе `/feed` съедается как имя). `/cancel` тоже halt + выход в меню / онбординг.

### 10.2 Онбординг (conversation `onboarding`, §6.1)

Вход (`/start` при незавершённом профиле или первый контакт): если события `onboarding_start` ещё нет — записать его (через `conversation.external`).

Шаги: язык (предвыбран) → имя (≤50, не команда) → год рождения (`currentYear-100 <= y <= currentYear-18`; иначе hard-stop) → пол (inline) → био (≤300, скип; whitespace-only = скип) → локация (TG location ИЛИ любой текст города ИЛИ скип; геокодинга нет) → фото (только photo-сообщение, иначе re-prompt; `file_id` самого большого размера) → сниппеты 1–3 (текст ≤1500 непустой → inline-язык; «готово» после первого; photo на этом шаге — re-prompt) → превью → подтверждение.

Завершение (через `external`): записать поля, `state=NULL`, событие `profile_complete`, первая карточка ленты. Нет @username — предупреждение (не блокер).

Языки сниппетов (фиксированный список): Rust, C++, Java, Python, JS, TS, C#, Go, Swift, Kotlin, Ruby, PHP.

### 10.3 Лента (§6.2)

`/feed` — именованная команда PRD §6.2; то же из меню и после онбординга. Гейт: если у зрителя `state !== NULL` — редирект в онбординг. Like/skip — тот же гейт.

Выборка **без LIMIT** (MVP-масштаб; D1 выдержит сотни/тысячи строк):

```
SELECT * FROM users
WHERE id != :me AND is_active = 1 AND state IS NULL
  AND id NOT IN (SELECT to_user FROM likes WHERE from_user = :me)
  AND id NOT IN (SELECT to_user FROM skips WHERE from_user = :me)
  AND (:langFilter IS NULL OR EXISTS (
        SELECT 1 FROM snippets s WHERE s.user_id = users.id AND s.language = :langFilter))
ORDER BY is_fake ASC, last_active_at DESC
```

Дальше в коде: haversine, если coords есть у обеих сторон.

- У зрителя нет coords → `max_dist_km` игнорируется.
- У зрителя есть coords и задан `max_dist_km` → отбросить кандидатов без вычислимой дистанции или с дистанцией > фильтра.
- Сортировка: `is_fake ASC`, затем с дистанцией по возрастанию, затем без дистанции (уже по `last_active_at`). Взять первого.
- Пусто → empty-state «кандидаты кончились, расширьте фильтры / зайдите позже».

Карточка: одно HTML-сообщение. На карточке **первый сниппет по `position`**. Экранировать **все** пользовательские поля (`<`, `>`, `&`): имя, био, город, сниппет. Далее имя, возраст, язык сниппета + остальные языки, дистанция (округл. км, минимум 1) или город, био. **Без фото.** Клавиатура: `👍 Like` / `👎 Skip`.

Лайк: `INSERT ... ON CONFLICT DO NOTHING`; событие `like` только если строка вставилась; взаимность (§10.4); дайджест (§10.5); следующая карточка. Скип: то же в `skips` + событие `skip`. Получатель лайка удалён / отсутствует — тихо игнорим.

Фильтры (`/filters`): пресеты км + «любая»; язык сниппета + «любой».

### 10.4 Мэтч и reveal (§6.4)

После успешного insert лайка: если есть взаимный лайк →

```
INSERT INTO matches (user_a, user_b, ...) VALUES (min, max, ...)
ON CONFLICT DO NOTHING
```

Reveal, событие `match` (ровно **одна** строка, `user_id` = инициатор — сторона, чей лайк закрыл пару) и отправки — **только если insert реально создал строку**. Иначе второй webhook молчит.

Reveal стороне X = данные Y. Отправляется, только если у Y есть username. Успех → `revealed_X=1`. Нет username у Y: X получает «match pending», Y — просьбу установить username.

Pending-reveal middleware (10.1 п.3) — таблица переходов:

| У Y username? | `revealed_X` | Действие на апдейте X или Y |
|---|---|---|
| да | 0 | отправить reveal X, поставить флаг |
| да | 1 | ничего |
| нет | 0 | ничего (ждём username) |
| нет | 1 | недостижимо |

Повторная отправка возможна, если send прошёл, а апдейт флага упал — принимаем (редкость). Потеря reveal при 403/краше больше не происходит: флаг=0 + username есть → retry на следующем апдейте любой стороны.

Формат reveal (caption фото ≤1024):

1. `sendPhoto(photo_file_id, caption: имя, возраст, город/дистанция, био, https://t.me/<username>)` — все поля экранированы; если `photo_file_id` NULL (не должно быть у реальных после онбординга) — только текст.
2. по одному сообщению на каждый сниппет (`<pre>`).

Не слать, если получатель `is_active=0`.

### 10.5 Дайджест лайков (§6.3)

После записи лайка, если получатель реальный и `is_active=1`:

```
UPDATE users
SET last_like_notif_at = :now
WHERE id = :to
  AND (last_like_notif_at IS NULL OR last_like_notif_at < :now - 86400)
```

Отправить дайджест **только если UPDATE затронул строку** (optimistic lock, закрывает гонку двух webhook). N = лайки к получателю с `created_at > старый last_like_notif_at` (или все, если был NULL), **минус** лайки, по которым уже есть строка в `matches`. Фейки не получают ничего. Отправка — `ctx.api` в `executionCtx.waitUntil`. Если waitUntil-send упал после успешного UPDATE — эти лайки в следующий дайджест не попадут; принимаем.

### 10.6 Кросс-юзер отправки и блокировка бота

`sendMessage`/`sendPhoto` другим — try/catch: 403 → `is_active=0`. Reveal await-ится инлайн; дайджест — waitUntil. Не вызывать `waitUntil` внутри conversation (плагину нужно видеть `ctx.api` для replay-dedup). Реактивация: user middleware ставит `is_active=1` на любом апдейте (unblock → следующее сообщение).

### 10.7 Прочие команды

- `/feed` — следующая карточка (гейт: профиль готов).
- `/profile` — своя карточка как в ленте (без фото) + edit всех полей, включая birth_year (18+) и gender. Сниппеты: удалить/добавить, лимит 1–3. `editField` — тот же `external`/`halt` на команды.
- `/matches` — имя, возраст, город, `t.me/<username>` (pending — «ждём username»). Фото в списке не шлём (экономия; уже было в reveal).
- `/delete` — подтверждение → удалить: user, snippets, likes (`from_user=:me OR to_user=:me`), skips (то же), matches (`user_a=:me OR user_b=:me`), sessions (`key=:me`); **events: `UPDATE ... SET user_id=NULL`** (фаннел не переписывается). Затем «данные удалены».
- `/language` — RU/EN.
- `/cancel` — выход из активного диалога.
- Повторный `/start`: незавершённый онбординг → resume (halt+restart conversation, если плагин уже держит диалог); готов → главное меню (Feed / Profile / Matches).

### 10.8 События и метрики

| type | когда | зачем |
|---|---|---|
| `onboarding_start` | вход в онбординг, один раз | знаменатель «registered / started onboarding» |
| `profile_complete` | подтверждение превью | числитель completion rate |
| `like` / `skip` | успешный insert | свайпы / день |
| `match` | успешный insert мэтча, одна строка | Matches total = `COUNT(*)` из `events` или из `matches` |

Не пишем, если актор — фейк. На `/delete` события анонимизируем, не удаляем. Метрики — ad-hoc SQL на M5, в коде их нет. D7: `users.last_active_at >= users.created_at + 7*86400` среди `is_fake=0` (удалённые выпадают — принимаем).

Webhook-redelivery может продублировать `like`/`skip` events (нет UNIQUE на events) — принимаем для MVP.

### 10.9 Сид-профили (§6.6)

`scripts/seed.ts`: статичные данные (имена RU/EN ~30+30, био-шаблоны, хабы: Москва, СПб, Берлин, Лондон, Варшава, Нью-Йорк, SF, Тбилиси, Ереван, Алматы + джиттер; 3–5 сниппетов на язык) → ~150 профилей:

- `is_fake=1`, `photo_file_id=NULL`, `state=NULL`, `is_active=1`
- `gender` 0/1, `locale` ru/en, `name`, `birth_year` 1990–2005
- `city` + `lat`/`lng`, `last_active_at`/`created_at` = now() со сдвигом
- сниппеты с `position`

Вывод `seed.sql` → `wrangler d1 execute DB --file=seed.sql [--local|--remote]`. Позже: `DELETE FROM users WHERE is_fake=1` + likes/skips/snippets, указывающие на них.

Пользователь далеко от всех хабов с узким `max_dist_km` не увидит фейков — empty-state «расширьте фильтры» это покрывает.

## 11. UX-состояния

- **Онбординг**: шаг = сообщение + валидация + re-prompt на неверный тип. 18− → hard-stop. `/cancel` и любая `/команда` выходят из шага.
- **Лента**: карточка / empty-state.
- **Мэтч**: reveal / «match pending» / «установите username».
- **Дайджест**: «у вас N новых лайков».
- **Профиль / matches / delete** — как в §10.7; пустые списки — отдельные строки в словарях.
- Вся копия RU и EN с первого дня, полные словари на каждом милестоуне.

## 12. Шаги реализации

### M1 — Skeleton

1. `pnpm init`. deps: `grammy@^1.45`, `@grammyjs/conversations@^2.1`, `drizzle-orm@0.45.x`. dev: `wrangler@^4` (Node ≥22), `drizzle-kit@0.31.x`, `typescript`, `@cloudflare/workers-types@^5` (или `wrangler types`), `tsx`. `tsconfig.json` (strict).
2. `wrangler.toml`: worker, `compatibility_date`, биндинг D1 `DB`, `migrations_dir="drizzle"`. `wrangler d1 create`. Секреты: `BOT_TOKEN`, `WEBHOOK_SECRET`.
3. Полная схема §9 → `drizzle-kit generate` → `wrangler d1 migrations apply --local` и `--remote`.
4. `src/i18n/{ru,en}.ts`, `src/t.ts`, `src/now.ts`.
5. `src/db/session-storage.ts` — `StorageAdapter` (read/write/delete) поверх `sessions`.
6. `src/index.ts`: `fetch(req, env, execCtx)` → собрать бота, прокинуть `execCtx`, `webhookCallback(bot, 'cloudflare-mod')`, роут по секретному пути; кэш `botInfo`.
7. `src/bot.ts`: private-only → user middleware → `/start` на локали.
8. `scripts/set-webhook.ts` + `setMyCommands` (start, feed, profile, matches, filters, language, delete, cancel).
9. Деплой: `wrangler deploy` → `pnpm tsx scripts/set-webhook.ts`.

**Done when:** бот отвечает на `/start` в Telegram из Cloudflare на обеих локалях.

### M2 — Profiles

1. Conversation `onboarding` по §10.2: `external`/`now`, halt на `/командах`, `onboarding_start`, все валидации, username-warning.
2. Превью + confirm → `state=NULL`, `profile_complete`, первая карточка.
3. `/profile` + `editField` (все поля, включая birth_year/gender).
4. Повторный `/start` и `/cancel`.

**Done when:** пользователь регистрируется и видит свою карточку; редактирование работает; `/feed` в середине онбординга не становится именем.

### M3 — Feed

1. `/feed` + выборка §10.3 (без LIMIT, `is_fake ASC`, haversine, фильтр дистанции с оговоркой про coords зрителя).
2. Рендер: HTML, `<pre>`, экранирование всех полей, первый сниппет по `position`.
3. like/skip: ON CONFLICT, события только на реальный insert, гейт `state IS NULL`.
4. `/filters`. Empty-state.

**Done when:** два тестовых юзера свайпают друг друга; фильтры меняют выдачу; empty-state показывается.

### M4 — Matching

1. Взаимность + `INSERT matches ON CONFLICT DO NOTHING`; reveal/event только у победителя insert.
2. Reveal §10.4 (photo+caption + сниппеты); try/catch → `is_active=0`.
3. Pending-username + retry-middleware по флагу.
4. Дайджест §10.5 (conditional UPDATE, waitUntil, без фейков, N без уже-мэтчей).
5. `/matches`.

**Done when:** два тестовых юзера мэтчатся и оба получают контакты.

### M5 — Launch polish

1. `/delete` по §10.7 (обе стороны связей + sessions + анонимизация events).
2. Проверка 5 типов событий; фейки не пишут.
3. `scripts/seed.ts` → remote D1; фейки только после реальных; лайк фейка ≠ мэтч/дайджест.
4. Полировка копии RU/EN, пустые состояния.
5. SQL метрик §3 (вне кода), исключая `is_fake=1`.

**Done when:** soft launch пост вышел.

## 13. Проверка

- После каждого шага: `pnpm tsc --noEmit`.
- Локально: `wrangler dev` (локальная D1 + те же миграции) + `wrangler dev --tunnel` (или cloudflared) → `setWebhook` на URL туннеля. Предусловие: отдельный dev-токен, два Telegram-аккаунта, Node ≥22. URL туннеля эфемерный — setWebhook на каждую сессию. Секреты локально — `.dev.vars`.
- Милестоуны — «Done when» каждого M, вручную в Telegram.
- M2 extra: `/feed` и `/start` посреди имени/сниппета не портят данные; 18− hard-stop; повторный `/start`.
- M4 extra: повторный тап like; взаимные лайки почти одновременно (гонка — один reveal); блок бота; pending-username через ручную установку `revealed_*=0` в D1.
- M5: сид → лента до фейков; лайк фейка без мэтча; SQL метрик без фейков; `/delete` и повторный `/start` не воскрешает старый диалог.
- Автотесты не пишем.

## 14. Риски и краевые случаи

| Риск / кейс | Вероятность | Обработка |
|---|---|---|
| Replay conversations без `external` → дубли инсертов | Высокая на M2 | Дисциплина §10.1; первая проверка M2 |
| Гонка взаимных лайков | Средняя | ON CONFLICT + reveal только у insert-победителя (§10.4) |
| Гонка дайджеста | Низкая | Conditional UPDATE (§10.5) |
| Потеря reveal при 403/краше | Низкая | Retry по `revealed_*=0` (§10.4) |
| `/delete` без sessions → воскрешение диалога | — | sessions в каскаде (§10.7) |
| conversations plugin API drift | Средняя | Пин `^2.1`; откат на hand-rolled `users.state` (согласовать) |
| Caption фото ≤1024 | Решено | Сниппеты отдельными сообщениями |
| Haversine | Решено | В коде; SQL простой. D1 math-функции есть, не используем |
| Дубли мэтча (A,B)/(B,A) | Решено | user_a<user_b + UNIQUE |
| Скипы | Решено | таблица `skips` |
| Блок бота | Низкая | 403 → is_active=0; не слать inactive |
| Sessions растут без TTL | Низкая на MVP | Принимаем |
| Смена username после reveal | Низкая | `/matches` лечится refresh; старые сообщения — нет |
| Redelivery webhook → дубль events | Низкая | Принимаем |
| Overengineering | — | §5 + §4 PRD; новая абстракция = стоп |

Краевые случаи §10 PRD покрыты. Дополнительно: команды внутри диалога (§10.1), private-only, гейт ленты по `state`, экранирование всех полей, nullable профиль до онбординга.

## 15. Оценка уверенности

**Plan confidence: 93%**
**Implementation confidence: 88%**

Что подтверждает: PRD детален; стек сверен с официальными доками (grammY `cloudflare-mod`, conversations v2 storage API, Drizzle+D1 migrations, Bot API caption 1024 / HTML `<pre>`); скоуп ограничен §4; три ревьюера закрыли дыры rev.1.

Что снижает:
1. **Replay-дисциплина conversations (−4%)** — главный риск M2; проверяется только живым диалогом.
2. **Дев-туннель + webhook (−2%)** — отладка на M1.
3. **Pending-username (−1%)** — полная симуляция только через манипуляции D1.

Что поднимет до ~95%: зелёный M1 (деплой + ответ) и полный онбординг на M2 без дублей в D1.

Не 100%: нетривиальный продукт, serverless-гонки и плагин с replay нельзя закрыть на бумаге.

## 16. Changelog rev.2 (после deep review)

Исправлены дефекты, которые ломали бы реализацию:

- Storage в `conversations({ storage })`, не в `session()` — иначе онбординг теряется между webhook.
- `name`/`birth_year`/`gender` nullable — иначе первый `/start` падает на NOT NULL.
- Убран LIMIT 50: фильтр дистанции больше не отсекает ближних за окном recency.
- `/feed` добавлен (был пропущен относительно PRD §6.2).
- Мэтч: `ON CONFLICT DO NOTHING` + reveal только у победителя insert.
- Reveal-retry по флагу, не по «появлению username».
- Дайджест: conditional UPDATE; N без уже-мэтчей.
- `/delete`: обе стороны связей + sessions; events анонимизируются.
- Событие `onboarding_start` для фаннела §3.
- Команды внутри диалога → halt; `/cancel`.
- Private-only; гейт ленты по `state`; `is_active=1` на upsert; не слать inactive.
- Экранирование всех пользовательских полей; epoch-seconds; пин версий; `botInfo` cache; `executionCtx` из `fetch`.
- Фильтр дистанции игнорируется, если у зрителя нет coords.
- `/profile` edit включает birth_year и gender.
- Сниппет на карточке — первый по `position`.
- Сид: полный список колонок.
- Рациональ haversine: D1 math есть, считаем в коде ради простоты SQL, не из-за отсутствия функций.
