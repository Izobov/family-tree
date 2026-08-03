<script lang="ts">
  import { dict } from '$lib/i18n';
  import PersonForm from '$lib/components/PersonForm.svelte';

  let { data, form } = $props();
  let t = $derived(dict(data.locale));
</script>

<main>
  <a class="back" href="/">← {t.nav.tree}</a>
  <h1>{t.quickAdd.title}</h1>
  <p class="hint">{t.quickAdd.hint}</p>

  <form method="POST">
    <PersonForm
      {t}
      errors={form?.errors ?? {}}
      submitLabel={t.quickAdd.submit}
      showDeath={true}
    />
  </form>
</main>

<style>
  main { max-width: 560px; margin: 0 auto; padding: var(--space-4); }
  .back {
    color: var(--accent);
    text-decoration: none;
    display: inline-block;
    min-height: var(--tap);
    line-height: var(--tap);
  }
  h1 { font-size: var(--font-4); margin: 0 0 var(--space-2); }
  .hint {
    color: var(--muted);
    font-size: var(--font-2);
    margin: 0 0 var(--space-4);
  }
</style>
