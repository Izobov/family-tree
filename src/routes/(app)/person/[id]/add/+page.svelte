<script lang="ts">
  import { page } from '$app/state';
  import { dict } from '$lib/i18n';
  import PersonForm from '$lib/components/PersonForm.svelte';

  let { data, form } = $props();
  let t = $derived(dict(data.locale));

  let options = $derived([
    { kind: 'father', label: t.person.addFather },
    { kind: 'mother', label: t.person.addMother },
    { kind: 'spouse', label: t.person.addSpouse },
    { kind: 'child', label: t.person.addChild }
  ]);

  /**
   * Нативный POST на `?/create` или `?/link` затирает query-строку — вместе
   * с ней теряется `?kind=` (тот же класс бага уже чинили для `?edit=1` на
   * экране человека). После fail() экран должен перерисоваться той же формой,
   * какую отправляли, поэтому берём kind из ответа экшна, если он там есть, и
   * только потом падаем на query.
   */
  let kind = $derived(form?.kind ?? data.kind);
  let mode = $derived(
    form?.mode === 'link' ? 'link' : page.url.searchParams.get('mode') === 'link' ? 'link' : 'create'
  );

  let candidates = $derived(kind === null ? [] : data.existingCandidates[kind]);

  // Единственный супруг — подавляющий случай, его предвыбираем сразу.
  let secondParentId = $derived(
    data.spouseCandidates.length === 1 ? data.spouseCandidates[0].id : ''
  );

  let linkFieldKey = $derived(
    kind === 'father'
      ? 'father_id'
      : kind === 'mother'
        ? 'mother_id'
        : kind === 'spouse'
          ? 'spouse'
          : kind === 'child'
            ? data.person.gender === 'male'
              ? 'father_id'
              : 'mother_id'
            : '_'
  );

  function nameOf(p: { first_name: string; last_name: string | null }): string {
    return p.last_name ? `${p.first_name} ${p.last_name}` : p.first_name;
  }
</script>

<main>
  <a class="back" href="/person/{data.person.id}">← {nameOf(data.person)}</a>
  <h1>{t.person.addRelative}</h1>

  {#if !kind}
    <nav class="picker">
      {#each options as opt (opt.kind)}
        <a href="/person/{data.person.id}/add?kind={opt.kind}">{opt.label}</a>
      {/each}
    </nav>
  {:else}
    <div class="mode-switch">
      <a class:active={mode === 'create'} href="/person/{data.person.id}/add?kind={kind}">
        {t.person.createNew}
      </a>
      <a
        class:active={mode === 'link'}
        href="/person/{data.person.id}/add?kind={kind}&mode=link"
      >
        {t.person.pickExisting}
      </a>
    </div>

    {#if mode === 'create'}
      <form method="POST" action="?/create">
        <input type="hidden" name="kind" value={kind} />
        <PersonForm {t} errors={form?.errors ?? {}} submitLabel={t.person.save} showDeath={true} />
        {#if kind === 'spouse'}
          <label class="married">
            {t.person.marriedOn}
            <input type="date" name="married_on" />
          </label>
        {/if}
        {#if kind === 'child' && data.spouseCandidates.length > 0}
          <label class="second-parent">
            {t.person.secondParent}
            <select name="second_parent_id">
              <option value="" selected={secondParentId === ''}>{t.person.noSecondParent}</option>
              {#each data.spouseCandidates as sp (sp.id)}
                <option value={sp.id} selected={sp.id === secondParentId}>{nameOf(sp)}</option>
              {/each}
            </select>
            {#if form?.errors?.second_parent_id}<span class="err">{form.errors.second_parent_id}</span>{/if}
          </label>
        {/if}
      </form>
    {:else}
      <form method="POST" action="?/link">
        <input type="hidden" name="kind" value={kind} />
        {#if form?.errors?._}<p class="err err--form" role="alert">{form.errors._}</p>{/if}
        {#if candidates.length === 0}
          <p class="empty">{t.person.noCandidates}</p>
        {:else}
          <label>
            {t.person.pickPerson}
            <select name="person_id" required>
              {#each candidates as cand (cand.id)}
                <option value={cand.id}>{nameOf(cand)}</option>
              {/each}
            </select>
            {#if form?.errors?.[linkFieldKey]}<span class="err">{form.errors[linkFieldKey]}</span>{/if}
          </label>
          {#if kind === 'spouse'}
            <label class="married">
              {t.person.marriedOn}
              <input type="date" name="married_on" />
            </label>
          {/if}
          <button type="submit">{t.person.link}</button>
        {/if}
      </form>
    {/if}
  {/if}
</main>

<style>
  main { max-width: 560px; margin: 0 auto; padding: var(--space-4); }
  .back { color: var(--accent); text-decoration: none; display: inline-block; min-height: var(--tap); line-height: var(--tap); }
  h1 { font-size: var(--font-4); margin: 0 0 var(--space-4); }
  .picker { display: grid; gap: var(--space-2); }
  .picker a {
    display: flex;
    align-items: center;
    min-height: var(--tap);
    padding: 0 var(--space-4);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--fg);
    text-decoration: none;
  }
  .mode-switch {
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
  }
  .mode-switch a {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    min-height: var(--tap);
    padding: 0 var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--muted);
    text-decoration: none;
    font-size: var(--font-2);
  }
  .mode-switch a.active {
    border-color: var(--accent);
    color: var(--accent);
    font-weight: 600;
  }
  .married { display: grid; gap: var(--space-1); font-size: var(--font-2); color: var(--muted); margin-top: var(--space-3); }
  .married input { min-height: var(--tap); padding: 0 var(--space-3); border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface); color: var(--fg); }
  .second-parent { display: grid; gap: var(--space-1); font-size: var(--font-2); color: var(--muted); margin-top: var(--space-3); }
  form > label:not(.married):not(.second-parent) { display: grid; gap: var(--space-1); font-size: var(--font-2); color: var(--muted); }
  select {
    min-height: var(--tap);
    padding: 0 var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--fg);
  }
  .empty { color: var(--muted); font-size: var(--font-2); }
  form > button[type='submit'] {
    min-height: var(--tap);
    padding: 0 var(--space-4);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--fg);
    font-size: var(--font-2);
    margin-top: var(--space-3);
  }
  .err { color: var(--danger); font-size: var(--font-1); }
  .err--form {
    margin: 0 0 var(--space-3);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--danger);
    border-radius: var(--radius-sm);
    font-size: var(--font-2);
  }
</style>
