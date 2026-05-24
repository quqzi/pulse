export const TCAS_SUBJECTS = [
  { name: 'Physics',      symbol: 'Ph', color: '#0d9488', colorRgb: '13,148,136',  orderIndex: 0 },
  { name: 'Chemistry',    symbol: 'Ch', color: '#d97706', colorRgb: '217,119,6',   orderIndex: 1 },
  { name: 'Mathematics',  symbol: 'Ma', color: '#3b82f6', colorRgb: '59,130,246',  orderIndex: 2 },
  { name: 'Biology',      symbol: 'Bi', color: '#22c55e', colorRgb: '34,197,94',   orderIndex: 3 },
  { name: 'English',      symbol: 'En', color: '#f43f5e', colorRgb: '244,63,94',   orderIndex: 4 },
  { name: 'TGAT/Social',  symbol: 'So', color: '#8b5cf6', colorRgb: '139,92,246',  orderIndex: 5 },
] as const;

export type SubjectName = (typeof TCAS_SUBJECTS)[number]['name'];
