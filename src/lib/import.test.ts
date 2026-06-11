import { describe, it, expect } from 'vitest';
import { parseFlashcards, parseExamQuestions, flashcardPrompt, examPrompt } from '$lib/import';

describe('parseFlashcards', () => {
  it('parses a plain JSON array', () => {
    const r = parseFlashcards('[{"front":"d/dx x^2","back":"2x"},{"front":"F=","back":"ma"}]');
    expect(r.ok && r.items).toEqual([
      { front: 'd/dx x^2', back: '2x' },
      { front: 'F=', back: 'ma' },
    ]);
  });

  it('strips markdown code fences', () => {
    const r = parseFlashcards('```json\n[{"front":"a","back":"b"}]\n```');
    expect(r.ok && r.items.length).toBe(1);
  });

  it('cuts leading prose before the JSON', () => {
    const r = parseFlashcards('Here are your flashcards:\n[{"front":"a","back":"b"}]');
    expect(r.ok && r.items.length).toBe(1);
  });

  it('unwraps an object holding the array', () => {
    const r = parseFlashcards('{"cards":[{"front":"a","back":"b"}]}');
    expect(r.ok && r.items.length).toBe(1);
  });

  it('accepts question/answer key aliases', () => {
    const r = parseFlashcards('[{"question":"q","answer":"a"}]');
    expect(r.ok && r.items[0]).toEqual({ front: 'q', back: 'a' });
  });

  it('skips invalid items but keeps valid ones', () => {
    const r = parseFlashcards('[{"front":"a","back":"b"},{"front":""},"junk",{"back":"x"}]');
    expect(r.ok && r.items.length).toBe(1);
  });

  it('rejects non-JSON', () => {
    const r = parseFlashcards('just some text');
    expect(r).toEqual({ ok: false, error: 'invalid-json' });
  });

  it('rejects JSON with no usable items', () => {
    const r = parseFlashcards('[{"foo":1}]');
    expect(r).toEqual({ ok: false, error: 'no-valid-items' });
  });

  it('rejects a non-array JSON value', () => {
    const r = parseFlashcards('"hello"');
    expect(r).toEqual({ ok: false, error: 'not-array' });
  });
});

describe('parseExamQuestions', () => {
  const q = { text: '1+1?', choices: ['1', '2', '3', '4'], correctIndex: 1, difficulty: 'easy' };

  it('parses a valid question', () => {
    const r = parseExamQuestions(JSON.stringify([q]));
    expect(r.ok && r.items[0]).toEqual({ ...q, year: undefined });
  });

  it('defaults unknown difficulty to medium', () => {
    const r = parseExamQuestions(JSON.stringify([{ ...q, difficulty: 'brutal' }]));
    expect(r.ok && r.items[0].difficulty).toBe('medium');
  });

  it('drops questions without exactly 4 choices', () => {
    const r = parseExamQuestions(JSON.stringify([{ ...q, choices: ['1', '2'] }]));
    expect(r).toEqual({ ok: false, error: 'no-valid-items' });
  });

  it('drops out-of-range correctIndex', () => {
    const r = parseExamQuestions(JSON.stringify([{ ...q, correctIndex: 4 }]));
    expect(r).toEqual({ ok: false, error: 'no-valid-items' });
  });

  it('accepts options/answerIndex aliases and keeps a valid year', () => {
    const r = parseExamQuestions(JSON.stringify([{ question: 'q?', options: ['a', 'b', 'c', 'd'], answerIndex: 2, year: 2024 }]));
    expect(r.ok && r.items[0]).toEqual({
      text: 'q?', choices: ['a', 'b', 'c', 'd'], correctIndex: 2, difficulty: 'medium', year: 2024,
    });
  });

  it('discards an implausible year', () => {
    const r = parseExamQuestions(JSON.stringify([{ ...q, year: 12 }]));
    expect(r.ok && r.items[0].year).toBeUndefined();
  });
});

describe('prompts', () => {
  it('flashcard prompt embeds the topic and format', () => {
    const p = flashcardPrompt('Calculus', 'Math');
    expect(p).toContain('"Calculus"');
    expect(p).toContain('Math');
    expect(p).toContain('"front"');
  });
  it('exam prompt embeds the subject and format', () => {
    const p = examPrompt('Physics');
    expect(p).toContain('"Physics"');
    expect(p).toContain('"correctIndex"');
  });
});
