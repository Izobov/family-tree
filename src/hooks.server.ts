import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public';
import { createServerClient } from '@supabase/ssr';
import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { parseLocale } from '$lib/i18n';

const PROTECTED = ['/', '/person', '/events', '/settings'];

const supabase: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll(cookiesToSet, headers) {
				cookiesToSet.forEach(({ name, value, options }) =>
					event.cookies.set(name, value, { ...options, path: '/' })
				);
				if (Object.keys(headers).length > 0) event.setHeaders(headers);
			}
		}
	});

	/**
	 * getClaims проверяет подпись JWT локально по кэшированным ключам.
	 * getSession подпись НЕ проверяет и для защиты страниц не годится.
	 */
	event.locals.safeGetSession = async () => {
		const { data, error } = await event.locals.supabase.auth.getClaims();
		if (error || !data?.claims) return { userId: null };
		return { userId: data.claims.sub as string };
	};

	event.locals.locale = parseLocale(
		event.cookies.get('locale') ?? event.request.headers.get('accept-language')
	);

	return resolve(event, {
		filterSerializedResponseHeaders: (name) =>
			name === 'content-range' || name === 'x-supabase-api-version'
	});
};

const guard: Handle = async ({ event, resolve }) => {
	const isProtected =
		event.url.pathname === '/' ||
		PROTECTED.some((p) => p !== '/' && event.url.pathname.startsWith(p));

	if (isProtected) {
		const { userId } = await event.locals.safeGetSession();
		if (!userId) {
			const target = event.url.pathname + event.url.search;
			redirect(303, `/login?redirectTo=${encodeURIComponent(target)}`);
		}
	}

	return resolve(event);
};

const lang: Handle = async ({ event, resolve }) =>
	resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%lang%', event.locals.locale)
	});

export const handle = sequence(supabase, guard, lang);
