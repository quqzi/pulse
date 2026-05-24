<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { subjects, topics, srsCards, loadData, getAuthContext } from '$lib/stores/data';
  import { db } from '$lib/db';
  import { reviewCard, isDue } from '$lib/srs';

  $: subjectId = $page.params.id;
  $: subject = $subjects.find(s => s.id === subjectId);
  $: subjectTopics = $topics.filter(t => t.subjectId === subjectId);
  $: cardForTopic = (topicId: string) => $srsCards.find(c => c.topicId === topicId);

  let newTopicName = '';
  let adding = false;
  let reviewingCard: { topicId: string; topicName: string } | null = null;

  async function addTopic() {
    if (!newTopicName.trim() || !subjectId) return;
    const { userId, mode } = getAuthContext();
    const topic = {
      id: db.newId(),
      subjectId,
      name: newTopicName.trim(),
      orderIndex: subjectTopics.length,
    };
    const card = await db.saveTopic(topic, userId, mode);
    topics.update(ts => [...ts, topic]);
    srsCards.update(cs => [...cs, card]);
    newTopicName = '';
    adding = false;
  }

  async function deleteTopic(topicId: string) {
    const { mode } = getAuthContext();
    await db.deleteTopic(topicId, mode);
    topics.update(ts => ts.filter(t => t.id !== topicId));
    srsCards.update(cs => cs.filter(c => c.topicId !== topicId));
  }

  async function handleReview(rating: 1 | 2 | 3 | 4) {
    if (!reviewingCard) return;
    const card = $srsCards.find(c => c.topicId === reviewingCard!.topicId);
    if (!card) return;
    const { mode } = getAuthContext();
    const result = reviewCard(card.ease, card.intervalDays, rating);
    const updated = { ...card, ...result, reps: card.reps + 1 };
    await db.updateSrsCard(updated, mode);
    srsCards.update(cs => cs.map(c => c.id === card.id ? updated : c));
    reviewingCard = null;
  }

  onMount(() => loadData($auth));
</script>

{#if reviewingCard}
  <div class="overlay" on:click|self={() => reviewingCard = null}>
    <div class="review-card card">
      <p class="section-label" style="text-align:center; margin-bottom:12px;">REVIEW</p>
      <h3 class="text-heading" style="text-align:center; margin-bottom:4px;">{reviewingCard.topicName}</h3>
      <p class="text-body" style="color: var(--muted); text-align: center; margin-bottom:24px;">How well did you recall this?</p>
      <div class="rating-row">
        {#each ([1,2,3,4] as const) as r}
          {@const labels = {1:'Again',2:'Hard',3:'Good',4:'Easy'}}
          {@const colors = {1:'#ef4444',2:'#f97316',3:'#22c55e',4:'#3b82f6'}}
          <button
            class="rating-btn"
            style="background: {colors[r]};"
            on:click={() => handleReview(r)}
          >{labels[r]}</button>
        {/each}
      </div>
    </div>
  </div>
{/if}

<div class="page">
  {#if !subject}
    <p class="text-body" style="color:var(--muted)">Subject not found.</p>
  {:else}
    <div class="page-header">
      <button class="back-btn" on:click={() => goto('/subjects')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5m7-7l-7 7 7 7"/>
        </svg>
      </button>
      <div class="subject-header" style="color: {subject.color};">
        <span class="subject-symbol">{subject.symbol}</span>
        <h1 class="text-large-title">{subject.name}</h1>
      </div>
    </div>

    <div class="section-label topics-label">TOPICS</div>

    {#if subjectTopics.length === 0}
      <p class="text-body empty">No topics yet. Add your first topic below.</p>
    {:else}
      <div class="topics-list card">
        {#each subjectTopics as topic, i (topic.id)}
          {@const card = cardForTopic(topic.id)}
          <div class="topic-row" class:divider={i > 0}>
            <div class="topic-info">
              <span class="topic-name">{topic.name}</span>
              {#if card}
                <span class="srs-status" class:due={isDue(card.dueDate)} class:reviewed={card.reps > 0}>
                  {#if isDue(card.dueDate)}
                    Due today
                  {:else if card.reps === 0}
                    New
                  {:else}
                    Due {card.dueDate}
                  {/if}
                </span>
              {/if}
            </div>
            <div class="topic-actions">
              {#if card && isDue(card.dueDate)}
                <button
                  class="review-btn"
                  style="background: color-mix(in srgb, {subject.color} 12%, transparent); color: {subject.color};"
                  on:click={() => reviewingCard = { topicId: topic.id, topicName: topic.name }}
                >Review</button>
              {/if}
              <button class="del-btn" on:click={() => deleteTopic(topic.id)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    {#if adding}
      <div class="add-row">
        <input
          type="text"
          placeholder="Topic name"
          bind:value={newTopicName}
          class="field-input"
          autofocus
          on:keydown={e => e.key === 'Enter' && addTopic()}
        />
        <button class="btn-primary add-btn" on:click={addTopic} disabled={!newTopicName.trim()}>Add</button>
        <button class="cancel-btn" on:click={() => { adding = false; newTopicName = ''; }}>Cancel</button>
      </div>
    {:else}
      <button
        class="add-topic-btn"
        style="color: {subject.color};"
        on:click={() => adding = true}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        Add topic
      </button>
    {/if}
  {/if}
</div>

<style>
  .page { padding: 20px 16px; max-width: 600px; margin: 0 auto; }
  .page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
  .back-btn {
    background: var(--bg3);
    border: none;
    border-radius: 10px;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--text);
    flex-shrink: 0;
  }
  .subject-header { display: flex; align-items: center; gap: 10px; }
  .subject-symbol { font-size: 22px; font-weight: 800; }
  h1 { margin: 0; }
  .section-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
    margin-bottom: 8px;
  }
  .topics-label { padding: 0 2px; }
  .empty { color: var(--muted); margin-bottom: 12px; }
  .topics-list { padding: 0; overflow: hidden; margin-bottom: 12px; }
  .topic-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
  }
  .topic-row.divider { border-top: 1px solid var(--border); }
  .topic-info { flex: 1; min-width: 0; }
  .topic-name { font-size: 15px; font-weight: 500; color: var(--text); display: block; }
  .srs-status {
    font-size: 11px;
    font-weight: 600;
    color: var(--muted);
    margin-top: 2px;
    display: block;
  }
  .srs-status.due { color: #ef4444; }
  .srs-status.reviewed { color: #22c55e; }
  .topic-actions { display: flex; align-items: center; gap: 6px; }
  .review-btn {
    padding: 5px 12px;
    border-radius: 16px;
    border: none;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 400ms cubic-bezier(0.34,1.56,0.64,1);
  }
  .review-btn:active { transform: scale(0.94); transition: transform 80ms ease-in; }
  .del-btn {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .del-btn:hover { background: var(--bg3); color: #ef4444; }
  .add-row {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }
  .field-input {
    flex: 1;
    padding: 10px 12px;
    border: 1.5px solid var(--primary);
    border-radius: 10px;
    background: var(--bg2);
    color: var(--text);
    font-size: 15px;
    outline: none;
  }
  .add-btn {
    padding: 10px 18px;
    border-radius: 10px;
    background: var(--primary);
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    border: none;
    cursor: pointer;
  }
  .add-btn:disabled { opacity: 0.4; }
  .cancel-btn {
    padding: 10px 14px;
    border-radius: 10px;
    background: var(--bg3);
    color: var(--muted);
    font-size: 14px;
    font-weight: 600;
    border: none;
    cursor: pointer;
  }
  .add-topic-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 15px;
    font-weight: 600;
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px 2px;
    margin-top: 4px;
  }
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,.35);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    padding: 24px;
  }
  .review-card { padding: 28px 24px; max-width: 320px; width: 100%; }
  .rating-row { display: flex; gap: 8px; }
  .rating-btn {
    flex: 1;
    padding: 11px 0;
    border-radius: 12px;
    border: none;
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: transform 400ms cubic-bezier(0.34,1.56,0.64,1);
  }
  .rating-btn:active { transform: scale(0.94); transition: transform 80ms ease-in; }
</style>
