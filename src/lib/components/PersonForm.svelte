<script lang="ts">
  import type { Dict } from '$lib/i18n';
  import type { PersonWithParents } from '$lib/tree/to-family-chart';

  let {
    t,
    person = null,
    errors = {},
    submitLabel,
    showDeath = true
  }: {
    t: Dict;
    person?: PersonWithParents | null;
    errors?: Record<string, string>;
    submitLabel: string;
    showDeath?: boolean;
  } = $props();
</script>

<div class="grid">
  <!--
    Общая ошибка. Слой данных возвращает нарушения с полем '_', когда падает
    сама запись, а не валидация поля. Без этого блока такая ошибка не имела бы
    места на экране: пользователь нажимал бы «Сохранить» и форма молча ничего
    не делала бы — ни сообщения, ни перехода.
  -->
  {#if errors._}<p class="err err--form" role="alert">{errors._}</p>{/if}

  <label>
    {t.person.firstName}
    <input name="first_name" value={person?.first_name ?? ''} required />
    {#if errors.first_name}<span class="err">{errors.first_name}</span>{/if}
  </label>

  <label>
    {t.person.lastName}
    <input name="last_name" value={person?.last_name ?? ''} />
  </label>

  <fieldset>
    <legend>{t.person.gender}</legend>
    <label class="inline">
      <input type="radio" name="gender" value="male"
             checked={(person?.gender ?? 'male') === 'male'} />
      {t.person.male}
    </label>
    <label class="inline">
      <input type="radio" name="gender" value="female"
             checked={person?.gender === 'female'} />
      {t.person.female}
    </label>
    {#if errors.gender}<span class="err">{errors.gender}</span>{/if}
  </fieldset>

  <label>
    {t.person.birthDate}
    <input type="date" name="birth_date" value={person?.birth_date ?? ''} />
  </label>

  {#if showDeath}
    <label>
      {t.person.diedOn}
      <input type="date" name="died_on" value={person?.died_on ?? ''} />
      {#if errors.died_on}<span class="err">{errors.died_on}</span>{/if}
    </label>
  {/if}

  <label>
    {t.person.about}
    <textarea name="about" rows="4">{person?.about ?? ''}</textarea>
  </label>

  <label>
    {t.person.email}
    <input type="email" name="email" value={person?.email ?? ''} />
  </label>

  <label>
    {t.person.phone}
    <input name="phone" inputmode="tel" placeholder="+79161234567"
           value={person?.phone ?? ''} />
    {#if errors.phone}<span class="err">{errors.phone}</span>{/if}
  </label>

  <label>
    {t.person.telegram}
    <input name="telegram" placeholder="username" value={person?.telegram ?? ''} />
    {#if errors.telegram}<span class="err">{errors.telegram}</span>{/if}
  </label>

  <label>
    {t.person.instagram}
    <input name="instagram" placeholder="username" value={person?.instagram ?? ''} />
    {#if errors.instagram}<span class="err">{errors.instagram}</span>{/if}
  </label>

  <button type="submit">{submitLabel}</button>
</div>

<style>
  .grid { display: grid; gap: var(--space-3); }
  label { display: grid; gap: var(--space-1); font-size: var(--font-2); color: var(--muted); }
  label.inline { display: flex; align-items: center; gap: var(--space-2); color: var(--fg); }
  input, textarea {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--fg);
  }
  input:not([type='radio']) { min-height: var(--tap); }
  fieldset {
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-3);
    display: flex;
    gap: var(--space-4);
    align-items: center;
  }
  legend { font-size: var(--font-1); color: var(--muted); padding: 0 var(--space-1); }
  .err { color: var(--danger); font-size: var(--font-1); }
  .err--form {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--danger);
    border-radius: var(--radius-sm);
    font-size: var(--font-2);
  }
</style>
