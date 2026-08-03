<script lang="ts">
  import { dict } from '$lib/i18n';
  import LangSwitch from '$lib/components/LangSwitch.svelte';

  let { data } = $props();
  let t = $derived(dict(data.locale));
</script>

<main>
  <h1>{t.settings.title}</h1>

  <section>
    <div class="row">
      <span class="label">{t.settings.language}</span>
      <LangSwitch current={data.locale} />
    </div>
    <p class="hint">{t.settings.languageHint}</p>
  </section>
</main>

<style>
  main {
    max-width: 560px;
    margin: 0 auto;
    padding: var(--space-4);
    display: grid;
    gap: var(--space-4);
  }

  h1 { font-size: var(--font-4); margin: 0; }

  section {
    display: grid;
    gap: var(--space-1);
    padding: var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .label { font-size: var(--font-3); }
  .hint { margin: 0; color: var(--muted); font-size: var(--font-1); }
</style>
