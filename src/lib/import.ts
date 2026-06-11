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

export type ImportError = 'invalid-json' | 'not-array' | 'no-valid-items';
export type ImportResult<T> = { ok: true; items: T[] } | { ok: false; error: ImportError };

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
  try {
    parsed = JSON.parse(extractJson(text));
  } catch {
    return { error: 'invalid-json' };
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
  for (const it of raw.arr.slice(0, MAX_ITEMS)) {
    if (!it || typeof it !== 'object') continue;
    const o = it as Record<string, unknown>;
    const front = str(o.front ?? o.question ?? o.term);
    const back = str(o.back ?? o.answer ?? o.definition);
    if (front && back) items.push({ front, back });
  }
  return items.length ? { ok: true, items } : { ok: false, error: 'no-valid-items' };
}

export function parseExamQuestions(text: string): ImportResult<ExamQuestionDraft> {
  const raw = parseRaw(text);
  if ('error' in raw) return { ok: false, error: raw.error };
  const items: ExamQuestionDraft[] = [];
  for (const it of raw.arr.slice(0, MAX_ITEMS)) {
    if (!it || typeof it !== 'object') continue;
    const o = it as Record<string, unknown>;
    const qText = str(o.text ?? o.question);
    const rawChoices = Array.isArray(o.choices) ? o.choices : Array.isArray(o.options) ? o.options : null;
    if (!qText || !rawChoices || rawChoices.length !== 4) continue;
    const choices = rawChoices.map(str);
    if (choices.some(c => c === null)) continue;
    const ci = Number(o.correctIndex ?? o.answerIndex ?? o.correct);
    if (!Number.isInteger(ci) || ci < 0 || ci > 3) continue;
    const diff = o.difficulty === 'easy' || o.difficulty === 'hard' ? o.difficulty : 'medium';
    const yearNum = Number(o.year);
    const year = Number.isInteger(yearNum) && yearNum >= 1990 && yearNum <= 2100 ? yearNum : undefined;
    items.push({
      text: qText,
      choices: choices as [string, string, string, string],
      correctIndex: ci as 0 | 1 | 2 | 3,
      difficulty: diff,
      year,
    });
  }
  return items.length ? { ok: true, items } : { ok: false, error: 'no-valid-items' };
}

export function flashcardPrompt(topicName: string, subjectName?: string): string {
  const scope = subjectName ? `the topic "${topicName}" (subject: ${subjectName})` : `the topic "${topicName}"`;
  return `Create 20 study flashcards for ${scope}, for Thai TCAS university-entrance exam prep.

Reply with ONLY a JSON array in this exact format, no other text:
[{"front": "question or term", "back": "answer or definition"}]

Rules:
- Keep each side under 200 characters.
- Cover the most exam-relevant facts, formulas, and definitions.
- Write the cards in the same language as the topic name.`;
}

export function examPrompt(subjectName: string): string {
  return `Create 10 multiple-choice questions for the subject "${subjectName}" at Thai TCAS university-entrance exam level.

Reply with ONLY a JSON array in this exact format, no other text:
[{"text": "the question", "choices": ["choice A", "choice B", "choice C", "choice D"], "correctIndex": 0, "difficulty": "medium"}]

Rules:
- Exactly 4 choices per question; "correctIndex" is the 0-based index of the correct one.
- "difficulty" is "easy", "medium", or "hard" — mix them.
- Write the questions in the same language as the subject name.`;
}
