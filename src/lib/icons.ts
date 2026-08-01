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
  mdiArrowUp,
  mdiHeart,
  mdiArrowDown,
  mdiInformationOutline,
  mdiCakeVariant,
  mdiRing
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
  parents: mdiArrowUp,
  spouses: mdiHeart,
  children: mdiArrowDown,
  about: mdiInformationOutline,
  birthday: mdiCakeVariant,
  anniversary: mdiRing
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
