<script lang="ts">
  import { dict } from '$lib/i18n';
  import { goto } from '$app/navigation';
  import PersonForm from '$lib/components/PersonForm.svelte';
  import FamilyTree from '$lib/components/FamilyTree.svelte';

  let { data, form } = $props();
  let t = $derived(dict(data.locale));
  let isEmpty = $derived(data.people.length === 0);
</script>

{#if isEmpty}
  <main class="onboarding">
    <h1>{t.onboarding.title}</h1>
    <p>{t.onboarding.hint}</p>
    <form method="POST" action="?/createFirst">
      <PersonForm
        {t}
        errors={form?.errors ?? {}}
        submitLabel={t.onboarding.submit}
        showDeath={false}
      />
    </form>
  </main>
{:else}
  <div class="canvas">
    <FamilyTree
      people={data.people}
      spouses={data.spouses}
      rootId={data.tree.root_person_id}
      {t}
      locale={data.locale}
      onOpen={(id) => goto(`/person/${id}`)}
    />
  </div>
{/if}

<style>
  .onboarding {
    max-width: 420px;
    margin: 0 auto;
    padding: var(--space-5) var(--space-4);
  }
  h1 { font-size: var(--font-5); margin: 0 0 var(--space-2); }
  p { color: var(--muted); margin: 0 0 var(--space-4); }

  .canvas {
    position: fixed;
    inset: 0;
  }
</style>
