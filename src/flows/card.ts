import { formatDistanceKm } from "../geo";
import { snippetFenceId } from "../snippet-languages";

export function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function ageFromBirthYear(birthYear: number, nowMs: number): number {
  return new Date(nowMs).getUTCFullYear() - birthYear;
}

export type CardSnippet = {
  language: string;
  content: string;
  position: number;
};

export function renderOwnCard(input: {
  name: string;
  birthYear: number;
  bio: string | null;
  city: string | null;
  snippets: CardSnippet[];
  nowMs: number;
  distanceKm?: number | null;
  includeAllSnippets?: boolean;
  header?: string;
  footer?: string;
}): string {
  const snippets = [...input.snippets].sort((a, b) => a.position - b.position);
  const shown = input.includeAllSnippets ? snippets : snippets.slice(0, 1);
  const age = ageFromBirthYear(input.birthYear, input.nowMs);
  const langs = snippets.map((snippet) => snippet.language).join(" · ");

  const lines: string[] = [];
  if (input.header) lines.push(input.header, "");
  for (const snippet of shown) {
    const fence = snippetFenceId(snippet.language);
    lines.push(`<pre><code class="language-${fence}">${escapeHtml(snippet.content)}</code></pre>`, "");
  }
  lines.push(`<b>${escapeHtml(input.name)}</b>, ${age}`);
  if (langs) lines.push(escapeHtml(langs));
  if (input.distanceKm != null) lines.push(escapeHtml(formatDistanceKm(input.distanceKm)));
  else if (input.city) lines.push(escapeHtml(input.city));
  if (input.bio) lines.push(escapeHtml(input.bio));
  if (input.footer) lines.push("", input.footer);

  let text = lines.join("\n");
  if (text.length > 4096 && shown.length > 1) {
    return renderOwnCard({ ...input, includeAllSnippets: false });
  }
  return text;
}
