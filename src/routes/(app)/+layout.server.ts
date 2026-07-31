import { error } from '@sveltejs/kit';
import { dict } from '$lib/i18n';
import { ensureTree, loadTree } from '$lib/server/people';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  const { userId } = await locals.safeGetSession();
  // guard в hooks.server.ts уже отсёк неавторизованных

  // Дерево создаётся здесь, а не при регистрации: идемпотентно и самовосстанавливается.
  await ensureTree(locals.supabase, userId!, locals.locale, dict(locals.locale).app.myTree);

  const loaded = await loadTree(locals.supabase, userId!);
  if (!loaded) error(503, 'tree-unavailable');

  return {
    userId,
    locale: locals.locale,
    tree: loaded.tree,
    people: loaded.people,
    spouses: loaded.spouses
  };
};
