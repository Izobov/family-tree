<script lang="ts">
  import '../app.css';
  import { dict } from '$lib/i18n';
  import { onMount } from 'svelte';
  import { loadTelegramWebApp } from '$lib/telegram-sdk';

  let { data, children } = $props();
  let t = $derived(dict(data.locale));

  onMount(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js', { type: 'module' });
    }

    /**
     * Внутри Telegram окно без expand() на части клиентов открывается в
     * половину экрана, и дерево оказывается в щели. ready() сообщает клиенту,
     * что можно убирать свой сплеш.
     */
    if (data.isTelegram) {
      loadTelegramWebApp().then((webApp) => {
        webApp?.ready();
        webApp?.expand();
      });
    }
  });
</script>

<svelte:head><title>{t.app.name}</title></svelte:head>

{@render children()}
