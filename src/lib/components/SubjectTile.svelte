<script lang="ts">
  import type { Subject, Topic } from '$lib/types';

  export let subject: Subject;
  export let topics: Topic[] = [];

  $: subjectTopics = topics.filter(t => t.subjectId === subject.id);
  $: covered = subjectTopics.filter(t => t.done).length;
  $: total = subjectTopics.length;
  $: pct = total > 0 ? Math.round((covered / total) * 100) : 0;
</script>

<button class="subject-tile" style="--subject-color: {subject.color}; --subject-rgb: {subject.colorRgb};" on:click>
  <span class="chip">{subject.symbol}</span>
  <div class="meta">
    <div class="name">{subject.name}</div>
    <div class="progress-row">
      <div class="bar"><div class="bar-fill" style="transform: scaleX({pct / 100});"></div></div>
      <span class="pct">{pct}%</span>
    </div>
  </div>
</button>

<style>
  .subject-tile {
    background: var(--bg2);
    border-radius: 14px;
    padding: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    border: 1px solid var(--border);
    cursor: pointer;
    transition: transform var(--dur-base) var(--ease-spring), box-shadow 160ms ease-out, background 160ms ease-out;
    width: 100%;
    text-align: left;
  }
  .subject-tile:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
    background: var(--bg3);
  }
  .subject-tile:active { transform: scale(0.96); transition-duration: var(--dur-fast); }

  /* iOS app-icon style chip: tinted squircle, symbol in the subject colour. */
  .chip {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    font-weight: 700;
    color: var(--subject-color);
    background: rgba(var(--subject-rgb), 0.14);
  }

  .meta { flex: 1; min-width: 0; }
  .name {
    font-size: 12px;
    font-weight: 600;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 5px;
  }

  .progress-row { display: flex; align-items: center; gap: 6px; }
  .bar {
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background: var(--bg3);
    overflow: hidden;
  }
  .bar-fill {
    height: 100%;
    border-radius: 2px;
    background: var(--subject-color);
    transform-origin: left;
    transition: transform var(--dur-slow) var(--ease-out);
  }
  .pct {
    font-size: 10px;
    font-weight: 600;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }
</style>
