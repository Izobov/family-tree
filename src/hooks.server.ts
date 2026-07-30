import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public';
import { createServerClient } from '@supabase/ssr';
import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { parseLocale } from '$lib/i18n';

const PROTECTED = ['/', '/person', '/events', '/settings'];

const supabase: Handle = async ({ event, resolve }) => {
	/**
	 * SvelteKit's setHeaders() throws if the same header is set twice in one
	 * request, and @supabase/ssr calls setAll() more than once per request —
	 * signUp() does it twice while storing the PKCE code verifier, each time
	 * forwarding the same Cache-Control hint. Without this guard the second
	 * call crashes the request with `"Cache-Control" header is already set`.
	 * The hints are idempotent, so setting each name once is correct.
	 */
	const headersAlreadySet = new Set<string>();

	event.locals.supabase = createServerClient(
		PUBLIC_SUPABASE_URL,
		PUBLIC_SUPABASE_PUBLISHABLE_KEY,
		{
			cookies: {
				getAll: () => event.cookies.getAll(),
				setAll(cookiesToSet, headers) {
					cookiesToSet.forEach(({ name, value, options }) =>
						event.cookies.set(name, value, { ...options, path: '/' })
					);

					const fresh: Record<string, string> = {};
					for (const [name, value] of Object.entries(headers)) {
						const key = name.toLowerCase();
						if (headersAlreadySet.has(key)) continue;
						headersAlreadySet.add(key);
						fresh[name] = value;
					}
					if (Object.keys(fresh).length > 0) event.setHeaders(fresh);
				}
			}
		}
	);

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
