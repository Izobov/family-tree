<script lang="ts">
  import '../app.css';
  import { dict } from '$lib/i18n';

  let { data, children } = $props();
  let t = $derived(dict(data.locale));
</script>

<svelte:head><title>{t.app.name}</title></svelte:head>

{@render children()}
