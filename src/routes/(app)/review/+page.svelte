<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { srsCards, topics, subjects, dueCards, loadData, getAuthContext } from '$lib/stores/data';
  import { reviewCard } from '$lib/srs';
  import { db } from '$lib/db';
  import type { SrsCard, Topic, Subject } from '$lib/types';

  interface RatingOption {
    rating: 1 | 2 | 3 | 4;
    label: string;
    color: string;
  }

  const RATINGS: RatingOption[] = [
    { rating: 1, label: 'Again', color: 'var(--srs-again)' },
    { rating: 2, label: 'Hard',  color: 'var(--srs-hard)' },
    { rating: 3, label: 'Good',  color: 'var(--srs-good)' },
    { rating: 4, label: 'Easy',  color: 'var(--srs-easy)' },
  ];

  interface QueueItem {
    card: SrsCard;
    topic: Topic;
    subject: Subject;
  }

  let queue: QueueItem[] = [];
  let currentIndex = 0;
  let revealed = false;
  let done = false;
  let loading = true;
  let ratingCounts: [number, number, number, number, number] = [0, 0, 0, 0, 0];

  $: current = queue[currentIndex] ?? null;
  $: progress = queue.length > 0 ? (currentIndex / queue.length) * 100 : 0;

  function buildQueue(cards: SrsCard[], topicList: Topic[], subjectList: Subject[]): QueueItem[] {
    return cards.reduce<QueueItem[]>((acc, card) => {
      const topic = topicList.find(t => t.id === card.topicId);
      if (!topic) return acc;
      const subject = subjectList.find(s => s.id === topic.subjectId);
      if (!subject) return acc;
      acc.push({ card, topic, subject });
      return acc;
    }, []);
  }

  function dueLabel(dueDate: string): string {
    const today = new Date().toISOString().split('T')[0];
    if (dueDate === today) return 'Due today';
    const diff = Math.round(
      (new Date(today).getTime() - new Date(dueDate).getTime()) / 86400000
    );
    return diff === 1 ? '1 day overdue' : `${diff} days overdue`;
  }

  function intervalPreview(card: SrsCard, rating: 1 | 2 | 3 | 4): string {
    const result = reviewCard(card.ease, card.intervalDays, rating);
    if (result.intervalDays === 1) return 'tomorrow';
    return `${result.intervalDays} days`;
  }

  async function rate(rating: 1 | 2 | 3 | 4) {
    if (!current) return;
    const result = reviewCard(current.card.ease, current.card.intervalDays, rating);
    const updated: SrsCard = {
      ...current.card,
      ease: result.ease,
      intervalDays: result.intervalDays,
      dueDate: result.dueDate,
      reps: current.card.reps + 1,
    };

    srsCards.update(all => all.map(c => c.id === updated.id ? updated : c));

    const { mode } = getAuthContext();
    await db.updateSrsCard(updated, mode);

    ratingCounts[rating] += 1;
    currentIndex += 1;
    revealed = false;

    if (currentIndex >= queue.length) {
      done = true;
    }
  }

  function handleKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLButtonElement) return;
    if (!done && current) {
      if (e.code === 'Space' && !revealed) {
        e.preventDefault();
        revealed = true;
        return;
      }
      if (revealed) {
        const digit = Number(e.key);
        if (digit >= 1 && digit <= 4) {
          rate(digit as 1 | 2 | 3 | 4);
        }
      }
    }
  }

  onMount(async () => {
    await loadData($auth);
    queue = buildQueue($dueCards, $topics, $subjects);
    if (queue.length === 0) {
      goto('/dashboard');
      return;
    }
    loading = false;
  });
</script>

<svelte:window on:keydown={handleKey} />

<div class="page">
  {#if loading}
    <p class="loading-text">Loading…</p>
  {:else if done}
    <div class="summary">
      <div class="summary-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      </div>
      <h1 class="summary-title">Review complete</h1>
      <p class="summary-count">{queue.length} card{queue.length === 1 ? '' : 's'} reviewed</p>
      <div class="summary-breakdown">
        {#each RATINGS as r}
          {#if ratingCounts[r.rating] > 0}
            <div class="breakdown-row">
              <span class="breakdown-label" style="color: {r.color};">{r.label}</span>
              <span class="breakdown-bar-wrap">
                <span
                  class="breakdown-bar"
                  style="background: {r.color}; transform: scaleX({ratingCounts[r.rating] / queue.length});"
                ></span>
              </span>
              <span class="breakdown-count">{ratingCounts[r.rating]}</span>
            </div>
          {/if}
        {/each}
      </div>
      <button class="back-btn" on:click={() => goto('/dashboard')}>
        Back to Dashboard
      </button>
    </div>
  {:else if current}
    <div class="top-bar">
      <button class="back-arrow" on:click={() => goto('/dashboard')} aria-label="Exit review">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <div class="progress-row">
        <span class="progress-label">{currentIndex + 1} / {queue.length}</span>
        <div class="progress-track">
          <div class="progress-fill" style="transform: scaleX({progress / 100});"></div>
        </div>
      </div>
    </div>

    <div class="card review-card">
      <div class="card-subject" style="color: {current.subject.color};">
        <span class="subject-dot" style="background: {current.subject.color};"></span>
        {current.subject.name}
      </div>
      <div class="card-topic">{current.topic.name}</div>
      <div class="card-meta">
        <span class="due-badge">{dueLabel(current.card.dueDate)}</span>
        <span class="interval-info">Current interval: {current.card.intervalDays}d</span>
      </div>
      {#if !revealed}
        <button class="reveal-btn" on:click={() => (revealed = true)}>
          Show ratings
        </button>
      {:else}
        <div class="ratings-row">
          {#each RATINGS as r}
            <button
              class="rating-btn"
              style="--rating-color: {r.color};"
              on:click={() => rate(r.rating)}
            >
              <span class="rating-label">{r.label}</span>
              <span class="rating-preview">{intervalPreview(current.card, r.rating)}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .page { padding: 20px 16px 0; max-width: 520px; margin: 0 auto; }

  .loading-text { color: var(--muted); font-size: 14px; margin-top: 60px; text-align: center; }

  /* Top bar */
  .top-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
  .back-arrow {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    padding: 4px;
    line-height: 0;
    flex-shrink: 0;
    border-radius: 8px;
    transition: color 140ms ease;
  }
  .back-arrow:hover { color: var(--text); }

  /* Progress */
  .progress-row { display: flex; align-items: center; gap: 10px; flex: 1; }
  .progress-label { font-size: 12px; color: var(--muted); flex-shrink: 0; min-width: 48px; }
  .progress-track {
    flex: 1;
    height: 4px;
    background: var(--border);
    border-radius: 2px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: var(--primary);
    border-radius: 2px;
    transform-origin: left center;
    transition: transform 300ms ease;
  }

  /* Card */
  .review-card {
    padding: 28px 24px 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-height: 260px;
  }
  .card-subject {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .subject-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .card-topic {
    font-size: 26px;
    font-weight: 700;
    color: var(--text);
    line-height: 1.2;
    letter-spacing: -0.02em;
  }
  .card-meta { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .due-badge {
    font-size: 12px;
    font-weight: 600;
    color: var(--primary);
    background: color-mix(in srgb, var(--primary) 10%, transparent);
    padding: 3px 9px;
    border-radius: 20px;
  }
  .interval-info { font-size: 12px; color: var(--muted); }

  /* Reveal button */
  .reveal-btn {
    margin-top: auto;
    padding: 13px;
    border-radius: var(--radius-md);
    border: 1.5px solid var(--border);
    background: var(--bg3);
    color: var(--text);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: transform 400ms cubic-bezier(0.34,1.56,0.64,1);
    text-align: center;
  }
  .reveal-btn:active { transform: scale(0.97); transition: transform 80ms ease-in; }

  /* Rating buttons */
  .ratings-row {
    margin-top: auto;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }
  @media (max-width: 400px) {
    .ratings-row { grid-template-columns: repeat(2, 1fr); }
  }
  .rating-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 10px 6px;
    border-radius: var(--radius-md);
    border: 1.5px solid var(--rating-color);
    background: color-mix(in srgb, var(--rating-color) 8%, transparent);
    color: var(--rating-color);
    cursor: pointer;
    font-family: inherit;
    transition: transform 400ms cubic-bezier(0.34,1.56,0.64,1);
  }
  .rating-btn:active { transform: scale(0.94); transition: transform 80ms ease-in; }
  .rating-label { font-size: 13px; font-weight: 700; }
  .rating-preview { font-size: 11px; font-weight: 500; opacity: 0.8; }

  /* Summary */
  .summary {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding-top: 40px;
    text-align: center;
  }
  .summary-icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--primary) 10%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .summary-title { font-size: 24px; font-weight: 700; color: var(--text); margin: 0; }
  .summary-count { font-size: 15px; color: var(--muted); margin: 0; }
  .summary-breakdown {
    width: 100%;
    max-width: 320px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 8px;
  }
  .breakdown-row { display: flex; align-items: center; gap: 10px; }
  .breakdown-label { font-size: 13px; font-weight: 600; width: 40px; text-align: left; flex-shrink: 0; }
  .breakdown-bar-wrap {
    flex: 1;
    height: 6px;
    background: var(--border);
    border-radius: 3px;
    overflow: hidden;
  }
  .breakdown-bar {
    display: block;
    height: 100%;
    border-radius: 3px;
    transform-origin: left center;
    transition: transform 600ms ease;
  }
  .breakdown-count { font-size: 13px; font-weight: 600; color: var(--text); width: 20px; text-align: right; flex-shrink: 0; }
  .back-btn {
    margin-top: 8px;
    padding: 13px 32px;
    border-radius: var(--radius-md);
    border: none;
    background: var(--primary);
    color: var(--bg);
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: transform 400ms cubic-bezier(0.34,1.56,0.64,1);
  }
  .back-btn:active { transform: scale(0.97); transition: transform 80ms ease-in; }
</style>
