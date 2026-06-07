<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import { topics, subjects, flashcards, loadData } from '$lib/stores/data';
  import { deckState, isDeckDue } from '$lib/flashcards';
  import { localDateStr } from '$lib/utils';
  import { t, fmt } from '$lib/i18n';
  import type { Topic, Subject } from '$lib/types';

  onMount(() => loadData($auth));
  $: if ($auth.mode !== 'loading') loadData($auth);

  $: today = localDateStr(new Date());
  $: subjectMap = Object.fromEntries($subjects.map(s => [s.id, s]));
  $: countFor = (topicId: string) => $flashcards.filter(c => c.topicId === topicId).length;

  type Deck = { topic: Topic; subject: Subject | undefined; count: number; state: ReturnType<typeof deckState> };

  $: decks = $topics
    .map((tp): Deck => {
      const count = countFor(tp.id);
      return { topic: tp, subject: subjectMap[tp.subjectId], count, state: deckState(tp.nextStudyDate, count, today) };
    })
    .filter(d => d.state !== 'empty');

  $: dueDecks = decks.filter(d => isDeckDue(d.state));

  $: allBySubject = (() => {
    const groups = new Map<string, { subject: Subject | undefined; decks: Deck[] }>();
    for (const d of decks) {
      const key = d.subject?.id ?? '?';
      if (!groups.has(key)) groups.set(key, { subject: d.subject, decks: [] });
      groups.get(key)!.decks.push(d);
    }
    return [...groups.values()];
  })();
</script>

<div class="flashcards-page">
  <h1 class="page-title">{$t.flashcards.title}</h1>

  {#if decks.length === 0}
    <div class="empty-state">
      <p class="empty-title">{$t.flashcards.emptyTitle}</p>
      <p class="empty-sub">{$t.flashcards.emptySub}</p>
    </div>
  {:else}
    {#if dueDecks.length > 0}
      <section class="section">
        <div class="section-label">{$t.flashcards.dueToday}</div>
        <div class="deck-list card">
          {#each dueDecks as d, i (d.topic.id)}
            <div class="deck-row" class:divider={i > 0}>
              <a class="deck-main" href="/flashcards/{d.topic.id}">
                {#if d.subject}<span class="deck-symbol" style="color: {d.subject.color}">{d.subject.symbol}</span>{/if}
                <span class="deck-name">{d.topic.name}</span>
                <span class="deck-meta due">{$t.flashcards.cardsCount(d.count)}</span>
              </a>
              <a class="study-btn" href="/flashcards/{d.topic.id}?study=1">{$t.flashcards.study}</a>
            </div>
          {/each}
        </div>
      </section>
    {/if}

    <section class="section">
      <div class="section-label">{$t.flashcards.allDecks}</div>
      {#each allBySubject as group (group.subject?.id ?? '?')}
        <div class="subject-group">
          {#if group.subject}<div class="subject-head" style="color: {group.subject.color}">{group.subject.symbol} {group.subject.name}</div>{/if}
          <div class="deck-list card">
            {#each group.decks as d, i (d.topic.id)}
              <div class="deck-row" class:divider={i > 0}>
                <a class="deck-main" href="/flashcards/{d.topic.id}">
                  <span class="deck-name">{d.topic.name}</span>
                  <span class="deck-meta">
                    {$t.flashcards.cardsCount(d.count)} ·
                    {#if d.state === 'new'}{$t.flashcards.stateNew}
                    {:else if d.state === 'due'}{$t.flashcards.stateDue}
                    {:else}{$t.flashcards.nextOn($fmt.date(d.topic.nextStudyDate + 'T00:00:00', { day: 'numeric', month: 'short' }))}{/if}
                  </span>
                </a>
                <a class="study-btn" href="/flashcards/{d.topic.id}?study=1">{$t.flashcards.study}</a>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </section>
  {/if}
  <div class="bottom-spacer"></div>
</div>

<style>
  .flashcards-page { padding: 20px 16px 0; max-width: 720px; margin: 0 auto; }
  .page-title { font-size: 22px; font-weight: 700; margin-bottom: 20px; color: var(--text); }
  .section { margin-bottom: 20px; }
  .section-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 8px; padding: 0 2px; }
  .subject-group { margin-bottom: 12px; }
  .subject-head { font-size: 12px; font-weight: 700; margin: 0 2px 6px; }
  .card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); overflow: hidden; }
  .deck-row { display: flex; align-items: center; gap: 10px; padding: 12px 14px; }
  .deck-row.divider { border-top: 1px solid var(--border); }
  .deck-main { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; text-decoration: none; color: inherit; }
  .deck-symbol { font-size: 14px; font-weight: 800; flex-shrink: 0; }
  .deck-name { font-size: 15px; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .deck-meta { font-size: 12px; color: var(--muted); flex-shrink: 0; }
  .deck-meta.due { color: var(--primary); font-weight: 600; }
  .study-btn { padding: 6px 14px; border-radius: 16px; background: var(--primary); color: var(--bg); font-size: 12px; font-weight: 600; text-decoration: none; flex-shrink: 0; }
  .empty-state { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 32px 16px; text-align: center; }
  .empty-title { font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
  .empty-sub { font-size: 13px; color: var(--muted); }
  .bottom-spacer { height: 40px; }
  @media (max-width: 768px) { .study-btn { min-height: 44px; display: inline-flex; align-items: center; } }
</style>
