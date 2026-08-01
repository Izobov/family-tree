<script lang="ts">
  import { page } from '$app/state';
  import { dict } from '$lib/i18n';
  import PersonDetail from '$lib/components/PersonDetail.svelte';
  import PersonForm from '$lib/components/PersonForm.svelte';

  let { data, form } = $props();
  let t = $derived(dict(data.locale));
  /**
   * `|| !!form?.errors` здесь не косметика. Нативный POST уходит на `?/update`
   * и затирает query-строку, вместе с ней теряется `?edit=1`. Без этой части
   * после fail(400) страница перерисовалась бы в режиме просмотра: данные
   * не сохранены (верно), но пользователь не увидел бы ни ошибки, ни формы —
   * нажал «Сохранить» и будто ничего не произошло.
   * Работает и без JS, поэтому не требует use:enhance.
   */
  let editing = $derived(page.url.searchParams.get('edit') === '1' || !!form?.errors);
</script>

<main>
  <a class="back" href="/">← {t.nav.tree}</a>

  {#if editing}
    <form method="POST" action="?/update" class="edit">
      <PersonForm
        {t}
        person={data.person}
        errors={form?.errors ?? {}}
        submitLabel={t.person.save}
      />
      <a class="cancel" href="/person/{data.person.id}">{t.person.cancel}</a>
    </form>
  {:else}
    <PersonDetail
      {t}
      locale={data.locale}
      person={data.person}
      parents={data.parents}
      spouses={data.spouses}
      children={data.children}
      siblings={data.siblings}
    />
  {/if}
</main>

<style>
  main { min-height: 100%; background: var(--bg); }
  .back {
    display: inline-block;
    padding: var(--space-3) var(--space-4);
    color: var(--accent);
    text-decoration: none;
  }
  .edit { max-width: 560px; margin: 0 auto; padding: var(--space-4); display: grid; gap: var(--space-3); }
  .cancel { color: var(--muted); text-align: center; text-decoration: none; min-height: var(--tap); line-height: var(--tap); }
</style>
