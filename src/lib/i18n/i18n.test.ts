import { describe, it, expect } from 'vitest';
import { en } from '$lib/i18n/en';
import { th } from '$lib/i18n/th';

type Shape = Record<string, unknown>;

// Flatten to `path:typeof` entries so a string→function mismatch is also caught.
function keyTypes(obj: Shape, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return typeof v === 'object' && v !== null
      ? keyTypes(v as Shape, path)
      : [`${path}:${typeof v}`];
  });
}

describe('i18n en/th parity', () => {
  it('th has the identical key set and value types as en', () => {
    expect(keyTypes(th as Shape).sort()).toEqual(keyTypes(en as Shape).sort());
  });

  it('converted sections have no leftover ASCII-English string values in th', () => {
    // Sections converted in the WS3 pilot. Extend this list as fan-out proceeds.
    const sections = ['nav', 'dashboard', 'readiness'] as const;
    const offenders: string[] = [];
    for (const sec of sections) {
      const block = (th as Record<string, Shape>)[sec] ?? {};
      for (const [k, v] of Object.entries(block)) {
        if (typeof v === 'string' && /[A-Za-z]/.test(v) && /^[\x00-\x7F]+$/.test(v)) {
          offenders.push(`${sec}.${k} = "${v}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
