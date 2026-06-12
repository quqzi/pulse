<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import { examQuestions, subjects, loadData, getAuthContext } from '$lib/stores/data';
  import { examSessionsRepo } from '$lib/data/entities';
  import { newId } from '$lib/id';
  import { t } from '$lib/i18n';
  import type { ExamQuestion, ExamSession } from '$lib/types';
  import MathText from '$lib/components/MathText.svelte';

  $: diffLabels = { easy: $t.exam.diffEasy, medium: $t.exam.diffMedium, hard: $t.exam.diffHard };

  onMount(() => loadData($auth));
  $: if ($auth.mode !== 'loading') loadData($auth);

  type Phase = 'setup' | 'running' | 'results';
  let phase: Phase = 'setup';

  // ── Setup config ─────────────────────────────────────────
  let selectedSubjects: string[] = [];
  let selectedDifficulties: ('easy' | 'medium' | 'hard')[] = ['easy', 'medium', 'hard'];
  let questionsPerSubject = 10;
  let useAllQuestions = false;
  let timerMode: 'overall' | 'per-question' = 'overall';
  let overallMinutes = 30;
  let noOverallLimit = false;
  let secondsPerQuestion = 60;

  $: availableSubjects = [...new Set($examQuestions.map((q) => q.subject))].sort();

  $: filteredPool = $examQuestions.filter(
    (q) => selectedSubjects.includes(q.subject) && selectedDifficulties.includes(q.difficulty),
  );

  $: totalQuestions = useAllQuestions
    ? filteredPool.length
    : selectedSubjects.reduce((sum, s) => {
        const available = filteredPool.filter((q) => q.subject === s).length;
        return sum + Math.min(questionsPerSubject, available);
      }, 0);

  $: canStart = selectedSubjects.length > 0 && selectedDifficulties.length > 0 && filteredPool.length > 0;

  $: summaryLine = canStart
    ? `${$t.exam.questionCount(totalQuestions)} · ${selectedSubjects.join(' + ')} · ${selectedDifficulties
        .map((d) => diffLabels[d])
        .join(' + ')} · ${
        timerMode === 'overall'
          ? noOverallLimit
            ? $t.exam.noTimeLimit
            : $t.exam.minOverall(overallMinutes)
          : $t.exam.secPerQuestion(secondsPerQuestion)
      }`
    : $t.exam.noMatch;

  function toggleSubject(s: string) {
    selectedSubjects = selectedSubjects.includes(s)
      ? selectedSubjects.filter((x) => x !== s)
      : [...selectedSubjects, s];
  }

  function toggleDifficulty(d: 'easy' | 'medium' | 'hard') {
    selectedDifficulties = selectedDifficulties.includes(d)
      ? selectedDifficulties.filter((x) => x !== d)
      : [...selectedDifficulties, d];
  }

  // ── Running state ─────────────────────────────────────────
  let queue: ExamQuestion[] = [];
  let currentIndex = 0;
  let answers: (number | null)[] = [];
  let startedAt = 0;

  let overallSecondsLeft = 0;
  let timerInterval: ReturnType<typeof setInterval> | null = null;
  let perQuestionSecondsLeft = 0;
  let perQuestionInterval: ReturnType<typeof setInterval> | null = null;

  $: current = queue[currentIndex] ?? null;
  $: progressPct = queue.length > 0 ? (currentIndex / queue.length) * 100 : 0;

  function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function buildQueue(): ExamQuestion[] {
    const result: ExamQuestion[] = [];
    for (const subj of selectedSubjects) {
      const pool = shuffle(filteredPool.filter((q) => q.subject === subj));
      const take = useAllQuestions ? pool.length : Math.min(questionsPerSubject, pool.length);
      result.push(...pool.slice(0, take));
    }
    return shuffle(result);
  }

  function startExam() {
    queue = buildQueue();
    answers = new Array(queue.length).fill(null);
    currentIndex = 0;
    startedAt = Date.now();
    phase = 'running';

    if (timerMode === 'overall' && !noOverallLimit) {
      overallSecondsLeft = overallMinutes * 60;
      timerInterval = setInterval(() => {
        overallSecondsLeft--;
        if (overallSecondsLeft <= 0) finishExam();
      }, 1000);
    }

    if (timerMode === 'per-question') startPerQuestionTimer();
  }

  function startPerQuestionTimer() {
    if (perQuestionInterval) clearInterval(perQuestionInterval);
    perQuestionSecondsLeft = secondsPerQuestion;
    perQuestionInterval = setInterval(() => {
      perQuestionSecondsLeft--;
      if (perQuestionSecondsLeft <= 0) advance();
    }, 1000);
  }

  function selectAnswer(idx: number) {
    answers[currentIndex] = idx;
    answers = [...answers];
  }

  function advance() {
    if (perQuestionInterval) {
      clearInterval(perQuestionInterval);
      perQuestionInterval = null;
    }
    if (currentIndex < queue.length - 1) {
      currentIndex++;
      if (timerMode === 'per-question') startPerQuestionTimer();
    } else {
      finishExam();
    }
  }

  function formatTime(secs: number): string {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  // ── Results ───────────────────────────────────────────────
  let resultSession: ExamSession | null = null;
  let weakestSubject = '';

  async function finishExam() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    if (perQuestionInterval) {
      clearInterval(perQuestionInterval);
      perQuestionInterval = null;
    }

    const durationSeconds = Math.round((Date.now() - startedAt) / 1000);
    const subjectScores: Record<string, { correct: number; total: number }> = {};

    for (let i = 0; i < queue.length; i++) {
      const q = queue[i];
      const subjId = $subjects.find((s) => s.name === q.subject)?.id ?? q.subject;
      if (!subjectScores[subjId]) subjectScores[subjId] = { correct: 0, total: 0 };
      subjectScores[subjId].total++;
      if (answers[i] === q.correctIndex) subjectScores[subjId].correct++;
    }

    const totalCorrect = Object.values(subjectScores).reduce((s, v) => s + v.correct, 0);

    const { userId } = getAuthContext();
    const session: ExamSession = {
      id: newId(),
      userId,
      subjectScores,
      totalCorrect,
      totalQuestions: queue.length,
      durationSeconds,
      timerMode,
      createdAt: new Date().toISOString(),
    };

    await examSessionsRepo.save(session);
    resultSession = session;

    let worstRatio = 2;
    for (const [subjId, val] of Object.entries(subjectScores)) {
      const ratio = val.total > 0 ? val.correct / val.total : 0;
      if (ratio < worstRatio) {
        worstRatio = ratio;
        weakestSubject = $subjects.find((s) => s.id === subjId)?.name ?? subjId;
      }
    }

    phase = 'results';
  }

  function tryAgain() {
    phase = 'setup';
    resultSession = null;
    queue = [];
    answers = [];
  }

  onDestroy(() => {
    if (timerInterval) clearInterval(timerInterval);
    if (perQuestionInterval) clearInterval(perQuestionInterval);
  });
</script>

{#if phase === 'setup'}
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="text-large-title page-title">{$t.exam.title}</h1>
        <p class="page-sub">{$t.exam.configureSession}</p>
      </div>
      <a href="/exam/questions" class="btn-secondary">{$t.exam.manageQuestions}</a>
    </div>

    <div class="setup-card">
      <div class="section">
        <div class="section-label">{$t.exam.subjects}</div>
        <div class="pill-group">
          {#each availableSubjects as s}
            <button class="pill" class:active={selectedSubjects.includes(s)} on:click={() => toggleSubject(s)}>{s}</button>
          {/each}
          {#if availableSubjects.length === 0}
            <span class="empty-hint">{$t.exam.noQuestionsHint}<a href="/exam/questions">{$t.exam.addSomeFirst}</a></span>
          {/if}
        </div>
      </div>

      <div class="section">
        <div class="section-label">{$t.exam.difficulty}</div>
        <div class="pill-group">
          {#each ['easy', 'medium', 'hard'] as const as d}
            <button class="pill" class:active={selectedDifficulties.includes(d)} on:click={() => toggleDifficulty(d)}>
              {diffLabels[d]}
            </button>
          {/each}
        </div>
      </div>

      <div class="section">
        <div class="section-label">{$t.exam.questionsPerSubject}</div>
        <div class="number-row">
          <input class="number-input" type="number" min={1} bind:value={questionsPerSubject} disabled={useAllQuestions} aria-label={$t.exam.questionsPerSubject} />
          <label class="toggle-label">
            <input type="checkbox" bind:checked={useAllQuestions} /> {$t.exam.useAllAvailable}
          </label>
        </div>
      </div>

      <div class="section">
        <div class="section-label">{$t.exam.timerMode}</div>
        <div class="timer-cards">
          <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
          <div class="timer-card" class:selected={timerMode === 'overall'} on:click={() => (timerMode = 'overall')}>
            <div class="timer-card-title">{$t.exam.overallLimit}</div>
            <div class="timer-card-sub">{$t.exam.overallLimitSub}</div>
            {#if timerMode === 'overall'}
              <div class="number-row" style="margin-top:10px">
                <input class="number-input" type="number" min={1} bind:value={overallMinutes} disabled={noOverallLimit} aria-label={$t.exam.overallMinutesAria} />
                <span class="unit">{$t.exam.minutes}</span>
                <label class="toggle-label">
                  <input type="checkbox" bind:checked={noOverallLimit} /> {$t.exam.noLimit}
                </label>
              </div>
            {/if}
          </div>

          <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
          <div class="timer-card" class:selected={timerMode === 'per-question'} on:click={() => (timerMode = 'per-question')}>
            <div class="timer-card-title">{$t.exam.perQuestionLimit}</div>
            <div class="timer-card-sub">{$t.exam.perQuestionLimitSub}</div>
            {#if timerMode === 'per-question'}
              <div class="number-row" style="margin-top:10px">
                <input class="number-input" type="number" min={5} bind:value={secondsPerQuestion} aria-label={$t.exam.secondsPerQuestionAria} />
                <span class="unit">{$t.exam.secondsPerQuestionUnit}</span>
              </div>
            {/if}
          </div>
        </div>
      </div>

      <div class="summary-line" class:warn={!canStart}>{summaryLine}</div>

      <button class="btn-start" disabled={!canStart} on:click={startExam}>{$t.exam.startExam}</button>
    </div>
  </div>

{:else if phase === 'running' && current}
  <div class="page page-exam">
    <div class="exam-header">
      <div class="progress-label">{$t.exam.questionProgress(currentIndex + 1, queue.length)}</div>
      {#if timerMode === 'overall' && !noOverallLimit}
        <div class="timer" class:urgent={overallSecondsLeft < 60}>⏱ {formatTime(overallSecondsLeft)}</div>
      {:else if timerMode === 'per-question'}
        <div class="timer" class:urgent={perQuestionSecondsLeft < 10}>⏱ {formatTime(perQuestionSecondsLeft)}</div>
      {/if}
    </div>

    <div class="progress-bar">
      <div class="progress-fill" style="transform: scaleX({progressPct / 100})"></div>
    </div>

    <div class="question-card">
      <span class="subject-badge">{current.subject.toUpperCase()}</span>
      <p class="question-text"><MathText text={current.text} /></p>
      {#if current.imageUrl}
        <img class="question-image" src={current.imageUrl} alt={$t.exam.imageAlt} />
      {/if}

      <div class="choices">
        {#each current.choices as choice, i}
          <button class="choice" class:selected={answers[currentIndex] === i} on:click={() => selectAnswer(i)}>
            <span class="choice-letter">{String.fromCharCode(65 + i)}</span>
            <span class="choice-text"><MathText text={choice} /></span>
          </button>
        {/each}
      </div>

      <button class="btn-next" disabled={answers[currentIndex] === null} on:click={advance}>
        {currentIndex < queue.length - 1 ? $t.exam.next : $t.exam.finishExam}
      </button>
    </div>
  </div>

{:else if phase === 'results' && resultSession}
  <div class="page">
    <div class="results-card">
      <div class="result-score">
        {resultSession.totalCorrect}<span class="result-denom">/{resultSession.totalQuestions}</span>
      </div>
      <div class="result-sub">{$t.exam.resultSummary(Math.round(resultSession.durationSeconds / 60))}</div>

      <div class="breakdown">
        {#each Object.entries(resultSession.subjectScores) as [subjId, val]}
          {@const subj = $subjects.find((s) => s.id === subjId)}
          {@const pct = val.total > 0 ? (val.correct / val.total) * 100 : 0}
          <div class="breakdown-row">
            <span class="breakdown-label">{subj?.name ?? subjId}</span>
            <div class="breakdown-bar">
              <div class="breakdown-fill" style="width:{pct}%;background:{subj?.color ?? 'var(--primary)'}"></div>
            </div>
            <span class="breakdown-score">{val.correct}/{val.total}</span>
          </div>
        {/each}
      </div>

      {#if weakestSubject}
        <div class="weakest">
          {$t.exam.weakestArea} <strong>{weakestSubject}</strong> — <a href="/review">{$t.exam.reviewSrs}</a>
        </div>
      {/if}

      <div class="result-actions">
        <button class="btn-primary" on:click={tryAgain}>{$t.exam.tryAgain}</button>
        <a href="/dashboard" class="btn-secondary">{$t.exam.backToDashboard}</a>
      </div>
    </div>
  </div>
{/if}

<style>
  .page { max-width: 600px; margin: 0 auto; padding: 32px 24px; }
  .page-exam { max-width: 560px; }
  .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; gap: 12px; }
  .page-title { color: var(--text); margin: 0 0 2px; }
  .page-sub { font-size: 13px; color: var(--muted); margin: 0; }
  .btn-primary { background: var(--primary); color: var(--bg); border: none; border-radius: var(--radius-md); padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none; }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-secondary { background: var(--bg2); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 8px 14px; font-size: 13px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; flex-shrink: 0; }

  /* Setup */
  .setup-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 24px; display: flex; flex-direction: column; gap: 20px; }
  .section-label { font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 8px; }
  .pill-group { display: flex; flex-wrap: wrap; gap: 8px; }
  .pill { background: var(--bg3); border: 1px solid var(--border); color: var(--muted); border-radius: 20px; padding: 6px 14px; font-size: 12px; cursor: pointer; font-family: inherit; }
  .pill.active { background: var(--primary-l); border-color: var(--primary); color: var(--primary); font-weight: 600; }
  .empty-hint { font-size: 12px; color: var(--muted); }
  .empty-hint a { color: var(--primary); }
  .number-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .number-input { width: 72px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 7px 10px; font-size: 14px; font-weight: 600; color: var(--text); text-align: center; font-family: inherit; }
  .number-input:disabled { opacity: 0.4; }
  .unit { font-size: 13px; color: var(--muted); }
  .toggle-label { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); cursor: pointer; }
  .timer-cards { display: flex; flex-direction: column; gap: 10px; }
  .timer-card { border: 1px solid var(--border); border-radius: var(--radius-md); padding: 14px 16px; cursor: pointer; }
  .timer-card.selected { border-color: var(--primary); background: var(--primary-l); }
  .timer-card-title { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 2px; }
  .timer-card-sub { font-size: 11px; color: var(--muted); }
  .summary-line { font-size: 12px; color: var(--muted); background: var(--bg3); border: 1px solid var(--border); border-radius: 6px; padding: 10px 14px; }
  .summary-line.warn { color: var(--danger); }
  .btn-start { background: var(--primary); color: var(--bg); border: none; border-radius: var(--radius-md); padding: 12px; font-size: 15px; font-weight: 600; cursor: pointer; width: 100%; }
  .btn-start:disabled { opacity: 0.4; cursor: not-allowed; }

  /* Running */
  .exam-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .progress-label { font-size: 13px; color: var(--muted); }
  .timer { font-size: 15px; font-weight: 600; color: var(--primary); font-variant-numeric: tabular-nums; }
  .timer.urgent { color: var(--danger); }
  .progress-bar { height: 4px; background: var(--border); border-radius: 2px; margin-bottom: 24px; overflow: hidden; }
  .progress-fill { height: 100%; background: var(--primary); border-radius: 2px; transform-origin: left; transition: transform 0.3s; }
  .question-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 24px; }
  .subject-badge { display: inline-block; background: var(--primary-l); color: var(--primary); font-size: 10px; font-weight: 700; padding: 3px 10px; border-radius: 10px; letter-spacing: .5px; margin-bottom: 12px; }
  .question-text { font-size: 15px; font-weight: 500; color: var(--text); line-height: 1.5; margin: 0 0 20px; }
  .question-image {
    display: block; max-width: 100%; max-height: 300px; margin: 0 0 16px;
    border-radius: var(--radius-md); border: 1px solid var(--border);
  }
  .choices { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
  .choice { display: flex; align-items: center; gap: 12px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px 14px; font-size: 14px; color: var(--text); cursor: pointer; text-align: left; font-family: inherit; }
  .choice.selected { border-color: var(--primary); background: var(--primary-l); color: var(--text); }
  .choice .choice-letter { font-weight: 700; color: var(--muted); font-size: 13px; flex-shrink: 0; }
  .choice.selected .choice-letter { color: var(--primary); }
  .btn-next { background: var(--primary); color: var(--bg); border: none; border-radius: var(--radius-md); padding: 11px; font-size: 14px; font-weight: 600; cursor: pointer; width: 100%; }
  .btn-next:disabled { opacity: 0.4; cursor: not-allowed; }

  /* Results */
  .results-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 32px 24px; text-align: center; }
  .result-score { font-size: 56px; font-weight: 700; color: var(--primary); line-height: 1; }
  .result-denom { font-size: 24px; font-weight: 400; color: var(--muted); }
  .result-sub { font-size: 13px; color: var(--muted); margin-top: 4px; margin-bottom: 24px; }
  .breakdown { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; text-align: left; }
  .breakdown-row { display: flex; align-items: center; gap: 10px; font-size: 13px; }
  .breakdown-label { width: 80px; color: var(--muted); flex-shrink: 0; }
  .breakdown-bar { flex: 1; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
  .breakdown-fill { height: 100%; border-radius: 3px; }
  .breakdown-score { width: 40px; text-align: right; font-weight: 600; color: var(--text); }
  .weakest { font-size: 13px; color: var(--muted); background: var(--bg3); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; margin-bottom: 20px; text-align: left; }
  .weakest strong { color: var(--text); }
  .weakest a { color: var(--primary); }
  .result-actions { display: flex; gap: 10px; justify-content: center; }

  @media (max-width: 768px) {
    .page { padding: 24px 16px 80px; }
    .choice { min-height: 48px; }
    .btn-next, .btn-start { min-height: 48px; }
  }
</style>
