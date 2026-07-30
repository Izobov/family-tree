import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const { userId } = await locals.safeGetSession();
	return { userId, locale: locals.locale };
};
