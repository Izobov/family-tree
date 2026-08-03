<script lang="ts">
  import type { Dict } from '$lib/i18n';
  import Icon from './Icon.svelte';
  import { haptic } from '$lib/telegram-sdk';

  let {
    t,
    canGoBack,
    onBack,
    onSearch,
    onAdd,
    onMe,
    onSettings
  }: {
    t: Dict;
    /** «Назад» неактивна, если возвращаться некуда — см. вычисление в +page.svelte. */
    canGoBack: boolean;
    onBack: () => void;
    onSearch: () => void;
    onAdd: () => void;
    onMe: () => void;
    onSettings: () => void;
  } = $props();

  /**
   * Отклик вешаем здесь, а не в каждом обработчике снаружи: панель — это
   * единственное место в приложении, где кнопки нажимают пальцем подряд, и
   * держать решение «отзываться ли» в одном месте проще, чем в пяти.
   * Вне Telegram haptic() молча ничего не делает.
   */
  function tap(handler: () => void): () => void {
    return () => {
      haptic();
      handler();
    };
  }
</script>

<nav class="bar">
  <button type="button" disabled={!canGoBack} onclick={tap(onBack)}>
    <Icon name="back" size={24} />
    <span>{t.nav.back}</span>
  </button>
  <button type="button" onclick={tap(onSearch)}>
    <Icon name="search" size={24} />
    <span>{t.nav.search}</span>
  </button>
  <!--
    Единственное действие на панели, а не навигация, поэтому стоит в середине
    (самое доступное большому пальцу место) и выделено акцентом: раньше человека
    можно было завести только как родственника кого-то существующего, и завести
    его «просто так, свяжу потом» было негде.
  -->
  <button type="button" class="add" onclick={tap(onAdd)}>
    <Icon name="add" size={24} />
    <span>{t.nav.add}</span>
  </button>
  <button type="button" onclick={tap(onMe)}>
    <Icon name="me" size={24} />
    <span>{t.nav.me}</span>
  </button>
  <!--
    «Все» отсюда убрана: она открывала тот же список, что и поиск, то есть
    дублировала соседнюю кнопку. Нарисовать всех разом диаграмма всё равно не
    может — family-chart строит вид от одного человека, а не граф целиком.
  -->
  <button type="button" onclick={tap(onSettings)}>
    <Icon name="settings" size={24} />
    <span>{t.nav.settings}</span>
  </button>
</nav>

<style>
  .bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 5;
    display: flex;
    /* Токен из tokens.css — тот же, что вычитает .canvas в +page.svelte,
       иначе панель и холст разойдутся во мнении, где кончается дерево. */
    height: calc(var(--bottom-nav-h) + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    background: var(--surface);
    border-top: 1px solid var(--line);
    box-shadow: var(--shadow-1);
  }

  button {
    flex: 1 1 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-height: var(--tap);
    padding: var(--space-1);
    border: none;
    background: none;
    color: var(--fg);
    font: inherit;
  }
  button:disabled {
    color: var(--muted);
    opacity: 0.5;
  }
  button span {
    font-size: var(--font-1);
  }
  .add {
    color: var(--accent);
    font-weight: 600;
  }
</style>
