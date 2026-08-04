// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { pending } from './pending';

function setup() {
  document.body.innerHTML = `
    <form>
      <button type="submit" id="save">Сохранить</button>
      <button type="button" id="cancel">Отмена</button>
      <button id="implicit">Без типа</button>
    </form>`;

  const form = document.querySelector('form') as HTMLFormElement;
  return {
    form,
    handle: pending(form),
    save: document.getElementById('save') as HTMLButtonElement,
    cancel: document.getElementById('cancel') as HTMLButtonElement,
    implicit: document.getElementById('implicit') as HTMLButtonElement
  };
}

/** jsdom не умеет requestSubmit, а нам нужно только само событие. */
function submit(form: HTMLFormElement) {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('pending', () => {
  it('блокирует отправляющие кнопки и помечает форму', async () => {
    const { form, save, implicit } = setup();

    submit(form);
    await Promise.resolve();

    expect(save.disabled).toBe(true);
    expect(implicit.disabled).toBe(true);
    expect(form.dataset.pending).toBe('');
  });

  it('не трогает type="button" — это переключатели, а не отправка', async () => {
    const { form, cancel } = setup();

    submit(form);
    await Promise.resolve();

    expect(cancel.disabled).toBe(false);
  });

  /**
   * Ключевое свойство. Браузер собирает данные формы вместе с name/value
   * нажатой кнопки уже ПОСЛЕ события submit, и отключённая кнопка в эту
   * сборку не попадает. Синхронная блокировка сломала бы переключатель языка,
   * где выбор передаётся именно так: <button name="locale" value="en">.
   */
  it('блокирует не синхронно, иначе value нажатой кнопки не уедет на сервер', () => {
    const { form, save } = setup();

    submit(form);

    expect(save.disabled).toBe(false);
  });

  it('возврат из bfcache разблокирует — иначе форма после «назад» мертва', async () => {
    const { form, save } = setup();

    submit(form);
    await Promise.resolve();
    expect(save.disabled).toBe(true);

    window.dispatchEvent(new Event('pageshow'));

    expect(save.disabled).toBe(false);
    expect(form.dataset.pending).toBeUndefined();
  });

  it('destroy снимает оба слушателя', async () => {
    const { form, handle, save } = setup();

    handle.destroy();
    submit(form);
    await Promise.resolve();

    expect(save.disabled).toBe(false);
  });

  it('кнопки, добавленные после навешивания, тоже блокируются', async () => {
    const { form } = setup();

    const late = document.createElement('button');
    late.type = 'submit';
    form.appendChild(late);

    submit(form);
    await Promise.resolve();

    expect(late.disabled).toBe(true);
  });
});
