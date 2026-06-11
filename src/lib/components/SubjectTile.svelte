<script lang="ts">
  import type { Subject, Topic } from '$lib/types';

  export let subject: Subject;
  export let topics: Topic[] = [];

  $: subjectTopics = topics.filter(t => t.subjectId === subject.id);
  $: covered = subjectTopics.filter(t => t.done).length;
  $: total = subjectTopics.length;
  $: pct = total > 0 ? Math.round((covered / total) * 100) : 0;
</script>

<button
  class="subject-tile"
  style="--subject-color: {subject.color}; --subject-color-rgb: {subject.colorRgb};"
  on:click
>
  <div class="symbol">{subject.symbol}</div>
  <div class="pct">{pct}%</div>
  <div class="mini-track">
    <div class="mini-fill" style="transform: scaleX({pct/100}); transform-origin: left;"></div>
  </div>
  <div class="name">{subject.name}</div>
</button>

<style>
  .subject-tile {
    background: var(--bg2);
    border-radius: 14px;
    padding: 14px 10px 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    border: none;
    cursor: pointer;
    transition: transform 160ms ease-out, box-shadow 160ms ease-out;
    width: 100%;
    text-align: center;
  }
  .subject-tile:hover {
    transform: translateY(-2px) scale(1.04);
    box-shadow: 0 4px 16px rgba(var(--subject-color-rgb), 0.35);
  }
  .subject-tile:active { transform: scale(0.96); }
  .symbol {
    font-size: 15px;
    font-weight: 700;
    color: var(--subject-color);
    line-height: 1;
    margin-bottom: 2px;
  }
  .pct {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    line-height: 1;
  }
  .mini-track {
    width: 100%;
    height: 3px;
    background: var(--bg3);
    border-radius: 2px;
    overflow: hidden;
    margin: 2px 0;
  }
  .mini-fill {
    height: 100%;
    background: var(--subject-color);
    border-radius: 2px;
    transition: transform var(--dur-slow) var(--ease-out);
  }
  .name {
    font-size: 10px;
    font-weight: 600;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
</style>
