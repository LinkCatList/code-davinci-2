# Срез 05 — мэтч, reveal, дайджест лайков

**Дата:** 2026-08-14  
**Родитель:** [../deep-plan.md](../deep-plan.md) (§10.4–10.7)  
**Статус:** реализован, деплой в этом ходе  
**Запрос:** «ship this» — уведомления второй стороне + деплой

---

## Цель

После лайка второй пользователь либо получает дайджест «N новых лайков» (не чаще 1/24ч), либо при взаимном лайке оба получают reveal (фото + карточка + `t.me`). `/matches` показывает список.

## Scope

- После успешного like: взаимность → `matches` (user_a < user_b, ON CONFLICT) → reveal/pending только если строка создана; иначе дайджест получателю.
- Reveal: `sendPhoto` + caption (≤1024, HTML) + сниппеты отдельными `<pre><code class="language-…">`. Нет username у Y → pending, не флаг.
- Middleware после upsert: если username появился и `revealed_*=0` — дослать reveal.
- Дайджест: conditional UPDATE `last_like_notif_at`, N без уже-мэтчей, `waitUntil`, не фейкам, не inactive.
- 403 → `is_active=0`.
- `/matches`: имя, возраст, город, ссылка или «ждём username».

## Non-goals

- `/filters`, `/delete`, `/language`, сиды, тесты.

## Acceptance

- Один лайк → получатель видит дайджест (если 24ч окно свободно).
- Второй взаимный лайк → оба получают reveal, есть строка `matches` и событие `match`.
- Повторный лайк не шлёт ничего.
- Нет username — pending; после появления username reveal досылается.
- `pnpm typecheck` + деплой.
