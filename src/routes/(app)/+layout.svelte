<script lang="ts">
  import { dict } from '$lib/i18n';
  import { goto, pushState } from '$app/navigation';
  import { page } from '$app/state';
  import LangSwitch from '$lib/components/LangSwitch.svelte';
  import OfflineBanner from '$lib/components/OfflineBanner.svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import PeopleSheet from '$lib/components/PeopleSheet.svelte';
  import Icon from '$lib/components/Icon.svelte';

  let { data, children } = $props();
  let t = $derived(dict(data.locale));

  /**
   * Общая для всего приложения нижняя панель (см. правку контроллера к
   * задаче 16): раньше она жила только в (app)/+page.svelte и пропадала на
   * экранах человека, добавления и удаления. Здесь она есть везде, а
   * поведение кнопок подстраивается под текущий маршрут — на дереве это
   * мгновенная перецентровка через history.pushState (как было раньше), на
   * остальных экранах — обычная навигация на "/", потому что состояние
   * фокуса дерева существует только в записи истории самой страницы дерева.
   */
  let onTree = $derived(page.url.pathname === '/');

  /**
   * «Назад» неактивна на дереве, если в текущей записи истории нет ни
   * фокуса, ни оверлея — откатывать больше некуда в рамках приложения (см.
   * тот же расчёт, что раньше жил в +page.svelte). На остальных экранах
   * «назад» всегда осмысленна: сюда всегда приходят по ссылке из дерева
   * или карточки человека.
   */
  let canGoBack = $derived(!onTree || !!page.state.personDetail || !!page.state.focusId);

  function onMe() {
    if (onTree) {
      if (data.tree.root_person_id) pushState('', { focusId: data.tree.root_person_id });
    } else {
      goto('/');
    }
  }

  let sheetMode = $state<'search' | 'all' | null>(null);

  function closeSheet() {
    sheetMode = null;
  }

  /**
   * Выбор человека из общего листа. На дереве — перецентровка на месте (как
   * раньше делал recenter() в +page.svelte), с других экранов — переход на
   * страницу человека: там нет истории с фокусом дерева, которую можно было
   * бы обновить через pushState.
   */
  function selectFromSheet(id: string) {
    sheetMode = null;
    if (onTree) {
      pushState('', { focusId: id });
    } else {
      goto(`/person/${id}`);
    }
  }
</script>

<OfflineBanner {t} />

<header>
  <a class="home" href="/">{t.nav.tree}</a>
  <div class="right">
    <LangSwitch current={data.locale} />
    <form method="POST" action="/signout">
      <button type="submit" class="icon-btn">
        <Icon name="signOut" size={20} label={t.nav.signOut} />
      </button>
    </form>
  </div>
</header>

<div class="content">
  {@render children()}
</div>

<BottomNav
  {t}
  {canGoBack}
  onBack={() => history.back()}
  onSearch={() => (sheetMode = 'search')}
  onEveryone={() => (sheetMode = 'all')}
  {onMe}
/>

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

<style>
  header {
    position: sticky;
    top: 0;
    z-index: 2;
    height: var(--header-h);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: 0 var(--space-3);
    background: var(--surface);
    border-bottom: 1px solid var(--line);
  }
  .home {
    color: var(--fg);
    font-weight: 600;
    font-size: var(--font-3);
    text-decoration: none;
    padding: var(--space-2);
  }
  .right {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: var(--tap);
    min-height: var(--tap);
    padding: 0;
    color: var(--muted);
  }

  .content {
    /* Единственная точка, где под нижнюю панель резервируется место — вместо
       того чтобы патчить это в каждом экране (app) отдельно. На экране
       дерева это не задваивает вычет: .canvas там position:fixed и inset,
       заданный в её собственном CSS, эти отступы контейнера не учитывает —
       он читает --bottom-nav-h и --header-h напрямую, из тех же токенов. */
    padding-bottom: calc(var(--bottom-nav-h) + env(safe-area-inset-bottom));
  }
</style>
