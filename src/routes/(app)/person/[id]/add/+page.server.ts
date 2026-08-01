import { error, fail, redirect } from '@sveltejs/kit';
import { dict } from '$lib/i18n';
import {
  createPerson,
  setParent,
  linkSpouse,
  deletePerson,
  requireTree,
  fetchPeople
} from '$lib/server/people';
import { readPersonForm, violationsToErrors } from '$lib/server/form';
import type { PersonWithParents } from '$lib/tree/to-family-chart';
import type { Violation } from '$lib/tree/invariants';
import type { Actions, PageServerLoad } from './$types';

const KINDS = ['father', 'mother', 'spouse', 'child'] as const;
type Kind = (typeof KINDS)[number];

export const load: PageServerLoad = async ({ params, url, parent }) => {
  const { people, spouses } = await parent();
  const person = people.find((p) => p.id === params.id);
  if (!person) error(404, 'person-not-found');

  const raw = url.searchParams.get('kind');
  const kind = (KINDS as readonly string[]).includes(raw ?? '') ? (raw as Kind) : null;

  const spouseIds = spouses
    .filter((s) => s.person_a_id === person.id || s.person_b_id === person.id)
    .map((s) => (s.person_a_id === person.id ? s.person_b_id : s.person_a_id));
  // Кандидаты во вторые родители при добавлении ребёнка — супруги якоря.
  const spouseCandidates = people.filter((p) => spouseIds.includes(p.id));

  /**
   * Кандидатов на «Выбрать из существующих» считаем сразу для всех четырёх
   * ролей, а не только для выбранной в query. Причина: нативный POST на
   * `?/create` или `?/link` затирает query-строку, вместе с ней теряется
   * `?kind=` (тот же класс бага уже чинили для `?edit=1` на экране человека).
   * Если бы список кандидатов зависел от `kind` из `url`, после fail() он
   * пересчитался бы пустым. Дерево небольшое, посчитать все четыре списка
   * сразу — дёшево.
   */
  const secondParentColumn = person.gender === 'male' ? 'father_id' : 'mother_id';
  const existingCandidates: Record<Kind, PersonWithParents[]> = {
    father: people.filter((p) => p.id !== person.id && p.gender === 'male'),
    mother: people.filter((p) => p.id !== person.id && p.gender === 'female'),
    spouse: people.filter((p) => p.id !== person.id && !spouseIds.includes(p.id)),
    child: people.filter((p) => p.id !== person.id && p[secondParentColumn] == null)
  };

  return { person, kind, spouseCandidates, existingCandidates };
};

export const actions: Actions = {
  create: async ({ request, params, locals }) => {
    // В actions нет parent() — дерево и людей запрашиваем сами.
    const { userId } = await locals.safeGetSession();
    const tree = await requireTree(locals.supabase, userId!);
    const people = await fetchPeople(locals.supabase, tree.id);
    const t = dict(locals.locale);
    const form = await request.formData();

    const raw = String(form.get('kind') ?? '');
    if (!(KINDS as readonly string[]).includes(raw)) error(400, 'bad-kind');
    const kind = raw as Kind;

    const anchor = people.find((p) => p.id === params.id);
    if (!anchor) error(404, 'person-not-found');

    const input = readPersonForm(form);
    // Пол отца и матери задаётся ролью, а не формой.
    if (kind === 'father') input.gender = 'male';
    if (kind === 'mother') input.gender = 'female';

    const created = await createPerson(locals.supabase, tree.id, input);
    if ('violations' in created) {
      return fail(400, { kind, errors: violationsToErrors(created.violations, t) });
    }

    // Переиспользуем в обоих местах ниже, где связь может не сложиться.
    const rollback = () => deletePerson(locals.supabase, tree.id, created.id);

    let linked: { ok: true } | { violations: Violation[] };
    if (kind === 'father' || kind === 'mother') {
      linked = await setParent(locals.supabase, tree.id, anchor.id, created.id, kind);
    } else if (kind === 'spouse') {
      const marriedOn = form.get('married_on');
      linked = await linkSpouse(
        locals.supabase,
        tree.id,
        anchor.id,
        created.id,
        typeof marriedOn === 'string' && marriedOn !== '' ? marriedOn : null
      );
    } else {
      const parentKind = anchor.gender === 'male' ? 'father' : 'mother';
      linked = await setParent(locals.supabase, tree.id, created.id, anchor.id, parentKind);
    }

    if ('violations' in linked) {
      // Связь не сложилась — не оставляем висячего человека в дереве.
      await rollback();
      return fail(400, { kind, errors: violationsToErrors(linked.violations, t) });
    }

    if (kind === 'child') {
      const secondId = String(form.get('second_parent_id') ?? '');
      if (secondId) {
        const second = people.find((p) => p.id === secondId);
        if (!second) {
          await rollback();
          error(400, 'bad-second-parent');
        }
        const parentKind = anchor.gender === 'male' ? 'father' : 'mother';
        const secondKind = second.gender === 'male' ? 'father' : 'mother';

        /**
         * Оба родителя не могут занимать одну колонку. Инварианты это не
         * ловят: validateParent проверяет «подходит ли пол человека под
         * роль», а не «занята ли уже эта роль кем-то другим» — при одинаковом
         * поле якоря и второго родителя второй setParent молча перезаписал
         * бы связь с якорем вместо того, чтобы её дополнить.
         */
        if (secondKind === parentKind) {
          await rollback();
          return fail(400, {
            kind,
            errors: violationsToErrors(
              [
                {
                  field: 'second_parent_id',
                  code: secondKind === 'father' ? 'motherMustBeFemale' : 'fatherMustBeMale'
                }
              ],
              t
            )
          });
        }

        const secondLink = await setParent(
          locals.supabase,
          tree.id,
          created.id,
          second.id,
          secondKind
        );
        if ('violations' in secondLink) {
          // Первая связь уже легла — у ребёнка был бы наполовину верный
          // набор родителей. Проще откатить создание целиком, чем оставлять
          // такого человека в дереве.
          await rollback();
          return fail(400, { kind, errors: violationsToErrors(secondLink.violations, t) });
        }
      }
    }

    redirect(303, `/person/${created.id}`);
  },

  link: async ({ request, params, locals }) => {
    // В actions нет parent() — дерево и людей запрашиваем сами.
    const { userId } = await locals.safeGetSession();
    const tree = await requireTree(locals.supabase, userId!);
    const people = await fetchPeople(locals.supabase, tree.id);
    const t = dict(locals.locale);
    const form = await request.formData();

    const raw = String(form.get('kind') ?? '');
    if (!(KINDS as readonly string[]).includes(raw)) error(400, 'bad-kind');
    const kind = raw as Kind;

    const anchor = people.find((p) => p.id === params.id);
    if (!anchor) error(404, 'person-not-found');

    const personId = String(form.get('person_id') ?? '');
    if (!personId) {
      return fail(400, {
        kind,
        mode: 'link' as const,
        errors: { _: t.errors.notFound } as Record<string, string>
      });
    }

    // Ничего не создаём — только связываем двух уже существующих людей.
    let linked: { ok: true } | { violations: Violation[] };
    if (kind === 'father' || kind === 'mother') {
      linked = await setParent(locals.supabase, tree.id, anchor.id, personId, kind);
    } else if (kind === 'spouse') {
      const marriedOn = form.get('married_on');
      linked = await linkSpouse(
        locals.supabase,
        tree.id,
        anchor.id,
        personId,
        typeof marriedOn === 'string' && marriedOn !== '' ? marriedOn : null
      );
    } else {
      const parentKind = anchor.gender === 'male' ? 'father' : 'mother';
      linked = await setParent(locals.supabase, tree.id, personId, anchor.id, parentKind);
    }

    if ('violations' in linked) {
      return fail(400, {
        kind,
        mode: 'link' as const,
        errors: violationsToErrors(linked.violations, t)
      });
    }

    redirect(303, `/person/${personId}`);
  }
};
