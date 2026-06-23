<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import MathText from '$lib/components/MathText.svelte';
  import { t } from '$lib/i18n';
  import type { GroupChallenge } from '$lib/groups';

  export let challenge: GroupChallenge;

  type ChallengeQuestion = GroupChallenge['payload']['questions'][number];

  const dispatch = createEventDispatcher<{ done: { answers: number[] }; cancel: void }>();
  let seededFor = '';
  let currentIndex = 0;
  let answers: (number | null)[] = [];

  $: questions = challenge.payload.questions;
  $: current = questions[currentIndex] as ChallengeQuestion | undefined;
  $: selectedAnswer = answers[currentIndex] ?? null;
  $: progressRatio = questions.length > 0 ? currentIndex / questions.length : 0;
  $: if (challenge.id !== seededFor) reset();

  function reset() {
    seededFor = challenge.id;
    currentIndex = 0;
    answers = new Array(challenge.payload.questions.length).fill(null);
  }

  function selectAnswer(index: number) {
    answers[currentIndex] = index;
    answers = [...answers];
  }

  function advance() {
    if (selectedAnswer === null) return;
    if (currentIndex < questions.length - 1) {
      currentIndex++;
      return;
    }
    finish();
  }

  function finish() {
    // Send the chosen answers; the server recomputes the score authoritatively.
    dispatch('done', { answers: answers.map((answer) => answer ?? -1) });
  }
</script>

<section class="runner" aria-label={challenge.title}>
  <div class="runner-header">
    <div>
      <p class="progress-label">{$t.groups.challengeQuestionProgress(Math.min(currentIndex + 1, questions.length), questions.length)}</p>
      <h2>{challenge.title}</h2>
    </div>
    <button type="button" class="cancel" on:click={() => dispatch('cancel')}>{$t.groups.cancelChallenge}</button>
  </div>

  <div class="progress-bar" aria-hidden="true">
    <div class="progress-fill" style="transform: scaleX({progressRatio})"></div>
  </div>

  {#if current}
    <div class="question-card">
      <span class="subject-badge">{current.subject.toUpperCase()}</span>
      <p class="question-text"><MathText text={current.text} /></p>

      <div class="choices">
        {#each current.choices as choice, i}
          <button type="button" class="choice" class:selected={selectedAnswer === i} on:click={() => selectAnswer(i)}>
            <span class="choice-letter">{String.fromCharCode(65 + i)}</span>
            <span class="choice-text"><MathText text={choice} /></span>
          </button>
        {/each}
      </div>

      <button type="button" class="btn-next" disabled={selectedAnswer === null} on:click={advance}>
        {currentIndex < questions.length - 1 ? $t.groups.nextQuestion : $t.groups.finishChallenge}
      </button>
    </div>
  {/if}
</section>

<style>
  .runner { margin-top: 12px; }
  .runner-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
  .progress-label { margin: 0 0 3px; color: var(--muted); font-size: 13px; }
  h2 { margin: 0; color: var(--text); font-size: 18px; overflow-wrap: anywhere; }
  .cancel { min-height: 36px; flex: 0 0 auto; padding: 8px 11px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg3); color: var(--text); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
  .progress-bar { height: 4px; margin-bottom: 24px; overflow: hidden; border-radius: 2px; background: var(--border); }
  .progress-fill { height: 100%; border-radius: 2px; background: var(--primary); transform-origin: left; transition: transform 0.3s; }
  .question-card { padding: 24px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg2); }
  .subject-badge { display: inline-block; margin-bottom: 12px; padding: 3px 10px; border-radius: 10px; background: var(--primary-l); color: var(--primary); font-size: 10px; font-weight: 700; letter-spacing: 0.05em; }
  .question-text { margin: 0 0 20px; color: var(--text); font-size: 15px; font-weight: 500; line-height: 1.5; }
  .choices { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
  .choice { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 14px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg); color: var(--text); text-align: left; font: inherit; font-size: 14px; cursor: pointer; }
  .choice.selected { border-color: var(--primary); background: var(--primary-l); color: var(--text); }
  .choice-letter { flex: 0 0 auto; color: var(--muted); font-size: 13px; font-weight: 700; }
  .choice.selected .choice-letter { color: var(--primary); }
  .choice-text { min-width: 0; }
  .btn-next { width: 100%; padding: 11px; border: 0; border-radius: var(--radius-md); background: var(--primary); color: var(--bg); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
  .btn-next:disabled { cursor: not-allowed; opacity: 0.4; }

  @media (max-width: 768px) {
    .runner-header { flex-direction: column; }
    .cancel { width: 100%; }
    .question-card { padding: 18px; }
    .choice, .btn-next { min-height: 48px; }
  }
</style>
