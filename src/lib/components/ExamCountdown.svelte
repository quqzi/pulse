<script lang="ts">
  import { settings } from '$lib/stores/settings';
  import { todayDate } from '$lib/stores/clock';
  import { t, fmt } from '$lib/i18n';

  // Compare local date strings (YYYY-MM-DD) so the count is correct on non-UTC
  // machines — never diff against Date.now(). todayDate ticks at midnight, so
  // the countdown is realtime without a per-second loop.
  $: daysLeft = (() => {
    const d = $settings.examDate;
    if (!d) return null;
    const exam = new Date(d + 'T00:00:00').getTime();
    if (Number.isNaN(exam)) return null;
    const today = new Date($todayDate + 'T00:00:00').getTime();
    return Math.round((exam - today) / 86400000);
  })();

  $: show = daysLeft !== null && daysLeft >= 0;
  $: urgent = daysLeft !== null && daysLeft <= 7;
</script>

{#if show && daysLeft !== null}
  <div class="countdown" class:urgent>
    <div class="big">{daysLeft === 0 ? '🎯' : daysLeft}</div>
    <div class="copy">
      <div class="headline">
        {#if daysLeft === 0}
          {$t.countdown.today}
        {:else}
          {daysLeft === 1 ? $t.countdown.day : $t.countdown.days}
          {$settings.examName ? `${$t.countdown.until} ${$settings.examName}` : $t.countdown.untilExam}
        {/if}
      </div>
      <div class="date">{$fmt.date($settings.examDate + 'T00:00:00', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
    </div>
  </div>
{/if}

<style>
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
