<script lang="ts">
  import { settings, effectiveExams } from '$lib/stores/settings';
  import { todayDate } from '$lib/stores/clock';
  import { t, fmt } from '$lib/i18n';

  // Compare local date strings (YYYY-MM-DD) so the count is correct on non-UTC
  // machines — never diff against Date.now(). todayDate ticks at midnight, so
  // the countdown is realtime without a per-second loop.
  function daysUntil(date: string): number {
    const exam = new Date(date + 'T00:00:00').getTime();
    const today = new Date($todayDate + 'T00:00:00').getTime();
    return Math.round((exam - today) / 86400000);
  }

  // All upcoming exams (today or later), each with its own days-left.
  $: upcoming = effectiveExams($settings)
    .map(e => ({ ...e, days: daysUntil(e.date) }))
    .filter(e => e.days >= 0);
</script>

{#if upcoming.length}
  <div class="countdown-list">
    {#each upcoming as e (e.id)}
      <div class="countdown" class:urgent={e.days <= 7}>
        <div class="big">{e.days === 0 ? '🎯' : e.days}</div>
        <div class="copy">
          <div class="headline">
            {#if e.days === 0}
              {e.name ? `${e.name} — ${$t.countdown.today}` : $t.countdown.today}
            {:else}
              {e.days === 1 ? $t.countdown.day : $t.countdown.days}
              {e.name ? `${$t.countdown.until} ${e.name}` : $t.countdown.untilExam}
            {/if}
          </div>
          <div class="date">{$fmt.date(e.date + 'T00:00:00', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .countdown-list { display: flex; flex-direction: column; gap: 8px; }
  .countdown {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 18px;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--primary) 8%, var(--bg2));
    border: 1px solid color-mix(in srgb, var(--primary) 20%, var(--border));
  }
  .countdown.urgent {
    background: color-mix(in srgb, var(--warning) 12%, var(--bg2));
    border-color: color-mix(in srgb, var(--warning) 35%, var(--border));
  }
  .big {
    font-size: 40px;
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.03em;
    color: var(--primary);
    font-variant-numeric: tabular-nums;
    min-width: 48px;
    text-align: center;
  }
  .countdown.urgent .big { color: var(--warning); }
  .copy { display: flex; flex-direction: column; gap: 2px; }
  .headline { font-size: 15px; font-weight: 600; color: var(--text); }
  .date { font-size: 13px; color: var(--muted); }
</style>
