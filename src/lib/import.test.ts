import { describe, it, expect } from 'vitest';
import { parseFlashcards, parseExamQuestions, parseTemplate, flashcardPrompt, examPrompt, templatePrompt } from '$lib/import';

describe('parseTemplate', () => {
  it('parses subjects with string topics', () => {
    const r = parseTemplate('[{"name":"Physics","symbol":"Ph","topics":["Kinematics","Energy"]}]');
    expect(r.ok && r.items[0]).toEqual({ name: 'Physics', symbol: 'Ph', topics: ['Kinematics', 'Energy'] });
  });

  it('accepts subject/title aliases and missing symbol', () => {
    const r = parseTemplate('[{"subject":"Chemistry","topics":["Atoms"]}]');
    expect(r.ok && r.items[0]).toEqual({ name: 'Chemistry', symbol: undefined, topics: ['Atoms'] });
  });

  it('accepts topics as objects with name/title', () => {
    const r = parseTemplate('[{"name":"Bio","chapters":[{"name":"Cells"},{"title":"Genetics"}]}]');
    expect(r.ok && r.items[0].topics).toEqual(['Cells', 'Genetics']);
  });

  it('truncates the symbol to 2 chars and tolerates no topics', () => {
    const r = parseTemplate('[{"name":"Mathematics","symbol":"Math"}]');
    expect(r.ok && r.items[0]).toEqual({ name: 'Mathematics', symbol: 'Ma', topics: [] });
  });

  it('skips entries without a name', () => {
    const r = parseTemplate('[{"topics":["x"]},{"name":"Thai","topics":[]}]');
    expect(r.ok && r.items.length).toBe(1);
    expect(r.ok && r.items[0].name).toBe('Thai');
  });

  it('strips fences and leading prose', () => {
    const r = parseTemplate('Here you go:\n```json\n[{"name":"English","topics":["Grammar"]}]\n```');
    expect(r.ok && r.items.length).toBe(1);
  });

  it('unwraps an object holding the array', () => {
    const r = parseTemplate('{"subjects":[{"name":"Physics","topics":[]}]}');
    expect(r.ok && r.items.length).toBe(1);
  });

  it('errors on invalid json and empty results', () => {
    expect(parseTemplate('not json').ok).toBe(false);
    expect(parseTemplate('[{"foo":"bar"}]').ok).toBe(false);
  });

  it('templatePrompt embeds the goal and count', () => {
    const p = templatePrompt('Medicine', 8);
    expect(p).toContain('Medicine');
    expect(p).toContain('8 main subjects');
  });
});

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

  it('tolerates trailing prose after the array', () => {
    expect(parseFlashcards('[{"front":"f","back":"b"}] \nHope this helps!').ok).toBe(true);
  });

  it('tolerates a trailing comma', () => {
    expect(parseFlashcards('[{"front":"f","back":"b",}]').ok).toBe(true);
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

  it('reports skipped count', () => {
    const r = parseFlashcards('[{"front":"f","back":"b"},{"front":"only front"}]');
    expect(r.ok && r.skipped).toBe(1);
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

  it('accepts letter answers incl. decorated/lowercase', () => {
    const r = parseExamQuestions('[{"text":"q","choices":["1","2","3","4"],"answer":"(c)"}]');
    expect(r.ok && r.items[0].correctIndex).toBe(2);
  });

  it('remaps correct:4 (1-based) to index 3', () => {
    const r = parseExamQuestions('[{"text":"q","choices":["1","2","3","4"],"correct":4}]');
    expect(r.ok && r.items[0].correctIndex).toBe(3);
  });

  it('accepts the answer as the choice text', () => {
    const r = parseExamQuestions('[{"text":"q","choices":["a","b","c","d"],"answer":"c"}]');
    expect(r.ok && r.items[0].correctIndex).toBe(2);
  });

  it('keeps first 4 of 5 choices when the answer is among them', () => {
    const r = parseExamQuestions('[{"text":"q","choices":["a","b","c","d","e"],"correctIndex":0}]');
    expect(r.ok && r.items[0].choices.length).toBe(4);
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
  it('prompts honor the requested count', () => {
    expect(flashcardPrompt('Calculus', undefined, 30)).toContain('Create 30 study flashcards');
    expect(examPrompt('Physics', 5)).toContain('Create 5 multiple-choice');
  });
  it('exam prompt pins a single difficulty when not mixed', () => {
    expect(examPrompt('Physics', 10, 'hard')).toContain('every question "hard"');
    expect(examPrompt('Physics', 10, 'mixed')).toContain('mix them');
  });
});
