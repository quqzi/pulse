<script lang="ts">
	import type { Subject, StudySession } from '$lib/types';
	import type { Settings } from '$lib/stores/settings';

	export let subjects: Subject[] = [];
	export let sessions: StudySession[] = [];
	export let settings: Settings | null = null;
	export let examDate: string | null = null;

	$: daysLeft = (() => {
		if (!examDate) return 0;
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const exam = new Date(examDate);
		exam.setHours(0, 0, 0, 0);
		return Math.round((exam.getTime() - today.getTime()) / 86400000);
	})();
	$: show = examDate !== null && daysLeft >= 0 && daysLeft <= 90;

	$: urgentColor = daysLeft <= 14 ? 'var(--warning)' : 'var(--primary)';

	$: behindSubjects = (() => {
		if (!settings || subjects.length === 0) return [];
		const weekAgo = new Date();
		weekAgo.setDate(weekAgo.getDate() - 7);
		const weekAgoStr = weekAgo.toISOString().split('T')[0] + 'T00:00:00';
		const weeklyGoalPer = (settings.dailyGoalHours * 7) / subjects.length;

		return subjects
			.map(subject => {
				const hours = sessions
					.filter(s => s.subjectId === subject.id && s.startedAt >= weekAgoStr)
					.reduce((sum, s) => sum + s.durationSec / 3600, 0);
				return { subject, deficit: weeklyGoalPer - hours };
			})
			.filter(x => x.deficit > 0)
			.sort((a, b) => b.deficit - a.deficit)
			.slice(0, 2)
			.map(x => x.subject.name);
	})();
</script>

{#if show}
	<div class="exam-banner">
		<span class="pulse-dot" style="background: {urgentColor};"></span>
		<span class="banner-text">
			TCAS in <strong>{daysLeft} day{daysLeft !== 1 ? 's' : ''}</strong>
			{#if behindSubjects.length > 0}
				— <span class="behind">{behindSubjects.join(' & ')} {behindSubjects.length === 1 ? 'is' : 'are'} most behind this week</span>
			{/if}
		</span>
	</div>
{/if}

<style>
	.exam-banner {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 16px;
		background: color-mix(in srgb, var(--primary) 8%, var(--bg2));
		border-bottom: 1px solid var(--border);
		font-size: 12px;
		color: var(--text);
		flex-shrink: 0;
	}

	.pulse-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		flex-shrink: 0;
		animation: pulse 2s infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.6;
			transform: scale(0.85);
		}
	}

	.banner-text {
		color: var(--text);
	}

	.behind {
		color: var(--muted);
	}
</style>
