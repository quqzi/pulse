import { describe, expect, it } from 'vitest';
import { insertLink, toggleLinePrefix, toggleWrap } from '$lib/notesFormat';

describe('toggleWrap', () => {
  it('wraps a selection', () => {
    expect(toggleWrap('ab', 0, 2, '**', '**')).toEqual({
      text: '**ab**',
      selStart: 2,
      selEnd: 4,
    });
  });

  it('inserts markers with the caret between them for an empty selection', () => {
    expect(toggleWrap('', 0, 0, '**', '**')).toEqual({
      text: '****',
      selStart: 2,
      selEnd: 2,
    });
  });

  it('unwraps an already wrapped selection', () => {
    expect(toggleWrap('**ab**', 2, 4, '**', '**')).toEqual({
      text: 'ab',
      selStart: 0,
      selEnd: 2,
    });
  });

  it('composes italic onto bold instead of corrupting the bold markers', () => {
    // **ab** with "ab" selected (2..4), applying italic must yield ***ab***,
    // not unwrap the inner bold asterisks into *ab*.
    expect(toggleWrap('**ab**', 2, 4, '*', '*')).toEqual({
      text: '***ab***',
      selStart: 3,
      selEnd: 5,
    });
  });

  it('composes bold onto italic', () => {
    expect(toggleWrap('*ab*', 1, 3, '**', '**')).toEqual({
      text: '***ab***',
      selStart: 3,
      selEnd: 5,
    });
  });

  it('still unwraps a standalone italic selection', () => {
    expect(toggleWrap('*ab*', 1, 3, '*', '*')).toEqual({
      text: 'ab',
      selStart: 0,
      selEnd: 2,
    });
  });

  it('toggles italic off a composed bold+italic, leaving bold intact', () => {
    // ***ab*** with "ab" selected (3..5), applying italic must decompose to **ab**,
    // not pile on a fourth asterisk per side.
    expect(toggleWrap('***ab***', 3, 5, '*', '*')).toEqual({
      text: '**ab**',
      selStart: 2,
      selEnd: 4,
    });
  });

  it('toggles bold off a composed bold+italic, leaving italic intact', () => {
    expect(toggleWrap('***ab***', 3, 5, '**', '**')).toEqual({
      text: '*ab*',
      selStart: 1,
      selEnd: 3,
    });
  });
});

describe('toggleLinePrefix', () => {
  it('adds a heading prefix to a single line', () => {
    expect(toggleLinePrefix('Title', 0, 5, '## ')).toEqual({
      text: '## Title',
      selStart: 0,
      selEnd: 8,
    });
  });

  it('adds a bullet prefix to each of multiple selected lines', () => {
    expect(toggleLinePrefix('a\nb\nc', 0, 5, '- ')).toEqual({
      text: '- a\n- b\n- c',
      selStart: 0,
      selEnd: 11,
    });
  });

  it('numbers lines sequentially for ordered lists', () => {
    expect(toggleLinePrefix('a\nb\nc', 0, 5, '1. ')).toEqual({
      text: '1. a\n2. b\n3. c',
      selStart: 0,
      selEnd: 14,
    });
  });

  it('removes the prefix when every touched line already has it', () => {
    expect(toggleLinePrefix('- a\n- b', 0, 7, '- ')).toEqual({
      text: 'a\nb',
      selStart: 0,
      selEnd: 3,
    });
  });

  it('prefixes the first empty line when the document starts with a newline', () => {
    expect(toggleLinePrefix('\nbody', 0, 0, '> ')).toEqual({
      text: '> \nbody',
      selStart: 0,
      selEnd: 2,
    });
  });
});

describe('insertLink', () => {
  it('wraps a selection as a link and selects the url placeholder', () => {
    expect(insertLink('read this', 0, 4)).toEqual({
      text: '[read](url) this',
      selStart: 7,
      selEnd: 10,
    });
  });
});
