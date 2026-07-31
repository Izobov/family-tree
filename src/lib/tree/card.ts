import type { Dict } from '$lib/i18n';
import { formatYears } from '$lib/i18n';
import type { Locale } from '$lib/types';
import type { FcDatum } from './to-family-chart';

/** Данные пользовательские, а вставляем сырым HTML — экранировать обязательно. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function initials(person: { first_name: string; last_name: string | null }): string {
  const a = person.first_name.trim().charAt(0);
  const b = person.last_name?.trim().charAt(0) ?? '';
  return (a + b).toUpperCase();
}

export function renderCard(
  datum: FcDatum,
  opts: { t: Dict; locale: Locale; isMain: boolean; today?: Date }
): string {
  const { person } = datum.data;
  const { t, locale, isMain, today } = opts;

  const years = formatYears(person.birth_date, person.died_on, locale, today);
  const name = esc(person.first_name);
  const surname = person.last_name ? esc(person.last_name) : '';
  const incomplete = !person.birth_date || !person.about;

  const counts: string[] = [];
  const push = (icon: string, n: number, label: string) => {
    if (n > 0) {
      counts.push(
        `<span class="ft-card__count" title="${esc(label)}">${icon}<b>${n}</b></span>`
      );
    }
  };
  push('↑', datum.rels.parents.length, t.person.parents);
  push('♥', datum.rels.spouses.length, t.person.spouses);
  push('↓', datum.rels.children.length, t.person.children);

  return `
<div class="ft-card ${isMain ? 'ft-card--main' : ''} ft-card--${datum.data.gender}">
  <div class="ft-card__top">
    <span class="ft-card__avatar">${esc(initials(person))}</span>
    <span class="ft-card__names">
      <span class="ft-card__first">${name}</span>
      ${surname ? `<span class="ft-card__last">${surname}</span>` : ''}
      ${years ? `<span class="ft-card__years">${esc(years)}</span>` : ''}
    </span>
  </div>
  <div class="ft-card__bottom">
    ${counts.length > 0 ? `<span class="ft-card__counts">${counts.join('')}</span>` : ''}
    ${person.about ? '<span class="ft-card__info">&#9432;</span>' : ''}
    ${incomplete ? '<span class="ft-card__todo"></span>' : ''}
  </div>
</div>`.trim();
}
