import type { Person } from '$lib/types';

export type ParentKind = 'father' | 'mother';

export interface Violation {
  field: string;
  code:
    | 'fatherMustBeMale'
    | 'motherMustBeFemale'
    | 'cycle'
    | 'selfParent'
    | 'otherTree'
    | 'notFound'
    | 'diedBeforeBorn'
    | 'firstNameRequired'
    | 'badPhone'
    | 'badUsername';
}

export interface PersonInput {
  first_name: string;
  birth_date: string | null;
  died_on: string | null;
  phone: string | null;
  telegram: string | null;
  instagram: string | null;
}

type Node = Pick<Person, 'id'> & { father_id: string | null; mother_id: string | null };

const PHONE = /^\+[1-9]\d{7,14}$/;
const USERNAME = /^[A-Za-z0-9_.]{1,32}$/;

/**
 * Стал бы parentId предком самого себя, если сделать его родителем childId.
 * Обход снизу вверх от предполагаемого родителя: если встретили ребёнка — цикл.
 * seen защищает от зависания на уже испорченных данных.
 */
export function createsCycle(people: Node[], childId: string, parentId: string): boolean {
  if (childId === parentId) return true;

  const byId = new Map(people.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const queue = [parentId];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (id === childId) return true;
    if (seen.has(id)) continue;
    seen.add(id);

    const node = byId.get(id);
    if (!node) continue;
    if (node.father_id) queue.push(node.father_id);
    if (node.mother_id) queue.push(node.mother_id);
  }

  return false;
}

export function validateParent(
  people: Person[],
  childId: string,
  parentId: string,
  kind: ParentKind
): Violation | null {
  const field = kind === 'father' ? 'father_id' : 'mother_id';

  if (childId === parentId) return { field, code: 'selfParent' };

  const child = people.find((p) => p.id === childId);
  const parent = people.find((p) => p.id === parentId);
  if (!parent) return { field, code: 'notFound' };
  if (child && parent.tree_id !== child.tree_id) return { field, code: 'otherTree' };

  if (kind === 'father' && parent.gender !== 'male') {
    return { field, code: 'fatherMustBeMale' };
  }
  if (kind === 'mother' && parent.gender !== 'female') {
    return { field, code: 'motherMustBeFemale' };
  }

  if (createsCycle(people as unknown as Node[], childId, parentId)) return { field, code: 'cycle' };

  return null;
}

export function validatePersonFields(input: PersonInput): Violation[] {
  const out: Violation[] = [];

  if (input.first_name.trim() === '') {
    out.push({ field: 'first_name', code: 'firstNameRequired' });
  }
  if (input.birth_date && input.died_on && input.died_on < input.birth_date) {
    out.push({ field: 'died_on', code: 'diedBeforeBorn' });
  }
  if (input.phone && !PHONE.test(input.phone)) {
    out.push({ field: 'phone', code: 'badPhone' });
  }
  for (const field of ['telegram', 'instagram'] as const) {
    const value = input[field];
    if (value && !USERNAME.test(value)) out.push({ field, code: 'badUsername' });
  }

  return out;
}
