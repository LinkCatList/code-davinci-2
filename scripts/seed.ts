import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FAKE_ID_BASE = 9_000_001;
const OUT_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../.temp/seed.sql");

type Locale = "ru" | "en";

type SeedSnippet = {
  language: string;
  content: string;
};

type SeedProfile = {
  name: string;
  locale: Locale;
  gender: 0 | 1;
  birthYear: number;
  bio: string;
  snippets: SeedSnippet[];
};

const PROFILES: SeedProfile[] = [
  {
    name: "Алексей",
    locale: "ru",
    gender: 0,
    birthYear: 1991,
    bio: "Живу в Белграде с осени 2022-го, веду бэкенд небольшой продуктовой команды. После работы хожу пешком без навигатора и учусь готовить что-нибудь кроме пасты. Буду рад компании на концерт.",
    snippets: [
      {
        language: "TS",
        content: `type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function parsePort(raw: string): Result<number> {
  const port = Number(raw);
  if (!/^[0-9]+$/.test(raw) || !Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false, error: "Invalid port" };
  }
  return { ok: true, value: port };
}`,
      },
    ],
  },
  {
    name: "Анна",
    locale: "ru",
    gender: 1,
    birthYear: 1993,
    bio: "Делаю интерфейсы в Берлине. Люблю велопрогулки, книжные с полками до потолка и людей, которым можно сказать «я устала» без презентации на десять слайдов.",
    snippets: [
      {
        language: "TS",
        content: `import { useEffect, useState } from "react";

export function useDebounced<T>(value: T, ms = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}`,
      },
    ],
  },
  {
    name: "Максим",
    locale: "ru",
    gender: 0,
    birthYear: 1989,
    bio: "Лиссабон, удалёнка, фронтенд. Переехал в 2023-м и до сих пор радуюсь океану как турист. Ищу человека для завтраков, разговоров и попыток наконец встать на сёрф.",
    snippets: [
      {
        language: "TS",
        content: `type Load<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "failed"; message: string };

export function mapLoad<T, U>(state: Load<T>, map: (value: T) => U): Load<U> {
  return state.status === "ready"
    ? { status: "ready", data: map(state.data) }
    : state;
}`,
      },
    ],
  },
  {
    name: "Денис",
    locale: "ru",
    gender: 0,
    birthYear: 1995,
    bio: "Автоматизирую тестирование. В свободное время собираю модели поездов: приятно, когда хоть где-то всё идёт по расписанию.",
    snippets: [
      {
        language: "TS",
        content: `export function multisetEqual<T>(left: T[], right: T[]): boolean {
  if (left.length !== right.length) return false;
  const counts = new Map<T, number>();
  for (const item of left) counts.set(item, (counts.get(item) ?? 0) + 1);
  for (const item of right) {
    const remaining = counts.get(item) ?? 0;
    if (remaining === 0) return false;
    counts.set(item, remaining - 1);
  }
  return true;
}`,
      },
    ],
  },
  {
    name: "Сергей",
    locale: "ru",
    gender: 0,
    birthYear: 1987,
    bio: "Варшава. Отвечаю за дизайн-систему, дома выращиваю базилик. Люблю камерные концерты и готовить для друзей. Можно начать знакомство с прогулки, без собеседования.",
    snippets: [
      {
        language: "TS",
        content: `const spacing = { xs: 4, sm: 8, md: 16, lg: 24 } as const;
type Space = keyof typeof spacing;

export function stackStyle(gap: Space): Record<string, string> {
  return {
    display: "flex",
    flexDirection: "column",
    gap: spacing[gap] + "px",
  };
}`,
      },
    ],
  },
  {
    name: "Никита",
    locale: "ru",
    gender: 0,
    birthYear: 1996,
    bio: "Пишу сервисы на Node.js, живу в Тбилиси. По выходным выбираюсь на скалы. Сначала боялся высоты, теперь боюсь только забыть термос.",
    snippets: [
      {
        language: "TS",
        content: `export class InFlight<K, V> {
  private pending = new Map<K, Promise<V>>();

  run(key: K, load: () => Promise<V>): Promise<V> {
    const existing = this.pending.get(key);
    if (existing) return existing;
    const task = Promise.resolve().then(load).finally(() => {
      this.pending.delete(key);
    });
    this.pending.set(key, task);
    return task;
  }
}`,
      },
    ],
  },
  {
    name: "Роман",
    locale: "ru",
    gender: 0,
    birthYear: 1990,
    bio: "Амстердам. Фронтенд в образовательном сервисе, плёночная фотография и воскресный рынок. Могу долго выбирать помидоры и быстро решиться на поездку.",
    snippets: [
      {
        language: "TS",
        content: `export function groupBy<T, K>(items: readonly T[], keyOf: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}`,
      },
    ],
  },
  {
    name: "Илья",
    locale: "ru",
    gender: 0,
    birthYear: 1994,
    bio: "Разработчик инструментов для других разработчиков. Играю на басу, читаю фантастику. Предпочитаю долгий разговор громкой вечеринке.",
    snippets: [
      {
        language: "TS",
        content: `type Job =
  | { type: "email"; to: string }
  | { type: "webhook"; url: string };

function unreachable(value: never): never {
  throw new Error("Unexpected job: " + JSON.stringify(value));
}

export function destination(job: Job): string {
  switch (job.type) {
    case "email": return job.to;
    case "webhook": return job.url;
    default: return unreachable(job);
  }
}`,
      },
    ],
  },
  {
    name: "Вадим",
    locale: "ru",
    gender: 0,
    birthYear: 1986,
    bio: "Осел в Барселоне после переезда в 2022-м. Руковожу небольшой веб-командой, но код пока не отпускает. Танцую бачату на уровне «зато улыбается».",
    snippets: [
      {
        language: "TS",
        content: `export function pageWindow(current: number, total: number): number[] {
  if (!Number.isInteger(total) || total < 1) return [];
  if (!Number.isInteger(current) || current < 1 || current > total) {
    throw new RangeError("Invalid current page");
  }
  const start = Math.max(1, Math.min(current - 2, total - 4));
  const end = Math.min(total, start + 4);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}`,
      },
    ],
  },
  {
    name: "Тимур",
    locale: "ru",
    gender: 0,
    birthYear: 1997,
    bio: "Ереван. Делаю клиентскую часть финансового приложения. Вечером готовлю острое и учу армянский. Хочется найти близкого человека, с которым хорошо даже в очереди за документами.",
    snippets: [
      {
        language: "TS",
        content: `type Currency = "EUR" | "USD";
type Money = { cents: number; currency: Currency };

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) throw new Error("Currency mismatch");
  const cents = a.cents + b.cents;
  if (![a.cents, b.cents, cents].every(Number.isSafeInteger)) {
    throw new RangeError("Amounts must be safe integers");
  }
  return { cents, currency: a.currency };
}`,
      },
    ],
  },
  {
    name: "Иван",
    locale: "ru",
    gender: 0,
    birthYear: 1992,
    bio: "Занимаюсь прикладным ML в Берлине. Вне работы люблю пешие маршруты и старое кино. Если модель сложнее задачи, сначала завариваю чай.",
    snippets: [
      {
        language: "Python",
        content: `import math

def softmax(scores: list[float]) -> list[float]:
    if not scores:
        return []
    if not all(math.isfinite(score) for score in scores):
        raise ValueError("scores must be finite")
    peak = max(scores)
    weights = [math.exp(score - peak) for score in scores]
    total = sum(weights)
    return [weight / total for weight in weights]`,
      },
    ],
  },
  {
    name: "Мария",
    locale: "ru",
    gender: 1,
    birthYear: 1991,
    bio: "Инженер данных, живу в Лиссабоне. Переезд в 2023-м научил просить помощи и путешествовать налегке. Люблю керамику, море зимой и ужины, которые незаметно переходят в завтрак.",
    snippets: [
      {
        language: "Python",
        content: `from dataclasses import dataclass

@dataclass(frozen=True)
class Window:
    start: int
    end: int

def merge(windows: list[Window]) -> list[Window]:
    out: list[Window] = []
    for window in sorted(windows, key=lambda w: w.start):
        if window.start >= window.end:
            raise ValueError("invalid window")
        if not out or out[-1].end < window.start:
            out.append(window)
        else:
            out[-1] = Window(out[-1].start, max(out[-1].end, window.end))
    return out`,
      },
    ],
  },
  {
    name: "Пётр",
    locale: "ru",
    gender: 0,
    birthYear: 1988,
    bio: "Пишу серверную часть на Python. Хлеб на закваске получается через раз, зато кот всегда доволен коробкой от муки.",
    snippets: [
      {
        language: "Python",
        content: `from collections.abc import Iterable, Iterator
from itertools import islice
from typing import TypeVar

T = TypeVar("T")

def batched(items: Iterable[T], size: int) -> Iterator[list[T]]:
    if size < 1:
        raise ValueError("size must be positive")
    source = iter(items)
    while batch := list(islice(source, size)):
        yield batch`,
      },
    ],
  },
  {
    name: "Андрей",
    locale: "ru",
    gender: 0,
    birthYear: 1984,
    bio: "Алматы. Строю пайплайны данных, по субботам ухожу в горы. В отношениях ценю заботу и чувство юмора. В рюкзаке всегда есть лишний бутерброд.",
    snippets: [
      {
        language: "Python",
        content: `from collections import Counter

def word_counts(lines: list[str]) -> Counter[str]:
    counts: Counter[str] = Counter()
    for line in lines:
        words = (word.strip(".,!?;:").casefold() for word in line.split())
        counts.update(word for word in words if word)
    return counts`,
      },
    ],
  },
  {
    name: "Михаил",
    locale: "ru",
    gender: 0,
    birthYear: 1993,
    bio: "В Тбилиси с 2022 года. Автоматизирую проверки API, собираю друзей на настолки. Правила объясняю терпеливо, проигрывать тоже научился. Почти.",
    snippets: [
      {
        language: "Python",
        content: `import json

def without_keys(value: object, ignored: set[str]) -> object:
    if isinstance(value, dict):
        return {
            key: without_keys(item, ignored)
            for key, item in value.items() if key not in ignored
        }
    if isinstance(value, list):
        return [without_keys(item, ignored) for item in value]
    return value

def canonical_json(raw: str, ignored: set[str]) -> str:
    return json.dumps(without_keys(json.loads(raw), ignored), sort_keys=True)`,
      },
    ],
  },
  {
    name: "Георгий",
    locale: "ru",
    gender: 0,
    birthYear: 1990,
    bio: "Работаю с рекомендательными системами в Амстердаме. Велосипед выбирал дольше, чем квартиру. Люблю джаз и поездки на поезде без плотной программы.",
    snippets: [
      {
        language: "Python",
        content: `import math

def cosine(a: list[float], b: list[float]) -> float:
    if len(a) != len(b):
        raise ValueError("dimension mismatch")
    if not all(math.isfinite(x) for x in a + b):
        raise ValueError("vectors must be finite")
    norm_a, norm_b = math.hypot(*a), math.hypot(*b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return sum((x / norm_a) * (y / norm_b) for x, y in zip(a, b))`,
      },
    ],
  },
  {
    name: "Лев",
    locale: "ru",
    gender: 0,
    birthYear: 1998,
    bio: "Аналитика, Python и бег на короткие дистанции. Умею слушать. Не умею оставлять недочитанной хорошую книгу, даже если завтра рано вставать.",
    snippets: [
      {
        language: "Python",
        content: `def sliding_average(values: list[float], size: int) -> list[float]:
    if size <= 0:
        raise ValueError("size must be positive")
    result: list[float] = []
    total = 0.0
    for index, value in enumerate(values):
        total += value
        if index >= size:
            total -= values[index - size]
        if index + 1 >= size:
            result.append(total / size)
    return result`,
      },
    ],
  },
  {
    name: "Виктор",
    locale: "ru",
    gender: 0,
    birthYear: 1985,
    bio: "Белград. Много лет делаю бэкенд, сейчас помогаю команде расти. В свободное время чиню старые радиоприёмники. Люблю вещи и отношения, у которых есть история.",
    snippets: [
      {
        language: "Python",
        content: `from datetime import datetime, timezone

def as_utc(raw: str) -> datetime:
    value = datetime.fromisoformat(raw)
    if value.tzinfo is None:
        raise ValueError("timezone is required")
    return value.astimezone(timezone.utc)`,
      },
    ],
  },
  {
    name: "Руслан",
    locale: "ru",
    gender: 0,
    birthYear: 1994,
    bio: "Варшава, инженер данных. Днём разбираю чужие CSV, вечером пробую новые рецепты. Мечтаю проехать длинный веломаршрут с человеком, который тоже останавливается ради красивого вида.",
    snippets: [
      {
        language: "Python",
        content: `import csv
from collections.abc import Iterator
from decimal import Decimal
from io import StringIO

def read_totals(raw: str) -> Iterator[tuple[str, Decimal]]:
    for row in csv.DictReader(StringIO(raw)):
        amount = Decimal(row["amount"])
        if not amount.is_finite():
            raise ValueError("amount must be finite")
        yield row["order_id"].strip(), amount`,
      },
    ],
  },
  {
    name: "Семён",
    locale: "ru",
    gender: 0,
    birthYear: 1996,
    bio: "Обучаю модели для работы с текстом. Сам люблю бумажные письма, походы с ночёвкой и разговоры без попытки немедленно всё оптимизировать.",
    snippets: [
      {
        language: "Python",
        content: `import unicodedata

def normalize_text(text: str) -> str:
    normalized = unicodedata.normalize("NFKC", text)
    return " ".join(normalized.casefold().split())

def vocabulary(texts: list[str]) -> dict[str, int]:
    tokens = {word for text in texts for word in normalize_text(text).split()}
    return {word: index for index, word in enumerate(sorted(tokens))}`,
      },
    ],
  },
  {
    name: "Кирилл",
    locale: "ru",
    gender: 0,
    birthYear: 1992,
    bio: "Пишу сервисы на Go, живу в Лимасоле. Море помогает закрывать ноутбук вовремя. Люблю плавать, готовить рыбу и обсуждать планы, которые не помещаются в рабочий календарь.",
    snippets: [
      {
        language: "Go",
        content: `func fetch(ctx context.Context, client *http.Client, url string) ([]byte, error) {
    ctx, cancel := context.WithTimeout(ctx, 800*time.Millisecond)
    defer cancel()
    req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
    if err != nil { return nil, err }
    res, err := client.Do(req)
    if err != nil { return nil, err }
    defer res.Body.Close()
    if res.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("unexpected status: %d", res.StatusCode)
    }
    return io.ReadAll(res.Body)
}`,
      },
    ],
  },
  {
    name: "Олег",
    locale: "ru",
    gender: 0,
    birthYear: 1988,
    bio: "Инфраструктура, Белград. После переезда в 2022-м заново собрал круг друзей. Теперь собираю винил и компанию для поездок на выходные. Телефон ночью со звуком только в дежурство.",
    snippets: [
      {
        language: "Go",
        content: `func backoff(attempt int) time.Duration {
    delay := 50 * time.Millisecond
    const limit = 2 * time.Second
    for i := 0; i < attempt && delay < limit; i++ {
        delay *= 2
    }
    if delay > limit { return limit }
    return delay
}`,
      },
    ],
  },
  {
    name: "Антон",
    locale: "ru",
    gender: 0,
    birthYear: 1991,
    bio: "Берлин. Бэкенд в логистике, сквош и довольно серьёзное отношение к завтраку. Обычно спокойный, кроме моментов, когда кто-то называет круассан просто булкой.",
    snippets: [
      {
        language: "Go",
        content: `type Set[T comparable] map[T]struct{}

func (s Set[T]) Has(value T) bool {
    _, ok := s[value]
    return ok
}

func Unique[T comparable](values []T) []T {
    seen := make(Set[T])
    out := make([]T, 0, len(values))
    for _, value := range values {
        if seen.Has(value) { continue }
        seen[value] = struct{}{}
        out = append(out, value)
    }
    return out
}`,
      },
    ],
  },
  {
    name: "Константин",
    locale: "ru",
    gender: 0,
    birthYear: 1983,
    bio: "Занимаюсь распределёнными системами. По вечерам учусь играть на фортепиано. Хочу отношений, где можно быть собой, ошибаться и вместе смеяться над этим.",
    snippets: [
      {
        language: "Go",
        content: `type Counter struct {
    mu sync.Mutex
    values map[string]int64
}

func (c *Counter) Add(key string, delta int64) int64 {
    c.mu.Lock()
    defer c.mu.Unlock()
    if c.values == nil { c.values = make(map[string]int64) }
    c.values[key] += delta
    return c.values[key]
}`,
      },
    ],
  },
  {
    name: "Давид",
    locale: "ru",
    gender: 0,
    birthYear: 1995,
    bio: "Живу в Ереване, разрабатываю внутреннюю платформу. Хорошо знаю кофейни, плохо — названия созвездий, но пытаюсь разобраться. Люблю выезды за город и неспешные знакомства.",
    snippets: [
      {
        language: "Go",
        content: `func Wait(ctx context.Context, delay time.Duration) error {
    if err := ctx.Err(); err != nil { return err }
    timer := time.NewTimer(delay)
    defer timer.Stop()
    select {
    case <-ctx.Done():
        return ctx.Err()
    case <-timer.C:
        return nil
    }
}`,
      },
    ],
  },
  {
    name: "Артур",
    locale: "ru",
    gender: 0,
    birthYear: 1990,
    bio: "Бэкенд, Алматы. Переехал в 2023-м, полюбил горы и ранние подъёмы ради них. В обычные дни ранние подъёмы по-прежнему под вопросом.",
    snippets: [
      {
        language: "Go",
        content: `func ParseIDs(raw string) ([]int64, error) {
    if strings.TrimSpace(raw) == "" { return nil, nil }
    parts := strings.Split(raw, ",")
    ids := make([]int64, 0, len(parts))
    for _, part := range parts {
        id, err := strconv.ParseInt(strings.TrimSpace(part), 10, 64)
        if err != nil || id <= 0 {
            return nil, fmt.Errorf("invalid id: %q", part)
        }
        ids = append(ids, id)
    }
    return ids, nil
}`,
      },
    ],
  },
  {
    name: "Борис",
    locale: "ru",
    gender: 0,
    birthYear: 1986,
    bio: "Лиссабон. Делаю инструменты для инфраструктуры. По воскресеньям хожу на блошиный рынок за вещами, которые мне не нужны. Иногда нахожу там отличные истории.",
    snippets: [
      {
        language: "Go",
        content: `func WriteJSON(w http.ResponseWriter, status int, value any) error {
    body, err := json.Marshal(value)
    if err != nil { return err }
    w.Header().Set("Content-Type", "application/json; charset=utf-8")
    w.WriteHeader(status)
    _, err = w.Write(append(body, '\\n'))
    return err
}`,
      },
    ],
  },
  {
    name: "Глеб",
    locale: "ru",
    gender: 0,
    birthYear: 1999,
    bio: "Go, мониторинг и домашняя пицца. Работаю в команде платформы, бегаю без рекордов. Буду рад человеку, с которым можно делить и тишину, и последний кусок.",
    snippets: [
      {
        language: "Go",
        content: `func MovingMean(values []float64, size int) ([]float64, error) {
    if size < 1 { return nil, fmt.Errorf("size must be positive") }
    out := make([]float64, 0)
    sum := 0.0
    for i, value := range values {
        sum += value
        if i >= size { sum -= values[i-size] }
        if i+1 >= size { out = append(out, sum/float64(size)) }
    }
    return out, nil
}`,
      },
    ],
  },
  {
    name: "Евгений",
    locale: "ru",
    gender: 0,
    birthYear: 1991,
    bio: "Барселона, веб-анимации. Катаюсь на лонгборде, рисую в блокноте людей в метро. В жизни люблю меньше эффектов и больше прямых слов.",
    snippets: [
      {
        language: "JS",
        content: `export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(from, to, progress) {
  return from + (to - from) * clamp(progress, 0, 1);
}

export function damp(current, target, speed, dt) {
  return lerp(current, target, 1 - Math.exp(-speed * dt));
}`,
      },
    ],
  },
  {
    name: "Владислав",
    locale: "ru",
    gender: 0,
    birthYear: 1994,
    bio: "Фронтенд в Варшаве. Переехал в 2022 году с одним чемоданом, теперь для переезда понадобится отдельная машина для растений. Люблю прогулки под дождём, если потом есть где согреться.",
    snippets: [
      {
        language: "JS",
        content: `export function debounce(fn, delay = 200) {
  let timer;
  function wrapped(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  }
  wrapped.cancel = () => clearTimeout(timer);
  return wrapped;
}`,
      },
    ],
  },
  {
    name: "Степан",
    locale: "ru",
    gender: 0,
    birthYear: 1989,
    bio: "Тбилиси. Разрабатываю веб-приложения для музыкантов, сам играю на барабанах. Люблю походы и маленькие концерты, где видно, как люди радуются своей музыке.",
    snippets: [
      {
        language: "JS",
        content: `export function once(fn) {
  let called = false;
  let result;
  return function (...args) {
    if (!called) {
      result = fn.apply(this, args);
      called = true;
    }
    return result;
  };
}`,
      },
    ],
  },
  {
    name: "Фёдор",
    locale: "ru",
    gender: 0,
    birthYear: 1996,
    bio: "Делаю доступные интерфейсы. Учусь жестовому языку, люблю документальное кино. Нравится, когда люди увлечённо рассказывают о том, в чём я совсем не разбираюсь.",
    snippets: [
      {
        language: "JS",
        content: `export function bindDisclosure(button, panel) {
  const sync = () => button.setAttribute("aria-expanded", String(!panel.hidden));
  const toggle = () => {
    panel.hidden = !panel.hidden;
    sync();
  };
  button.setAttribute("aria-controls", panel.id);
  sync();
  button.addEventListener("click", toggle);
  return () => button.removeEventListener("click", toggle);
}`,
      },
    ],
  },
  {
    name: "Ярослав",
    locale: "ru",
    gender: 0,
    birthYear: 1993,
    bio: "Амстердам. Пишу на JavaScript, готовлю кофе без весов — да, так можно. Коллекционирую маршруты для прогулок и смешные вывески. Хочу познакомиться без бесконечной переписки.",
    snippets: [
      {
        language: "JS",
        content: `export function queryString(params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (item != null) query.append(key, String(item));
    }
  }
  return query.toString();
}`,
      },
    ],
  },
  {
    name: "Матвей",
    locale: "ru",
    gender: 0,
    birthYear: 2001,
    bio: "Лимасол. Разрабатываю интерфейсы, в свободное время снимаю короткие видео и ныряю с маской. Люблю спонтанные планы, но на встречу прихожу вовремя.",
    snippets: [
      {
        language: "JS",
        content: `export async function readJson(url, signal) {
  const response = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error("HTTP " + response.status);
  }
  return response.json();
}`,
      },
    ],
  },
  {
    name: "Дмитрий",
    locale: "ru",
    gender: 0,
    birthYear: 1987,
    bio: "Java-бэкенд в Берлине. В 2023-м сменил страну, работу и привычку откладывать жизнь на отпуск. Теперь по пятницам обязательно куда-нибудь выбираюсь. Присоединяйся.",
    snippets: [
      {
        language: "Java",
        content: `public record IdempotencyKey(String value) {
    public IdempotencyKey {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("empty key");
        }
        value = value.strip();
    }
}`,
      },
    ],
  },
  {
    name: "Николай",
    locale: "ru",
    gender: 0,
    birthYear: 1981,
    bio: "Разрабатываю банковские сервисы. Хожу под парусом, дома люблю тишину и хороший чай. Давно перестал считать занятость достижением. Ищу тёплые, устойчивые отношения.",
    snippets: [
      {
        language: "Java",
        content: `public record Page(int offset, int limit) {
    public Page {
        if (offset < 0 || limit < 1 || limit > 100) {
            throw new IllegalArgumentException("invalid page");
        }
    }

    public Page next() {
        return new Page(Math.addExact(offset, limit), limit);
    }
}`,
      },
    ],
  },
  {
    name: "Василий",
    locale: "ru",
    gender: 0,
    birthYear: 1990,
    bio: "Белград, серверная разработка. Люблю шахматы в парке, длинные обеды и поездки на электричках. Расскажу про любимый фильм, если ты расскажешь про свой.",
    snippets: [
      {
        language: "Java",
        content: `import java.time.Instant;

public record TimeRange(Instant start, Instant end) {
    public TimeRange {
        if (start == null || end == null || !start.isBefore(end)) {
            throw new IllegalArgumentException("invalid range");
        }
    }

    public boolean contains(Instant point) {
        return !point.isBefore(start) && point.isBefore(end);
    }
}`,
      },
    ],
  },
  {
    name: "Александр",
    locale: "ru",
    gender: 0,
    birthYear: 1985,
    bio: "Варшава. Веду команду Java-разработчиков, но любимая роль — человек с картой в походе. Иногда ошибаюсь тропой; обычно именно там самый красивый вид.",
    snippets: [
      {
        language: "Java",
        content: `import java.util.LinkedHashMap;
import java.util.Map;

public final class LruCache<K, V> extends LinkedHashMap<K, V> {
    private final int capacity;

    public LruCache(int capacity) {
        super(16, 0.75f, true);
        if (capacity < 1) throw new IllegalArgumentException("invalid capacity");
        this.capacity = capacity;
    }

    @Override
    protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
        return size() > capacity;
    }
}`,
      },
    ],
  },
  {
    name: "Эмиль",
    locale: "ru",
    gender: 0,
    birthYear: 1994,
    bio: "Ереван. Пишу сервисы для онлайн-обучения. Учу испанский, танцую сальсу и каждый раз обещаю себе не покупать больше книг, пока не прочитаю купленные.",
    snippets: [
      {
        language: "Java",
        content: `import java.util.Optional;

public final class Names {
    private Names() {}

    public static Optional<String> nonBlank(String raw) {
        return Optional.ofNullable(raw)
            .map(String::strip)
            .filter(value -> !value.isEmpty());
    }
}`,
      },
    ],
  },
  {
    name: "Леонид",
    locale: "ru",
    gender: 0,
    birthYear: 1989,
    bio: "Автоматизация тестирования на JVM. Люблю собак, столярку и научпоп. На работе ищу крайние случаи, в жизни стараюсь замечать хорошее в обычных днях.",
    snippets: [
      {
        language: "Java",
        content: `import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public final class Lists {
    public static <T> List<Integer> mismatchIndices(List<T> a, List<T> b) {
        var out = new ArrayList<Integer>();
        for (int i = 0; i < Math.max(a.size(), b.size()); i++) {
            if (i >= a.size() || i >= b.size() || !Objects.equals(a.get(i), b.get(i))) {
                out.add(i);
            }
        }
        return out;
    }
}`,
      },
    ],
  },
  {
    name: "Владимир",
    locale: "ru",
    gender: 0,
    birthYear: 1986,
    bio: "Сервисы на C#, Лимасол. Переехал в 2022-м, стал чаще плавать и реже спорить в интернете. Люблю готовить большие ужины и знакомить между собой друзей.",
    snippets: [
      {
        language: "C#",
        content: `public sealed class SlidingWindow
{
    private readonly Queue<DateTimeOffset> _hits = new();
    private readonly object _gate = new();

    public bool TryHit(DateTimeOffset now)
    {
        lock (_gate)
        {
            while (_hits.Count > 0 && now - _hits.Peek() >= TimeSpan.FromMinutes(1))
                _hits.Dequeue();
            if (_hits.Count >= 60) return false;
            _hits.Enqueue(now);
            return true;
        }
    }
}`,
      },
    ],
  },
  {
    name: "Платон",
    locale: "ru",
    gender: 0,
    birthYear: 1992,
    bio: "Делаю инструменты для игр, живу в Барселоне. Рисую миниатюры, хожу на скалодром. Люблю людей, которые умеют увлекаться чем-то просто потому, что это весело.",
    snippets: [
      {
        language: "C#",
        content: `public readonly record struct Point(double X, double Y)
{
    public Point Lerp(Point target, double progress)
    {
        var t = Math.Clamp(progress, 0.0, 1.0);
        return new Point(X + (target.X - X) * t, Y + (target.Y - Y) * t);
    }

    public double DistanceSquared(Point other)
        => (X - other.X) * (X - other.X) + (Y - other.Y) * (Y - other.Y);
}`,
      },
    ],
  },
  {
    name: "Савелий",
    locale: "ru",
    gender: 0,
    birthYear: 1995,
    bio: "Алматы. Бэкенд на .NET, теннис и семейные рецепты, записанные от руки. Ценю любопытство, доброту и возможность спокойно договориться.",
    snippets: [
      {
        language: "C#",
        content: `public static class Dates
{
    public static IEnumerable<DateOnly> EachDay(DateOnly start, DateOnly end)
    {
        if (start > end) yield break;
        var day = start;
        while (true)
        {
            yield return day;
            if (day == end) yield break;
            day = day.AddDays(1);
        }
    }
}`,
      },
    ],
  },
  {
    name: "Даниил",
    locale: "ru",
    gender: 0,
    birthYear: 1997,
    bio: "Разрабатываю внутренние сервисы на C#. Люблю комиксы, лыжи и готовить завтраки по воскресеньям. Хочу больше совместных впечатлений и меньше разговоров о дедлайнах.",
    snippets: [
      {
        language: "C#",
        content: `public static class Sequences
{
    public static IEnumerable<T> DistinctByKey<T, TKey>(
        IEnumerable<T> source, Func<T, TKey> keyOf)
    {
        var seen = new HashSet<TKey>();
        foreach (var item in source)
        {
            if (seen.Add(keyOf(item))) yield return item;
        }
    }
}`,
      },
    ],
  },
  {
    name: "Павел",
    locale: "ru",
    gender: 0,
    birthYear: 1988,
    bio: "Берлин, встроенные системы. Люблю ремонтировать велосипеды и ездить на них в лес. С железом терпелив, с людьми стараюсь быть ещё терпеливее.",
    snippets: [
      {
        language: "C++",
        content: `#include <array>
#include <cstddef>
#include <optional>

template <typename T, std::size_t N>
class Ring {
  static_assert(N > 0);
  std::array<T, N> data{};
  std::size_t head = 0, size = 0;
public:
  bool push(const T& value) {
    if (size == N) return false;
    data[(head + size) % N] = value;
    ++size;
    return true;
  }
  std::optional<T> pop() {
    if (size == 0) return std::nullopt;
    T value = data[head];
    head = (head + 1) % N;
    --size;
    return value;
  }
};`,
      },
    ],
  },
  {
    name: "Игорь",
    locale: "ru",
    gender: 0,
    birthYear: 1982,
    bio: "Практикую C++ и спокойствие в Белграде. Переехал в 2023-м, увлёкся фотографией птиц. Могу полчаса ждать нужный кадр, зато в кафе выбираю быстро.",
    snippets: [
      {
        language: "C++",
        content: `#include <cstddef>
#include <optional>
#include <span>

std::optional<std::size_t> find_index(std::span<const int> values, int target) {
  std::size_t left = 0, right = values.size();
  // Input is sorted in ascending order.
  while (left < right) {
    const auto mid = left + (right - left) / 2;
    if (values[mid] < target) left = mid + 1;
    else right = mid;
  }
  if (left < values.size() && values[left] == target) return left;
  return std::nullopt;
}`,
      },
    ],
  },
  {
    name: "Григорий",
    locale: "ru",
    gender: 0,
    birthYear: 1991,
    bio: "Амстердам. Программирую графику, вне монитора люблю акварель и архитектуру. Часто сворачиваю с маршрута ради красивого дома. Хорошо бы делать это вдвоём.",
    snippets: [
      {
        language: "C++",
        content: `#include <cmath>
#include <optional>

struct Vec2 {
  double x, y;
};

std::optional<Vec2> normalized(Vec2 value) {
  const double length = std::hypot(value.x, value.y);
  if (length == 0 || !std::isfinite(length)) return std::nullopt;
  return Vec2{value.x / length, value.y / length};
}`,
      },
    ],
  },
  {
    name: "Валерий",
    locale: "ru",
    gender: 0,
    birthYear: 1984,
    bio: "Системный разработчик. Коллекционирую старые карты, хожу в походы и люблю долго готовить под музыку. Умею планировать, но оставляю место случайностям.",
    snippets: [
      {
        language: "C++",
        content: `#include <array>
#include <cstdint>
#include <span>

std::array<std::uint8_t, 4> encode_u32(std::uint32_t value) {
  return {std::uint8_t(value >> 24), std::uint8_t(value >> 16),
          std::uint8_t(value >> 8), std::uint8_t(value)};
}

std::uint32_t decode_u32(std::span<const std::uint8_t, 4> bytes) {
  return (std::uint32_t(bytes[0]) << 24) | (std::uint32_t(bytes[1]) << 16)
       | (std::uint32_t(bytes[2]) << 8) | std::uint32_t(bytes[3]);
}`,
      },
    ],
  },
  {
    name: "Клим",
    locale: "ru",
    gender: 0,
    birthYear: 1993,
    bio: "iOS-разработчик в Лиссабоне. Люблю утреннее море, собак и небольшие музеи. На работе делаю навигацию, в отпуске с удовольствием теряюсь.",
    snippets: [
      {
        language: "Swift",
        content: `enum Load<Value> {
    case idle
    case loading
    case ready(Value)
    case failed(String)

    func map<Next>(_ transform: (Value) -> Next) -> Load<Next> {
        switch self {
        case .idle: return .idle
        case .loading: return .loading
        case .ready(let value): return .ready(transform(value))
        case .failed(let message): return .failed(message)
        }
    }
}`,
      },
    ],
  },
  {
    name: "Елена",
    locale: "ru",
    gender: 1,
    birthYear: 1990,
    bio: "Делаю приложения для iPhone, живу в Барселоне с 2023 года. Хожу в горы, пеку хлеб, иногда пропадаю в музее на полдня. Ценю самостоятельность и нежность, они отлично уживаются.",
    snippets: [
      {
        language: "Swift",
        content: `extension Sequence where Element: Hashable {
    func unique() -> [Element] {
        var seen = Set<Element>()
        return filter { seen.insert($0).inserted }
    }
}

struct Route: Hashable {
    let screen: String
    let itemID: Int?
}`,
      },
    ],
  },
  {
    name: "Тихон",
    locale: "ru",
    gender: 0,
    birthYear: 1996,
    bio: "Мобильная разработка, Swift. Играю в любительском театре, учусь говорить громче и яснее. Люблю настолки, длинные прогулки и людей без вечной иронии.",
    snippets: [
      {
        language: "Swift",
        content: `actor MemoryStore<Key: Hashable & Sendable, Value: Sendable> {
    private var values: [Key: Value] = [:]

    func value(for key: Key) -> Value? {
        values[key]
    }

    func set(_ value: Value, for key: Key) {
        values[key] = value
    }

    func removeAll() {
        values.removeAll()
    }
}`,
      },
    ],
  },
  {
    name: "Артём",
    locale: "ru",
    gender: 0,
    birthYear: 1994,
    bio: "Android-разработка, Тбилиси. По выходным выбираюсь в горы или готовлю для друзей. В 2022-м переехал с рюкзаком; привычку брать мало вещей сохранил.",
    snippets: [
      {
        language: "Kotlin",
        content: `import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay

suspend fun <T> retryIO(times: Int = 3, block: suspend () -> T): T {
    require(times > 0)
    repeat(times - 1) { attempt ->
        try {
            return block()
        } catch (e: CancellationException) {
            throw e
        } catch (e: java.io.IOException) {
            delay(100L * (attempt + 1))
        }
    }
    return block()
}`,
      },
    ],
  },
  {
    name: "Дарья",
    locale: "ru",
    gender: 1,
    birthYear: 1995,
    bio: "Варшава, Android. Люблю велопоездки, хорошую фантастику и ужины без телефонов. Ищу человека, с которым можно строить планы и спокойно менять их, когда начинается дождь.",
    snippets: [
      {
        language: "Kotlin",
        content: `sealed interface Screen<out T> {
    data object Loading : Screen<Nothing>
    data class Ready<T>(val data: T) : Screen<T>
    data class Failed(val message: String) : Screen<Nothing>
}

fun <T, R> Screen<T>.map(transform: (T) -> R): Screen<R> = when (this) {
    Screen.Loading -> Screen.Loading
    is Screen.Ready -> Screen.Ready(transform(data))
    is Screen.Failed -> this
}`,
      },
    ],
  },
  {
    name: "Марк",
    locale: "ru",
    gender: 0,
    birthYear: 2000,
    bio: "Живу в Ереване, делаю мобильные приложения. Учусь снимать на плёнку и не проверять результат сразу. Люблю маленькие поездки, острые супы и добрые шутки.",
    snippets: [
      {
        language: "Kotlin",
        content: `data class Task(val id: Long, val title: String, val done: Boolean)

fun List<Task>.toggle(id: Long): List<Task> = map { task ->
    if (task.id == id) task.copy(done = !task.done) else task
}

fun List<Task>.pendingTitles(): List<String> =
    filterNot { it.done }.map { it.title }`,
      },
    ],
  },
  {
    name: "Егор",
    locale: "ru",
    gender: 0,
    birthYear: 1991,
    bio: "Белград. Поддерживаю большой PHP-продукт и маленький огород на балконе. Люблю путешествовать без списка обязательных достопримечательностей и разговаривать за готовкой.",
    snippets: [
      {
        language: "PHP",
        content: `final class TimeWindow
{
    public function __construct(
        public readonly DateTimeImmutable $start,
        public readonly DateTimeImmutable $end,
    ) {
        if ($start >= $end) {
            throw new InvalidArgumentException('Invalid window');
        }
    }

    public function contains(DateTimeImmutable $time): bool
    {
        return $time >= $this->start && $time < $this->end;
    }
}`,
      },
    ],
  },
  {
    name: "Виталий",
    locale: "ru",
    gender: 0,
    birthYear: 1987,
    bio: "PHP с тех времён, когда это ещё не было легаси. Люблю бадминтон, детективы и ранние завтраки. Хочу найти человека, которому можно отправить нелепую фотографию и стать чуть ближе.",
    snippets: [
      {
        language: "PHP",
        content: `function firstMatch(iterable $items, callable $accept): mixed
{
    foreach ($items as $item) {
        if ($accept($item)) {
            return $item;
        }
    }
    return null;
}`,
      },
    ],
  },
  {
    name: "Демид",
    locale: "ru",
    gender: 0,
    birthYear: 1992,
    bio: "Системный разработчик в Берлине, пишу на Rust. После переезда в 2023-м начал ходить в хор. Оказалось, петь с другими людьми легче, чем одному дома.",
    snippets: [
      {
        language: "Rust",
        content: `#[derive(Debug)]
pub enum PortError {
    Invalid(std::num::ParseIntError),
    Zero,
}

pub fn parse_port(raw: &str) -> Result<u16, PortError> {
    let port = raw.parse::<u16>().map_err(PortError::Invalid)?;
    if port == 0 {
        return Err(PortError::Zero);
    }
    Ok(port)
}`,
      },
    ],
  },
  {
    name: "Всеволод",
    locale: "ru",
    gender: 0,
    birthYear: 1989,
    bio: "Алматы. Разрабатываю инструменты для обработки данных на Rust. Люблю пешие походы и научную фантастику. Могу молчать рядом, не считая это неловкостью.",
    snippets: [
      {
        language: "Rust",
        content: `pub fn parse_pair(input: &str) -> Option<(&str, &str)> {
    let (key, value) = input.split_once('=')?;
    let key = key.trim();
    if key.is_empty() {
        return None;
    }
    Some((key, value.trim()))
}

pub fn nonempty_lines(input: &str) -> impl Iterator<Item = &str> {
    input.lines().map(str::trim).filter(|line| !line.is_empty())
}`,
      },
    ],
  },
  {
    name: "Герман",
    locale: "ru",
    gender: 0,
    birthYear: 1986,
    bio: "Лиссабон, Ruby и небольшой продукт для путешественников. В свободное время хожу под парусом и учу португальский. Нравятся люди, с которыми обычный поход за продуктами становится прогулкой.",
    snippets: [
      {
        language: "Ruby",
        content: `class Money
  attr_reader :cents, :currency

  def initialize(cents, currency)
    raise ArgumentError, "integer cents required" unless cents.is_a?(Integer)
    @cents = cents
    @currency = currency.dup.freeze
    freeze
  end

  def +(other)
    raise ArgumentError, "currency mismatch" unless currency == other.currency
    Money.new(cents + other.cents, currency)
  end
end`,
      },
    ],
  },
  {
    name: "Захар",
    locale: "ru",
    gender: 0,
    birthYear: 1993,
    bio: "Rails-разработчик. Люблю чинить старые вещи, печь пироги и звать друзей в гости. В знакомствах за честность и любопытство: расскажи, чему ты недавно научился или научилась.",
    snippets: [
      {
        language: "Ruby",
        content: `def index_by_unique(items)
  items.each_with_object({}) do |item, index|
    key = yield(item)
    raise ArgumentError, "duplicate key: #{key}" if index.key?(key)
    index[key] = item
  end
end`,
      },
    ],
  },
];

if (PROFILES.length !== 60) {
  throw new Error(`expected 60 profiles, got ${PROFILES.length}`);
}

function sqlText(value: string): string {
  const hex = Buffer.from(value, "utf8").toString("hex");
  return `CAST(X'${hex}' AS TEXT)`;
}

function buildSql(now: number): string {
  const lines: string[] = [
    "DELETE FROM snippets WHERE user_id IN (SELECT id FROM users WHERE is_fake = 1);",
    "DELETE FROM likes WHERE from_user IN (SELECT id FROM users WHERE is_fake = 1) OR to_user IN (SELECT id FROM users WHERE is_fake = 1);",
    "DELETE FROM skips WHERE from_user IN (SELECT id FROM users WHERE is_fake = 1) OR to_user IN (SELECT id FROM users WHERE is_fake = 1);",
    "DELETE FROM matches WHERE user_a IN (SELECT id FROM users WHERE is_fake = 1) OR user_b IN (SELECT id FROM users WHERE is_fake = 1);",
    "DELETE FROM users WHERE is_fake = 1;",
  ];

  for (const [index, profile] of PROFILES.entries()) {
    const id = FAKE_ID_BASE + index;
    const createdAt = now - (PROFILES.length + 10 - index) * 86400;
    const lastActiveAt = now - index * 3600;
    lines.push(
      [
        "INSERT INTO users (",
        "id, username, locale, state, name, birth_year, gender, bio, lang_filter,",
        "is_active, is_fake, last_active_at, last_like_notif_at, created_at",
        ") VALUES (",
        `${id}, NULL, ${sqlText(profile.locale)}, NULL, ${sqlText(profile.name)}, ${profile.birthYear}, ${profile.gender},`,
        `${sqlText(profile.bio)},`,
        "NULL, 1, 1, ",
        `${lastActiveAt}, NULL, ${createdAt}`,
        ");",
      ].join(""),
    );
    for (const [position, snippet] of profile.snippets.entries()) {
      lines.push(
        `INSERT INTO snippets (user_id, language, content, position) VALUES (${id}, ${sqlText(snippet.language)}, ${sqlText(snippet.content)}, ${position});`,
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

const now = Math.floor(Date.now() / 1000);
mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, buildSql(now));
console.log(`wrote ${PROFILES.length} fake users to ${OUT_PATH}`);
