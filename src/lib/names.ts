// Name rendering for EN mode. Player/team names that have a curated entry in
// the dictionary use it (best quality); anything new — a player or team added
// later — falls back to an automatic Hebrew→Latin transliteration so it still
// reads in English instead of showing Hebrew.
//
// Only use this for names (players, teams, record holders) — never for generic
// UI strings, since the transliteration fallback would garble real sentences.
import { DICT } from './dict';

// Normalized lookup (strip gershayim / quotes / bidi marks, collapse spaces,
// lowercase) so a name spelled with different punctuation still resolves —
// same logic t()/st() use.
function normalizeForDict(s: string): string {
  return s
    .replace(/[‎‏‪-‮]/g, '')
    .replace(/["“”„‟״'‘’`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
const NORM_DICT: Record<string, string> = {};
for (const [he, en] of Object.entries(DICT)) NORM_DICT[normalizeForDict(he)] = en;

// Correct spellings for common Hebrew words (venues, cities, street terms) that
// the algorithmic transliteration gets wrong. Looked up per whole word before
// falling back to the letter-by-letter transliteration. Add more as needed.
const WORD_OVERRIDES: Record<string, string> = {
  // Venue / facility terms
  'אולם': 'Olam', 'ספורט': 'Sport', 'מרחבים': 'Marchavim', 'מרהבים': 'Marchavim',
  'היכל': 'Heichal', 'בית': 'Beit', 'ספר': 'Sefer', 'תיכון': 'Tichon',
  'מרכז': 'Merkaz', 'קהילתי': 'Kehilati',
  // Street terms
  'רחוב': 'Rehov', 'שדרות': 'Sderot', 'שדרה': 'Sderat', 'דרך': 'Derech',
  // Cities / places
  'קריית': 'Kiryat', 'קרית': 'Kiryat', 'גת': 'Gat', 'ראשון': 'Rishon', 'לציון': 'LeZion',
  'חדרה': 'Hadera', 'חולון': 'Holon', 'נתניה': 'Netanya', 'ירושלים': 'Jerusalem',
  'אשדוד': 'Ashdod', 'מלאכי': 'Malachi', 'מוצקין': 'Motzkin', 'השרון': 'HaSharon',
  'גדולי': 'Gdolei', 'ישראל': 'Israel', 'העצמאות': 'HaAtzmaut', 'הרצל': 'Herzl',
};

const FINAL: Record<string, string> = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
const GERESH = new Set(["'", '׳', '’', '`']);
const HE_RE = /[֐-׿]/;

function isVowelEnd(s: string): boolean {
  return /[aeiou]$/i.test(s);
}

// Best-effort romanization of a single Hebrew word. Hebrew omits most vowels,
// so the output is approximate — good enough to read, not authoritative.
function translitWord(w: string): string {
  if (WORD_OVERRIDES[w]) return WORD_OVERRIDES[w];
  const ch = [...w];
  let out = '';
  for (let i = 0; i < ch.length; i++) {
    const raw = ch[i];
    const c = FINAL[raw] ?? raw;
    const next = ch[i + 1];
    const geresh = next != null && GERESH.has(next);
    const start = i === 0;
    const end = i === ch.length - 1;

    // Geresh digraphs (foreign sounds): ג׳=j, צ׳=ch, ז׳=zh
    if (geresh && (c === 'ג' || c === 'צ' || c === 'ז')) {
      out += c === 'ג' ? 'j' : c === 'צ' ? 'ch' : 'zh';
      i++; // consume the geresh
      continue;
    }

    switch (c) {
      case 'א':
      case 'ע': out += start ? 'a' : (isVowelEnd(out) ? '' : 'a'); break;
      case 'ב': out += 'b'; break;
      case 'ג': out += 'g'; break;
      case 'ד': out += 'd'; break;
      case 'ה': out += end ? (isVowelEnd(out) ? '' : 'a') : 'h'; break;
      case 'ו':
        if (start) out += 'v';
        else if (next === 'ו') { out += 'u'; i++; }
        else out += isVowelEnd(out) ? 'v' : 'o';
        break;
      case 'ז': out += 'z'; break;
      case 'ח': out += 'ch'; break;
      case 'ט': out += 't'; break;
      case 'י':
        if (start) out += 'y';
        else out += isVowelEnd(out) ? 'y' : 'i';
        break;
      case 'כ': out += 'k'; break;
      case 'ל': out += 'l'; break;
      case 'מ': out += 'm'; break;
      case 'נ': out += 'n'; break;
      case 'ס': out += 's'; break;
      case 'פ': out += start ? 'p' : 'f'; break;
      case 'צ': out += 'tz'; break;
      case 'ק': out += 'k'; break;
      case 'ר': out += 'r'; break;
      case 'ש': out += 'sh'; break;
      case 'ת': out += 't'; break;
      default: break; // geresh, gershayim, punctuation, digits → drop
    }
  }
  return out ? out[0].toUpperCase() + out.slice(1) : out;
}

// Transliterate only maximal runs of Hebrew letters (with internal geresh),
// leaving digits, punctuation, Latin and whitespace intact — so addresses like
// "אולם אלון, שדרות העצמאות 31" keep their numbers and commas.
export function transliterateHebrew(s: string): string {
  return s.replace(/[֐-׿]+(?:['׳’`][֐-׿]+)*/g, (run) => translitWord(run));
}

// Render a player/team name (or a holder string) for the active language.
// he → unchanged. en → curated dictionary entry, else transliteration.
export function displayName(s: string | null | undefined, lang: 'he' | 'en'): string {
  if (!s || lang === 'he') return s ?? '';
  const hit = DICT[s] ?? DICT[s.trim()] ?? NORM_DICT[normalizeForDict(s)];
  if (hit) return hit;
  return HE_RE.test(s) ? transliterateHebrew(s) : s;
}
