-- Optional topic names on exam questions (multiple for mixed-topic questions).
-- Additive only: existing rows default to an empty array, which the mapper
-- reads back as "no topics".
alter table public.exam_questions
  add column if not exists topics text[] not null default '{}';
