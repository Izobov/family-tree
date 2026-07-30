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
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
