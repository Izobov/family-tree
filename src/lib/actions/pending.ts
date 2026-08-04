/**
 * Пока форма летит на сервер, её кнопки должны быть недоступны и показывать,
 * что что-то происходит.
 *
 * Формы в проекте отправляются нативно, без use:enhance, поэтому store
 * `navigating` из SvelteKit про них ничего не знает — он отслеживает только
 * переходы, которые делает сам роутер. Отсюда и собственное решение.
 *
 * Вешается на <form>, а не на каждую кнопку: так ни одна кнопка внутри не
 * будет забыта, и правило «форма занята» живёт в одном месте.
 */
export function pending(form: HTMLFormElement) {
  /**
   * Только отправляющие кнопки. type="button" — это переключатели режимов
   * (например «У меня уже есть аккаунт» на экране Telegram), они ничего не
   * отправляют и блокировать их нельзя.
   */
  const submitters = () =>
    Array.from(form.querySelectorAll<HTMLButtonElement>('button:not([type="button"])'));

  function lock() {
    /**
     * На следующем микротаске, а не сразу. Браузер собирает данные формы
     * вместе с name/value нажатой кнопки уже после события submit, и
     * отключённая кнопка в эту сборку не попадает. Синхронная блокировка
     * сломала бы переключатель языка, где выбор передаётся именно так:
     * <button name="locale" value="en">.
     */
    queueMicrotask(() => {
      form.dataset.pending = '';
      submitters().forEach((button) => (button.disabled = true));
    });
  }

  function unlock() {
    delete form.dataset.pending;
    submitters().forEach((button) => (button.disabled = false));
  }

  form.addEventListener('submit', lock);

  /**
   * Возврат «назад» достаёт страницу из bfcache ровно в том виде, в каком её
   * покинули, — то есть с заблокированными кнопками. Без этого форма после
   * «назад» оказывалась бы мёртвой, и починить её мог бы только перезаход.
   */
  window.addEventListener('pageshow', unlock);

  return {
    destroy() {
      form.removeEventListener('submit', lock);
      window.removeEventListener('pageshow', unlock);
    }
  };
}
