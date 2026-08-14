export const SNIPPET_LANGUAGES = [
  "Rust",
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
