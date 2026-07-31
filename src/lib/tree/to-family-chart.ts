import type { Person, Spouse } from '$lib/types';

export type PersonWithParents = Person & {
  father_id: string | null;
  mother_id: string | null;
};

export interface FcDatum {
  id: string;
  data: { gender: 'M' | 'F'; person: PersonWithParents };
  rels: { parents: string[]; spouses: string[]; children: string[] };
}

/**
 * Разворачивает нормализованные строки в избыточный граф, которого требует
 * family-chart 0.9: связи должны быть двусторонними, children — заполнены явно.
 */
export function toFamilyChart(people: PersonWithParents[], spouses: Spouse[]): FcDatum[] {
  const ids = new Set(people.map((p) => p.id));
  const children = new Map<string, string[]>();
  const partners = new Map<string, string[]>();

  for (const person of people) {
    for (const parentId of [person.father_id, person.mother_id]) {
      if (!parentId || !ids.has(parentId)) continue;
      const list = children.get(parentId) ?? [];
      list.push(person.id);
      children.set(parentId, list);
    }
  }

  for (const { person_a_id, person_b_id } of spouses) {
    if (!ids.has(person_a_id) || !ids.has(person_b_id)) continue;
    for (const [self, other] of [
      [person_a_id, person_b_id],
      [person_b_id, person_a_id]
    ]) {
      const list = partners.get(self) ?? [];
      list.push(other);
      partners.set(self, list);
    }
  }

  return people.map((person) => ({
    id: person.id,
    data: { gender: person.gender === 'male' ? 'M' : 'F', person },
    rels: {
      parents: [person.father_id, person.mother_id].filter(
        (id): id is string => !!id && ids.has(id)
      ),
      spouses: partners.get(person.id) ?? [],
      children: children.get(person.id) ?? []
    }
  }));
}

/** Сиблинги не хранятся — выводятся из общего отца или общей матери. */
export function deriveSiblings(
  people: PersonWithParents[],
  personId: string
): PersonWithParents[] {
  const self = people.find((p) => p.id === personId);
  if (!self) return [];
  if (!self.father_id && !self.mother_id) return [];

  return people.filter(
    (p) =>
      p.id !== personId &&
      ((self.father_id !== null && p.father_id === self.father_id) ||
        (self.mother_id !== null && p.mother_id === self.mother_id))
  );
}
