<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import { examQuestions, subjects, loadData, getAuthContext } from '$lib/stores/data';
  import { examQuestionsRepo } from '$lib/data/entities';
  import { newId } from '$lib/id';
  import type { ExamQuestion } from '$lib/types';

  onMount(() => loadData($auth));
  $: if ($auth.mode !== 'loading') loadData($auth);

  let search = '';
  let filterSubject = 'all';
  let showForm = false;
  let editingQuestion: ExamQuestion | null = null;

  let formText = '';
  let formChoices: [string, string, string, string] = ['', '', '', ''];
  let formCorrectIndex: 0 | 1 | 2 | 3 = 0;
  let formSubject = '';
  let formDifficulty: ExamQuestion['difficulty'] = 'medium';
  let formYear = '';

  $: filteredQuestions = $examQuestions.filter((q) => {
    const matchesSearch = search === '' || q.text.toLowerCase().includes(search.toLowerCase());
    const matchesSubject = filterSubject === 'all' || q.subject === filterSubject;
    return matchesSearch && matchesSubject;
  });

  $: subjectOptions = [...new Set($examQuestions.map((q) => q.subject))].sort();

  function openAdd() {
    editingQuestion = null;
    formText = '';
    formChoices = ['', '', '', ''];
    formCorrectIndex = 0;
    formSubject = $subjects[0]?.name ?? '';
    formDifficulty = 'medium';
    formYear = '';
    showForm = true;
  }

  function openEdit(q: ExamQuestion) {
    editingQuestion = q;
    formText = q.text;
    formChoices = [...q.choices] as [string, string, string, string];
    formCorrectIndex = q.correctIndex;
    formSubject = q.subject;
    formDifficulty = q.difficulty;
    formYear = q.year ? String(q.year) : '';
    showForm = true;
  }

  function cancelForm() {
    showForm = false;
    editingQuestion = null;
  }

  async function saveQuestion() {
    if (!formText.trim() || formChoices.some((c) => !c.trim())) return;
    const { userId } = getAuthContext();
    const q: ExamQuestion = {
      id: editingQuestion?.id ?? newId(),
      userId,
      text: formText.trim(),
      choices: formChoices.map((c) => c.trim()) as [string, string, string, string],
      correctIndex: formCorrectIndex,
      subject: formSubject,
      difficulty: formDifficulty,
      year: formYear ? parseInt(formYear, 10) : undefined,
      createdAt: editingQuestion?.createdAt ?? new Date().toISOString(),
    };
    await examQuestionsRepo.save(q);
    cancelForm();
  }

  async function deleteQuestion(q: ExamQuestion) {
    if (!confirm('Delete this question?')) return;
    await examQuestionsRepo.remove(q.id);
  }

  function difficultyLabel(d: ExamQuestion['difficulty']): string {
    return d.charAt(0).toUpperCase() + d.slice(1);
  }
</script>

<div class="page">
  <div class="page-header">
    <div>
      <h1 class="page-title">Question Bank</h1>
      <p class="page-sub">{$examQuestions.length} question{$examQuestions.length !== 1 ? 's' : ''}</p>
    </div>
    <div class="header-actions">
      <a href="/exam" class="btn-secondary">← Mock Exam</a>
      <button class="btn-primary" on:click={openAdd}>+ Add Question</button>
    </div>
  </div>

  <div class="toolbar">
    <input class="search" type="text" placeholder="Search questions…" bind:value={search} />
    <select bind:value={filterSubject}>
      <option value="all">All subjects</option>
      {#each subjectOptions as s}
        <option value={s}>{s}</option>
      {/each}
    </select>
  </div>

  {#if showForm}
    <div class="form-card">
      <h3 class="form-title">{editingQuestion ? 'Edit Question' : 'Add Question'}</h3>

      <label class="field-label" for="q-text">Question</label>
      <textarea id="q-text" class="field-input" bind:value={formText} rows={3} placeholder="Enter question text…"></textarea>

      <span class="field-label">Choices — click circle to mark correct</span>
      {#each formChoices as _choice, i}
        <div class="choice-row">
          <span class="choice-letter">{String.fromCharCode(65 + i)}</span>
          <input class="field-input choice-input" bind:value={formChoices[i]} placeholder="Choice {String.fromCharCode(65 + i)}" aria-label="Choice {String.fromCharCode(65 + i)}" />
          <button
            class="correct-btn"
            class:selected={formCorrectIndex === i}
            on:click={() => (formCorrectIndex = i as 0 | 1 | 2 | 3)}
            title="Mark as correct"
            aria-label="Mark choice {String.fromCharCode(65 + i)} correct"
          ></button>
        </div>
      {/each}

      <div class="form-row">
        <div class="form-col">
          <label class="field-label" for="q-subject">Subject</label>
          <select id="q-subject" class="field-input" bind:value={formSubject}>
            {#each $subjects as s}
              <option value={s.name}>{s.name}</option>
            {/each}
          </select>
        </div>
        <div class="form-col">
          <label class="field-label" for="q-diff">Difficulty</label>
          <select id="q-diff" class="field-input" bind:value={formDifficulty}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <div class="form-col">
          <label class="field-label" for="q-year">Year (optional)</label>
          <input id="q-year" class="field-input" bind:value={formYear} placeholder="e.g. 2024" maxlength={4} />
        </div>
      </div>

      <div class="form-actions">
        <button class="btn-secondary" on:click={cancelForm}>Cancel</button>
        <button class="btn-primary" on:click={saveQuestion} disabled={!formText.trim() || formChoices.some((c) => !c.trim())}>
          Save Question
        </button>
      </div>
    </div>
  {/if}

  {#if filteredQuestions.length === 0}
    <div class="empty-state">
      <p class="empty-title">{$examQuestions.length === 0 ? 'No questions yet.' : 'No questions match.'}</p>
      <p class="empty-sub">{$examQuestions.length === 0 ? 'Add your first question to get started.' : 'Try a different search or filter.'}</p>
    </div>
  {:else}
    <div class="question-list">
      {#each filteredQuestions as q (q.id)}
        <div class="question-row">
          <div class="q-content">
            <p class="q-text">{q.text}</p>
            <div class="q-tags">
              <span class="tag tag-subject">{q.subject}</span>
              <span class="tag tag-diff">{difficultyLabel(q.difficulty)}</span>
              {#if q.year}<span class="tag tag-year">{q.year}</span>{/if}
            </div>
          </div>
          <div class="q-actions">
            <button class="action-btn" on:click={() => openEdit(q)}>Edit</button>
            <button class="action-btn action-delete" on:click={() => deleteQuestion(q)} aria-label="Delete question">✕</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .page { max-width: 780px; margin: 0 auto; padding: 32px 24px; }
  .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; gap: 12px; }
  .page-title { font-size: 22px; font-weight: 700; color: var(--text); margin: 0 0 2px; }
  .page-sub { font-size: 13px; color: var(--muted); margin: 0; }
  .header-actions { display: flex; gap: 8px; flex-shrink: 0; }
  .btn-primary { background: var(--primary); color: var(--bg); border: none; border-radius: var(--radius-md); padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-secondary { background: var(--bg2); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 8px 14px; font-size: 13px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; }
  .toolbar { display: flex; gap: 10px; margin-bottom: 20px; }
  .search { flex: 1; background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 8px 12px; font-size: 13px; color: var(--text); font-family: inherit; }
  .toolbar select { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 8px 12px; font-size: 13px; color: var(--text); font-family: inherit; }
  .form-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 20px; margin-bottom: 24px; }
  .form-title { font-size: 15px; font-weight: 600; color: var(--text); margin: 0 0 16px; }
  .field-label { display: block; font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .5px; margin: 12px 0 4px; }
  .field-input { width: 100%; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; font-size: 13px; color: var(--text); box-sizing: border-box; font-family: inherit; }
  .choice-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .choice-letter { width: 16px; font-size: 12px; font-weight: 600; color: var(--muted); flex-shrink: 0; }
  .choice-input { flex: 1; }
  .correct-btn { width: 24px; height: 24px; border-radius: 50%; border: 2px solid var(--border); background: transparent; cursor: pointer; flex-shrink: 0; transition: background 0.15s, border-color 0.15s; }
  .correct-btn.selected { background: var(--primary); border-color: var(--primary); }
  .form-row { display: flex; gap: 12px; }
  .form-col { flex: 1; }
  .form-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
  .empty-state { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 32px 16px; text-align: center; }
  .empty-title { font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
  .empty-sub { font-size: 13px; color: var(--muted); }
  .question-list { display: flex; flex-direction: column; gap: 1px; background: var(--border); border: 1px solid var(--border); border-radius: var(--radius-md); overflow: hidden; }
  .question-row { display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; background: var(--bg2); }
  .q-content { flex: 1; min-width: 0; }
  .q-text { font-size: 13px; font-weight: 500; color: var(--text); margin: 0 0 6px; line-height: 1.4; }
  .q-tags { display: flex; gap: 6px; flex-wrap: wrap; }
  .tag { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 10px; }
  .tag-subject { background: var(--primary-l); color: var(--primary); }
  .tag-diff { background: var(--bg3); color: var(--muted); }
  .tag-year { background: var(--bg3); color: var(--muted); }
  .q-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
  .action-btn { background: none; border: none; font-size: 12px; color: var(--muted); cursor: pointer; padding: 2px 4px; font-family: inherit; }
  .action-btn:hover { color: var(--text); }
  .action-delete:hover { color: var(--danger); }

  @media (max-width: 768px) {
    .page { padding: 24px 16px 80px; }
    .form-row { flex-direction: column; gap: 0; }
    .action-btn { min-height: 36px; }
  }
</style>
