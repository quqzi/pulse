<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Subject, Topic, SrsCard } from '$lib/types';

  export let subjects: Subject[] = [];
  export let topics: Topic[] = [];
  export let dueCards: SrsCard[] = [];

  const dispatch = createEventDispatcher<{ start: { subjectId: string; topicId: string } }>();

  interface PlanItem {
    card: SrsCard;
    topic: Topic;
    subject: Subject;
  }

  $: items = dueCards
    .slice(0, 8)
    .reduce<PlanItem[]>((acc, card) => {
      const topic = topics.find(t => t.id === card.topicId);
      if (!topic) return acc;
      const subject = subjects.find(s => s.id === topic.subjectId);
      if (!subject) return acc;
      acc.push({ card, topic, subject });
      return acc;
    }, []);
</script>

{#if items.length > 0}
  <section class="plan-section">
    <div class="section-label">TODAY'S PLAN</div>
    <div class="plan-card card">
      {#each items as item, i}
        <div class="plan-row" class:divider={i > 0}>
          <div class="accent-stripe" style="background: {item.subject.color};"></div>
          <div class="plan-info">
            <div class="plan-topic">{item.topic.name}</div>
            <div class="plan-subject" style="color: {item.subject.color};">{item.subject.symbol}</div>
          </div>
          <button
            class="start-btn"
            style="--subject-color: {item.subject.color};"
            on:click={() => dispatch('start', { subjectId: item.subject.id, topicId: item.topic.id })}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
            Start
          </button>
        </div>
      {/each}
    </div>
  </section>
{/if}

<style>
  .plan-section { margin-top: 24px; }
  .section-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
    margin-bottom: 8px;
    padding: 0 2px;
  }
  .plan-card { padding: 0; overflow: hidden; }
  .plan-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    position: relative;
  }
  .plan-row.divider { border-top: 1px solid var(--border); }
  .accent-stripe {
    width: 3px;
    height: 32px;
    border-radius: 2px;
    flex-shrink: 0;
  }
  .plan-info { flex: 1; min-width: 0; }
  .plan-topic {
    font-size: 14px;
    font-weight: 500;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .plan-subject { font-size: 11px; font-weight: 600; margin-top: 2px; }
  .start-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 7px 14px;
    border-radius: 20px;
    border: none;
    background: color-mix(in srgb, var(--subject-color) 12%, transparent);
    color: var(--subject-color);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    flex-shrink: 0;
    transition: transform 400ms cubic-bezier(0.34,1.56,0.64,1);
  }
  .start-btn:active { transform: scale(0.94); transition: transform 80ms ease-in; }
</style>
