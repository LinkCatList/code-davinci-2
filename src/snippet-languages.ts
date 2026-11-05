export const SNIPPET_LANGUAGES = [
  "Rust",
  "Solidity",
  "C",
  "C++",
  "Java",
  "Python",
  "JS",
  "TS",
  "C#",
  "Go",
  "Swift",
  "Kotlin",
  "Ruby",
  "PHP",
] as const;

export type SnippetLanguage = (typeof SNIPPET_LANGUAGES)[number];

export function isSnippetLanguage(value: string): value is SnippetLanguage {
  return (SNIPPET_LANGUAGES as readonly string[]).includes(value);
}

const FENCE_IDS: Record<SnippetLanguage, string> = {
  Rust: "rust",
  Solidity: "solidity",
  C: "c",
  "C++": "cpp",
  Java: "java",
  Python: "python",
  JS: "js",
  TS: "ts",
  "C#": "csharp",
  Go: "go",
  Swift: "swift",
  Kotlin: "kotlin",
  Ruby: "ruby",
  PHP: "php",
};

export function snippetFenceId(language: string): string {
  if (isSnippetLanguage(language)) return FENCE_IDS[language];
  const fallback = language.toLowerCase().replace(/[^a-z0-9+#.-]/g, "");
  return fallback || "text";
}

const ALIASES: Record<string, SnippetLanguage> = {
  rust: "Rust",
  solidity: "Solidity",
  sol: "Solidity",
  c: "C",
  cpp: "C++",
  "c++": "C++",
  cxx: "C++",
  java: "Java",
  python: "Python",
  py: "Python",
  js: "JS",
  javascript: "JS",
  ts: "TS",
  typescript: "TS",
  csharp: "C#",
  "c#": "C#",
  go: "Go",
  golang: "Go",
  swift: "Swift",
  kotlin: "Kotlin",
  kt: "Kotlin",
  ruby: "Ruby",
  rb: "Ruby",
  php: "PHP",
};

export function snippetLanguageFromTag(tag: string | undefined): SnippetLanguage | undefined {
  if (!tag) return undefined;
  const key = tag.trim().toLowerCase();
  if (!key) return undefined;
  if (Object.hasOwn(ALIASES, key)) return ALIASES[key];
  return SNIPPET_LANGUAGES.find((language) => language.toLowerCase() === key);
}

export type CodeEntityHint = { type: string; language?: string };

const FENCE_OPEN = /^```[ \t]*([A-Za-z0-9+#._-]*)[ \t]*\r?\n/;
const FENCE_CLOSE = /(?:\r?\n)```[ \t]*$/;

function unwrapMappedFence(text: string): { content: string; language: SnippetLanguage } | null {
  const open = FENCE_OPEN.exec(text);
  if (!open) return null;
  const language = snippetLanguageFromTag(open[1]);
  if (!language) return null;
  let body = text.slice(open[0].length);
  if (/^[ \t]*```[ \t]*$/.test(body)) return { content: "", language };
  if (FENCE_CLOSE.test(body)) body = body.replace(FENCE_CLOSE, "");
  return { content: body, language };
}

export function detectSnippetLanguage(
  text: string,
  entities?: ReadonlyArray<CodeEntityHint>,
): { content: string; language: SnippetLanguage | null } {
  if (entities) {
    for (const entity of entities) {
      if (entity.type !== "pre") continue;
      const language = snippetLanguageFromTag(entity.language);
      if (language) return { content: text, language };
    }
  }
  return unwrapMappedFence(text) ?? { content: text, language: null };
}
