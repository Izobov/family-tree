<script lang="ts">
  import type { Locale } from '$lib/types';
  import { locales } from '$lib/i18n';

  let { current }: { current: Locale } = $props();
</script>

<form method="POST" action="/locale">
  {#each locales as locale (locale)}
    <button
      type="submit"
      name="locale"
      value={locale}
      class:active={locale === current}
      aria-pressed={locale === current}
    >
      {locale.toUpperCase()}
    </button>
  {/each}
</form>

<style>
  form {
    display: flex;
    gap: 2px;
  }
  button {
    /* Тэп-таргет не меньше --tap даже в компактном хедере: ширина
       компромиссная (буквы «RU»/«EN» узкие), высота — нет. */
    min-height: var(--tap);
    min-width: var(--tap);
    padding: 0 var(--space-2);
    font-size: var(--font-1);
    border-radius: var(--radius-sm);
    color: var(--muted);
  }
  .active {
    color: var(--fg);
    border-color: var(--accent);
    font-weight: 600;
  }
</style>
