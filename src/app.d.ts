// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Locale } from '$lib/types';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			supabase: SupabaseClient;
			safeGetSession(): Promise<{ userId: string | null }>;
			locale: Locale;
		}
		interface PageData {
			userId: string | null;
			locale: Locale;
		}
		interface PageState {
			personDetail?: {
				person: import('$lib/tree/to-family-chart').PersonWithParents;
				parents: import('$lib/tree/to-family-chart').PersonWithParents[];
				spouses: import('$lib/tree/to-family-chart').PersonWithParents[];
				children: import('$lib/tree/to-family-chart').PersonWithParents[];
				siblings: import('$lib/tree/to-family-chart').PersonWithParents[];
			};
		}
		// interface Platform {}
	}
}

export {};
