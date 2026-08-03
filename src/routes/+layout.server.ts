import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	const { userId } = await locals.safeGetSession();
	/**
	 * Куку ставит /telegram после успешного входа. По ней layout решает, грузить
	 * ли SDK Telegram: веб- и PWA-пользователям он не нужен и стоит лишнего
	 * запроса к чужому домену.
	 */
	return { userId, locale: locals.locale, isTelegram: cookies.get('tg') === '1' };
};
