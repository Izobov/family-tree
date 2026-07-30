export type Locale = 'ru' | 'en';
export type Gender = 'male' | 'female';

export interface Person {
  id: string;
  tree_id: string;
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

export interface Spouse {
  tree_id: string;
  person_a_id: string;
  person_b_id: string;
  married_on: string | null;
}

export interface Tree {
  id: string;
  owner_id: string;
  name: string;
  root_person_id: string | null;
}

export interface UserSettings {
  user_id: string;
  locale: Locale;
  push_enabled: boolean;
  lead_days: number;
}
