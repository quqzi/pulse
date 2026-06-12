<script lang="ts">
  import { goto } from '$app/navigation';
  import { readinessScore, subjects } from '$lib/stores/data';
  import { countup } from '$lib/motion/countup';
  import { t } from '$lib/i18n';

  let expandedId: string | null = null;
  const toggle = (id: string) => (expandedId = expandedId === id ? null : id);

  const SEGMENTS = [
    { key: 'coverage', max: 40, labelKey: 'partCoverage', opacity: 1 },
    { key: 'hours', max: 30, labelKey: 'partHours', opacity: 0.55 },
    { key: 'exam', max: 30, labelKey: 'partExam', opacity: 0.25 },
  ] as const;

  const R = 52;
  const C = 2 * Math.PI * R;
  // Three consecutive arcs around the ring — each part's earned points are
  // already out of a 100-point total (40+30+30), so points map straight to %.
  $: arcs = (() => {
    let start = 0;
    return SEGMENTS.map((seg) => {
      const len = ($readinessScore.parts[seg.key] / 100) * C;
      const arc = { len, offset: -start, opacity: seg.opacity };
      start += len;
      return arc;
    });
  })();
</script>

<div class="card">
  <div class="card-header">
    <span class="card-label">{$t.readiness.title}</span>
  </div>

  {#if $subjects.length > 0}
    <div class="gauge-row">
    <div class="gauge-wrap">
      <svg class="gauge" viewBox="0 0 120 120" aria-hidden="true">
        <circle class="gauge-track" cx="60" cy="60" r={R} />
        {#each arcs as a, i (i)}
          <circle
            class="gauge-arc"
            cx="60" cy="60" r={R}
            style="stroke-dasharray:{a.len} {C - a.len}; stroke-dashoffset:{a.offset}; opacity:{a.opacity}"
          />
        {/each}
      </svg>
      <div class="gauge-center">
        <span class="gauge-num" use:countup={{ value: $readinessScore.overall }}>{$readinessScore.overall}</span><span class="gauge-pct">%</span>
      </div>
    </div>

    <div class="legend">
      {#each SEGMENTS as seg (seg.key)}
        {@const stats = $readinessScore.stats}
        <div class="legend-row">
          <span class="legend-swatch" style="opacity:{seg.opacity}"></span>
          <span class="legend-name">{$t.readiness[seg.labelKey]}</span>
          <span class="legend-real">
            {#if seg.key === 'coverage'}{$t.readiness.topicsOf(stats.topicsDone, stats.topicsTotal)}
            {:else if seg.key === 'hours'}{$t.readiness.hoursOf(stats.recentHours, stats.hoursTarget)}
            {:else if stats.examCount === 0}{$t.readiness.examsNone}
            {:else}{$t.readiness.examsOf(stats.examAccuracy, stats.examCount)}{/if}
          </span>
          <span class="legend-pts">{$t.readiness.ptsOf($readinessScore.parts[seg.key], seg.max)}</span>
        </div>
      {/each}
    </div>
    </div>

    <div class="subject-list">
      {#each $subjects as subj (subj.id)}
        {@const score = $readinessScore.bySubject[subj.id] ?? 0}
        {@const parts = $readinessScore.partsBySubject[subj.id]}
        <button class="subject-row" class:open={expandedId === subj.id} on:click={() => toggle(subj.id)} aria-expanded={expandedId === subj.id}>
          <span class="subj-name">{subj.name}</span>
          <span class="subj-score" style="color:{subj.color}">{score}%</span>
          <svg class="chev" class:flip={expandedId === subj.id} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        {#if expandedId === subj.id && parts}
          {@const st = $readinessScore.statsBySubject[subj.id]}
          <div class="subj-detail">
            <div class="seg-bar small" style="--subj-color:{subj.color}" aria-hidden="true">
              {#each SEGMENTS as seg (seg.key)}
                <div class="seg subj" style="width:{parts[seg.key]}%; opacity:{seg.opacity}"></div>
              {/each}
            </div>
            <div class="detail-rows">
              <span class="detail-item">{$t.readiness.partCoverage} <strong>{$t.readiness.topicsOf(st.topicsDone, st.topicsTotal)}</strong></span>
              <span class="detail-item">{$t.readiness.partHours} <strong>{$t.readiness.hoursOf(st.recentHours, st.hoursTarget)}</strong></span>
              <span class="detail-item">{$t.readiness.partExam} <strong>{st.examCount === 0 ? $t.readiness.examsNone : $t.readiness.examsOf(st.examAccuracy, st.examCount)}</strong></span>
            </div>
          </div>
        {/if}
      {/each}
    </div>
  {:else}
    <span class="no-data">{$t.readiness.noData}</span>
  {/if}

  <button class="start-btn pressable" on:click={() => goto('/exam')}>{$t.readiness.startExam}</button>
</div>

<style>
  .card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 20px; display: flex; flex-direction: column; gap: 12px; }
  .card-header { display: flex; justify-content: space-between; align-items: center; }
  .card-label { font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .5px; }
  .gauge-row { display: flex; align-items: center; gap: 24px; }
  .gauge-row .legend { flex: 1; min-width: 0; }
  @media (max-width: 640px) { .gauge-row { flex-direction: column; gap: 12px; } .gauge-row .legend { width: 100%; } }
  .gauge-wrap { position: relative; width: 124px; height: 124px; flex-shrink: 0; align-self: center; margin: 4px 0; }
  .gauge { width: 124px; height: 124px; transform: rotate(-90deg); }
  .gauge-track { fill: none; stroke: var(--bg3); stroke-width: 11; }
  .gauge-arc {
    fill: none; stroke: var(--primary); stroke-width: 11;
    transition: stroke-dasharray var(--dur-slow) var(--ease-out), stroke-dashoffset var(--dur-slow) var(--ease-out);
  }
  .gauge-center { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
  .gauge-num { font-size: 38px; font-weight: 700; color: var(--primary); line-height: 1; font-variant-numeric: tabular-nums; }
  .gauge-pct { font-size: 16px; font-weight: 400; color: var(--muted); align-self: flex-start; margin-top: 34px; }

  /* Per-subject mini bar (kept) */
  .seg-bar.small { display: flex; gap: 2px; height: 5px; border-radius: 4px; background: var(--bg3); overflow: hidden; margin-bottom: 6px; }
  .seg.subj { background: var(--subj-color); border-radius: 2px; min-width: 0; }

  .legend { display: flex; flex-direction: column; gap: 4px; }
  .legend-row { display: flex; align-items: center; gap: 8px; font-size: 12px; }
  .legend-swatch { width: 10px; height: 10px; border-radius: 3px; background: var(--primary); flex-shrink: 0; }
  .legend-name { color: var(--muted); flex: 1; }
  .legend-real { color: var(--text); font-weight: 600; font-variant-numeric: tabular-nums; }
  .legend-pts { color: var(--muted); font-size: 11px; font-variant-numeric: tabular-nums; min-width: 34px; text-align: right; }

  .subject-list { display: flex; flex-direction: column; border-top: 1px solid var(--border); padding-top: 4px; }
  .subject-row {
    display: flex; align-items: center; gap: 8px; padding: 8px 2px;
    background: none; border: none; cursor: pointer; font-family: inherit;
    width: 100%; text-align: left; border-radius: 8px;
    transition: background 120ms ease;
  }
  @media (hover: hover) { .subject-row:hover { background: var(--bg3); } }
  .subj-name { flex: 1; min-width: 0; font-size: 13px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .subj-score { font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .chev { color: var(--muted); flex-shrink: 0; transition: transform 160ms ease; }
  .chev.flip { transform: rotate(180deg); }
  .subj-detail { padding: 2px 2px 10px; }
  .detail-rows { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 11px; color: var(--muted); }
  .detail-item strong { color: var(--text); font-variant-numeric: tabular-nums; }

  .no-data { font-size: 12px; color: var(--muted); }
  .start-btn { background: var(--primary); color: var(--bg); border: none; border-radius: var(--radius-md); padding: 9px 16px; font-size: 13px; font-weight: 600; cursor: pointer; align-self: flex-start; }
  @media (max-width: 768px) { .start-btn { min-height: 44px; } .subject-row { min-height: 44px; } }
</style>
