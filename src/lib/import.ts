// AI-assisted bulk import: prompt templates the user copies into any AI,
// and tolerant parsers for the JSON the AI replies with.

export interface FlashcardDraft {
  front: string;
  back: string;
}

export interface ExamQuestionDraft {
  text: string;
  choices: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  difficulty: 'easy' | 'medium' | 'hard';
  year?: number;
}

export interface SubjectPresetDraft {
  name: string;
  symbol?: string;
  topics: string[];
}

export type ImportError = 'invalid-json' | 'not-array' | 'no-valid-items';
export type ImportResult<T> = { ok: true; items: T[]; skipped: number } | { ok: false; error: ImportError };

const MAX_FIELD_LEN = 500;
const MAX_ITEMS = 200;

/** Strip markdown code fences and any prose around the first JSON array/object. */
function extractJson(text: string): string {
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  // AIs often preface with "Here are your cards:" — cut to the first bracket.
  const start = Math.min(...['[', '{'].map(c => { const i = s.indexOf(c); return i === -1 ? Infinity : i; }));
  if (start !== Infinity && start > 0) s = s.slice(start);
  if (start === Infinity) return s;

  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '[' || ch === '{') {
      stack.push(ch === '[' ? ']' : '}');
      continue;
    }
    if (ch === ']' || ch === '}') {
      if (stack.pop() !== ch) return s;
      if (stack.length === 0) return s.slice(0, i + 1);
    }
  }
  return s;
}

function toArray(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    for (const v of Object.values(parsed)) {
      if (Array.isArray(v)) return v;
    }
  }
  return null;
}

function parseRaw(text: string): { arr: unknown[] } | { error: ImportError } {
  let parsed: unknown;
  const extracted = extractJson(text);
  try {
    parsed = JSON.parse(extracted);
  } catch {
    try {
      parsed = JSON.parse(extracted.replace(/,\s*([}\]])/g, '$1'));
    } catch {
      return { error: 'invalid-json' };
    }
  }
  const arr = toArray(parsed);
  if (!arr) return { error: 'not-array' };
  return { arr };
}

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, MAX_FIELD_LEN) : null;

export function parseFlashcards(text: string): ImportResult<FlashcardDraft> {
  const raw = parseRaw(text);
  if ('error' in raw) return { ok: false, error: raw.error };
  const items: FlashcardDraft[] = [];
  let skipped = 0;
  for (const it of raw.arr.slice(0, MAX_ITEMS)) {
    if (!it || typeof it !== 'object') {
      skipped += 1;
      continue;
    }
    const o = it as Record<string, unknown>;
    const front = str(o.front ?? o.question ?? o.term);
    const back = str(o.back ?? o.answer ?? o.definition);
    if (front && back) {
      items.push({ front, back });
    } else {
      skipped += 1;
    }
  }
  return items.length ? { ok: true, items, skipped } : { ok: false, error: 'no-valid-items' };
}

function resolveAnswerIndex(o: Record<string, unknown>, choices: string[]): 0 | 1 | 2 | 3 | null {
  const sources = [
    ['correctIndex', o.correctIndex],
    ['answerIndex', o.answerIndex],
    ['correct', o.correct],
    ['answer', o.answer],
    ['correctAnswer', o.correctAnswer],
  ] as const;
  const source = sources.find(([, value]) => value !== undefined && value !== null);
  if (!source) return null;
  const [key, rawAns] = source;
  const numeric = typeof rawAns === 'number' || (typeof rawAns === 'string' && rawAns.trim() !== '')
    ? Number(rawAns)
    : Number.NaN;
  if (Number.isInteger(numeric)) {
    if (numeric >= 0 && numeric <= 3) return numeric as 0 | 1 | 2 | 3;
    if (key === 'correct' && numeric === 4) return 3;
  }
  if (typeof rawAns !== 'string') return null;

  const letter = rawAns.trim().match(/^\(?\s*([a-d])\s*[\).:]?$/i)?.[1];
  if (letter) return (letter.toLowerCase().charCodeAt(0) - 97) as 0 | 1 | 2 | 3;

  const match = choices.findIndex(choice => choice.toLowerCase() === rawAns.trim().toLowerCase());
  return match >= 0 && match <= 3 ? match as 0 | 1 | 2 | 3 : null;
}

export function parseExamQuestions(text: string): ImportResult<ExamQuestionDraft> {
  const raw = parseRaw(text);
  if ('error' in raw) return { ok: false, error: raw.error };
  const items: ExamQuestionDraft[] = [];
  let skipped = 0;
  for (const it of raw.arr.slice(0, MAX_ITEMS)) {
    if (!it || typeof it !== 'object') {
      skipped += 1;
      continue;
    }
    const o = it as Record<string, unknown>;
    const qText = str(o.text ?? o.question);
    const rawChoices = Array.isArray(o.choices) ? o.choices : Array.isArray(o.options) ? o.options : null;
    if (!qText || !rawChoices || rawChoices.length < 4) {
      skipped += 1;
      continue;
    }
    const choices = rawChoices.map(str);
    if (choices.some(c => c === null)) {
      skipped += 1;
      continue;
    }
    const ci = resolveAnswerIndex(o, choices as string[]);
    if (ci === null) {
      skipped += 1;
      continue;
    }
    const diff = o.difficulty === 'easy' || o.difficulty === 'hard' ? o.difficulty : 'medium';
    const yearNum = Number(o.year);
    const year = Number.isInteger(yearNum) && yearNum >= 1990 && yearNum <= 2100 ? yearNum : undefined;
    const keptChoices = choices.slice(0, 4);
    if (ci >= keptChoices.length) {
      skipped += 1;
      continue;
    }
    items.push({
      text: qText,
      choices: keptChoices as [string, string, string, string],
      correctIndex: ci,
      difficulty: diff,
      year,
    });
  }
  return items.length ? { ok: true, items, skipped } : { ok: false, error: 'no-valid-items' };
}

const MAX_TOPICS = 60;

/** A subject can carry its topics as ["A","B"] or [{name:"A"}, …]. */
function toTopicList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const t of v) {
    const name = typeof t === 'string' ? str(t) : str((t as Record<string, unknown>)?.name ?? (t as Record<string, unknown>)?.title);
    if (name) out.push(name);
    if (out.length >= MAX_TOPICS) break;
  }
  return out;
}

export function parseTemplate(text: string): ImportResult<SubjectPresetDraft> {
  const raw = parseRaw(text);
  if ('error' in raw) return { ok: false, error: raw.error };
  const items: SubjectPresetDraft[] = [];
  let skipped = 0;
  for (const it of raw.arr.slice(0, MAX_ITEMS)) {
    if (!it || typeof it !== 'object') {
      skipped += 1;
      continue;
    }
    const o = it as Record<string, unknown>;
    const name = str(o.name ?? o.subject ?? o.title);
    if (!name) {
      skipped += 1;
      continue;
    }
    const symbolRaw = str(o.symbol ?? o.abbr ?? o.abbreviation);
    const symbol = symbolRaw ? symbolRaw.slice(0, 2) : undefined;
    const topics = toTopicList(o.topics ?? o.chapters ?? o.units);
    items.push({ name, symbol, topics });
  }
  return items.length ? { ok: true, items, skipped } : { ok: false, error: 'no-valid-items' };
}

export function templatePrompt(goal = 'TCAS', count = 6, language?: string, focus?: string): string {
  const languageRule = language?.trim()
    ? `- Write the output in ${language.trim()}.`
    : `- Write the subjects and topics in the same language as "${goal}".`;
  const focusRule = focus?.trim() ? `\n- Focus especially on: ${focus.trim()}.` : '';
  return `List the ${count} main subjects a student preparing for ${goal} should study, and the key topics/chapters for each.

Reply with ONLY a JSON array in this exact format, no other text:
[{"name": "Physics", "symbol": "Ph", "topics": ["Kinematics", "Forces & Newton's laws", "Energy"]}]

Rules:
- "symbol" is a 1-2 letter abbreviation of the subject.
- "topics" lists the chapters/units to study for that subject (8-15 each).
${languageRule}${focusRule}`;
}

export function flashcardPrompt(topicName: string, subjectName?: string, count = 20, language?: string, focus?: string): string {
  const scope = subjectName ? `the topic "${topicName}" (subject: ${subjectName})` : `the topic "${topicName}"`;
  const languageRule = language?.trim()
    ? `- Write the output in ${language.trim()}.`
    : '- Write the cards in the same language as the topic name.';
  const focusRule = focus?.trim() ? `\n- Focus especially on: ${focus.trim()}.` : '';
  return `Create ${count} study flashcards for ${scope}.

Reply with ONLY a JSON array in this exact format, no other text:
[{"front": "question or term", "back": "answer or definition"}]

Rules:
- Keep each side under 200 characters.
- Cover the most important facts, formulas, and definitions.
- Write any math as LaTeX wrapped in $...$ (e.g. "$\\frac{a}{b}$", "$x^2$") — it will be typeset.
${languageRule}${focusRule}`;
}

export type ExamPromptDifficulty = 'mixed' | 'easy' | 'medium' | 'hard';

export function examPrompt(subjectName: string, count = 10, difficulty: ExamPromptDifficulty = 'mixed', language?: string, focus?: string): string {
  const diffRule = difficulty === 'mixed'
    ? '- "difficulty" is "easy", "medium", or "hard" — mix them.'
    : `- Make every question "${difficulty}" difficulty and set "difficulty" to "${difficulty}".`;
  const languageRule = language?.trim()
    ? `- Write the output in ${language.trim()}.`
    : '- Write the questions in the same language as the subject name.';
  const focusRule = focus?.trim() ? `\n- Focus especially on: ${focus.trim()}.` : '';
  return `Create ${count} multiple-choice questions for the subject "${subjectName}".

Reply with ONLY a JSON array in this exact format, no other text:
[{"text": "the question", "choices": ["choice A", "choice B", "choice C", "choice D"], "correctIndex": 0, "difficulty": "medium"}]

Rules:
- Exactly 4 choices per question; "correctIndex" is the 0-based index of the correct one.
${diffRule}
- Write any math as LaTeX wrapped in $...$ (e.g. "$\\frac{a}{b}$", "$x^2$") — it will be typeset.
${languageRule}${focusRule}`;
}
