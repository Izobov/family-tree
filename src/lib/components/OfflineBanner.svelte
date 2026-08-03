<script lang="ts">
  import type { Dict } from '$lib/i18n';

  let { t }: { t: Dict } = $props();
  let online = $state(true);

  // Состояние сети — чисто клиентское, поэтому читаем navigator.onLine и
  // подписываемся на события только внутри $effect: на сервере ни того,
  // ни другого не существует, а SSR всегда должен рисовать «онлайн».
  $effect(() => {
    online = navigator.onLine;
    const up = () => (online = true);
    const down = () => (online = false);
    addEventListener('online', up);
    addEventListener('offline', down);
    return () => {
      removeEventListener('online', up);
      removeEventListener('offline', down);
    };
  });
</script>

{#if !online}
  <p role="status">{t.offline.banner}</p>
{/if}

<style>
  p {
    margin: 0;
    padding: var(--space-2) var(--space-4);
    background: var(--danger);
    color: #fff;
    font-size: var(--font-2);
    text-align: center;
  }
</style>
