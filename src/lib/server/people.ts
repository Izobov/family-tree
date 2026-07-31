import type { SupabaseClient } from '@supabase/supabase-js';
import type { Gender, Locale, Spouse, Tree } from '$lib/types';
import type { PersonWithParents } from '$lib/tree/to-family-chart';
import {
  validateParent,
  validatePersonFields,
  type ParentKind,
  type Violation
} from '$lib/tree/invariants';

export interface PersonWrite {
  first_name: string;
  last_name: string | null;
  gender: Gender;
  birth_date: string | null;
  died_on: string | null;
  email: string | null;
  phone: string | null;
  telegram: string | null;
  instagram: string | null;
  about: string | null;
}

const PERSON_COLUMNS =
  'id, tree_id, first_name, last_name, gender, birth_date, died_on, email, phone, telegram, instagram, about, father_id, mother_id';

export async function loadTree(
  supabase: SupabaseClient,
  userId: string
): Promise<{ tree: Tree; people: PersonWithParents[]; spouses: Spouse[] } | null> {
  const { data: tree } = await supabase
    .from('trees')
    .select('id, owner_id, name, root_person_id')
    .eq('owner_id', userId)
    .maybeSingle();

  if (!tree) return null;

  const [{ data: people }, { data: spouses }] = await Promise.all([
    supabase.from('people').select(PERSON_COLUMNS).eq('tree_id', tree.id),
    supabase
      .from('spouses')
      .select('tree_id, person_a_id, person_b_id, married_on')
      .eq('tree_id', tree.id)
  ]);

  return {
    tree: tree as Tree,
    people: (people ?? []) as PersonWithParents[],
    spouses: (spouses ?? []) as Spouse[]
  };
}

/**
 * Гарантирует, что у пользователя есть дерево и настройки, и возвращает дерево.
 * Идемпотентна: вызывается на каждый вход в приложение.
 *
 * Почему так, а не при регистрации: две вставки из клиента нельзя сделать
 * атомарно, и при частичном сбое пользователь остался бы с активной сессией и
 * без дерева, без пути починиться. Здесь же любой такой пользователь лечится
 * сам при следующем открытии приложения — включая созданных вручную или
 * будущим OAuth.
 *
 * Гонка двух одновременных запросов безопасна: `trees.owner_id` уникален, второй
 * insert падает на конфликте, и мы просто перечитываем строку.
 */
export async function ensureTree(
  supabase: SupabaseClient,
  userId: string,
  locale: Locale,
  treeName: string
): Promise<Tree | null> {
  const existing = await supabase
    .from('trees')
    .select('id, owner_id, name, root_person_id')
    .eq('owner_id', userId)
    .maybeSingle();

  if (existing.data) return existing.data as Tree;

  // Настройки: user_id — первичный ключ, поэтому upsert идемпотентен сам по себе.
  await supabase
    .from('user_settings')
    .upsert({ user_id: userId, locale }, { onConflict: 'user_id' });

  const created = await supabase
    .from('trees')
    .insert({ owner_id: userId, name: treeName })
    .select('id, owner_id, name, root_person_id')
    .maybeSingle();

  if (created.data) return created.data as Tree;

  // Конфликт уникальности означает, что дерево создал параллельный запрос.
  const retry = await supabase
    .from('trees')
    .select('id, owner_id, name, root_person_id')
    .eq('owner_id', userId)
    .maybeSingle();

  return (retry.data as Tree) ?? null;
}

/**
 * Дерево текущего пользователя для form actions.
 * В actions нет parent() — он существует только у load-событий, — поэтому
 * дерево здесь запрашивается напрямую.
 */
export async function requireTree(
  supabase: SupabaseClient,
  userId: string
): Promise<Tree> {
  const { data } = await supabase
    .from('trees')
    .select('id, owner_id, name, root_person_id')
    .eq('owner_id', userId)
    .maybeSingle();

  if (!data) throw new Error('tree-not-found');
  return data as Tree;
}

export async function fetchPeople(
  supabase: SupabaseClient,
  treeId: string
): Promise<PersonWithParents[]> {
  const { data } = await supabase.from('people').select(PERSON_COLUMNS).eq('tree_id', treeId);
  return (data ?? []) as PersonWithParents[];
}

export async function createPerson(
  supabase: SupabaseClient,
  treeId: string,
  input: PersonWrite
): Promise<{ id: string } | { violations: Violation[] }> {
  const violations = validatePersonFields(input);
  if (violations.length > 0) return { violations };

  const { data, error } = await supabase
    .from('people')
    .insert({ ...input, tree_id: treeId })
    .select('id')
    .single();

  if (error || !data) return { violations: [{ field: '_', code: 'notFound' }] };
  return { id: data.id as string };
}

export async function updatePerson(
  supabase: SupabaseClient,
  treeId: string,
  personId: string,
  input: PersonWrite
): Promise<{ ok: true } | { violations: Violation[] }> {
  const violations = validatePersonFields(input);
  if (violations.length > 0) return { violations };

  // Смена пола не должна оставить человека отцом при gender = 'female'.
  const people = await fetchPeople(supabase, treeId);
  const asFatherOf = people.filter((p) => p.father_id === personId);
  const asMotherOf = people.filter((p) => p.mother_id === personId);
  if (input.gender === 'female' && asFatherOf.length > 0) {
    return { violations: [{ field: 'gender', code: 'fatherMustBeMale' }] };
  }
  if (input.gender === 'male' && asMotherOf.length > 0) {
    return { violations: [{ field: 'gender', code: 'motherMustBeFemale' }] };
  }

  const { error } = await supabase
    .from('people')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', personId)
    .eq('tree_id', treeId);

  if (error) return { violations: [{ field: '_', code: 'notFound' }] };
  return { ok: true };
}

export async function setParent(
  supabase: SupabaseClient,
  treeId: string,
  childId: string,
  parentId: string,
  kind: ParentKind
): Promise<{ ok: true } | { violations: Violation[] }> {
  const people = await fetchPeople(supabase, treeId);
  const violation = validateParent(people, childId, parentId, kind);
  if (violation) return { violations: [violation] };

  const column = kind === 'father' ? 'father_id' : 'mother_id';
  const { error } = await supabase
    .from('people')
    .update({ [column]: parentId, updated_at: new Date().toISOString() })
    .eq('id', childId)
    .eq('tree_id', treeId);

  if (error) return { violations: [{ field: column, code: 'notFound' }] };
  return { ok: true };
}

export async function linkSpouse(
  supabase: SupabaseClient,
  treeId: string,
  aId: string,
  bId: string,
  marriedOn: string | null
): Promise<{ ok: true } | { violations: Violation[] }> {
  if (aId === bId) return { violations: [{ field: 'spouse', code: 'selfParent' }] };

  const people = await fetchPeople(supabase, treeId);
  if (!people.some((p) => p.id === aId) || !people.some((p) => p.id === bId)) {
    return { violations: [{ field: 'spouse', code: 'notFound' }] };
  }

  // Таблица держит пару один раз, порядок задаёт check (person_a_id < person_b_id).
  const [low, high] = aId < bId ? [aId, bId] : [bId, aId];
  const { error } = await supabase.from('spouses').upsert(
    { tree_id: treeId, person_a_id: low, person_b_id: high, married_on: marriedOn },
    { onConflict: 'person_a_id,person_b_id' }
  );

  if (error) return { violations: [{ field: 'spouse', code: 'notFound' }] };
  return { ok: true };
}

/** Кто останется без родителя, если удалить этого человека. */
export function orphansOf(
  people: PersonWithParents[],
  personId: string
): PersonWithParents[] {
  return people.filter((p) => p.father_id === personId || p.mother_id === personId);
}

export async function deletePerson(
  supabase: SupabaseClient,
  treeId: string,
  personId: string
): Promise<{ ok: true }> {
  // father_id/mother_id детей обнулит on delete set null,
  // строки spouses снесёт on delete cascade,
  // trees.root_person_id обнулит trees_root_fk.
  await supabase.from('people').delete().eq('id', personId).eq('tree_id', treeId);
  return { ok: true };
}
