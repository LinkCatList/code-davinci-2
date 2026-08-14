import { Keyboard } from "grammy";
import { t, type Locale } from "./t";

export type BrowseMode = "home" | "feed" | "inbox" | "profile" | "paused";

export type MenuAction =
  | "browse"
  | "profile"
  | "likes"
  | "matches"
  | "like"
  | "skip"
  | "sleep"
  | "restart"
  | "snippets"
  | "bio"
  | "pause";

export const REMOVE_KEYBOARD = { remove_keyboard: true } as const;

const CHROME_KEYS = [
  "menuBrowse",
  "menuProfile",
  "menuLikes",
  "menuMatches",
  "swipeLike",
  "swipeSkip",
  "swipeSleep",
  "profileRestart",
  "profileSnippets",
  "profileBio",
  "profilePause",
  "onboardingLangRu",
  "onboardingLangEn",
  "onboardingGenderMale",
  "onboardingGenderFemale",
  "onboardingSkip",
  "onboardingShareLocation",
  "onboardingSnippetAdd",
  "onboardingSnippetDone",
  "onboardingConfirm",
  "onboardingStartOver",
] as const;

function persist(keyboard: Keyboard): Keyboard {
  return keyboard.resized().persistent();
}

export function homeKeyboard(locale: Locale): Keyboard {
  return persist(
    new Keyboard()
      .text(t(locale, "menuBrowse"))
      .text(t(locale, "menuProfile"))
      .text(t(locale, "menuLikes"))
      .text(t(locale, "menuMatches")),
  );
}

export function browseKeyboard(locale: Locale): Keyboard {
  return persist(
    new Keyboard()
      .text(t(locale, "swipeLike"))
      .text(t(locale, "swipeSkip"))
      .text(t(locale, "swipeSleep")),
  );
}

export function profileKeyboard(locale: Locale): Keyboard {
  return persist(
    new Keyboard()
      .text(t(locale, "menuBrowse"))
      .row()
      .text(t(locale, "profileRestart"))
      .row()
      .text(t(locale, "profileSnippets"))
      .row()
      .text(t(locale, "profileBio"))
      .row()
      .text(t(locale, "profilePause")),
  );
}

export function pausedKeyboard(locale: Locale): Keyboard {
  return persist(new Keyboard().text(t(locale, "menuBrowse")));
}

export function keyboardFor(mode: BrowseMode, locale: Locale): Keyboard {
  switch (mode) {
    case "feed":
    case "inbox":
      return browseKeyboard(locale);
    case "profile":
      return profileKeyboard(locale);
    case "paused":
      return pausedKeyboard(locale);
    default:
      return homeKeyboard(locale);
  }
}

export function onboardingLangKeyboard(locale: Locale): Keyboard {
  return new Keyboard()
    .text(t(locale, "onboardingLangRu"))
    .text(t(locale, "onboardingLangEn"))
    .resized();
}

export function onboardingGenderKeyboard(locale: Locale): Keyboard {
  return new Keyboard()
    .text(t(locale, "onboardingGenderMale"))
    .text(t(locale, "onboardingGenderFemale"))
    .resized();
}

export function onboardingSkipKeyboard(locale: Locale): Keyboard {
  return new Keyboard().text(t(locale, "onboardingSkip")).resized();
}

export function onboardingLocationKeyboard(locale: Locale): Keyboard {
  return new Keyboard()
    .requestLocation(t(locale, "onboardingShareLocation"))
    .row()
    .text(t(locale, "onboardingSkip"))
    .resized();
}

export function onboardingMoreKeyboard(locale: Locale): Keyboard {
  return new Keyboard()
    .text(t(locale, "onboardingSnippetAdd"))
    .row()
    .text(t(locale, "onboardingSnippetDone"))
    .resized();
}

export function onboardingPreviewKeyboard(locale: Locale): Keyboard {
  return new Keyboard()
    .text(t(locale, "onboardingConfirm"))
    .row()
    .text(t(locale, "onboardingStartOver"))
    .resized();
}

export function parseBrowseMode(value: string | null | undefined): BrowseMode {
  if (value === "feed" || value === "inbox" || value === "profile" || value === "paused") {
    return value;
  }
  return "home";
}

function exactActionMap(locale: Locale): Map<string, MenuAction> {
  return new Map<string, MenuAction>([
    [t(locale, "menuBrowse"), "browse"],
    [t(locale, "menuProfile"), "profile"],
    [t(locale, "menuLikes"), "likes"],
    [t(locale, "menuMatches"), "matches"],
    [t(locale, "swipeLike"), "like"],
    [t(locale, "swipeSkip"), "skip"],
    [t(locale, "swipeSleep"), "sleep"],
    [t(locale, "profileRestart"), "restart"],
    [t(locale, "profileSnippets"), "snippets"],
    [t(locale, "profileBio"), "bio"],
    [t(locale, "profilePause"), "pause"],
    ["❤️", "like"],
    ["👎", "skip"],
    ["💤", "sleep"],
    ["1 ❤️", "like"],
    ["2 👎", "skip"],
    ["3 💤", "sleep"],
  ]);
}

const DIGITS: Record<BrowseMode, Array<MenuAction | undefined>> = {
  home: ["browse", "profile", "likes", "matches"],
  feed: ["like", "skip", "sleep"],
  inbox: ["like", "skip", "sleep"],
  profile: ["browse", "restart", "snippets", "bio", "pause"],
  paused: ["browse"],
};

export function matchMenuAction(
  text: string,
  locale: Locale,
  screen: BrowseMode,
): MenuAction | null {
  const trimmed = text.trim();
  const exact = exactActionMap(locale).get(trimmed);
  if (exact) return exact;
  if (/^[1-5]$/.test(trimmed)) {
    return DIGITS[screen][Number(trimmed) - 1] ?? null;
  }
  return null;
}

export function chromeLabels(locale: Locale): Set<string> {
  return new Set(CHROME_KEYS.map((key) => t(locale, key)));
}

export function isReservedInput(text: string): boolean {
  const trimmed = text.trim();
  if (/^[1-5]$/.test(trimmed)) return true;
  if (trimmed === "❤️" || trimmed === "👎" || trimmed === "💤") return true;
  return chromeLabels("ru").has(trimmed) || chromeLabels("en").has(trimmed);
}

export function isSkipText(text: string, locale: Locale): boolean {
  const trimmed = text.trim();
  return (
    trimmed === t(locale, "onboardingSkip") ||
    trimmed === t("ru", "onboardingSkip") ||
    trimmed === t("en", "onboardingSkip")
  );
}

export function matchLangButton(text: string): Locale | null {
  const trimmed = text.trim();
  if (trimmed === t("ru", "onboardingLangRu") || trimmed === t("en", "onboardingLangRu")) return "ru";
  if (trimmed === t("ru", "onboardingLangEn") || trimmed === t("en", "onboardingLangEn")) return "en";
  return null;
}

export function matchGenderButton(text: string, locale: Locale): 0 | 1 | null {
  const trimmed = text.trim();
  if (trimmed === t(locale, "onboardingGenderMale") || trimmed === "1") return 0;
  if (trimmed === t(locale, "onboardingGenderFemale") || trimmed === "2") return 1;
  return null;
}

export function matchPreviewButton(text: string, locale: Locale): "ok" | "reset" | null {
  const trimmed = text.trim();
  if (trimmed === t(locale, "onboardingConfirm") || trimmed === "1") return "ok";
  if (trimmed === t(locale, "onboardingStartOver") || trimmed === "2") return "reset";
  return null;
}

export function matchSnippetMoreButton(text: string, locale: Locale): "add" | "done" | null {
  const trimmed = text.trim();
  if (trimmed === t(locale, "onboardingSnippetAdd") || trimmed === "1") return "add";
  if (trimmed === t(locale, "onboardingSnippetDone") || trimmed === "2") return "done";
  return null;
}

export function looksLikeOtherLocaleMenu(text: string, locale: Locale): boolean {
  const other: Locale = locale === "ru" ? "en" : "ru";
  const trimmed = text.trim();
  if (/^[1-5]$/.test(trimmed)) return true;
  return chromeLabels(other).has(trimmed) && !chromeLabels(locale).has(trimmed);
}
