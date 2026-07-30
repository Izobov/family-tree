<script lang="ts">
  import type { Dict } from '$lib/i18n';

  let {
    t,
    title,
    submitLabel,
    altHref,
    altLabel,
    error = null
  }: {
    t: Dict;
    title: string;
    submitLabel: string;
    altHref: string;
    altLabel: string;
    error?: string | null;
  } = $props();
</script>

<main>
  <h1>{title}</h1>

  <form method="POST">
    <label>
      {t.auth.email}
      <input name="email" type="email" autocomplete="email" required />
    </label>

    <label>
      {t.auth.password}
      <input name="password" type="password" autocomplete="current-password" required />
    </label>

    {#if error}<p class="error" role="alert">{error}</p>{/if}

    <button type="submit">{submitLabel}</button>
  </form>

  <a href={altHref}>{altLabel}</a>
</main>

<style>
  main {
    max-width: 380px;
    margin: 0 auto;
    padding: var(--space-5) var(--space-4);
    display: grid;
    gap: var(--space-4);
  }
  form { display: grid; gap: var(--space-3); }
  label { display: grid; gap: var(--space-1); font-size: var(--font-2); color: var(--muted); }
  input {
    min-height: var(--tap);
    padding: 0 var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface);
  }
  .error { color: var(--danger); font-size: var(--font-2); margin: 0; }
  a { color: var(--accent); font-size: var(--font-2); }
</style>
