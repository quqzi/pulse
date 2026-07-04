<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import { examQuestions, subjects, loadData, getAuthContext } from '$lib/stores/data';
  import { examQuestionsRepo } from '$lib/data/entities';
  import { newId } from '$lib/id';
  import { parseExamQuestions, examPrompt, type ExamQuestionDraft, type ExamPromptDifficulty } from '$lib/import';
  import { toast } from '$lib/stores/toast';
  import ImportSheet from '$lib/components/ImportSheet.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import { fileToDownscaledDataUrl } from '$lib/image';
  import Picker from '$lib/components/Picker.svelte';
  import { t } from '$lib/i18n';
  import { get } from 'svelte/store';
  import type { ExamQuestion } from '$lib/types';
  import MathText from '$lib/components/MathText.svelte';
  import MathToolbar from '$lib/components/MathToolbar.svelte';

  $: diffLabels = { easy: $t.exam.diffEasy, medium: $t.exam.diffMedium, hard: $t.exam.diffHard };

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
  let formImageUrl: string | undefined;
  let imageLoading = false;

  async function onPickImage(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    imageLoading = true;
    try {
      formImageUrl = await fileToDownscaledDataUrl(file);
    } catch {
      toast.error(get(t).exam.imageError);
    } finally {
      imageLoading = false;
      (e.currentTarget as HTMLInputElement).value = '';
    }
  }

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
    formImageUrl = undefined;
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
    formImageUrl = q.imageUrl;
    showForm = true;
  }

  function cancelForm() {
    showForm = false;
    editingQuestion = null;
  }

  let mathOpen = false;
  let textEl: HTMLTextAreaElement;
  let choiceEls: (HTMLInputElement | undefined)[] = [undefined, undefined, undefined, undefined];
  let focusedField: 'text' | number = 'text';

  function insertTex(tex: string) {
    const el = focusedField === 'text' ? textEl : choiceEls[focusedField];
    const cur = focusedField === 'text' ? formText : formChoices[focusedField];
    const start = el?.selectionStart ?? cur.length;
    const end = el?.selectionEnd ?? start;
    const next = cur.slice(0, start) + tex + cur.slice(end);
    const hole = tex.includes('{}') ? tex.indexOf('{}') + 1 : tex.includes('()') ? tex.indexOf('()') + 1 : tex.length;
    if (focusedField === 'text') formText = next;
    else formChoices[focusedField] = next;
    queueMicrotask(() => { el?.focus(); el?.setSelectionRange(start + hole, start + hole); });
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
      imageUrl: formImageUrl,
      createdAt: editingQuestion?.createdAt ?? new Date().toISOString(),
    };
    await examQuestionsRepo.save(q);
    cancelForm();
  }

  // Native confirm() is suppressed in iOS standalone PWAs — use the app dialog.
  let deleteOpen = false;
  let pendingDeleteId: string | null = null;
  function promptDelete(q: ExamQuestion) { pendingDeleteId = q.id; deleteOpen = true; }
  async function doDelete() {
    if (pendingDeleteId) await examQuestionsRepo.remove(pendingDeleteId);
    pendingDeleteId = null;
  }

  // ── AI import ─────────────────────────────────────────────
  let importOpen = false;
  let importSubject = '';
  let importCount = 10;
  let importDifficulty: ExamPromptDifficulty = 'mixed';
  let importLanguage = '';
  let importFocus = '';
  $: if (!importSubject && $subjects.length > 0) importSubject = $subjects[0].name;
  $: importPromptText = examPrompt(importSubject || 'TCAS', importCount, importDifficulty, importLanguage || undefined, importFocus.trim() || undefined);

  function previewQuestion(item: unknown) {
    const draft = item as ExamQuestionDraft;
    return { title: draft.text, sub: draft.choices[draft.correctIndex] };
  }

  function isDuplicateQuestion(item: unknown) {
    const draft = item as ExamQuestionDraft;
    const targetSubject = importSubject || 'TCAS';
    const text = draft.text.trim().toLowerCase();
    return $examQuestions.some((q) => q.subject === targetSubject && q.text.trim().toLowerCase() === text);
  }

  async function handleImport(e: CustomEvent<{ items: unknown[] }>) {
    const { userId } = getAuthContext();
    const drafts = e.detail.items as ExamQuestionDraft[];
    const createdAt = new Date().toISOString();
    const ok = await examQuestionsRepo.saveMany(
      drafts.map((d) => ({
        id: newId(), userId,
        text: d.text, choices: d.choices, correctIndex: d.correctIndex,
        subject: importSubject || 'TCAS', difficulty: d.difficulty, year: d.year,
        createdAt,
      })),
    );
    if (!ok) return; // engine rolled back + toasted; keep the sheet + paste for retry
    importOpen = false;
    toast.success(get(t).importer.importedToast(drafts.length));
  }
</script>

<ConfirmDialog bind:open={deleteOpen} title={$t.exam.deleteConfirm} message={$t.common.cannotUndo} on:confirm={doDelete} />

<div class="page">
  <div class="page-header">
    <div>
      <h1 class="page-title">{$t.exam.bankTitle}</h1>
      <p class="page-sub">{$t.exam.bankCount($examQuestions.length)}</p>
    </div>
    <div class="header-actions">
      <a href="/exam" class="btn-secondary">{$t.exam.backToExam}</a>
      <button class="btn-secondary" on:click={() => (importOpen = true)}>✦ {$t.importer.open}</button>
      <button class="btn-primary" on:click={openAdd}>{$t.exam.addQuestion}</button>
    </div>
  </div>

  <ImportSheet
    bind:open={importOpen}
    prompt={importPromptText}
    parse={parseExamQuestions}
    preview={previewQuestion}
    isDuplicate={isDuplicateQuestion}
    on:import={handleImport}
    on:close={() => (importOpen = false)}
  >
    <div slot="options" class="import-options">
      <div class="import-subject-row">
        <label class="field-label" for="import-subject">{$t.exam.subjectLabel}</label>
        <Picker
          bind:value={importSubject}
          options={$subjects.map(s => ({ value: s.name, label: s.name, color: s.color }))}
          ariaLabel={$t.exam.subjectLabel}
        />
      </div>
      <div class="opt-row">
        <span class="opt-label">{$t.importer.howMany}</span>
        {#each [5, 10, 20] as n (n)}
          <button class="opt-pill" class:active={importCount === n} on:click={() => (importCount = n)}>{n}</button>
        {/each}
      </div>
      <div class="opt-row">
        <span class="opt-label">{$t.exam.difficulty}</span>
        <button class="opt-pill" class:active={importDifficulty === 'mixed'} on:click={() => (importDifficulty = 'mixed')}>{$t.importer.diffMixed}</button>
        <button class="opt-pill" class:active={importDifficulty === 'easy'} on:click={() => (importDifficulty = 'easy')}>{$t.exam.diffEasy}</button>
        <button class="opt-pill" class:active={importDifficulty === 'medium'} on:click={() => (importDifficulty = 'medium')}>{$t.exam.diffMedium}</button>
        <button class="opt-pill" class:active={importDifficulty === 'hard'} on:click={() => (importDifficulty = 'hard')}>{$t.exam.diffHard}</button>
      </div>
      <div class="opt-row">
        <span class="opt-label">{$t.importer.language}</span>
        <button class="opt-pill" class:active={importLanguage === ''} on:click={() => (importLanguage = '')}>{$t.importer.languageAuto}</button>
        <button class="opt-pill" class:active={importLanguage === 'Thai'} on:click={() => (importLanguage = 'Thai')}>{$t.importer.languageThai}</button>
        <button class="opt-pill" class:active={importLanguage === 'English'} on:click={() => (importLanguage = 'English')}>{$t.importer.languageEnglish}</button>
      </div>
      <div class="import-focus-row">
        <label class="field-label" for="exam-import-focus">{$t.importer.focus}</label>
        <input id="exam-import-focus" class="field-input" bind:value={importFocus} placeholder={$t.importer.focusPlaceholder} />
      </div>
    </div>
  </ImportSheet>

  <div class="toolbar">
    <input class="search" type="text" placeholder={$t.exam.searchPlaceholder} bind:value={search} />
    <Picker
      value={filterSubject === 'all' ? '' : filterSubject}
      options={subjectOptions.map(s => ({ value: s, label: s }))}
      placeholder={$t.exam.allSubjects}
      on:change={(e) => (filterSubject = e.detail.value || 'all')}
    />
  </div>

  {#if showForm}
    <div class="form-card">
      <h3 class="form-title">{editingQuestion ? $t.exam.editQuestionTitle : $t.exam.addQuestionTitle}</h3>

      <label class="field-label" for="q-text">{$t.exam.questionLabel}</label>
      <textarea id="q-text" class="field-input" bind:value={formText} bind:this={textEl} on:focus={() => (focusedField = 'text')} rows={3} placeholder={$t.exam.questionPlaceholder}></textarea>

      <div class="math-row">
        <button class="math-toggle" class:active={mathOpen} on:click={() => (mathOpen = !mathOpen)} aria-label={$t.common.insertMath} aria-pressed={mathOpen}>√x</button>
        {#if mathOpen}<MathToolbar on:insert={(e) => insertTex(e.detail.tex)} />{/if}
      </div>
      {#if formText.includes('$')}
        <p class="math-preview"><MathText text={formText} /></p>
      {/if}

      <span class="field-label">{$t.exam.choicesLabel}</span>
      {#each formChoices as _choice, i}
        <div class="choice-row">
          <span class="choice-letter">{String.fromCharCode(65 + i)}</span>
          <input class="field-input choice-input" bind:value={formChoices[i]} bind:this={choiceEls[i]} on:focus={() => (focusedField = i)} placeholder={$t.exam.choicePlaceholder(String.fromCharCode(65 + i))} aria-label={$t.exam.choiceAria(String.fromCharCode(65 + i))} />
          <button
            class="correct-btn"
            class:selected={formCorrectIndex === i}
            on:click={() => (formCorrectIndex = i as 0 | 1 | 2 | 3)}
            title={$t.exam.markCorrect}
            aria-label={$t.exam.markChoiceCorrect(String.fromCharCode(65 + i))}
          ></button>
        </div>
      {/each}

      <div class="form-row">
        <div class="form-col">
          <span class="field-label">{$t.exam.subjectLabel}</span>
          <Picker
            bind:value={formSubject}
            options={$subjects.map(s => ({ value: s.name, label: s.name, color: s.color }))}
            ariaLabel={$t.exam.subjectLabel}
          />
        </div>
        <div class="form-col">
          <span class="field-label">{$t.exam.difficulty}</span>
          <Picker
            value={formDifficulty}
            options={[
              { value: 'easy', label: $t.exam.diffEasy },
              { value: 'medium', label: $t.exam.diffMedium },
              { value: 'hard', label: $t.exam.diffHard },
            ]}
            ariaLabel={$t.exam.difficulty}
            on:change={(e) => (formDifficulty = e.detail.value as 'easy' | 'medium' | 'hard')}
          />
        </div>
        <div class="form-col">
          <label class="field-label" for="q-year">{$t.exam.yearOptional}</label>
          <input id="q-year" class="field-input" bind:value={formYear} placeholder={$t.exam.yearPlaceholder} maxlength={4} />
        </div>
      </div>

      <span class="field-label">{$t.exam.imageLabel}</span>
      {#if formImageUrl}
        <div class="image-preview">
          <img src={formImageUrl} alt={$t.exam.imageAlt} />
          <button class="image-remove" on:click={() => (formImageUrl = undefined)} aria-label={$t.exam.imageRemove}>✕</button>
        </div>
      {:else}
        <label class="image-drop" class:loading={imageLoading}>
          <input type="file" accept="image/*" on:change={onPickImage} hidden />
          <span>{imageLoading ? $t.exam.imageLoading : $t.exam.imageAdd}</span>
        </label>
      {/if}

      <div class="form-actions">
        <button class="btn-secondary" on:click={cancelForm}>{$t.common.cancel}</button>
        <button class="btn-primary" on:click={saveQuestion} disabled={!formText.trim() || formChoices.some((c) => !c.trim())}>
          {$t.exam.saveQuestion}
        </button>
      </div>
    </div>
  {/if}

  {#if filteredQuestions.length === 0}
    <EmptyState
      icon="doc"
      title={$examQuestions.length === 0 ? $t.exam.emptyNoQuestions : $t.exam.emptyNoMatch}
      sub={$examQuestions.length === 0 ? $t.exam.emptyAddFirst : $t.exam.emptyTryDifferent}
    />
  {:else}
    <div class="question-list">
      {#each filteredQuestions as q (q.id)}
        <div class="question-row">
          {#if q.imageUrl}<img class="q-thumb" src={q.imageUrl} alt={$t.exam.imageAlt} />{/if}
          <div class="q-content">
            <p class="q-text"><MathText text={q.text} /></p>
            <div class="q-tags">
              <span class="tag tag-subject">{q.subject}</span>
              <span class="tag tag-diff">{diffLabels[q.difficulty]}</span>
              {#if q.year}<span class="tag tag-year">{q.year}</span>{/if}
            </div>
          </div>
          <div class="q-actions">
            <button class="action-btn" on:click={() => openEdit(q)}>{$t.common.edit}</button>
            <button class="action-btn action-delete" on:click={() => promptDelete(q)} aria-label={$t.exam.deleteQuestionAria}>✕</button>
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
  .toolbar > :global(.picker-trigger) { width: auto; min-width: 140px; font-size: 13px; }
  .form-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 20px; margin-bottom: 24px; }
  .form-title { font-size: 15px; font-weight: 600; color: var(--text); margin: 0 0 16px; }
  .field-label { display: block; font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .5px; margin: 12px 0 4px; }
  .field-input { width: 100%; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; font-size: 13px; color: var(--text); box-sizing: border-box; font-family: inherit; }
  .choice-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .math-row { display: flex; align-items: flex-start; gap: 8px; margin: 6px 0 10px; }
  .math-toggle {
    flex-shrink: 0; padding: 5px 10px; border-radius: 8px;
    border: 1.5px solid var(--border); background: none; color: var(--muted);
    font-family: var(--font-mono); font-size: 12px; font-weight: 600; cursor: pointer;
  }
  .math-toggle.active { border-color: var(--primary); color: var(--primary); background: var(--primary-l); }
  .math-preview { margin: 0 0 10px; padding: 8px 10px; border-radius: 8px; background: var(--bg3); font-size: 14px; color: var(--text); }
  .choice-letter { width: 16px; font-size: 12px; font-weight: 600; color: var(--muted); flex-shrink: 0; }
  .choice-input { flex: 1; }
  .correct-btn { width: 24px; height: 24px; border-radius: 50%; border: 2px solid var(--border); background: transparent; cursor: pointer; flex-shrink: 0; transition: background 0.15s, border-color 0.15s; }
  .correct-btn.selected { background: var(--primary); border-color: var(--primary); }
  .form-row { display: flex; gap: 12px; }
  .form-col { flex: 1; }
  .form-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
  .image-drop {
    display: flex; align-items: center; justify-content: center;
    padding: 18px; border: 1.5px dashed var(--border); border-radius: var(--radius-md);
    background: var(--bg); color: var(--muted); font-size: 13px; font-weight: 500;
    cursor: pointer; transition: border-color 120ms ease, color 120ms ease;
  }
  .image-drop:hover { border-color: var(--primary); color: var(--text); }
  .image-drop.loading { opacity: 0.6; cursor: progress; }
  .image-preview { position: relative; display: inline-block; max-width: 100%; }
  .image-preview img {
    max-width: 100%; max-height: 220px; border-radius: var(--radius-md);
    border: 1px solid var(--border); display: block;
  }
  .image-remove {
    position: absolute; top: 6px; right: 6px;
    width: 28px; height: 28px; border-radius: 50%; border: none;
    background: rgba(0,0,0,0.6); color: #fff; cursor: pointer; font-size: 13px;
    display: flex; align-items: center; justify-content: center;
  }
  .q-thumb {
    width: 48px; height: 48px; object-fit: cover; border-radius: 8px;
    border: 1px solid var(--border); flex-shrink: 0;
  }
  .import-subject-row { margin-bottom: 10px; }
  .import-subject-row .field-label { margin-top: 0; }
  .import-focus-row .field-label { margin-top: 0; }
  .import-options { margin-bottom: 4px; }
  .opt-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
  .opt-label { font-size: 12px; color: var(--muted); margin-right: 2px; min-width: 52px; }
  .opt-pill { padding: 6px 12px; border-radius: 999px; border: 1.5px solid var(--border); background: var(--bg); color: var(--muted); font-family: inherit; font-size: 12px; font-weight: 600; cursor: pointer; min-height: 32px; }
  .opt-pill.active { border-color: var(--primary); background: var(--primary-l); color: var(--primary); }
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
