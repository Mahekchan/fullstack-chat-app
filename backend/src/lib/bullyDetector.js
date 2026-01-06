import fs from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { franc } from "franc";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const listsDir = path.join(__dirname, "./bully_lists");

function loadList(code) {
  try {
    const filePath = path.join(listsDir, `${code}.json`);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
  } catch (e) {
    // ignore
  }
  return { high: [], medium: [], low: [] };
}

function stripEmojisAndPunctuation(s) {
  // remove emojis and most punctuation, keep spaces and basic letters/numbers
  // emoji regex simplified
  const emojiRegex = /([\u2700-\u27BF]|[\uE000-\uF8FF]|[\uD83C-\uDBFF\uDC00-\uDFFF]|[\u2011-\u26FF])/g;
  let out = s.replace(emojiRegex, " ");
  // remove punctuation except apostrophes that may appear in transliterations
  out = out.replace(/["\(\)\[\]\{\]\,\.|\!\?;:@#\$%\^&\*<>\/\\~=+\-]/g, " ");
  out = out.replace(/\s+/g, " ").trim();
  return out;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeRepeatedChars(s) {
  // collapse long repeated letters to two occurrences (so 'soooo' -> 'soo')
  return s.replace(/([a-zA-Z])\1{2,}/g, "$1$1");
}

function normalizeText(s) {
  if (!s || typeof s !== "string") return "";
  let out = s.toLowerCase();
  out = stripEmojisAndPunctuation(out);
  out = normalizeRepeatedChars(out);
  return out;
}

const SUPPORTED_LANGS = ["eng", "hin", "hing", "mar", "tam", "tel"];

export function detectBullying(text) {
  if (!text || typeof text !== "string") {
    return { isBullying: false, detectedLanguage: [], flaggedWords: [], severity: "low", language: "und", matched: [] };
  }

  const normalized = normalizeText(text);

  // quick script detection for Devanagari (Hindi/Marathi) and Tamil/Telugu scripts
  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  const hasTamil = /[\u0B80-\u0BFF]/.test(text);
  const hasTelugu = /[\u0C00-\u0C7F]/.test(text);

  // franc detection (may return 'und' or 'eng' for romanized Hindi)
  const francGuess = franc(text, { minLength: 3 });

  const languagesConsidered = new Set();
  if (hasDevanagari) languagesConsidered.add("hin");
  if (hasTamil) languagesConsidered.add("tam");
  if (hasTelugu) languagesConsidered.add("tel");
  if (francGuess && francGuess !== "und") languagesConsidered.add(francGuess);
  // always include English as fallback
  languagesConsidered.add("eng");
  // include Hinglish/roman Hindi explicitly to handle transliterations
  languagesConsidered.add("hing");

  const flaggedWords = [];
  const matched = [];
  let severity = "low";

  for (const lang of SUPPORTED_LANGS) {
    const lists = loadList(lang);
    // check high first
    for (const kw of lists.high || []) {
      if (!kw) continue;
      const nkw = normalizeText(kw);
      // if keyword is latin-only, match whole words to avoid substrings; otherwise use includes
      const isLatin = /^[a-z0-9\s']+$/i.test(nkw);
      if ((isLatin && new RegExp("\\b" + escapeRegExp(nkw) + "\\b", "i").test(normalized)) || (!isLatin && normalized.includes(nkw))) {
        matched.push({ level: "High", keyword: kw, language: lang });
        flaggedWords.push({ word: kw, language: lang });
        severity = "high";
      }
    }
    // medium
    for (const kw of lists.medium || []) {
      if (!kw) continue;
      const nkw = normalizeText(kw);
      const isLatin = /^[a-z0-9\s']+$/i.test(nkw);
      if (((isLatin && new RegExp("\\b" + escapeRegExp(nkw) + "\\b", "i").test(normalized)) || (!isLatin && normalized.includes(nkw))) && severity !== "high") {
        matched.push({ level: "Medium", keyword: kw, language: lang });
        flaggedWords.push({ word: kw, language: lang });
        if (severity !== "high") severity = "medium";
      }
    }
    // low
    for (const kw of lists.low || []) {
      if (!kw) continue;
      const nkw = normalizeText(kw);
      const isLatin = /^[a-z0-9\s']+$/i.test(nkw);
      if (((isLatin && new RegExp("\\b" + escapeRegExp(nkw) + "\\b", "i").test(normalized)) || (!isLatin && normalized.includes(nkw))) && severity === "low") {
        matched.push({ level: "Low", keyword: kw, language: lang });
        flaggedWords.push({ word: kw, language: lang });
      }
    }
  }

  // detectedLanguage array: include any languages where we found matches, else include franc guess / script hints
  const detectedSet = new Set();
  for (const m of matched) detectedSet.add(m.language);
  if (!detectedSet.size) {
    if (hasDevanagari) detectedSet.add("hin");
    if (hasTamil) detectedSet.add("tam");
    if (hasTelugu) detectedSet.add("tel");
    if (francGuess && francGuess !== "und") detectedSet.add(francGuess);
    detectedSet.add("eng");
  }

  const detectedLanguage = Array.from(detectedSet);

  const isBullying = matched.length > 0;

  return {
    isBullying,
    detectedLanguage,
    flaggedWords,
    severity: severity,
    // backward compatibility for existing callers
    language: detectedLanguage[0] || "und",
    matched,
  };
}
