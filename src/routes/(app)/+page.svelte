<script lang="ts">
  import { dict } from '$lib/i18n';
  import { goto, preloadData, pushState } from '$app/navigation';
  import { page } from '$app/state';
  import PersonForm from '$lib/components/PersonForm.svelte';
  import FamilyTree from '$lib/components/FamilyTree.svelte';
  import PersonDetail from '$lib/components/PersonDetail.svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import PeopleSheet from '$lib/components/PeopleSheet.svelte';

  let { data, form } = $props();
  let t = $derived(dict(data.locale));
  let isEmpty = $derived(data.people.length === 0);

  /**
   * Кто в фокусе дерева. page.state.focusId живёт только пока в истории есть
   * запись, которая его туда положила (см. recenter/openPerson) — стоит
   * откатиться за неё, и остаётся фоллбэк на корень дерева.
   */
  let focusId = $derived(page.state.focusId ?? data.tree.root_person_id);

  /**
   * «Назад» неактивна, если в текущей записи истории нет ни фокуса, ни
   * оверлея: значит, это базовый вид, откатывать больше некуда в рамках
   * приложения (что было до него — уже не наша навигация).
   */
  let canGoBack = $derived(!!page.state.personDetail || !!page.state.focusId);

  /**
   * Оверлей появляется без смены фокуса, поэтому без этого пользователь
   * скринридера не узнаёт, что панель открылась, и не может в неё
   * перетабаться. role="dialog" ставим только здесь: на самостоятельном
   * маршруте /person/[id] это обычная страница, а не диалог.
   */
  let overlayEl = $state<HTMLDivElement | null>(null);

  $effect(() => {
    overlayEl?.focus();
  });

  /**
   * Перецентрировка — обычная запись в истории, а не прямой вызов
   * family-chart, поэтому «назад» её отменяет. Именно это чинит жалобу
   * «кликнул на карточку, всё скрылось, как вернуться».
   */
  function recenter(id: string) {
    pushState('', { focusId: id });
  }

  /**
   * Оверлей вместо навигации: дерево остаётся смонтированным, зум и фокус
   * не слетают, а кнопка «назад» на Android закрывает панель, а не приложение.
   * Если предзагрузка не удалась — обычный переход как фоллбэк.
   *
   * focusId переносим в состояние оверлея явно: у каждой записи истории
   * своё состояние, и если его не повторить, при открытии оверлея поверх
   * перецентрированного дерева focusId в этой записи окажется пустым,
   * FamilyTree откатится на корень ещё до того, как пользователь нажал
   * «назад» — дерево дёрнется на глазах вместе с открытием панели.
   */
  async function openPerson(id: string) {
    const href = `/person/${id}`;
    const result = await preloadData(href);
    if (result.type === 'loaded' && result.status === 200) {
      pushState(href, {
        personDetail: result.data as App.PageState['personDetail'],
        focusId
      });
    } else {
      goto(href);
    }
  }

  let sheetMode = $state<'search' | 'all' | null>(null);

  function closeSheet() {
    sheetMode = null;
  }

  function selectFromSheet(id: string) {
    sheetMode = null;
    recenter(id);
  }

  function focusOnRoot() {
    if (data.tree.root_person_id) recenter(data.tree.root_person_id);
  }
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
      {focusId}
      {t}
      locale={data.locale}
      onOpen={openPerson}
      onRecenter={recenter}
    />
  </div>

  <BottomNav
    {t}
    {canGoBack}
    onBack={() => history.back()}
    onSearch={() => (sheetMode = 'search')}
    onEveryone={() => (sheetMode = 'all')}
    onMe={focusOnRoot}
  />
{/if}

{#if sheetMode}
  <PeopleSheet
    {t}
    locale={data.locale}
    people={data.people}
    mode={sheetMode}
    onClose={closeSheet}
    onSelect={selectFromSheet}
  />
{/if}

{#if page.state.personDetail}
  {@const d = page.state.personDetail}
  <div
    class="overlay"
    role="dialog"
    aria-modal="true"
    aria-label={d.person.last_name
      ? `${d.person.first_name} ${d.person.last_name}`
      : d.person.first_name}
    tabindex="-1"
    bind:this={overlayEl}
  >
    <PersonDetail
      {t}
      locale={data.locale}
      person={d.person}
      parents={d.parents}
      spouses={d.spouses}
      children={d.children}
      siblings={d.siblings}
      onClose={() => history.back()}
      onShowInTree={() => history.back()}
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
    /* Снизу вычитаем нижнюю панель — без этого низ дерева уезжает под неё
       и остаётся недостижимым для пальца. */
    inset: 0 0 calc(var(--bottom-nav-h) + env(safe-area-inset-bottom)) 0;
  }

  .overlay {
    position: fixed;
    inset: 0;
    z-index: 10;
    overflow-y: auto;
    background: var(--bg);
    animation: slide 0.2s ease-out;
  }

  @keyframes slide {
    from { transform: translateY(12px); opacity: 0; }
    to { transform: none; opacity: 1; }
  }
</style>
