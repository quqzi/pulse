<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { subjects, topics, srsCards, dueCards, loadData } from '$lib/stores/data';
  import SubjectTile from '$lib/components/SubjectTile.svelte';

  onMount(() => loadData($auth));

  $: dueBySubject = (subjectId: string) => {
    const subjectTopicIds = new Set($topics.filter(t => t.subjectId === subjectId).map(t => t.id));
    return $dueCards.filter(c => subjectTopicIds.has(c.topicId)).length;
  };
</script>

<div class="page">
  <h1 class="text-large-title">Subjects</h1>

  {#if $subjects.length === 0}
    <p class="text-body empty">No subjects yet. Complete onboarding to get started.</p>
  {:else}
    <div class="subjects-grid">
      {#each $subjects as subject (subject.id)}
        <div class="tile-wrapper">
          <SubjectTile
            {subject}
            topics={$topics}
            cards={$srsCards}
            on:click={() => goto(`/subjects/${subject.id}`)}
          />
          {#if dueBySubject(subject.id) > 0}
            <div class="due-badge" style="background: {subject.color};">
              {dueBySubject(subject.id)}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .page { padding: 24px 16px; max-width: 600px; margin: 0 auto; }
  h1 { margin-bottom: 20px; }
  .empty { color: var(--muted); margin-top: 12px; }
  .subjects-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  @media (min-width: 480px) {
    .subjects-grid { grid-template-columns: repeat(4, 1fr); }
  }
  .tile-wrapper { position: relative; }
  .due-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 18px;
    height: 18px;
    border-radius: 9px;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
    pointer-events: none;
  }
</style>
