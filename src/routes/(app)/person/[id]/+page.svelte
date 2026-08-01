<script lang="ts">
  import { dict } from '$lib/i18n';
  import PersonDetail from '$lib/components/PersonDetail.svelte';

  let { data } = $props();
  let t = $derived(dict(data.locale));
</script>

<main>
  <a class="back" href="/">← {t.nav.tree}</a>
  <PersonDetail
    {t}
    locale={data.locale}
    person={data.person}
    parents={data.parents}
    spouses={data.spouses}
    children={data.children}
    siblings={data.siblings}
  />
</main>

<style>
  main { min-height: 100%; background: var(--bg); }
  .back {
    display: inline-block;
    padding: var(--space-3) var(--space-4);
    color: var(--accent);
    text-decoration: none;
  }
</style>
