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
  city: string;
  lat: number;
  lng: number;
  snippets: SeedSnippet[];
};

const PROFILES: SeedProfile[] = [
  {
    name: "Артём",
    locale: "ru",
    gender: 0,
    birthYear: 1996,
    bio: "бэкенд и инфраструктура. люблю, когда ошибка живёт в типе, а не в проде",
    city: "Москва",
    lat: 55.7558,
    lng: 37.6173,
    snippets: [
      {
        language: "Rust",
        content: `#[derive(Debug)]
pub enum LoadError {
    Missing,
    Corrupt(String),
}

pub fn load_config(raw: &str) -> Result<u16, LoadError> {
    let port = raw.parse().map_err(|e| LoadError::Corrupt(format!("{e}")))?;
    if port == 0 {
        return Err(LoadError::Missing);
    }
    Ok(port)
}`,
      },
    ],
  },
  {
    name: "Мария",
    locale: "ru",
    gender: 1,
    birthYear: 1998,
    bio: "data + python. если можно посчитать — лучше посчитать",
    city: "Санкт-Петербург",
    lat: 59.9311,
    lng: 30.3609,
    snippets: [
      {
        language: "Python",
        content: `from dataclasses import dataclass

@dataclass(frozen=True)
class Window:
    start: int
    end: int

    def overlaps(self, other: "Window") -> bool:
        return self.start < other.end and other.start < self.end

def merge(windows: list[Window]) -> list[Window]:
    ordered = sorted(windows, key=lambda w: w.start)
    out: list[Window] = []
    for window in ordered:
        if not out or not out[-1].overlaps(window):
            out.append(window)
        else:
            out[-1] = Window(out[-1].start, max(out[-1].end, window.end))
    return out`,
      },
    ],
  },
  {
    name: "Кирилл",
    locale: "ru",
    gender: 0,
    birthYear: 1994,
    bio: "пишу сервисы на Go. ненавижу магические таймауты",
    city: "Москва",
    lat: 55.7512,
    lng: 37.6184,
    snippets: [
      {
        language: "Go",
        content: `func withTimeout(ctx context.Context, d time.Duration) (context.Context, context.CancelFunc) {
	if _, ok := ctx.Deadline(); ok {
		return context.WithCancel(ctx)
	}
	return context.WithTimeout(ctx, d)
}

func fetchUser(ctx context.Context, id string) (*User, error) {
	ctx, cancel := withTimeout(ctx, 800*time.Millisecond)
	defer cancel()
	return repo.Find(ctx, id)
}`,
      },
    ],
  },
  {
    name: "Дарья",
    locale: "ru",
    gender: 1,
    birthYear: 1999,
    bio: "фронт, дизайн-системы, злость на !important",
    city: "Тбилиси",
    lat: 41.7151,
    lng: 44.8271,
    snippets: [
      {
        language: "TS",
        content: `type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function parseHex(input: string): Result<number, string> {
  if (!/^#[0-9a-fA-F]{6}$/.test(input)) {
    return { ok: false, error: "bad hex" };
  }
  return { ok: true, value: Number.parseInt(input.slice(1), 16) };
}`,
      },
    ],
  },
  {
    name: "Иван",
    locale: "ru",
    gender: 0,
    birthYear: 1993,
    bio: "ML без слайдов. если модель не бьёт эвристику — модели нет",
    city: "Алматы",
    lat: 43.238,
    lng: 76.945,
    snippets: [
      {
        language: "Python",
        content: `import math

def softmax(xs: list[float]) -> list[float]:
    peak = max(xs)
    exps = [math.exp(x - peak) for x in xs]
    total = sum(exps)
    return [x / total for x in exps]

def topk(scores: list[float], k: int) -> list[int]:
    idx = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
    return idx[:k]`,
      },
    ],
  },
  {
    name: "София",
    locale: "ru",
    gender: 1,
    birthYear: 2001,
    bio: "android, kotlin, иногда compose ради удовольствия",
    city: "Ереван",
    lat: 40.1792,
    lng: 44.4991,
    snippets: [
      {
        language: "Kotlin",
        content: `suspend fun <T> retry(
    times: Int = 3,
    block: suspend () -> T,
): T {
    var last: Throwable? = null
    repeat(times) { attempt ->
        try {
            return block()
        } catch (e: Exception) {
            last = e
            delay(100L * (attempt + 1))
        }
    }
    throw last ?: IllegalStateException("retry failed")
}`,
      },
    ],
  },
  {
    name: "Павел",
    locale: "ru",
    gender: 0,
    birthYear: 1995,
    bio: "embedded / C++. считаю такты, не сторипоинты",
    city: "Москва",
    lat: 55.76,
    lng: 37.6,
    snippets: [
      {
        language: "C++",
        content: `template <typename T, size_t N>
class Ring {
  T buf[N]{};
  size_t head = 0;
  size_t tail = 0;
  bool full = false;

 public:
  bool push(const T& v) {
    if (full) return false;
    buf[head] = v;
    head = (head + 1) % N;
    full = head == tail;
    return true;
  }
};`,
      },
    ],
  },
  {
    name: "Анна",
    locale: "ru",
    gender: 1,
    birthYear: 1997,
    bio: "продуктовый фронт. живу в Берлине, скучаю по нормальному чаю",
    city: "Берлин",
    lat: 52.52,
    lng: 13.405,
    snippets: [
      {
        language: "TS",
        content: `export function useDebounced<T>(value: T, ms = 250): T {
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
    name: "Дмитрий",
    locale: "ru",
    gender: 0,
    birthYear: 1992,
    bio: "java, spring, очередь, которая почему-то всегда полная",
    city: "Санкт-Петербург",
    lat: 59.94,
    lng: 30.31,
    snippets: [
      {
        language: "Java",
        content: `public final class IdempotencyKey {
  private final String value;

  public IdempotencyKey(String raw) {
    if (raw == null || raw.isBlank()) {
      throw new IllegalArgumentException("empty key");
    }
    this.value = raw.strip();
  }

  public String value() {
    return value;
  }
}`,
      },
    ],
  },
  {
    name: "Алина",
    locale: "ru",
    gender: 1,
    birthYear: 2000,
    bio: "js, анимации, иногда слишком много анимаций",
    city: "Варшава",
    lat: 52.2297,
    lng: 21.0122,
    snippets: [
      {
        language: "JS",
        content: `export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function lerp(a, b, t) {
  return a + (b - a) * clamp(t, 0, 1);
}

export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}`,
      },
    ],
  },
  {
    name: "Alex",
    locale: "en",
    gender: 0,
    birthYear: 1995,
    bio: "distributed systems, bad coffee, good tests",
    city: "Berlin",
    lat: 52.501,
    lng: 13.41,
    snippets: [
      {
        language: "Go",
        content: `type Circuit struct {
	fails int
	open  time.Time
}

func (c *Circuit) Allow() bool {
	if c.fails < 5 {
		return true
	}
	return time.Since(c.open) > 3*time.Second
}

func (c *Circuit) Fail() {
	c.fails++
	if c.fails == 5 {
		c.open = time.Now()
	}
}`,
      },
    ],
  },
  {
    name: "Maya",
    locale: "en",
    gender: 1,
    birthYear: 1998,
    bio: "python, notebooks that accidentally became services",
    city: "London",
    lat: 51.5074,
    lng: -0.1278,
    snippets: [
      {
        language: "Python",
        content: `def sliding_avg(xs: list[float], k: int) -> list[float]:
    if k <= 0:
        raise ValueError("k must be > 0")
    out: list[float] = []
    acc = 0.0
    for i, x in enumerate(xs):
        acc += x
        if i >= k:
            acc -= xs[i - k]
        if i + 1 >= k:
            out.append(acc / k)
    return out`,
      },
    ],
  },
  {
    name: "Jake",
    locale: "en",
    gender: 0,
    birthYear: 1994,
    bio: "typescript maximalist. if it compiles, I ship it",
    city: "New York",
    lat: 40.7128,
    lng: -74.006,
    snippets: [
      {
        language: "TS",
        content: `type Job =
  | { type: "email"; to: string }
  | { type: "webhook"; url: string };

export function describe(job: Job): string {
  switch (job.type) {
    case "email":
      return \`mail -> \${job.to}\`;
    case "webhook":
      return \`hook -> \${job.url}\`;
  }
}`,
      },
    ],
  },
  {
    name: "Lena",
    locale: "en",
    gender: 1,
    birthYear: 1996,
    bio: "iOS. I will argue about navigation stacks",
    city: "San Francisco",
    lat: 37.7749,
    lng: -122.4194,
    snippets: [
      {
        language: "Swift",
        content: `struct Cache<Key: Hashable, Value> {
    private var store: [Key: Value] = [:]
    private let limit: Int

    init(limit: Int) { self.limit = limit }

    mutating func get(_ key: Key) -> Value? { store[key] }

    mutating func set(_ key: Key, _ value: Value) {
        if store.count >= limit { store.remove(at: store.startIndex) }
        store[key] = value
    }
}`,
      },
    ],
  },
  {
    name: "Ryan",
    locale: "en",
    gender: 0,
    birthYear: 1991,
    bio: "rust + compilers. weekends are for unused side projects",
    city: "London",
    lat: 51.515,
    lng: -0.09,
    snippets: [
      {
        language: "Rust",
        content: `pub fn levenshtein(a: &str, b: &str) -> usize {
    let mut prev: Vec<usize> = (0..=b.len()).collect();
    let mut curr = vec![0; b.len() + 1];
    for (i, ca) in a.chars().enumerate() {
        curr[0] = i + 1;
        for (j, cb) in b.chars().enumerate() {
            let cost = usize::from(ca != cb);
            curr[j + 1] = (prev[j + 1] + 1).min(curr[j] + 1).min(prev[j] + cost);
        }
        std::mem::swap(&mut prev, &mut curr);
    }
    prev[b.len()]
}`,
      },
    ],
  },
  {
    name: "Sophie",
    locale: "en",
    gender: 1,
    birthYear: 1999,
    bio: "android, maps, and too many snackbars",
    city: "Warsaw",
    lat: 52.23,
    lng: 21.01,
    snippets: [
      {
        language: "Kotlin",
        content: `fun formatKm(meters: Int): String {
    val km = meters / 1000f
    return if (km < 1) "\${meters}m" else "%.1f km".format(km)
}

fun haversine(a: Pair<Double, Double>, b: Pair<Double, Double>): Double {
    val r = 6371.0
    val dLat = Math.toRadians(b.first - a.first)
    val dLng = Math.toRadians(b.second - a.second)
    val n = sin(dLat / 2).pow(2) +
        cos(Math.toRadians(a.first)) * cos(Math.toRadians(b.first)) *
        sin(dLng / 2).pow(2)
    return 2 * r * asin(min(1.0, sqrt(n)))
}`,
      },
    ],
  },
  {
    name: "Marcus",
    locale: "en",
    gender: 0,
    birthYear: 1993,
    bio: "jvm backend. I still like checked exceptions a little",
    city: "New York",
    lat: 40.73,
    lng: -73.99,
    snippets: [
      {
        language: "Java",
        content: `public record Page(int offset, int limit) {
  public Page {
    if (offset < 0 || limit <= 0 || limit > 100) {
      throw new IllegalArgumentException("bad page");
    }
  }

  public Page next() {
    return new Page(offset + limit, limit);
  }
}`,
      },
    ],
  },
  {
    name: "Nina",
    locale: "en",
    gender: 1,
    birthYear: 1997,
    bio: "ruby, rails, and deleting code with joy",
    city: "Tbilisi",
    lat: 41.7225,
    lng: 44.7925,
    snippets: [
      {
        language: "Ruby",
        content: `class Money
  attr_reader :cents

  def initialize(cents)
    raise ArgumentError if cents < 0
    @cents = cents
  end

  def +(other)
    Money.new(@cents + other.cents)
  end

  def to_s
    format("$%.2f", @cents / 100.0)
  end
end`,
      },
    ],
  },
  {
    name: "Liam",
    locale: "en",
    gender: 0,
    birthYear: 1996,
    bio: "C# / game tools. I debug with prints and pride",
    city: "San Francisco",
    lat: 37.78,
    lng: -122.41,
    snippets: [
      {
        language: "C#",
        content: `public readonly record struct Tick(int Value)
{
    public Tick Next() => new(Value + 1);
}

public static class Cooldown
{
    public static bool Ready(Tick now, Tick last, int frames)
        => now.Value - last.Value >= frames;
}`,
      },
    ],
  },
  {
    name: "Emma",
    locale: "en",
    gender: 1,
    birthYear: 2000,
    bio: "js, design, and fighting layout shift",
    city: "Berlin",
    lat: 52.51,
    lng: 13.39,
    snippets: [
      {
        language: "JS",
        content: `export function groupBy(items, key) {
  return items.reduce((acc, item) => {
    const k = key(item);
    (acc[k] ??= []).push(item);
    return acc;
  }, {});
}

export function unique(items) {
  return [...new Set(items)];
}`,
      },
    ],
  },
  {
    name: "Егор",
    locale: "ru",
    gender: 0,
    birthYear: 1998,
    bio: "php, легаси, и внезапная любовь к типам",
    city: "Алматы",
    lat: 43.2567,
    lng: 76.9286,
    snippets: [
      {
        language: "PHP",
        content: `final class Clock
{
    public function __construct(private readonly int $now) {}

    public function later(int $seconds): self
    {
        return new self($this->now + $seconds);
    }

    public function isAfter(self $other): bool
    {
        return $this->now > $other->now;
    }
}`,
      },
    ],
  },
  {
    name: "Екатерина",
    locale: "ru",
    gender: 1,
    birthYear: 1995,
    bio: "python, etl, графики, которые никто не открывает",
    city: "Москва",
    lat: 55.74,
    lng: 37.62,
    snippets: [
      {
        language: "Python",
        content: `def chunked(items: list[str], size: int) -> list[list[str]]:
    return [items[i:i + size] for i in range(0, len(items), size)]

def normalize(name: str) -> str:
    return " ".join(name.lower().split())`,
      },
    ],
  },
  {
    name: "Noah",
    locale: "en",
    gender: 0,
    birthYear: 1992,
    bio: "php that wants to be rust when it grows up",
    city: "London",
    lat: 51.503,
    lng: -0.12,
    snippets: [
      {
        language: "PHP",
        content: `function pick(array $items, callable $ok): mixed
{
    foreach ($items as $item) {
        if ($ok($item)) {
            return $item;
        }
    }
    return null;
}`,
      },
    ],
  },
  {
    name: "Андрей",
    locale: "ru",
    gender: 0,
    birthYear: 1990,
    bio: "ruby с 2012. всё ещё не устал от блоков",
    city: "Санкт-Петербург",
    lat: 59.95,
    lng: 30.32,
    snippets: [
      {
        language: "Ruby",
        content: `def retry_on(times:, &)
  attempts = 0
  begin
    attempts += 1
    yield
  rescue StandardError
    retry if attempts < times
    raise
  end
end`,
      },
    ],
  },
  {
    name: "Max",
    locale: "en",
    gender: 0,
    birthYear: 1997,
    bio: "ts, product, and one too many side quests",
    city: "Warsaw",
    lat: 52.24,
    lng: 21.02,
    snippets: [
      {
        language: "TS",
        content: `export function assertUnreachable(x: never): never {
  throw new Error(\`unexpected: \${String(x)}\`);
}

export function compact<T>(xs: Array<T | null | undefined>): T[] {
  return xs.filter((x): x is T => x != null);
}`,
      },
    ],
  },
];

if (PROFILES.length !== 25) {
  throw new Error(`expected 25 profiles, got ${PROFILES.length}`);
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
    const createdAt = now - (40 - index) * 86400;
    const lastActiveAt = now - index * 3600;
    lines.push(
      [
        "INSERT INTO users (",
        "id, username, locale, state, name, birth_year, gender, bio, city, lat, lng,",
        "max_dist_km, lang_filter, is_active, is_fake, last_active_at, last_like_notif_at, created_at",
        ") VALUES (",
        `${id}, NULL, ${sqlText(profile.locale)}, NULL, ${sqlText(profile.name)}, ${profile.birthYear}, ${profile.gender},`,
        `${sqlText(profile.bio)}, ${sqlText(profile.city)}, ${profile.lat}, ${profile.lng},`,
        "NULL, NULL, 1, 1, ",
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
