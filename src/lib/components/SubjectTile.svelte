<script lang="ts">
  import type { Subject, Topic } from '$lib/types';

  export let subject: Subject;
  export let topics: Topic[] = [];

  $: subjectTopics = topics.filter(t => t.subjectId === subject.id);
  $: covered = subjectTopics.filter(t => t.done).length;
  $: total = subjectTopics.length;
  $: pct = total > 0 ? Math.round((covered / total) * 100) : 0;

  const R = 24;
  const C = 2 * Math.PI * R;
  $: dash = (pct / 100) * C;
</script>

<button class="subject-tile" style="--subject-color: {subject.color};" on:click>
  <div class="ring-wrap">
    <svg class="ring" viewBox="0 0 56 56" aria-hidden="true">
      <circle class="ring-track" cx="28" cy="28" r={R} />
      <circle class="ring-arc" cx="28" cy="28" r={R} style="stroke-dasharray:{dash} {C - dash}" />
    </svg>
    <span class="symbol">{subject.symbol}</span>
  </div>
  <div class="pct">{pct}<span class="pct-sign">%</span></div>
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
    gap: 6px;
    border: 1px solid var(--border);
    cursor: pointer;
    transition: transform 160ms ease-out, box-shadow 160ms ease-out, background 160ms ease-out;
    width: 100%;
    text-align: center;
  }
  .subject-tile:hover {
    transform: translateY(-2px) scale(1.03);
    box-shadow: var(--shadow-md);
    background: var(--bg3);
  }
  .subject-tile:active { transform: scale(0.96); }

  .ring-wrap { position: relative; width: 56px; height: 56px; }
  .ring { width: 56px; height: 56px; transform: rotate(-90deg); }
  .ring-track { fill: none; stroke: var(--bg3); stroke-width: 4; }
  .ring-arc {
    fill: none; stroke: var(--subject-color); stroke-width: 4; stroke-linecap: round;
    transition: stroke-dasharray var(--dur-slow, 500ms) var(--ease-out, ease);
  }
  .symbol {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; font-weight: 700; color: var(--subject-color); line-height: 1;
  }
  .pct {
    font-size: 13px; font-weight: 700; color: var(--text); line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .pct-sign { font-size: 10px; font-weight: 600; color: var(--muted); }
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
