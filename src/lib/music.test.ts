import { describe, it, expect } from 'vitest';
import { toMusicEmbed } from '$lib/music';

describe('toMusicEmbed', () => {
  it('returns null for empty or junk input', () => {
    expect(toMusicEmbed('')).toBeNull();
    expect(toMusicEmbed('   ')).toBeNull();
    expect(toMusicEmbed('hello there')).toBeNull();
    expect(toMusicEmbed('example.com/song')).toBeNull();
  });

  it('rejects non-http protocols', () => {
    expect(toMusicEmbed('javascript:alert(1)')).toBeNull();
  });

  it('parses a youtu.be short link', () => {
    const e = toMusicEmbed('https://youtu.be/dQw4w9WgXcQ');
    expect(e).toEqual({ kind: 'youtube', src: 'https://www.youtube.com/embed/dQw4w9WgXcQ', height: 200 });
  });

  it('parses a youtube watch link and keeps the list', () => {
    const e = toMusicEmbed('https://www.youtube.com/watch?v=abc123&list=PL999');
    expect(e?.src).toBe('https://www.youtube.com/embed/abc123?list=PL999');
  });

  it('parses a youtube playlist link', () => {
    const e = toMusicEmbed('https://youtube.com/playlist?list=PLxyz');
    expect(e?.src).toBe('https://www.youtube.com/embed/videoseries?list=PLxyz');
  });

  it('accepts a bare host without a scheme', () => {
    const e = toMusicEmbed('youtu.be/dQw4w9WgXcQ');
    expect(e?.kind).toBe('youtube');
  });

  it('parses a spotify track as the compact player', () => {
    const e = toMusicEmbed('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT');
    expect(e).toEqual({ kind: 'spotify', src: 'https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT', height: 152 });
  });

  it('parses a spotify playlist as the tall player and handles intl prefixes', () => {
    const e = toMusicEmbed('https://open.spotify.com/intl-th/playlist/37i9dQZF1DXcBWIGoYBM5M?si=x');
    expect(e).toEqual({ kind: 'spotify', src: 'https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M', height: 352 });
  });

  it('parses a soundcloud track via the widget', () => {
    const e = toMusicEmbed('https://soundcloud.com/artist/track-name');
    expect(e?.kind).toBe('soundcloud');
    expect(e?.src).toContain('w.soundcloud.com/player');
    expect(e?.src).toContain(encodeURIComponent('https://soundcloud.com/artist/track-name'));
  });

  it('parses an apple music album as the tall embed', () => {
    const e = toMusicEmbed('https://music.apple.com/us/album/whatever/123456');
    expect(e?.kind).toBe('applemusic');
    expect(e?.src).toBe('https://embed.music.apple.com/us/album/whatever/123456');
    expect(e?.height).toBe(450);
  });
});
