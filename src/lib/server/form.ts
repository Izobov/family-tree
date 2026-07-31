import type { Dict } from '$lib/i18n';
import type { Violation } from '$lib/tree/invariants';
import type { PersonWrite } from '$lib/server/people';

function str(form: FormData, key: string): string | null {
  const value = form.get(key);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Юзернеймы храним без @ и без домена, телефон — как ввели. */
function username(form: FormData, key: string): string | null {
  const value = str(form, key);
  if (!value) return null;
  return value.replace(/^@/, '').replace(/^https?:\/\/[^/]+\//, '');
}

export function readPersonForm(form: FormData): PersonWrite {
  return {
    first_name: str(form, 'first_name') ?? '',
    last_name: str(form, 'last_name'),
    gender: form.get('gender') === 'female' ? 'female' : 'male',
    birth_date: str(form, 'birth_date'),
    died_on: str(form, 'died_on'),
    email: str(form, 'email'),
    phone: str(form, 'phone'),
    telegram: username(form, 'telegram'),
    instagram: username(form, 'instagram'),
    about: str(form, 'about')
  };
}

export function violationsToErrors(
  violations: Violation[],
  t: Dict
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of violations) out[v.field] = t.errors[v.code];
  return out;
}
