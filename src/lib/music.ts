// Link-only music: turn a pasted YouTube / Spotify / SoundCloud / Apple Music
// URL into an embeddable player iframe. No uploads, no API keys — just a link.

export type MusicKind = 'youtube' | 'spotify' | 'soundcloud' | 'applemusic';

export interface MusicEmbed {
  kind: MusicKind;
  src: string;
  height: number;
}

const SPOTIFY_TYPES = ['track', 'playlist', 'album', 'artist', 'episode', 'show'];

function youtube(id: string, list: string | null): MusicEmbed {
  const q = list ? `?list=${encodeURIComponent(list)}` : '';
  return { kind: 'youtube', src: `https://www.youtube.com/embed/${id}${q}`, height: 200 };
}

/** Parse a music link into a player embed, or null if it isn't a supported link. */
export function toMusicEmbed(raw: string): MusicEmbed | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let u: URL;
  try { u = new URL(withScheme); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;

  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  const parts = u.pathname.split('/').filter(Boolean);

  // YouTube — youtu.be/<id>, /watch?v=<id>, /embed/<id>, /playlist?list=<id>
  if (host === 'youtu.be') {
    const id = parts[0];
    if (id) return youtube(id, u.searchParams.get('list'));
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    if (u.pathname === '/watch') {
      const id = u.searchParams.get('v');
      if (id) return youtube(id, u.searchParams.get('list'));
    }
    if (parts[0] === 'embed' && parts[1]) return youtube(parts[1], u.searchParams.get('list'));
    if (u.pathname === '/playlist') {
      const list = u.searchParams.get('list');
      if (list) return { kind: 'youtube', src: `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(list)}`, height: 200 };
    }
  }

  // Spotify — open.spotify.com/[intl-xx/]<type>/<id>
  if (host === 'open.spotify.com') {
    const i = parts.findIndex(p => SPOTIFY_TYPES.includes(p));
    if (i !== -1 && parts[i + 1]) {
      const type = parts[i];
      const id = parts[i + 1].split('?')[0];
      const tall = type === 'playlist' || type === 'album' || type === 'artist' || type === 'show';
      return { kind: 'spotify', src: `https://open.spotify.com/embed/${type}/${id}`, height: tall ? 352 : 152 };
    }
  }

  // SoundCloud — any track/set URL feeds the official widget
  if (host === 'soundcloud.com' || host === 'm.soundcloud.com') {
    if (parts.length) {
      const player = `https://w.soundcloud.com/player/?url=${encodeURIComponent(`https://soundcloud.com${u.pathname}`)}&color=%23ff5500&auto_play=false`;
      return { kind: 'soundcloud', src: player, height: 166 };
    }
  }

  // Apple Music — swap the host for the embed host, keep the path
  if (host === 'music.apple.com') {
    const tall = parts.includes('playlist') || parts.includes('album');
    return { kind: 'applemusic', src: `https://embed.music.apple.com${u.pathname}${u.search}`, height: tall ? 450 : 175 };
  }

  return null;
}
