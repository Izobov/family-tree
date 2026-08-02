<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Spouse, Locale } from '$lib/types';
  import type { Dict } from '$lib/i18n';
  import { toFamilyChart, type PersonWithParents } from '$lib/tree/to-family-chart';
  import { renderCard } from '$lib/tree/card';
  import '$lib/styles/cards.css';
  // Библиотечные стили обязательны: без них svg.main_svg не получает
  // width/height и диаграмма не занимает контейнер (карточка «прилипает»
  // в угол вместо центрирования на главном человеке).
  import 'family-chart/styles/family-chart.css';

  let {
    people,
    spouses,
    rootId,
    focusId,
    t,
    locale,
    onOpen,
    onRecenter
  }: {
    people: PersonWithParents[];
    spouses: Spouse[];
    rootId: string | null;
    /**
     * Кто сейчас в фокусе — приходит из page.state.focusId в родителе, а не
     * решается здесь. Перецентрировка идёт через историю браузера (см.
     * onRecenter), поэтому «что показать» и «куда переключиться» разведены:
     * FamilyTree только слушается focusId и никогда не решает сам.
     */
    focusId: string | null;
    t: Dict;
    locale: Locale;
    onOpen: (id: string) => void;
    /** Тап по чужой (не главной) карточке — раньше сразу дёргал family-chart. */
    onRecenter: (id: string) => void;
  } = $props();

  let host: HTMLDivElement;
  /**
   * Именно $state, а не обычный let. В рунах обычная переменная не реактивна,
   * и цепочка ломается так: динамический import всегда резолвится позже, поэтому
   * $effect отрабатывает первый раз при chart === null, выходит по раннему
   * возврату и не успевает прочитать graph — то есть не подписывается ни на что.
   * Эффект без зависимостей больше не перезапускается никогда, и диаграмма,
   * отрисовавшись один раз, перестаёт реагировать на правки навсегда.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let chart = $state<any>(null);

  let graph = $derived(toFamilyChart(people, spouses));

  onMount(async () => {
    const f3 = await import('family-chart');

    chart = f3
      .createChart(host, structuredClone(graph))
      .setOrientationVertical()
      .setCardXSpacing(250)
      .setCardYSpacing(160)
      .setShowSiblingsOfMain(true)
      .setSingleParentEmptyCard(false)
      .setLinkSpouseText((sp1: any, sp2: any) => {
        const match = spouses.find(
          (s) =>
            (s.person_a_id === sp1.data.id && s.person_b_id === sp2.data.id) ||
            (s.person_a_id === sp2.data.id && s.person_b_id === sp1.data.id)
        );
        return match?.married_on ? match.married_on.slice(0, 4) : '';
      });

    const card = chart.setCardHtml();

    card
      .setCardInnerHtmlCreator((d: any) =>
        renderCard(d.data, {
          t,
          locale,
          isMain: d.data.id === chart.getMainDatum().id
        })
      )
      .setCardDim({ w: 220, h: 96 })
      .setMiniTree(false)
      // Вариант A: чужая карточка перецентрирует, карточка в фокусе раскрывается.
      // Перецентрировку отдаём наружу вместо card.onCardClickDefault — родитель
      // превращает её в pushState, чтобы «назад» могло её отменить.
      .setOnCardClick((_e: MouseEvent, d: any) => {
        if (d.data.id === chart.getMainDatum().id) onOpen(d.data.id);
        else onRecenter(d.data.id);
      });

    const initialId = focusId ?? rootId;
    if (initialId) chart.updateMainId(initialId);
    chart.updateTree({ initial: true, tree_position: 'main_to_middle' });
  });

  // onMount здесь async, поэтому Svelte не может использовать возвращаемую
  // из него функцию как cleanup (тип onMount это запрещает) — cleanup вынесен
  // в onDestroy отдельно, поведение то же самое: сбросить chart и очистить DOM.
  onDestroy(() => {
    chart = null;
    if (host) host.innerHTML = '';
  });

  /**
   * Данные обновляем через updateData, а не пересозданием графика:
   * пересоздание сбросило бы зум и фокус, и каждая правка выглядела бы
   * как перезагрузка страницы.
   */
  /**
   * Про «показать всех»: options вроде filter или show_all_relationships здесь
   * не работают — их в библиотеке нет (ViewProps знает только initial,
   * transition_time, tree_position и scale). Обрезки по глубине тоже нет:
   * ancestry_depth и progeny_depth по умолчанию undefined, и trimTree в этом
   * случае возвращает дерево целиком.
   *
   * Родственники «пропадают» по другой причине: family-chart принципиально
   * рисует не весь граф, а вид от одного человека — предков, потомков, супругов
   * и братьев-сестёр самого фокуса. Дядя появится, только если встать на отца.
   * Лечится навигацией (поиск, фокус, список всех), а не настройкой рендера.
   */
  $effect(() => {
    if (!chart) return;
    chart.updateData(structuredClone(graph));
    chart.updateTree({ tree_position: 'inherit' });
  });

  /**
   * Реакция на смену focusId, пришедшую снаружи (кнопка «Я», выбор из
   * PeopleSheet, нажатие «назад» — всё это меняет page.state.focusId у
   * родителя, а сюда долетает уже как проп). updateMainId сам по себе не
   * перерисовывает вид — проверено в браузере: без updateTree карточка
   * меняется внутри chart, но дерево на экране не сдвигается. Поэтому
   * следом обязателен updateTree({ tree_position: 'main_to_middle' }).
   * Сравнение с текущим getMainDatum() нужно, чтобы не запускать лишний
   * transition при первом рендере — main уже выставлен на нужного человека
   * в onMount.
   */
  $effect(() => {
    if (!chart || !focusId) return;
    if (chart.getMainDatum()?.id === focusId) return;
    chart.updateMainId(focusId);
    chart.updateTree({ tree_position: 'main_to_middle' });
  });
</script>

<!-- Класс f3 обязателен: библиотечный CSS (family-chart.css) скопит все свои
     правила под селектором `.f3 ...`, включая `svg.main_svg { width/height:100% }`,
     без которого диаграмма не растягивается на контейнер. -->
<div class="f3 tree" bind:this={host}></div>

<style>
  .tree {
    width: 100%;
    height: 100%;
    touch-action: none;
    overflow: hidden;
  }
</style>
