import type { SubjectPreset, Template } from '$lib/types';

export const SUBJECT_COLOR_PALETTE: { hex: string; rgb: string }[] = [
  { hex: '#ef4444', rgb: '239,68,68'   },
  { hex: '#f59e0b', rgb: '245,158,11'  },
  { hex: '#22c55e', rgb: '34,197,94'   },
  { hex: '#0d9488', rgb: '13,148,136'  },
  { hex: '#3b82f6', rgb: '59,130,246'  },
  { hex: '#8b5cf6', rgb: '139,92,246'  },
  { hex: '#ec4899', rgb: '236,72,153'  },
  { hex: '#6b7280', rgb: '107,114,128' },
];

function p(name: string, symbol: string, color: string, colorRgb: string): SubjectPreset {
  return { name, symbol, color, colorRgb };
}

export const BUILTIN_TEMPLATES: Template[] = [
  {
    id: 'builtin-tcas',
    userId: 'builtin',
    name: 'TCAS',
    createdAt: '2026-01-01T00:00:00.000Z',
    presets: [
      p('Physics',     'Ph', '#0d9488', '13,148,136'),
      p('Chemistry',   'Ch', '#d97706', '217,119,6'),
      p('Mathematics', 'Ma', '#3b82f6', '59,130,246'),
      p('Biology',     'Bi', '#22c55e', '34,197,94'),
      p('English',     'En', '#f43f5e', '244,63,94'),
      p('Thai',        'Th', '#8b5cf6', '139,92,246'),
      p('TGAT1',       'G1', '#0ea5e9', '14,165,233'),
      p('TGAT2',       'G2', '#0284c7', '2,132,199'),
      p('TGAT3',       'G3', '#0369a1', '3,105,161'),
      p('TPAT1',       'P1', '#ec4899', '236,72,153'),
      p('TPAT2',       'P2', '#db2777', '219,39,119'),
      p('TPAT3',       'P3', '#f97316', '249,115,22'),
      p('TPAT4',       'P4', '#ea580c', '234,88,12'),
      p('TPAT5',       'P5', '#dc2626', '220,38,38'),
    ],
  },
  {
    id: 'builtin-medicine',
    userId: 'builtin',
    name: 'Medicine',
    createdAt: '2026-01-01T00:00:00.000Z',
    presets: [
      p('Biology',        'Bi', '#22c55e', '34,197,94'),
      p('Chemistry',      'Ch', '#d97706', '217,119,6'),
      p('Physics',        'Ph', '#0d9488', '13,148,136'),
      p('Thai',           'Th', '#8b5cf6', '139,92,246'),
      p('English',        'En', '#f43f5e', '244,63,94'),
      p('Social Studies', 'So', '#6b7280', '107,114,128'),
      p('TPAT1',          'P1', '#ec4899', '236,72,153'),
      p('TGAT1',          'G1', '#0ea5e9', '14,165,233'),
      p('TGAT2',          'G2', '#0284c7', '2,132,199'),
      p('TGAT3',          'G3', '#0369a1', '3,105,161'),
    ],
  },
  {
    id: 'builtin-engineering',
    userId: 'builtin',
    name: 'Engineering',
    createdAt: '2026-01-01T00:00:00.000Z',
    presets: [
      p('Mathematics', 'Ma', '#3b82f6', '59,130,246'),
      p('Physics',     'Ph', '#0d9488', '13,148,136'),
      p('Chemistry',   'Ch', '#d97706', '217,119,6'),
      p('English',     'En', '#f43f5e', '244,63,94'),
      p('TPAT3',       'P3', '#f97316', '249,115,22'),
    ],
  },
];

export const ALL_BUILTIN_PRESETS = new Map(
  BUILTIN_TEMPLATES.flatMap(t => t.presets).map(p => [p.name.toLowerCase(), p])
);
