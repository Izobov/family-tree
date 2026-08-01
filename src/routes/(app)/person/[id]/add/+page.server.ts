import { error, fail, redirect } from '@sveltejs/kit';
import { dict } from '$lib/i18n';
import {
  createPerson,
  setParent,
  linkSpouse,
  requireTree,
  fetchPeople
} from '$lib/server/people';
import { readPersonForm, violationsToErrors } from '$lib/server/form';
import type { Violation } from '$lib/tree/invariants';
import type { Actions, PageServerLoad } from './$types';

const KINDS = ['father', 'mother', 'spouse', 'child'] as const;
type Kind = (typeof KINDS)[number];

export const load: PageServerLoad = async ({ params, url, parent }) => {
  const { people } = await parent();
  const person = people.find((p) => p.id === params.id);
  if (!person) error(404, 'person-not-found');

  const raw = url.searchParams.get('kind');
  const kind = (KINDS as readonly string[]).includes(raw ?? '') ? (raw as Kind) : null;

  return { person, kind };
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
      return fail(400, { errors: violationsToErrors(created.violations, t) });
    }

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
      await locals.supabase.from('people').delete().eq('id', created.id).eq('tree_id', tree.id);
      return fail(400, { errors: violationsToErrors(linked.violations, t) });
    }

    redirect(303, `/person/${created.id}`);
  }
};
