<script lang="ts">
  import '../app.css';
  import { dict } from '$lib/i18n';
  import { onMount } from 'svelte';

  let { data, children } = $props();
  let t = $derived(dict(data.locale));

  onMount(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js', { type: 'module' });
    }
  });
</script>

<svelte:head><title>{t.app.name}</title></svelte:head>

{@render children()}
