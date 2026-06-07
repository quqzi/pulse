<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { sessions } from '$lib/stores/data';
  import { settings } from '$lib/stores/settings';
  import { t, fmt } from '$lib/i18n';

  $: dailyData = (() => {
    const days: { label: string; hours: number; isToday: boolean }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const hours = $sessions
        .filter(s => s.startedAt.startsWith(dateStr))
        .reduce((sum, s) => sum + s.durationSec / 3600, 0);
      const label = i === 0
        ? $t.analytics.today
        : $fmt.date(d.toISOString(), { weekday: 'short', day: 'numeric' });
      days.push({ label, hours, isToday: i === 0 });
    }
    return days;
  })();

  $: fmtH = (h: number): string => {
    const { unitH, unitM } = $t.analytics;
    if (h === 0) return `0${unitH}`;
    if (h < 1) return `${Math.round(h * 60)}${unitM}`;
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return mm ? `${hh}${unitH} ${mm}${unitM}` : `${hh}${unitH}`;
  };

  let canvas: HTMLCanvasElement;
  let chart: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any

  async function buildChart() {
    if (!canvas) return;
    await tick();
    const { Chart, registerables } = await import('chart.js');
    Chart.register(...registerables);
    if (chart) { chart.destroy(); chart = null; }

    const cs = getComputedStyle(document.body);
    const primaryRgb = cs.getPropertyValue('--primary-rgb').trim() || '23,23,23';
    const mutedColor = cs.getPropertyValue('--muted').trim();
    const borderColor = cs.getPropertyValue('--border').trim();
    const unitH = $t.analytics.unitH;

    chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: dailyData.map(d => d.label),
        datasets: [{
          data: dailyData.map(d => +d.hours.toFixed(2)),
          backgroundColor: dailyData.map(d =>
            d.isToday ? `rgba(${primaryRgb},0.9)` : `rgba(${primaryRgb},0.35)`
          ),
          borderRadius: 4,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx: any) => fmtH(ctx.parsed.y) } }, // eslint-disable-line @typescript-eslint/no-explicit-any
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: mutedColor, font: { size: 10 }, maxRotation: 0 },
          },
          y: {
            beginAtZero: true,
            grid: { color: borderColor },
            border: { display: false },
            ticks: { color: mutedColor, font: { size: 10 }, callback: (v: any) => `${v}${unitH}` }, // eslint-disable-line @typescript-eslint/no-explicit-any
          },
        },
      },
    });
  }

  onMount(() => buildChart());

  $: $settings.theme, canvas && buildChart();
  $: $settings.lang, canvas && buildChart();

  onDestroy(() => { chart?.destroy(); });

  let prevKey = '';
  $: {
    const key = dailyData.map(d => d.hours.toFixed(2)).join(',');
    if (key !== prevKey) {
      prevKey = key; // eslint-disable-line no-useless-assignment
      if (chart) {
        const cs = getComputedStyle(document.body);
        const primaryRgb = cs.getPropertyValue('--primary-rgb').trim() || '23,23,23';
        chart.data.datasets[0].data = dailyData.map(d => +d.hours.toFixed(2));
        chart.data.datasets[0].backgroundColor = dailyData.map(d =>
          d.isToday ? `rgba(${primaryRgb},0.9)` : `rgba(${primaryRgb},0.35)`
        );
        chart.update();
      } else if (canvas) {
        buildChart();
      }
    }
  }
</script>

<div class="chart-card card">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .chart-card { padding: 16px; height: 200px; }
  .chart-card canvas { width: 100% !important; height: 100% !important; }
</style>
