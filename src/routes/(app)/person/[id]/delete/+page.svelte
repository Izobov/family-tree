<script lang="ts">
  import { pending } from '$lib/actions/pending';
  import { dict } from '$lib/i18n';

  let { data } = $props();
  let t = $derived(dict(data.locale));

  function nameOf(p: { first_name: string; last_name: string | null }): string {
    return p.last_name ? `${p.first_name} ${p.last_name}` : p.first_name;
  }
</script>

<main>
  <h1>{t.deleteDialog.title}</h1>
  <p class="who">{nameOf(data.person)}</p>

  {#if data.orphans.length > 0}
    <section>
      <p>{t.deleteDialog.orphans}</p>
      <ul>
        {#each data.orphans as orphan (orphan.id)}
          <li>{nameOf(orphan)}</li>
        {/each}
      </ul>
    </section>
  {/if}

  <div class="actions">
    <form use:pending method="POST" action="?/confirm">
      <button type="submit" class="danger">{t.deleteDialog.confirm}</button>
    </form>
    <a href="/person/{data.person.id}">{t.deleteDialog.cancel}</a>
  </div>
</main>

<style>
  main { max-width: 460px; margin: 0 auto; padding: var(--space-5) var(--space-4); display: grid; gap: var(--space-4); }
  h1 { font-size: var(--font-4); margin: 0; }
  .who { font-size: var(--font-3); font-weight: 600; margin: 0; }
  p { margin: 0; color: var(--muted); font-size: var(--font-2); }
  ul { margin: var(--space-2) 0 0; padding-left: var(--space-4); }
  .actions { display: flex; gap: var(--space-3); align-items: center; }
  .danger { color: #fff; background: var(--danger); border-color: var(--danger); }
  a { color: var(--muted); text-decoration: none; min-height: var(--tap); line-height: var(--tap); }
</style>
