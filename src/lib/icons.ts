/**
 * Единственное место, где выбираются иконки. Компоненты импортируют роль
 * («телефон», «супруги»), а не конкретную иконку MDI — поменять начертание
 * можно здесь, не трогая разметку.
 *
 * Берём @mdi/js, а не шрифт: это просто строки с SVG-путями, поэтому нет
 * ни загрузки шрифта, ни внешних запросов. Для PWA со строгим CSP это
 * принципиально, и заодно позволяет вставлять иконку в карточку дерева,
 * которая собирается строкой HTML вне Svelte.
 */
import {
  mdiPhone,
  mdiWhatsapp,
  mdiSend,
  mdiInstagram,
  mdiEmail,
  mdiClose,
  mdiHumanMaleFemale,
  mdiRing,
  mdiAccountChild,
  mdiInformationOutline,
  mdiCakeVariant,
  mdiArrowLeft,
  mdiMagnify,
  mdiAccountCircle,
  mdiLogout,
  mdiPlus,
  mdiCog
} from '@mdi/js';

export const icons = {
  phone: mdiPhone,
  whatsapp: mdiWhatsapp,
  // В MDI 7 бренд-иконку Telegram убрали. mdiSend — тот же бумажный самолётик,
  // то есть ровно та визуальная идентичность, которую пользователь и ожидает.
  telegram: mdiSend,
  instagram: mdiInstagram,
  email: mdiEmail,
  close: mdiClose,
  /**
   * Родство: стрелки вверх/вниз и сердце пользователю ничего не сообщали —
   * непонятно, что считает «стрелочка вверх 2». Берём предметные символы:
   * двое взрослых, обручальное кольцо и ребёнок. Они различимы между собой
   * даже на 14px и читаются без подписи. Сердце сознательно не используем:
   * оно читается как «нравится», а не как «брак».
   */
  parents: mdiHumanMaleFemale,
  spouses: mdiRing,
  children: mdiAccountChild,
  about: mdiInformationOutline,
  birthday: mdiCakeVariant,
  anniversary: mdiRing,
  /**
   * Нижняя панель навигации. Разные предметные символы — стрелка, лупа,
   * человек в круге, шестерня — различимы между собой на 24px и читаются
   * без подписи, хотя подпись всё равно есть под каждой.
   */
  back: mdiArrowLeft,
  search: mdiMagnify,
  me: mdiAccountCircle,
  settings: mdiCog,
  // Быстрое создание человека. Плюс — единственный символ, который на нижней
  // панели читается как «добавить» без подписи, поэтому берём именно его, а не
  // «человек с плюсом»: на 24px тот превращается в кашу.
  add: mdiPlus,
  // Хедер: кнопка выхода из аккаунта — только иконка, подпись даём через
  // aria-label, чтобы хедер оставался компактным на телефоне.
  signOut: mdiLogout
} as const;

export type IconName = keyof typeof icons;

/**
 * Иконка как строка SVG — для карточки дерева, которую family-chart вставляет
 * в DOM сам, вне Svelte. Экранировать путь не нужно: это константа библиотеки,
 * а не пользовательский ввод.
 */
export function svgIcon(name: IconName, size = 14): string {
  return (
    `<svg class="ft-icon" viewBox="0 0 24 24" width="${size}" height="${size}" ` +
    `aria-hidden="true" focusable="false"><path fill="currentColor" d="${icons[name]}"/></svg>`
  );
}
