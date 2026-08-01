<script lang="ts">
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

  function nameOf(p: { first_name: string; last_name: string | null }): string {
    return p.last_name ? `${p.first_name} ${p.last_name}` : p.first_name;
  }
</script>

<main>
  <a class="back" href="/person/{data.person.id}">← {nameOf(data.person)}</a>
  <h1>{t.person.addRelative}</h1>

  {#if !data.kind}
    <nav class="picker">
      {#each options as opt (opt.kind)}
        <a href="/person/{data.person.id}/add?kind={opt.kind}">{opt.label}</a>
      {/each}
    </nav>
  {:else}
    <form method="POST" action="?/create">
      <input type="hidden" name="kind" value={data.kind} />
      <PersonForm
        {t}
        errors={form?.errors ?? {}}
        submitLabel={t.person.save}
        showDeath={true}
      />
      {#if data.kind === 'spouse'}
        <label class="married">
          {t.person.marriedOn}
          <input type="date" name="married_on" />
        </label>
      {/if}
    </form>
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
  .married { display: grid; gap: var(--space-1); font-size: var(--font-2); color: var(--muted); margin-top: var(--space-3); }
  .married input { min-height: var(--tap); padding: 0 var(--space-3); border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface); color: var(--fg); }
</style>
