<script lang="ts">
  import { pending } from '$lib/actions/pending';
  import { onMount, tick } from 'svelte';
  import { dict } from '$lib/i18n';
  import { loadTelegramWebApp } from '$lib/telegram-sdk';

  let { data, form } = $props();
  let t = $derived(dict(data.locale));

  type Phase = 'loading' | 'choice' | 'link' | 'error' | 'outside';

  /**
   * initData существует только в браузере, поэтому сервер отдаёт заглушку со
   * спиннером, а вся логика начинается здесь.
   */
  let initData = $state('');
  let phase = $state<Phase>('loading');
  let autoForm = $state<HTMLFormElement | null>(null);

  /**
   * Экшны отправляются нативным POST, то есть страница перезагружается целиком
   * и onMount отрабатывает снова. Без этого разбора он повторно отправлял бы
   * `auto` — бесконечный цикл вместо экрана выбора.
   */
  function phaseFrom(f: typeof form): Phase {
    if (!f) return 'loading';
    // Экшны возвращают разные наборы полей, поэтому сужаем через `in`.
    if ('mode' in f && f.mode === 'link') return 'link';
    if ('status' in f && f.status === 'unknown') return 'choice';
    return 'error';
  }

  onMount(async () => {
    const webApp = await loadTelegramWebApp();
    if (!webApp?.initData) {
      phase = 'outside';
      return;
    }

    webApp.ready();
    // Без expand() часть клиентов открывает окно в половину экрана.
    webApp.expand();
    initData = webApp.initData;

    const fromServer = phaseFrom(form);
    if (fromServer !== 'loading') {
      phase = fromServer;
      return;
    }

    await tick();
    autoForm?.requestSubmit();
  });
</script>

<main>
  {#if phase === 'loading'}
    <div class="center">
      <div class="spinner"></div>
      <p class="muted">{t.telegram.connecting}</p>
    </div>

    <form use:pending method="POST" action="?/auto" bind:this={autoForm} hidden>
      <input type="hidden" name="init_data" value={initData} />
    </form>
  {:else if phase === 'outside'}
    <h1>{t.telegram.outsideTitle}</h1>
    <p class="muted">{t.telegram.outsideHint}</p>
    <a class="btn" href="/login">{t.telegram.toLogin}</a>
  {:else}
    {#if form?.error}
      <p class="err" role="alert">{form.error}</p>
    {/if}

    {#if phase === 'choice' || phase === 'error'}
      <h1>{t.telegram.chooseTitle}</h1>
      <p class="muted">{t.telegram.chooseHint}</p>

      <form use:pending method="POST" action="?/signup">
        <input type="hidden" name="init_data" value={initData} />
        <button type="submit" class="btn btn--primary">{t.telegram.createNew}</button>
      </form>

      <button type="button" class="btn" onclick={() => (phase = 'link')}>
        {t.telegram.haveAccount}
      </button>
    {:else if phase === 'link'}
      <h1>{t.telegram.linkTitle}</h1>
      <p class="muted">{t.telegram.linkHint}</p>

      <form use:pending method="POST" action="?/link">
        <input type="hidden" name="init_data" value={initData} />
        <label>
          {t.auth.email}
          <input type="email" name="email" autocomplete="email" required />
        </label>
        <label>
          {t.auth.password}
          <input type="password" name="password" autocomplete="current-password" required />
        </label>
        <button type="submit" class="btn btn--primary">{t.telegram.linkSubmit}</button>
      </form>

      <button type="button" class="btn" onclick={() => (phase = 'choice')}>
        {t.telegram.back}
      </button>
    {/if}
  {/if}
</main>

<style>
  main {
    max-width: 420px;
    margin: 0 auto;
    padding: var(--space-5) var(--space-4);
    display: grid;
    gap: var(--space-3);
  }

  h1 { font-size: var(--font-4); margin: 0; }
  .muted { color: var(--muted); font-size: var(--font-2); margin: 0 0 var(--space-2); }

  .center {
    min-height: 60vh;
    display: grid;
    justify-items: center;
    align-content: center;
    gap: var(--space-4);
  }

  .spinner {
    width: 34px;
    height: 34px;
    border: 3px solid var(--line);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  form { display: grid; gap: var(--space-3); }

  label { display: grid; gap: var(--space-1); font-size: var(--font-2); color: var(--muted); }

  input {
    min-height: var(--tap);
    padding: 0 var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--fg);
    font-size: var(--font-3);
  }

  .btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: var(--tap);
    padding: 0 var(--space-4);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--fg);
    font: inherit;
    font-size: var(--font-2);
    text-decoration: none;
    width: 100%;
  }
  .btn--primary {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--bg);
    font-weight: 600;
  }

  .err {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--danger);
    border-radius: var(--radius-sm);
    color: var(--danger);
    font-size: var(--font-2);
  }
</style>
