# Family Tree Implementation Plan — часть 2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Продолжение `2026-07-30-family-tree.md`. Задачи 1–11 (каркас, i18n, БД, аутентификация, инварианты, маппер, онбординг, карточки, диаграмма) должны быть выполнены до начала этой части.

**Global Constraints** — те же, что в части 1. Ключевые напоминания: без Tailwind; про `family-chart` знают только `FamilyTree.svelte` и `card.ts`; `SUPABASE_SECRET_KEY` только в `.server`-файлах; все строки через i18n; RLS-политики с `to authenticated` и `(select auth.uid())`.

Фаза 1 завершается задачей 19 (задеплоенное работающее приложение). Фаза 2 — задачи 20–23.

---

### Task 12: Полный экран человека и shallow routing

**Files:**
- Create: `src/routes/(app)/person/[id]/+page.server.ts`, `src/routes/(app)/person/[id]/+page.svelte`
- Create: `src/lib/components/PersonDetail.svelte`, `src/lib/components/ContactRow.svelte`
- Modify: `src/routes/(app)/+page.svelte`, `src/app.d.ts`

**Interfaces:**
- Consumes: `loadTree`, `deriveSiblings`, `formatDate`, `formatYears`, `initials`
- Produces:
  - `GET /person/[id]` → `{ person, parents, spouses, children, siblings, locale }`
  - `PersonDetail.svelte` — вся разметка полного экрана, переиспользуется маршрутом и оверлеем
  - `App.PageState.personDetail` — тип состояния shallow routing
  - `openPerson(id)` в `(app)/+page.svelte` — оверлей поверх смонтированного дерева

- [ ] **Step 1: Расширить типы состояния страницы**

Добавить в `src/app.d.ts` внутрь `namespace App`:

```ts
    interface PageState {
      personDetail?: {
        person: import('$lib/tree/to-family-chart').PersonWithParents;
        parents: import('$lib/tree/to-family-chart').PersonWithParents[];
        spouses: import('$lib/tree/to-family-chart').PersonWithParents[];
        children: import('$lib/tree/to-family-chart').PersonWithParents[];
        siblings: import('$lib/tree/to-family-chart').PersonWithParents[];
      };
    }
```

- [ ] **Step 2: Написать кнопки контактов**

`src/lib/components/ContactRow.svelte`:

```svelte
<script lang="ts">
  import type { Dict } from '$lib/i18n';
  import type { Person } from '$lib/types';

  let { t, person }: { t: Dict; person: Person } = $props();

  type Link = { href: string; label: string; icon: string };

  let links = $derived.by((): Link[] => {
    const out: Link[] = [];
    if (person.phone) {
      out.push({ href: `tel:${person.phone}`, label: t.person.phone, icon: '☎' });
      out.push({
        href: `https://wa.me/${person.phone.replace(/\D/g, '')}`,
        label: 'WhatsApp',
        icon: '✆'
      });
    }
    if (person.telegram) {
      out.push({ href: `https://t.me/${person.telegram}`, label: 'Telegram', icon: '✈' });
    }
    if (person.instagram) {
      out.push({
        href: `https://instagram.com/${person.instagram}`,
        label: 'Instagram',
        icon: '◎'
      });
    }
    if (person.email) {
      out.push({ href: `mailto:${person.email}`, label: t.person.email, icon: '✉' });
    }
    return out;
  });
</script>

{#if links.length > 0}
  <section>
    <h2>{t.person.contacts}</h2>
    <div class="row">
      {#each links as link (link.href)}
        <a href={link.href} rel="noreferrer noopener">
          <span class="icon" aria-hidden="true">{link.icon}</span>
          {link.label}
        </a>
      {/each}
    </div>
  </section>
{/if}

<style>
  h2 { font-size: var(--font-1); text-transform: uppercase; color: var(--muted); margin: 0 0 var(--space-2); letter-spacing: 0.05em; }
  .row { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  a {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--tap);
    padding: 0 var(--space-4);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--fg);
    text-decoration: none;
    font-size: var(--font-2);
  }
  .icon { font-size: var(--font-4); line-height: 1; }
</style>
```

- [ ] **Step 3: Написать полный экран**

`src/lib/components/PersonDetail.svelte`:

```svelte
<script lang="ts">
  import type { Dict } from '$lib/i18n';
  import { formatDate, formatYears } from '$lib/i18n';
  import type { Locale } from '$lib/types';
  import type { PersonWithParents } from '$lib/tree/to-family-chart';
  import { initials } from '$lib/tree/card';
  import ContactRow from './ContactRow.svelte';

  let {
    t,
    locale,
    person,
    parents,
    spouses,
    children,
    siblings,
    onClose = null,
    onShowInTree = null
  }: {
    t: Dict;
    locale: Locale;
    person: PersonWithParents;
    parents: PersonWithParents[];
    spouses: PersonWithParents[];
    children: PersonWithParents[];
    siblings: PersonWithParents[];
    onClose?: (() => void) | null;
    onShowInTree?: ((id: string) => void) | null;
  } = $props();

  let groups = $derived([
    { label: t.person.parents, list: parents },
    { label: t.person.spouses, list: spouses },
    { label: t.person.children, list: children },
    { label: t.person.siblings, list: siblings }
  ]);

  function fullName(p: PersonWithParents): string {
    return p.last_name ? `${p.first_name} ${p.last_name}` : p.first_name;
  }
</script>

<article>
  <header>
    {#if onClose}
      <button type="button" class="close" onclick={onClose} aria-label={t.person.cancel}>✕</button>
    {/if}
    <span class="avatar avatar--{person.gender}">{initials(person)}</span>
    <h1>{fullName(person)}</h1>
    <p class="years">{formatYears(person.birth_date, person.died_on, locale)}</p>
  </header>

  <section class="facts">
    <div>
      <dt>{t.person.birthDate}</dt>
      <dd>{person.birth_date ? formatDate(person.birth_date, locale) : t.person.noData}</dd>
    </div>
    {#if person.died_on}
      <div>
        <dt>{t.person.diedOn}</dt>
        <dd>{formatDate(person.died_on, locale)}</dd>
      </div>
    {/if}
  </section>

  {#if person.about}
    <section class="about">
      <h2>{t.person.about}</h2>
      <p>{person.about}</p>
    </section>
  {/if}

  <ContactRow {t} {person} />

  <section>
    <h2>{t.person.relatives}</h2>
    {#each groups as group (group.label)}
      {#if group.list.length > 0}
        <div class="group">
          <span class="group-label">{group.label}</span>
          <ul>
            {#each group.list as rel (rel.id)}
              <li><a href="/person/{rel.id}">{fullName(rel)}</a></li>
            {/each}
          </ul>
        </div>
      {/if}
    {/each}
  </section>

  <section class="actions">
    <a class="btn" href="/person/{person.id}?edit=1">{t.person.edit}</a>
    <a class="btn" href="/person/{person.id}?add=1">{t.person.addRelative}</a>
    {#if onShowInTree}
      <button type="button" onclick={() => onShowInTree(person.id)}>{t.person.showInTree}</button>
    {/if}
    <a class="btn btn--danger" href="/person/{person.id}?delete=1">{t.person.delete}</a>
  </section>
</article>

<style>
  article {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-4);
    max-width: 560px;
    margin: 0 auto;
  }
  header { display: grid; justify-items: center; gap: var(--space-2); position: relative; }
  .close {
    position: absolute;
    top: 0;
    right: 0;
    min-height: var(--tap);
    min-width: var(--tap);
    padding: 0;
    border-radius: 50%;
  }
  .avatar {
    width: 84px;
    height: 84px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: var(--font-5);
    font-weight: 600;
    color: #fff;
  }
  .avatar--male { background: var(--accent-male); }
  .avatar--female { background: var(--accent-female); }
  h1 { font-size: var(--font-5); margin: 0; text-align: center; }
  .years { color: var(--muted); margin: 0; }
  h2 {
    font-size: var(--font-1);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
    margin: 0 0 var(--space-2);
  }
  .facts { display: grid; gap: var(--space-2); }
  .facts div { display: flex; justify-content: space-between; gap: var(--space-3); }
  dt { color: var(--muted); font-size: var(--font-2); margin: 0; }
  dd { margin: 0; }
  .about p { margin: 0; white-space: pre-wrap; }
  .group { margin-bottom: var(--space-3); }
  .group-label { font-size: var(--font-2); color: var(--muted); }
  ul { list-style: none; margin: var(--space-1) 0 0; padding: 0; display: grid; gap: var(--space-1); }
  ul a { color: var(--accent); text-decoration: none; display: block; min-height: var(--tap); line-height: var(--tap); }
  .actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .btn, .actions button {
    display: inline-flex;
    align-items: center;
    min-height: var(--tap);
    padding: 0 var(--space-4);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--fg);
    text-decoration: none;
    font-size: var(--font-2);
  }
  .btn--danger { color: var(--danger); border-color: var(--danger); }
</style>
```

- [ ] **Step 4: Написать загрузку маршрута**

`src/routes/(app)/person/[id]/+page.server.ts`:

```ts
import { error } from '@sveltejs/kit';
import { deriveSiblings } from '$lib/tree/to-family-chart';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
  const { people, spouses } = await parent();

  const person = people.find((p) => p.id === params.id);
  if (!person) error(404, 'person-not-found');

  const spouseIds = spouses
    .filter((s) => s.person_a_id === person.id || s.person_b_id === person.id)
    .map((s) => (s.person_a_id === person.id ? s.person_b_id : s.person_a_id));

  return {
    person,
    parents: people.filter((p) => p.id === person.father_id || p.id === person.mother_id),
    spouses: people.filter((p) => spouseIds.includes(p.id)),
    children: people.filter((p) => p.father_id === person.id || p.mother_id === person.id),
    siblings: deriveSiblings(people, person.id)
  };
};
```

- [ ] **Step 5: Написать страницу маршрута**

`src/routes/(app)/person/[id]/+page.svelte`:

```svelte
<script lang="ts">
  import { dict } from '$lib/i18n';
  import PersonDetail from '$lib/components/PersonDetail.svelte';

  let { data } = $props();
  let t = $derived(dict(data.locale));
</script>

<main>
  <a class="back" href="/">← {t.nav.tree}</a>
  <PersonDetail
    {t}
    locale={data.locale}
    person={data.person}
    parents={data.parents}
    spouses={data.spouses}
    children={data.children}
    siblings={data.siblings}
  />
</main>

<style>
  main { min-height: 100%; background: var(--bg); }
  .back {
    display: inline-block;
    padding: var(--space-3) var(--space-4);
    color: var(--accent);
    text-decoration: none;
  }
</style>
```

- [ ] **Step 6: Подключить shallow routing на главной**

В `src/routes/(app)/+page.svelte` заменить блок `<script>` целиком:

```svelte
<script lang="ts">
  import { dict } from '$lib/i18n';
  import { goto, preloadData, pushState } from '$app/navigation';
  import { page } from '$app/state';
  import PersonForm from '$lib/components/PersonForm.svelte';
  import FamilyTree from '$lib/components/FamilyTree.svelte';
  import PersonDetail from '$lib/components/PersonDetail.svelte';

  let { data, form } = $props();
  let t = $derived(dict(data.locale));
  let isEmpty = $derived(data.people.length === 0);

  /**
   * Оверлей вместо навигации: дерево остаётся смонтированным, зум и фокус
   * не слетают, а кнопка «назад» на Android закрывает панель, а не приложение.
   * Если предзагрузка не удалась — обычный переход как фоллбэк.
   */
  async function openPerson(id: string) {
    const href = `/person/${id}`;
    const result = await preloadData(href);
    if (result.type === 'loaded' && result.status === 200) {
      pushState(href, { personDetail: result.data as App.PageState['personDetail'] });
    } else {
      goto(href);
    }
  }
</script>
```

И добавить оверлей после `{/if}`:

```svelte
{#if page.state.personDetail}
  {@const d = page.state.personDetail}
  <div class="overlay">
    <PersonDetail
      {t}
      locale={data.locale}
      person={d.person}
      parents={d.parents}
      spouses={d.spouses}
      children={d.children}
      siblings={d.siblings}
      onClose={() => history.back()}
      onShowInTree={() => history.back()}
    />
  </div>
{/if}
```

Заменить `onOpen={(id) => goto(...)}` на `onOpen={openPerson}` и добавить в `<style>`:

```css
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 10;
    overflow-y: auto;
    background: var(--bg);
    animation: slide 0.2s ease-out;
  }

  @keyframes slide {
    from { transform: translateY(12px); opacity: 0; }
    to { transform: none; opacity: 1; }
  }
```

- [ ] **Step 7: Проверить вручную**

```bash
npm run dev
```

1. На `/` тапнуть карточку в фокусе — ожидается выезд панели, URL меняется на `/person/<id>`.
2. Нажать «назад» в браузере — панель закрывается, дерево остаётся на месте, зум сохранён.
3. Открыть `/person/<id>` по прямой ссылке в новой вкладке — ожидается самостоятельная страница с кнопкой «← Дерево».
4. Открыть `/person/00000000-0000-0000-0000-000000000000` — ожидается 404.

- [ ] **Step 8: Коммит**

```bash
git add "src/routes/(app)/person" src/lib/components/PersonDetail.svelte src/lib/components/ContactRow.svelte src/app.d.ts "src/routes/(app)/+page.svelte"
git commit -m "feat: полный экран человека через shallow routing, кнопки контактов"
```

---

### Task 13: Правка человека

**Files:**
- Modify: `src/routes/(app)/person/[id]/+page.server.ts` (добавить action `update`)
- Modify: `src/routes/(app)/person/[id]/+page.svelte` (режим правки по `?edit=1`)

**Interfaces:**
- Consumes: `updatePerson`, `readPersonForm`, `violationsToErrors`
- Produces: `POST /person/[id]?/update` → редирект на `/person/[id]` при успехе, `fail(400, { errors })` при нарушении инвариантов

- [ ] **Step 1: Добавить action**

Дописать в `src/routes/(app)/person/[id]/+page.server.ts`:

```ts
import { fail, redirect } from '@sveltejs/kit';
import { dict } from '$lib/i18n';
import { updatePerson, requireTree } from '$lib/server/people';
import { readPersonForm, violationsToErrors } from '$lib/server/form';
import type { Actions } from './$types';

export const actions: Actions = {
  update: async ({ request, params, locals }) => {
    // В actions нет parent() — дерево запрашиваем сами.
    const { userId } = await locals.safeGetSession();
    const tree = await requireTree(locals.supabase, userId!);
    const t = dict(locals.locale);
    const input = readPersonForm(await request.formData());

    const result = await updatePerson(locals.supabase, tree.id, params.id, input);
    if ('violations' in result) {
      return fail(400, { errors: violationsToErrors(result.violations, t) });
    }

    redirect(303, `/person/${params.id}`);
  }
};
```

Импорт `error` и `deriveSiblings` из шага 4 задачи 12 оставить на месте — `load` не меняется.

- [ ] **Step 2: Добавить режим правки в страницу**

Заменить `src/routes/(app)/person/[id]/+page.svelte`:

```svelte
<script lang="ts">
  import { page } from '$app/state';
  import { dict } from '$lib/i18n';
  import PersonDetail from '$lib/components/PersonDetail.svelte';
  import PersonForm from '$lib/components/PersonForm.svelte';

  let { data, form } = $props();
  let t = $derived(dict(data.locale));
  let editing = $derived(page.url.searchParams.get('edit') === '1');
</script>

<main>
  <a class="back" href="/">← {t.nav.tree}</a>

  {#if editing}
    <form method="POST" action="?/update" class="edit">
      <PersonForm
        {t}
        person={data.person}
        errors={form?.errors ?? {}}
        submitLabel={t.person.save}
      />
      <a class="cancel" href="/person/{data.person.id}">{t.person.cancel}</a>
    </form>
  {:else}
    <PersonDetail
      {t}
      locale={data.locale}
      person={data.person}
      parents={data.parents}
      spouses={data.spouses}
      children={data.children}
      siblings={data.siblings}
    />
  {/if}
</main>

<style>
  main { min-height: 100%; background: var(--bg); }
  .back {
    display: inline-block;
    padding: var(--space-3) var(--space-4);
    color: var(--accent);
    text-decoration: none;
  }
  .edit { max-width: 560px; margin: 0 auto; padding: var(--space-4); display: grid; gap: var(--space-3); }
  .cancel { color: var(--muted); text-align: center; text-decoration: none; min-height: var(--tap); line-height: var(--tap); }
</style>
```

- [ ] **Step 3: Проверить вручную**

```bash
npm run dev
```

1. Открыть `/person/<id>?edit=1`, изменить имя и About, сохранить. Ожидается возврат на просмотр с новыми данными.
2. Ввести телефон `8916` — ожидается ошибка «Телефон в формате +79161234567» под полем, данные не сохранены.
3. Ввести дату смерти раньше даты рождения — ожидается «Дата смерти раньше даты рождения».
4. Ввести телефон `+79161234567`, сохранить, вернуться на просмотр — ожидаются кнопки «Телефон» и «WhatsApp».

- [ ] **Step 4: Коммит**

```bash
git add "src/routes/(app)/person"
git commit -m "feat: правка человека с валидацией полей и контактов"
```

---

### Task 14: Добавление родственника

**Files:**
- Create: `src/routes/(app)/person/[id]/add/+page.server.ts`, `src/routes/(app)/person/[id]/add/+page.svelte`
- Modify: `src/lib/components/PersonDetail.svelte` (ссылка ведёт на `/add`)

**Interfaces:**
- Consumes: `createPerson`, `setParent`, `linkSpouse`, `readPersonForm`
- Produces:
  - `POST /person/[id]/add?/create` с полем `kind` из `'father' | 'mother' | 'spouse' | 'child'`
  - Отец: создать человека `gender=male`, затем `setParent(child=[id], parent=new, 'father')`
  - Мать: то же с `gender=female` и `'mother'`
  - Супруг: создать человека, затем `linkSpouse([id], new, married_on)`
  - Ребёнок: создать человека, затем `setParent(child=new, parent=[id], kind)` где `kind` зависит от пола `[id]`

- [ ] **Step 1: Написать action**

`src/routes/(app)/person/[id]/add/+page.server.ts`:

```ts
import { error, fail, redirect } from '@sveltejs/kit';
import { dict } from '$lib/i18n';
import {
  createPerson,
  setParent,
  linkSpouse,
  requireTree,
  fetchPeople
} from '$lib/server/people';
import { readPersonForm, violationsToErrors } from '$lib/server/form';
import type { Violation } from '$lib/tree/invariants';
import type { Actions, PageServerLoad } from './$types';

const KINDS = ['father', 'mother', 'spouse', 'child'] as const;
type Kind = (typeof KINDS)[number];

export const load: PageServerLoad = async ({ params, url, parent }) => {
  const { people } = await parent();
  const person = people.find((p) => p.id === params.id);
  if (!person) error(404, 'person-not-found');

  const raw = url.searchParams.get('kind');
  const kind = (KINDS as readonly string[]).includes(raw ?? '') ? (raw as Kind) : null;

  return { person, kind };
};

export const actions: Actions = {
  create: async ({ request, params, locals }) => {
    // В actions нет parent() — дерево и людей запрашиваем сами.
    const { userId } = await locals.safeGetSession();
    const tree = await requireTree(locals.supabase, userId!);
    const people = await fetchPeople(locals.supabase, tree.id);
    const t = dict(locals.locale);
    const form = await request.formData();

    const raw = String(form.get('kind') ?? '');
    if (!(KINDS as readonly string[]).includes(raw)) error(400, 'bad-kind');
    const kind = raw as Kind;

    const anchor = people.find((p) => p.id === params.id);
    if (!anchor) error(404, 'person-not-found');

    const input = readPersonForm(form);
    // Пол отца и матери задаётся ролью, а не формой.
    if (kind === 'father') input.gender = 'male';
    if (kind === 'mother') input.gender = 'female';

    const created = await createPerson(locals.supabase, tree.id, input);
    if ('violations' in created) {
      return fail(400, { errors: violationsToErrors(created.violations, t) });
    }

    let linked: { ok: true } | { violations: Violation[] };
    if (kind === 'father' || kind === 'mother') {
      linked = await setParent(locals.supabase, tree.id, anchor.id, created.id, kind);
    } else if (kind === 'spouse') {
      const marriedOn = form.get('married_on');
      linked = await linkSpouse(
        locals.supabase,
        tree.id,
        anchor.id,
        created.id,
        typeof marriedOn === 'string' && marriedOn !== '' ? marriedOn : null
      );
    } else {
      const parentKind = anchor.gender === 'male' ? 'father' : 'mother';
      linked = await setParent(locals.supabase, tree.id, created.id, anchor.id, parentKind);
    }

    if ('violations' in linked) {
      // Связь не сложилась — не оставляем висячего человека в дереве.
      await locals.supabase.from('people').delete().eq('id', created.id).eq('tree_id', tree.id);
      return fail(400, { errors: violationsToErrors(linked.violations, t) });
    }

    redirect(303, `/person/${created.id}`);
  }
};
```

- [ ] **Step 2: Написать страницу**

`src/routes/(app)/person/[id]/add/+page.svelte`:

```svelte
<script lang="ts">
  import { dict } from '$lib/i18n';
  import PersonForm from '$lib/components/PersonForm.svelte';

  let { data, form } = $props();
  let t = $derived(dict(data.locale));

  let options = $derived([
    { kind: 'father', label: t.person.addFather },
    { kind: 'mother', label: t.person.addMother },
    { kind: 'spouse', label: t.person.addSpouse },
    { kind: 'child', label: t.person.addChild }
  ]);

  function nameOf(p: { first_name: string; last_name: string | null }): string {
    return p.last_name ? `${p.first_name} ${p.last_name}` : p.first_name;
  }
</script>

<main>
  <a class="back" href="/person/{data.person.id}">← {nameOf(data.person)}</a>
  <h1>{t.person.addRelative}</h1>

  {#if !data.kind}
    <nav class="picker">
      {#each options as opt (opt.kind)}
        <a href="/person/{data.person.id}/add?kind={opt.kind}">{opt.label}</a>
      {/each}
    </nav>
  {:else}
    <form method="POST" action="?/create">
      <input type="hidden" name="kind" value={data.kind} />
      <PersonForm
        {t}
        errors={form?.errors ?? {}}
        submitLabel={t.person.save}
        showDeath={true}
      />
      {#if data.kind === 'spouse'}
        <label class="married">
          {t.person.marriedOn}
          <input type="date" name="married_on" />
        </label>
      {/if}
    </form>
  {/if}
</main>

<style>
  main { max-width: 560px; margin: 0 auto; padding: var(--space-4); }
  .back { color: var(--accent); text-decoration: none; display: inline-block; min-height: var(--tap); line-height: var(--tap); }
  h1 { font-size: var(--font-4); margin: 0 0 var(--space-4); }
  .picker { display: grid; gap: var(--space-2); }
  .picker a {
    display: flex;
    align-items: center;
    min-height: var(--tap);
    padding: 0 var(--space-4);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--fg);
    text-decoration: none;
  }
  .married { display: grid; gap: var(--space-1); font-size: var(--font-2); color: var(--muted); margin-top: var(--space-3); }
  .married input { min-height: var(--tap); padding: 0 var(--space-3); border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface); color: var(--fg); }
</style>
```

Для полей «отец» и «мать» переключатель пола в форме остаётся видимым, но сервер его игнорирует — роль задаёт пол. Это осознанное упрощение: убирать поле условно означало бы ветвление в `PersonForm`, а лишний клик тут никому не мешает.

- [ ] **Step 3: Поправить ссылку в PersonDetail**

В `src/lib/components/PersonDetail.svelte` заменить строку кнопки добавления:

```svelte
    <a class="btn" href="/person/{person.id}/add">{t.person.addRelative}</a>
```

- [ ] **Step 4: Проверить вручную**

```bash
npm run dev
```

1. Открыть человека → «Добавить родственника» → «Отца». Заполнить имя, сохранить. Ожидается переход на нового человека, у исходного в разделе «Родители» появился отец.
2. Вернуться на `/` — ожидается, что в дереве два узла, связанных линией.
3. Добавить «Супруга» с датой свадьбы — ожидается связь и год на линии между супругами.
4. Добавить «Ребёнка» — ожидается, что ребёнок висит под исходным человеком.
5. Проверить БД:

```bash
supabase db query "select count(*) as people from people; select count(*) as marriages from spouses"
```

- [ ] **Step 5: Коммит**

```bash
git add "src/routes/(app)/person" src/lib/components/PersonDetail.svelte
git commit -m "feat: добавление отца, матери, супруга и ребёнка"
```

---

### Task 15: Удаление человека

**Files:**
- Create: `src/routes/(app)/person/[id]/delete/+page.server.ts`, `src/routes/(app)/person/[id]/delete/+page.svelte`
- Modify: `src/lib/components/PersonDetail.svelte` (ссылка ведёт на `/delete`)

**Interfaces:**
- Consumes: `deletePerson`, `orphansOf`
- Produces: `POST /person/[id]/delete?/confirm` → редирект на `/`; страница подтверждения перечисляет тех, кто останется без родителя

Отдельный маршрут вместо `confirm()`: нативный диалог блокирует поток и ломает автоматизацию браузера, а на телефоне выглядит чужеродно.

- [ ] **Step 1: Написать маршрут**

`src/routes/(app)/person/[id]/delete/+page.server.ts`:

```ts
import { error, redirect } from '@sveltejs/kit';
import { deletePerson, orphansOf, requireTree } from '$lib/server/people';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
  const { people } = await parent();
  const person = people.find((p) => p.id === params.id);
  if (!person) error(404, 'person-not-found');

  return { person, orphans: orphansOf(people, person.id) };
};

export const actions: Actions = {
  confirm: async ({ params, locals }) => {
    // В actions нет parent() — дерево запрашиваем сами.
    const { userId } = await locals.safeGetSession();
    const tree = await requireTree(locals.supabase, userId!);
    await deletePerson(locals.supabase, tree.id, params.id);
    redirect(303, '/');
  }
};
```

- [ ] **Step 2: Написать страницу подтверждения**

`src/routes/(app)/person/[id]/delete/+page.svelte`:

```svelte
<script lang="ts">
  import { dict } from '$lib/i18n';

  let { data } = $props();
  let t = $derived(dict(data.locale));

  function nameOf(p: { first_name: string; last_name: string | null }): string {
    return p.last_name ? `${p.first_name} ${p.last_name}` : p.first_name;
  }
</script>

<main>
  <h1>{t.deleteDialog.title}</h1>
  <p class="who">{nameOf(data.person)}</p>

  {#if data.orphans.length > 0}
    <section>
      <p>{t.deleteDialog.orphans}</p>
      <ul>
        {#each data.orphans as orphan (orphan.id)}
          <li>{nameOf(orphan)}</li>
        {/each}
      </ul>
    </section>
  {/if}

  <div class="actions">
    <form method="POST" action="?/confirm">
      <button type="submit" class="danger">{t.deleteDialog.confirm}</button>
    </form>
    <a href="/person/{data.person.id}">{t.deleteDialog.cancel}</a>
  </div>
</main>

<style>
  main { max-width: 460px; margin: 0 auto; padding: var(--space-5) var(--space-4); display: grid; gap: var(--space-4); }
  h1 { font-size: var(--font-4); margin: 0; }
  .who { font-size: var(--font-3); font-weight: 600; margin: 0; }
  p { margin: 0; color: var(--muted); font-size: var(--font-2); }
  ul { margin: var(--space-2) 0 0; padding-left: var(--space-4); }
  .actions { display: flex; gap: var(--space-3); align-items: center; }
  .danger { color: #fff; background: var(--danger); border-color: var(--danger); }
  a { color: var(--muted); text-decoration: none; min-height: var(--tap); line-height: var(--tap); }
</style>
```

- [ ] **Step 3: Поправить ссылку в PersonDetail**

```svelte
    <a class="btn btn--danger" href="/person/{person.id}/delete">{t.person.delete}</a>
```

- [ ] **Step 4: Проверить вручную**

```bash
npm run dev
```

1. Открыть человека, у которого есть дети, нажать «Удалить». Ожидается список «Останутся без родителя:» с их именами.
2. Нажать «Отмена» — возврат на просмотр, ничего не удалено.
3. Удалить человека без детей — ожидается редирект на `/`, узел исчез из дерева.
4. Удалить корень дерева — ожидается, что приложение не падает (`trees.root_person_id` обнулился, диаграмма открылась на другом человеке).

```bash
supabase db query "select root_person_id from trees"
```

- [ ] **Step 5: Коммит**

```bash
git add "src/routes/(app)/person" src/lib/components/PersonDetail.svelte
git commit -m "feat: удаление человека с предупреждением об осиротевших детях"
```

---

### Task 16: Хедер, переключатель языка, офлайн-баннер

**Files:**
- Create: `src/lib/components/LangSwitch.svelte`, `src/lib/components/OfflineBanner.svelte`
- Create: `src/routes/(app)/+layout.svelte`
- Create: `src/routes/locale/+server.ts`

**Interfaces:**
- Consumes: `locales`, `dict`
- Produces:
  - `POST /locale` с полем `locale` — пишет куку `locale` и `user_settings.locale`, редирект на `Referer`
  - `(app)/+layout.svelte` — хедер с навигацией, переключателем и баннером
  - `OfflineBanner` экспортирует состояние через `online` из `$lib/components/OfflineBanner.svelte`? Нет — состояние локальное, баннер самодостаточен

- [ ] **Step 1: Написать эндпоинт смены языка**

`src/routes/locale/+server.ts`:

```ts
import { redirect } from '@sveltejs/kit';
import { locales } from '$lib/i18n';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies, locals }) => {
  const form = await request.formData();
  const raw = String(form.get('locale') ?? '');
  const locale = locales.includes(raw as never) ? (raw as 'ru' | 'en') : 'ru';

  // Кука — для рендера страниц, БД — чтобы крон знал язык пуша без запроса.
  cookies.set('locale', locale, {
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365
  });

  const { userId } = await locals.safeGetSession();
  if (userId) {
    await locals.supabase.from('user_settings').update({ locale }).eq('user_id', userId);
  }

  redirect(303, request.headers.get('referer') ?? '/');
};
```

- [ ] **Step 2: Написать переключатель**

`src/lib/components/LangSwitch.svelte`:

```svelte
<script lang="ts">
  import type { Locale } from '$lib/types';
  import { locales } from '$lib/i18n';

  let { current }: { current: Locale } = $props();
</script>

<form method="POST" action="/locale">
  {#each locales as locale (locale)}
    <button
      type="submit"
      name="locale"
      value={locale}
      class:active={locale === current}
      aria-pressed={locale === current}
    >
      {locale.toUpperCase()}
    </button>
  {/each}
</form>

<style>
  form { display: flex; gap: 2px; }
  button {
    min-height: 32px;
    min-width: 40px;
    padding: 0 var(--space-2);
    font-size: var(--font-1);
    border-radius: var(--radius-sm);
    color: var(--muted);
  }
  .active { color: var(--fg); border-color: var(--accent); }
</style>
```

- [ ] **Step 3: Написать баннер**

`src/lib/components/OfflineBanner.svelte`:

```svelte
<script lang="ts">
  import type { Dict } from '$lib/i18n';

  let { t }: { t: Dict } = $props();
  let online = $state(true);

  $effect(() => {
    online = navigator.onLine;
    const up = () => (online = true);
    const down = () => (online = false);
    addEventListener('online', up);
    addEventListener('offline', down);
    return () => {
      removeEventListener('online', up);
      removeEventListener('offline', down);
    };
  });
</script>

{#if !online}
  <p role="status">{t.offline.banner}</p>
{/if}

<style>
  p {
    margin: 0;
    padding: var(--space-2) var(--space-4);
    background: var(--accent);
    color: #fff;
    font-size: var(--font-2);
    text-align: center;
  }
</style>
```

- [ ] **Step 4: Написать хедер группы (app)**

`src/routes/(app)/+layout.svelte`:

```svelte
<script lang="ts">
  import { dict } from '$lib/i18n';
  import LangSwitch from '$lib/components/LangSwitch.svelte';
  import OfflineBanner from '$lib/components/OfflineBanner.svelte';

  let { data, children } = $props();
  let t = $derived(dict(data.locale));
</script>

<OfflineBanner {t} />

<header>
  <nav>
    <a href="/">{t.nav.tree}</a>
    <a href="/events">{t.nav.events}</a>
    <a href="/settings">{t.nav.settings}</a>
  </nav>
  <div class="right">
    <LangSwitch current={data.locale} />
    <form method="POST" action="/signout">
      <button type="submit">{t.nav.signOut}</button>
    </form>
  </div>
</header>

{@render children()}

<style>
  header {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    background: var(--surface);
    border-bottom: 1px solid var(--line);
  }
  nav { display: flex; gap: var(--space-3); }
  nav a { color: var(--fg); text-decoration: none; font-size: var(--font-2); }
  .right { display: flex; gap: var(--space-2); align-items: center; }
  .right button { min-height: 32px; padding: 0 var(--space-3); font-size: var(--font-1); }
</style>
```

Хедер `sticky`, а холст дерева `position: fixed; inset: 0` — поэтому в `(app)/+page.svelte` изменить `.canvas` так, чтобы дерево не уезжало под хедер:

```css
  .canvas {
    position: fixed;
    inset: 49px 0 0;
  }
```

- [ ] **Step 5: Проверить вручную**

```bash
npm run dev
```

1. Нажать `EN` — интерфейс переключается на английский, страница остаётся той же.
2. Перезагрузить — язык сохранился.
3. Проверить БД: `supabase db query "select locale from user_settings"` — ожидается `en`.
4. В devtools включить Network → Offline — ожидается красная полоса с текстом про отсутствие сети.
5. Нажать «Выйти» — ожидается редирект на `/login`.

- [ ] **Step 6: Коммит**

```bash
git add src/lib/components/LangSwitch.svelte src/lib/components/OfflineBanner.svelte "src/routes/(app)/+layout.svelte" "src/routes/(app)/+page.svelte" src/routes/locale
git commit -m "feat: хедер, переключатель языка с сохранением в БД, офлайн-баннер"
```

---

### Task 17: PWA — манифест и service worker

**Files:**
- Create: `static/manifest.webmanifest`
- Create: `static/icon-192.png`, `static/icon-512.png`, `static/icon-maskable-512.png`
- Create: `src/service-worker.ts`
- Modify: `src/app.html`, `src/routes/+layout.svelte`

**Interfaces:**
- Consumes: `build`, `files`, `version` из `$service-worker`
- Produces: устанавливаемое приложение; офлайн отдаёт закэшированную оболочку и последнее дерево

- [ ] **Step 1: Написать манифест**

`static/manifest.webmanifest`:

```json
{
  "name": "Family Tree",
  "short_name": "Family Tree",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#faf8f5",
  "theme_color": "#7a5c3e",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    {
      "src": "/icon-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

- [ ] **Step 2: Сгенерировать иконки**

```bash
node -e "
const { writeFileSync } = require('node:fs');
// Заглушки нужного размера: плотный квадрат цвета --accent с буквой в центре
// заменяются на настоящие иконки позже; сейчас важно, чтобы манифест валидировался.
const svg = (size, pad) => Buffer.from(
  '<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"'+size+'\" height=\"'+size+'\">' +
  '<rect width=\"'+size+'\" height=\"'+size+'\" fill=\"#7a5c3e\"/>' +
  '<text x=\"50%\" y=\"50%\" dy=\".35em\" text-anchor=\"middle\" fill=\"#faf8f5\" ' +
  'font-family=\"sans-serif\" font-size=\"'+(size*(pad?0.42:0.55))+'\">FT</text></svg>'
);
writeFileSync('static/icon.svg', svg(512, false));
console.log('written static/icon.svg');
"
```

Затем сконвертировать в PNG нужных размеров:

```bash
npx --yes sharp-cli -i static/icon.svg -o static/icon-192.png resize 192 192
npx --yes sharp-cli -i static/icon.svg -o static/icon-512.png resize 512 512
npx --yes sharp-cli -i static/icon.svg -o static/icon-maskable-512.png resize 512 512
```

Проверить, что три PNG появились:

```bash
node -e "['192','512'].forEach(s=>console.log('icon-'+s+'.png', require('node:fs').statSync('static/icon-'+s+'.png').size)); console.log('maskable', require('node:fs').statSync('static/icon-maskable-512.png').size)"
```

- [ ] **Step 3: Подключить манифест в app.html**

Добавить в `<head>` файла `src/app.html`:

```html
    <link rel="manifest" href="/manifest.webmanifest" />
    <meta name="theme-color" content="#7a5c3e" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <link rel="apple-touch-icon" href="/icon-192.png" />
```

Если тег `viewport` уже есть — заменить его на приведённый (важен `viewport-fit=cover` для iOS в standalone).

- [ ] **Step 4: Написать service worker**

`src/service-worker.ts`:

```ts
/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `family-tree-${version}`;
const PRECACHE = [...build, ...files];

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => sw.skipWaiting())
  );
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => sw.clients.claim())
  );
});

sw.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  // API и аутентификация всегда идут в сеть: закэшированный ответ здесь опасен.
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);

      if (PRECACHE.includes(url.pathname)) {
        const hit = await cache.match(url.pathname);
        if (hit) return hit;
      }

      try {
        const response = await fetch(request);
        if (response.ok && response.type === 'basic') {
          cache.put(request, response.clone());
        }
        return response;
      } catch {
        const hit = await cache.match(request);
        if (hit) return hit;
        throw new Error('offline and nothing cached');
      }
    })()
  );
});
```

- [ ] **Step 5: Зарегистрировать service worker**

В `svelte.config.js` убрать `serviceWorker: { register: false }` (регистрацию делаем сами, чтобы контролировать момент) и добавить в `src/routes/+layout.svelte`:

```svelte
<script lang="ts">
  import '../app.css';
  import { dict } from '$lib/i18n';
  import { onMount } from 'svelte';

  let { data, children } = $props();
  let t = $derived(dict(data.locale));

  onMount(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js', { type: 'module' });
    }
  });
</script>
```

Остальная часть файла не меняется.

- [ ] **Step 6: Проверить в собранном виде**

Service worker не работает в dev-режиме SvelteKit, поэтому проверять только на превью:

```bash
npm run build
npm run preview
```

1. Открыть `http://localhost:4173/`, войти.
2. DevTools → Application → Manifest: ожидается имя «Family Tree», три иконки, `display: standalone`, ошибок нет.
3. DevTools → Application → Service Workers: ожидается активный воркер.
4. DevTools → Network → Offline, перезагрузить страницу — ожидается, что оболочка и дерево отрисовались, сверху висит офлайн-баннер.
5. Lighthouse → категория «Progressive Web App» (или «Installable») — ожидается, что приложение признано устанавливаемым.

- [ ] **Step 7: Коммит**

```bash
git add static src/service-worker.ts src/app.html svelte.config.js src/routes/+layout.svelte
git commit -m "feat: PWA — манифест, иконки, service worker с офлайн-кэшем"
```

---

### Task 18: Сквозной тест Playwright

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/tree.spec.ts`
- Modify: `.gitignore` (добавить `test-results/`, `playwright-report/`)

**Interfaces:**
- Consumes: собранное приложение и живой проект Supabase
- Produces: `npm run test:e2e` — один сквозной путь от регистрации до появления события

- [ ] **Step 1: Написать конфиг**

`playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  projects: [{ name: 'mobile', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
```

Проект `mobile` выбран намеренно: телефон — основной сценарий, и тест должен ловить проблемы с тап-таргетами.

- [ ] **Step 2: Установить браузеры**

```bash
npx playwright install chromium
```

- [ ] **Step 3: Написать тест**

`e2e/tree.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

/** Уникальный email на прогон: подтверждение email в проекте выключено. */
const email = `e2e-${Date.now()}@example.com`;
const password = 'test-password-123';

test('регистрация, построение дерева, правка, событие', async ({ page }) => {
  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click();

  // Онбординг: первый человек становится корнем.
  await expect(page.getByRole('heading', { name: 'Расскажите о себе' })).toBeVisible();
  await page.getByLabel('Имя').fill('Иван');
  await page.getByLabel('Фамилия').fill('Изобов');
  await page.getByLabel('Дата рождения').fill('1990-05-15');
  await page.getByRole('button', { name: 'Создать дерево' }).click();

  // Дерево нарисовалось.
  await expect(page.locator('.ft-card').first()).toBeVisible();
  await expect(page.locator('.ft-card')).toContainText('Иван');

  // Тап по карточке в фокусе раскрывает полный экран.
  await page.locator('.ft-card--main').click();
  await expect(page.getByRole('heading', { name: 'Иван Изобов' })).toBeVisible();
  expect(new URL(page.url()).pathname).toMatch(/^\/person\//);

  // Добавляем отца.
  await page.getByRole('link', { name: 'Добавить родственника' }).click();
  await page.getByRole('link', { name: 'Отца' }).click();
  await page.getByLabel('Имя').fill('Пётр');
  await page.getByLabel('Фамилия').fill('Изобов');
  await page.getByLabel('Дата рождения').fill('1960-07-31');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('heading', { name: 'Пётр Изобов' })).toBeVisible();

  // Правка: валидация телефона отклоняет мусор.
  await page.goto(new URL(page.url()).pathname + '?edit=1');
  await page.getByLabel('Телефон').fill('8916');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByText('Телефон в формате +79161234567')).toBeVisible();

  // Корректный телефон сохраняется и даёт кнопку WhatsApp.
  await page.getByLabel('Телефон').fill('+79161234567');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('link', { name: 'WhatsApp' })).toBeVisible();

  // В дереве два человека.
  await page.goto('/');
  await expect(page.locator('.ft-card')).toHaveCount(2);

  // Переключение языка.
  await page.getByRole('button', { name: 'EN' }).click();
  await expect(page.getByRole('link', { name: 'Tree' })).toBeVisible();
});
```

- [ ] **Step 4: Прогнать тест**

```bash
npm run test:e2e
```

Ожидается: 1 passed.

Если тест падает на `getByLabel('Пароль')` — проверить, что `AuthForm.svelte` оборачивает `<input>` внутрь `<label>` (Playwright связывает подпись и поле именно так).

- [ ] **Step 5: Коммит**

```bash
git add playwright.config.ts e2e .gitignore
git commit -m "test: сквозной путь от регистрации до дерева на мобильном вьюпорте"
```

---

### Task 19: Деплой на Vercel

**Files:**
- Create: `vercel.json`
- Modify: `README.md`

**Interfaces:**
- Consumes: собранный проект, переменные окружения
- Produces: работающий production-URL, куда можно зайти с телефона и установить приложение

- [ ] **Step 1: Создать `vercel.json`**

`vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [{ "path": "/api/cron/events", "schedule": "0 3 * * *" }]
}
```

Крон-эндпоинт появится в задаче 23; до тех пор он будет отвечать 404, и это не ломает деплой. `0 3 * * *` — раз в сутки, как требует Hobby-план.

- [ ] **Step 2: Слинковать проект**

```bash
npx vercel link --yes
```

- [ ] **Step 3: Залить переменные окружения**

```bash
npx vercel env add PUBLIC_SUPABASE_URL production
npx vercel env add PUBLIC_SUPABASE_PUBLISHABLE_KEY production
npx vercel env add SUPABASE_SECRET_KEY production
```

Значения взять из локального `.env`. Те же три переменные добавить в окружение `preview` — иначе preview-деплои будут падать.

- [ ] **Step 4: Задеплоить**

```bash
npx vercel --prod
```

- [ ] **Step 5: Проверить продакшен**

1. Открыть выданный URL, зарегистрироваться, создать себя, добавить отца.
2. Открыть тот же URL **на телефоне**. На Android — «Установить приложение», на iOS — «Поделиться → На экран „Домой“».
3. Запустить с домашнего экрана: ожидается standalone без адресной строки.
4. Проверить, что дерево скроллится и зумится пальцами и карточки нажимаются без промахов.

- [ ] **Step 6: Записать README**

`README.md`:

```markdown
# Family Tree

Двуязычное PWA для семейного дерева. SvelteKit + Supabase + Vercel.

## Разработка

```bash
npm install
cp .env.example .env   # заполнить ключи из Supabase Dashboard
npm run dev
```

## Проверки

```bash
npm run check      # типы
npm run test:unit  # чистые функции
npm run test:e2e   # сквозной путь (собирает и поднимает preview)
```

Service worker в dev-режиме не работает — PWA проверять через `npm run build && npm run preview`.

## Схема БД

Миграции в `supabase/migrations`. Применение: `supabase db push --linked`.

## Документы

- Дизайн: `docs/superpowers/specs/2026-07-30-family-tree-design.md`
- План: `docs/superpowers/plans/2026-07-30-family-tree.md` и `-part2.md`
```

- [ ] **Step 7: Коммит**

```bash
git add vercel.json README.md .vercel
git commit -m "chore: деплой на Vercel, конфиг крона, README"
```

Если `.vercel` попал в `.gitignore` автоматически — не добавлять его принудительно.

**На этом фаза 1 завершена: приложение работает, задеплоено и ставится на телефон.**

---

### Task 20: Расчёт ближайших событий

**Files:**
- Create: `src/lib/events/upcoming.ts`
- Test: `src/lib/events/upcoming.test.ts`

**Interfaces:**
- Consumes: `PersonWithParents`, `Spouse`
- Produces:
  - `type FamilyEvent = { kind: 'birthday'; date: string; subjectKey: string; person: PersonWithParents; count: number } | { kind: 'anniversary'; date: string; subjectKey: string; a: PersonWithParents; b: PersonWithParents; count: number }`
  - `upcomingEvents(people, spouses, from: Date, leadDays: number): FamilyEvent[]` — отсортировано по дате, затем по имени

**Почему обход по дням, а не «вычислить следующую дату»:** перебор реальных календарных дат от `from` вперёд автоматически решает переход через год. Это тот баг, который иначе всплывает ровно один раз в году.

- [ ] **Step 1: Написать падающий тест**

`src/lib/events/upcoming.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { upcomingEvents } from './upcoming';
import type { Spouse } from '$lib/types';
import type { PersonWithParents } from '$lib/tree/to-family-chart';

function p(id: string, over: Partial<PersonWithParents> = {}): PersonWithParents {
  return {
    id,
    tree_id: 't1',
    first_name: id,
    last_name: null,
    gender: 'male',
    birth_date: null,
    died_on: null,
    email: null,
    phone: null,
    telegram: null,
    instagram: null,
    about: null,
    father_id: null,
    mother_id: null,
    ...over
  } as PersonWithParents;
}

function sp(a: string, b: string, married_on: string | null): Spouse {
  return { tree_id: 't1', person_a_id: a, person_b_id: b, married_on };
}

describe('upcomingEvents — дни рождения', () => {
  it('находит день рождения сегодня', () => {
    const events = upcomingEvents(
      [p('a', { birth_date: '1948-07-30' })],
      [],
      new Date('2026-07-30T00:00:00Z'),
      3
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'birthday', date: '2026-07-30', count: 78 });
  });

  it('находит день рождения внутри окна', () => {
    const events = upcomingEvents(
      [p('a', { birth_date: '1948-08-02' })],
      [],
      new Date('2026-07-30T00:00:00Z'),
      3
    );
    expect(events).toHaveLength(1);
    expect(events[0].date).toBe('2026-08-02');
  });

  it('игнорирует день рождения за окном', () => {
    const events = upcomingEvents(
      [p('a', { birth_date: '1948-08-05' })],
      [],
      new Date('2026-07-30T00:00:00Z'),
      3
    );
    expect(events).toEqual([]);
  });

  it('ПЕРЕХОД ЧЕРЕЗ ГОД: 3 января попадает в окно из 31 декабря', () => {
    const events = upcomingEvents(
      [p('a', { birth_date: '1948-01-03' })],
      [],
      new Date('2026-12-31T00:00:00Z'),
      3
    );
    expect(events).toHaveLength(1);
    expect(events[0].date).toBe('2027-01-03');
    expect(events[0].count).toBe(79);
  });

  it('leadDays = 0 оставляет только сегодня', () => {
    const events = upcomingEvents(
      [p('a', { birth_date: '1948-07-30' }), p('b', { birth_date: '1948-07-31' })],
      [],
      new Date('2026-07-30T00:00:00Z'),
      0
    );
    expect(events.map((e) => e.date)).toEqual(['2026-07-30']);
  });

  it('умерших не поздравляет', () => {
    const events = upcomingEvents(
      [p('a', { birth_date: '1948-07-30', died_on: '2011-06-01' })],
      [],
      new Date('2026-07-30T00:00:00Z'),
      3
    );
    expect(events).toEqual([]);
  });

  it('человека без даты рождения пропускает', () => {
    const events = upcomingEvents([p('a')], [], new Date('2026-07-30T00:00:00Z'), 3);
    expect(events).toEqual([]);
  });

  it('не считает событием сам день рождения в год рождения', () => {
    const events = upcomingEvents(
      [p('baby', { birth_date: '2026-07-30' })],
      [],
      new Date('2026-07-30T00:00:00Z'),
      3
    );
    expect(events).toEqual([]);
  });
});

describe('upcomingEvents — годовщины', () => {
  const alive = [p('a'), p('b', { gender: 'female' })];

  it('находит годовщину и считает годы', () => {
    const events = upcomingEvents(
      alive,
      [sp('a', 'b', '2000-08-01')],
      new Date('2026-07-30T00:00:00Z'),
      3
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'anniversary', date: '2026-08-01', count: 26 });
  });

  it('без married_on годовщины нет', () => {
    const events = upcomingEvents(
      alive,
      [sp('a', 'b', null)],
      new Date('2026-07-30T00:00:00Z'),
      3
    );
    expect(events).toEqual([]);
  });

  it('если один из супругов умер — годовщины нет', () => {
    const events = upcomingEvents(
      [p('a', { died_on: '2020-01-01' }), p('b', { gender: 'female' })],
      [sp('a', 'b', '2000-08-01')],
      new Date('2026-07-30T00:00:00Z'),
      3
    );
    expect(events).toEqual([]);
  });

  it('брак со ссылкой на отсутствующего человека игнорируется', () => {
    const events = upcomingEvents(
      [p('a')],
      [sp('a', 'ghost', '2000-08-01')],
      new Date('2026-07-30T00:00:00Z'),
      3
    );
    expect(events).toEqual([]);
  });

  it('свадьба в этом же году годовщиной не считается', () => {
    const events = upcomingEvents(
      alive,
      [sp('a', 'b', '2026-08-01')],
      new Date('2026-07-30T00:00:00Z'),
      3
    );
    expect(events).toEqual([]);
  });
});

describe('upcomingEvents — порядок и ключи', () => {
  it('сортирует по дате, затем по имени', () => {
    const events = upcomingEvents(
      [
        p('later', { birth_date: '1990-08-02', first_name: 'Яна', gender: 'female' }),
        p('todayB', { birth_date: '1990-07-30', first_name: 'Борис' }),
        p('todayA', { birth_date: '1990-07-30', first_name: 'Анна', gender: 'female' })
      ],
      [],
      new Date('2026-07-30T00:00:00Z'),
      5
    );
    expect(events.map((e) => e.date)).toEqual(['2026-07-30', '2026-07-30', '2026-08-02']);
    expect(events.slice(0, 2).map((e) => (e as { person: { first_name: string } }).person.first_name))
      .toEqual(['Анна', 'Борис']);
  });

  it('subjectKey у дня рождения — id, у годовщины — пара через двоеточие', () => {
    const events = upcomingEvents(
      [p('a', { birth_date: '1990-07-30' }), p('b', { gender: 'female' })],
      [sp('a', 'b', '2000-07-30')],
      new Date('2026-07-30T00:00:00Z'),
      0
    );
    const keys = events.map((e) => e.subjectKey).sort();
    expect(keys).toEqual(['a', 'a:b']);
  });
});
```

- [ ] **Step 2: Прогнать тест, убедиться что падает**

```bash
npm run test:unit -- src/lib/events/upcoming.test.ts
```

Ожидается: FAIL, `Cannot find module './upcoming'`.

- [ ] **Step 3: Реализовать расчёт**

`src/lib/events/upcoming.ts`:

```ts
import type { Spouse } from '$lib/types';
import type { PersonWithParents } from '$lib/tree/to-family-chart';

export type FamilyEvent =
  | {
      kind: 'birthday';
      date: string;
      subjectKey: string;
      count: number;
      person: PersonWithParents;
    }
  | {
      kind: 'anniversary';
      date: string;
      subjectKey: string;
      count: number;
      a: PersonWithParents;
      b: PersonWithParents;
    };

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Календарные даты окна включительно. Перебор реальных дат решает переход через год. */
function windowDays(from: Date, leadDays: number): string[] {
  const out: string[] = [];
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  for (let i = 0; i <= leadDays; i++) {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + i);
    out.push(iso(day));
  }
  return out;
}

function nameOf(person: PersonWithParents): string {
  return person.last_name ? `${person.first_name} ${person.last_name}` : person.first_name;
}

/**
 * События в окне [from, from + leadDays].
 * Дни рождения — только у живых. Годовщины — только если оба живы и известна дата свадьбы.
 * Событие в год самого события (рождение, свадьба) не считается годовщиной, поэтому count >= 1.
 */
export function upcomingEvents(
  people: PersonWithParents[],
  spouses: Spouse[],
  from: Date,
  leadDays: number
): FamilyEvent[] {
  const days = windowDays(from, leadDays);
  const byId = new Map(people.map((p) => [p.id, p]));
  const events: FamilyEvent[] = [];

  for (const day of days) {
    const [year, monthDay] = [day.slice(0, 4), day.slice(5)];

    for (const person of people) {
      if (!person.birth_date || person.died_on) continue;
      if (person.birth_date.slice(5) !== monthDay) continue;
      const count = Number(year) - Number(person.birth_date.slice(0, 4));
      if (count < 1) continue;
      events.push({ kind: 'birthday', date: day, subjectKey: person.id, count, person });
    }

    for (const marriage of spouses) {
      if (!marriage.married_on) continue;
      if (marriage.married_on.slice(5) !== monthDay) continue;

      const a = byId.get(marriage.person_a_id);
      const b = byId.get(marriage.person_b_id);
      if (!a || !b || a.died_on || b.died_on) continue;

      const count = Number(year) - Number(marriage.married_on.slice(0, 4));
      if (count < 1) continue;

      events.push({
        kind: 'anniversary',
        date: day,
        subjectKey: `${marriage.person_a_id}:${marriage.person_b_id}`,
        count,
        a,
        b
      });
    }
  }

  return events.sort((x, y) => {
    if (x.date !== y.date) return x.date < y.date ? -1 : 1;
    const nx = x.kind === 'birthday' ? nameOf(x.person) : nameOf(x.a);
    const ny = y.kind === 'birthday' ? nameOf(y.person) : nameOf(y.a);
    return nx.localeCompare(ny, 'ru');
  });
}
```

Известное ограничение: у рождённых 29 февраля событие возникает только в високосные годы. Специальный перенос на 28 февраля не делаем — это осознанное упрощение.

- [ ] **Step 4: Прогнать тест**

```bash
npm run test:unit -- src/lib/events/upcoming.test.ts
```

Ожидается: PASS (15 проверок).

- [ ] **Step 5: Коммит**

```bash
git add src/lib/events
git commit -m "feat: расчёт ближайших событий с корректным переходом через год"
```

---

### Task 21: Экран «Ближайшие события»

**Files:**
- Create: `src/routes/(app)/events/+page.server.ts`, `src/routes/(app)/events/+page.svelte`

**Interfaces:**
- Consumes: `upcomingEvents`, `formatDate`, `dict`
- Produces: `GET /events` → `{ groups: { label: 'today'|'thisWeek'|'thisMonth'; events: FamilyEvent[] }[] }`

- [ ] **Step 1: Написать загрузку**

`src/routes/(app)/events/+page.server.ts`:

```ts
import { upcomingEvents } from '$lib/events/upcoming';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
  const { people, spouses } = await parent();

  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const weekEnd = new Date(now);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  const weekEndIso = weekEnd.toISOString().slice(0, 10);

  // Смотрим на 31 день вперёд и раскладываем по трём корзинам.
  const events = upcomingEvents(people, spouses, now, 31);

  return {
    groups: [
      { label: 'today' as const, events: events.filter((e) => e.date === today) },
      {
        label: 'thisWeek' as const,
        events: events.filter((e) => e.date > today && e.date <= weekEndIso)
      },
      { label: 'thisMonth' as const, events: events.filter((e) => e.date > weekEndIso) }
    ]
  };
};
```

- [ ] **Step 2: Написать страницу**

`src/routes/(app)/events/+page.svelte`:

```svelte
<script lang="ts">
  import { dict, formatDate } from '$lib/i18n';
  import type { FamilyEvent } from '$lib/events/upcoming';

  let { data } = $props();
  let t = $derived(dict(data.locale));
  let hasAny = $derived(data.groups.some((g) => g.events.length > 0));

  function nameOf(p: { first_name: string; last_name: string | null }): string {
    return p.last_name ? `${p.first_name} ${p.last_name}` : p.first_name;
  }

  function title(e: FamilyEvent): string {
    return e.kind === 'birthday' ? nameOf(e.person) : `${nameOf(e.a)} & ${nameOf(e.b)}`;
  }

  function subtitle(e: FamilyEvent): string {
    return e.kind === 'birthday'
      ? `${t.events.birthday} · ${t.events.turns} ${e.count}`
      : `${t.events.anniversary} · ${e.count} ${t.events.yearsTogether}`;
  }

  function href(e: FamilyEvent): string {
    return e.kind === 'birthday' ? `/person/${e.person.id}` : `/person/${e.a.id}`;
  }
</script>

<main>
  <h1>{t.events.title}</h1>

  {#if !hasAny}
    <p class="empty">{t.events.empty}</p>
  {:else}
    {#each data.groups as group (group.label)}
      {#if group.events.length > 0}
        <section>
          <h2>{t.events[group.label]}</h2>
          <ul>
            {#each group.events as event (event.subjectKey + event.date)}
              <li>
                <a href={href(event)}>
                  <span class="icon" aria-hidden="true">
                    {event.kind === 'birthday' ? '🎂' : '💍'}
                  </span>
                  <span class="text">
                    <span class="title">{title(event)}</span>
                    <span class="sub">{subtitle(event)}</span>
                  </span>
                  <time datetime={event.date}>{formatDate(event.date, data.locale)}</time>
                </a>
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    {/each}
  {/if}
</main>

<style>
  main { max-width: 560px; margin: 0 auto; padding: var(--space-4); display: grid; gap: var(--space-4); }
  h1 { font-size: var(--font-4); margin: 0; }
  h2 {
    font-size: var(--font-1);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
    margin: 0 0 var(--space-2);
  }
  .empty { color: var(--muted); margin: 0; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); }
  a {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--tap);
    padding: var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--fg);
    text-decoration: none;
  }
  .icon { font-size: var(--font-4); }
  .text { display: grid; min-width: 0; flex: 1; }
  .title { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sub { font-size: var(--font-1); color: var(--muted); }
  time { font-size: var(--font-1); color: var(--muted); white-space: nowrap; }
</style>
```

- [ ] **Step 3: Проверить вручную**

```bash
npm run dev
```

1. Добавить человека с датой рождения, у которой месяц и день совпадают с сегодняшними, но год давний.
2. Открыть `/events` — ожидается блок «Сегодня» с этим человеком и правильным числом лет.
3. Добавить супруга с датой свадьбы через 5 дней (тот же месяц-день, год давний) — ожидается блок «На этой неделе» с годовщиной.
4. Проставить умершему дату смерти — ожидается, что его день рождения из списка исчез.
5. Переключить язык на EN — ожидаются английские подписи и формат даты.

- [ ] **Step 4: Коммит**

```bash
git add "src/routes/(app)/events"
git commit -m "feat: экран ближайших событий с группировкой по срокам"
```

---

### Task 22: Подписка на Web Push и настройки

**Files:**
- Create: `src/routes/(app)/settings/+page.server.ts`, `src/routes/(app)/settings/+page.svelte`
- Create: `src/routes/api/push/subscribe/+server.ts`, `src/routes/api/push/unsubscribe/+server.ts`
- Modify: `src/service-worker.ts` (обработчики `push` и `notificationclick`)
- Modify: `.env`, `.env.example`

**Interfaces:**
- Consumes: `user_settings`, `push_subscriptions`, `VAPID_PUBLIC_KEY`
- Produces:
  - `POST /api/push/subscribe` тело `{ endpoint, keys: { p256dh, auth } }` → 204
  - `POST /api/push/unsubscribe` тело `{ endpoint }` → 204
  - `POST /settings?/save` — сохраняет `lead_days` и `push_enabled`
  - Service worker показывает уведомление и открывает `/person/<id>` по тапу

- [ ] **Step 1: Сгенерировать VAPID-ключи**

```bash
npm install --save-exact web-push@3.6.7
npx web-push generate-vapid-keys
```

Записать выданные значения в `.env`:

```
VAPID_PUBLIC_KEY=<publicKey из вывода>
VAPID_PRIVATE_KEY=<privateKey из вывода>
VAPID_SUBJECT=mailto:izobov9@gmail.com
CRON_SECRET=<любая случайная строка, например openssl rand -hex 32>
```

`VAPID_PUBLIC_KEY` нужен и в браузере, поэтому продублировать его как публичную переменную:

```
PUBLIC_VAPID_PUBLIC_KEY=<тот же publicKey>
```

Добавить `PUBLIC_VAPID_PUBLIC_KEY` в `.env.example`.

- [ ] **Step 2: Написать эндпоинты подписки**

`src/routes/api/push/subscribe/+server.ts`:

```ts
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  const { userId } = await locals.safeGetSession();
  if (!userId) error(401, 'unauthorized');

  const body = (await request.json()) as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };

  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    error(400, 'bad-subscription');
  }

  const { error: dbError } = await locals.supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth
    },
    { onConflict: 'endpoint' }
  );

  if (dbError) error(503, 'store-failed');

  await locals.supabase
    .from('user_settings')
    .update({ push_enabled: true })
    .eq('user_id', userId);

  return json({ ok: true }, { status: 200 });
};
```

`src/routes/api/push/unsubscribe/+server.ts`:

```ts
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  const { userId } = await locals.safeGetSession();
  if (!userId) error(401, 'unauthorized');

  const body = (await request.json()) as { endpoint?: string };
  if (body.endpoint) {
    await locals.supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', body.endpoint);
  }

  const { count } = await locals.supabase
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  // Флаг снимаем только когда не осталось ни одного устройства.
  if ((count ?? 0) === 0) {
    await locals.supabase
      .from('user_settings')
      .update({ push_enabled: false })
      .eq('user_id', userId);
  }

  return json({ ok: true });
};
```

- [ ] **Step 3: Написать серверную часть настроек**

`src/routes/(app)/settings/+page.server.ts`:

```ts
import { fail } from '@sveltejs/kit';
import { PUBLIC_VAPID_PUBLIC_KEY } from '$env/static/public';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const { userId } = await locals.safeGetSession();

  const { data } = await locals.supabase
    .from('user_settings')
    .select('locale, push_enabled, lead_days')
    .eq('user_id', userId!)
    .maybeSingle();

  return {
    settings: data ?? { locale: locals.locale, push_enabled: false, lead_days: 3 },
    vapidPublicKey: PUBLIC_VAPID_PUBLIC_KEY
  };
};

export const actions: Actions = {
  save: async ({ request, locals }) => {
    const { userId } = await locals.safeGetSession();
    const form = await request.formData();
    const leadDays = Number(form.get('lead_days'));

    if (!Number.isInteger(leadDays) || leadDays < 0 || leadDays > 30) {
      return fail(400, { badLeadDays: true });
    }

    await locals.supabase
      .from('user_settings')
      .update({ lead_days: leadDays })
      .eq('user_id', userId!);

    return { saved: true };
  }
};
```

- [ ] **Step 4: Написать страницу настроек**

`src/routes/(app)/settings/+page.svelte`:

```svelte
<script lang="ts">
  import { dict } from '$lib/i18n';
  import { invalidateAll } from '$app/navigation';
  import LangSwitch from '$lib/components/LangSwitch.svelte';

  let { data, form } = $props();
  let t = $derived(dict(data.locale));

  let supported = $state(true);
  let busy = $state(false);
  let enabled = $state(data.settings.push_enabled);

  $effect(() => {
    supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  });

  function urlBase64ToUint8Array(base64: string): Uint8Array {
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  }

  /** Разрешение запрашивается строго внутри обработчика тапа — требование iOS. */
  async function enablePush() {
    busy = true;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.vapidPublicKey)
      });

      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(subscription.toJSON())
      });

      if (response.ok) {
        enabled = true;
        await invalidateAll();
      }
    } finally {
      busy = false;
    }
  }

  async function disablePush() {
    busy = true;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      const endpoint = subscription?.endpoint;
      await subscription?.unsubscribe();

      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ endpoint })
      });

      enabled = false;
      await invalidateAll();
    } finally {
      busy = false;
    }
  }
</script>

<main>
  <h1>{t.settings.title}</h1>

  <section>
    <h2>{t.settings.language}</h2>
    <LangSwitch current={data.locale} />
  </section>

  <section>
    <h2>{t.settings.notifications}</h2>

    {#if !supported}
      <p class="muted">{t.settings.unsupported}</p>
    {:else}
      <p class="status">{enabled ? t.settings.pushOn : t.settings.pushOff}</p>
      {#if enabled}
        <button type="button" onclick={disablePush} disabled={busy}>
          {t.settings.disablePush}
        </button>
      {:else}
        <button type="button" onclick={enablePush} disabled={busy}>
          {t.settings.enablePush}
        </button>
      {/if}
    {/if}

    <form method="POST" action="?/save">
      <label>
        {t.settings.leadDays}
        <input type="number" name="lead_days" min="0" max="30"
               value={data.settings.lead_days} />
      </label>
      <button type="submit">{t.person.save}</button>
      {#if form?.saved}<span class="muted">✓</span>{/if}
    </form>

    <aside>
      <h3>{t.settings.iosTitle}</h3>
      <p class="muted">{t.settings.iosHint}</p>
    </aside>
  </section>
</main>

<style>
  main { max-width: 560px; margin: 0 auto; padding: var(--space-4); display: grid; gap: var(--space-5); }
  h1 { font-size: var(--font-4); margin: 0; }
  h2 {
    font-size: var(--font-1);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
    margin: 0 0 var(--space-3);
  }
  h3 { font-size: var(--font-2); margin: 0 0 var(--space-1); }
  section { display: grid; gap: var(--space-3); justify-items: start; }
  .status { margin: 0; }
  .muted { color: var(--muted); font-size: var(--font-2); margin: 0; }
  form { display: flex; align-items: end; gap: var(--space-3); flex-wrap: wrap; }
  label { display: grid; gap: var(--space-1); font-size: var(--font-2); color: var(--muted); }
  input {
    min-height: var(--tap);
    width: 96px;
    padding: 0 var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--fg);
  }
  aside {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: var(--space-3);
    background: var(--surface);
  }
</style>
```

- [ ] **Step 5: Добавить обработчики push в service worker**

Дописать в конец `src/service-worker.ts`:

```ts
interface PushPayload {
  title: string;
  body: string;
  url: string;
}

sw.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload: PushPayload;
  try {
    payload = event.data.json() as PushPayload;
  } catch {
    return;
  }

  event.waitUntil(
    sw.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: payload.url }
    })
  );
});

sw.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string })?.url ?? '/events';

  event.waitUntil(
    (async () => {
      const clients = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        if (client.url.endsWith(url)) return client.focus();
      }
      await sw.clients.openWindow(url);
    })()
  );
});
```

- [ ] **Step 6: Проверить вручную**

```bash
npm run build
npm run preview
```

1. Открыть `/settings` в Chrome. Ожидается «Уведомления выключены» и кнопка «Включить уведомления».
2. Нажать кнопку, разрешить в промпте браузера. Ожидается «Уведомления включены».
3. Проверить БД:

```bash
supabase db query "select count(*) as subs from push_subscriptions; select push_enabled from user_settings"
```

Ожидается `subs = 1`, `push_enabled = true`.

4. Изменить «Предупреждать за» на 7, сохранить — ожидается галочка и `lead_days = 7` в БД.
5. Нажать «Отключить уведомления» — ожидается `subs = 0` и `push_enabled = false`.

- [ ] **Step 7: Коммит**

```bash
git add "src/routes/(app)/settings" src/routes/api/push src/service-worker.ts .env.example
git commit -m "feat: подписка на Web Push, настройки уведомлений, инструкция для iOS"
```

---

### Task 23: Крон рассылки уведомлений

**Files:**
- Create: `src/lib/server/supabase.ts`, `src/lib/server/push.ts`
- Create: `src/routes/api/cron/events/+server.ts`
- Modify: `vercel.json` (уже содержит крон из задачи 19 — проверить)

**Interfaces:**
- Consumes: `SUPABASE_SECRET_KEY`, `VAPID_*`, `CRON_SECRET`, `upcomingEvents`, `dict`
- Produces:
  - `adminClient(): SupabaseClient` — клиент под секретным ключом, обходит RLS
  - `sendPush(subscription, payload): Promise<'sent' | 'gone' | 'failed'>`
  - `GET /api/cron/events` с `Authorization: Bearer $CRON_SECRET` → `{ users, sent, pruned }`

- [ ] **Step 1: Написать админ-клиент**

`src/lib/server/supabase.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_SECRET_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';

/**
 * Клиент под секретным ключом: обходит RLS, поэтому нужен только крону,
 * которому надо разослать уведомления всем пользователям сразу.
 * Импортировать этот модуль можно исключительно из .server-файлов.
 */
export function adminClient(): SupabaseClient {
  return createClient(PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
```

- [ ] **Step 2: Написать отправку пушей**

`src/lib/server/push.ts`:

```ts
import webpush from 'web-push';
import { VAPID_PRIVATE_KEY, VAPID_SUBJECT } from '$env/static/private';
import { PUBLIC_VAPID_PUBLIC_KEY } from '$env/static/public';

webpush.setVapidDetails(VAPID_SUBJECT, PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

/**
 * 404 и 410 означают, что подписка мертва — её надо удалить, иначе будем
 * долбить мёртвый endpoint каждую ночь.
 */
export async function sendPush(
  target: PushTarget,
  payload: PushPayload
): Promise<'sent' | 'gone' | 'failed'> {
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(payload)
    );
    return 'sent';
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return 'gone';
    return 'failed';
  }
}
```

- [ ] **Step 3: Написать крон-эндпоинт**

`src/routes/api/cron/events/+server.ts`:

```ts
import { error, json } from '@sveltejs/kit';
import { CRON_SECRET } from '$env/static/private';
import { adminClient } from '$lib/server/supabase';
import { sendPush } from '$lib/server/push';
import { upcomingEvents, type FamilyEvent } from '$lib/events/upcoming';
import { dict } from '$lib/i18n';
import type { Locale, Spouse } from '$lib/types';
import type { PersonWithParents } from '$lib/tree/to-family-chart';
import type { RequestHandler } from './$types';

function nameOf(p: { first_name: string; last_name: string | null }): string {
  return p.last_name ? `${p.first_name} ${p.last_name}` : p.first_name;
}

function describe(event: FamilyEvent, locale: Locale): { title: string; body: string; url: string } {
  const t = dict(locale);
  if (event.kind === 'birthday') {
    return {
      title: `${t.events.birthday}: ${nameOf(event.person)}`,
      body: `${t.events.turns} ${event.count}`,
      url: `/person/${event.person.id}`
    };
  }
  return {
    title: `${t.events.anniversary}: ${nameOf(event.a)} & ${nameOf(event.b)}`,
    body: `${event.count} ${t.events.yearsTogether}`,
    url: `/person/${event.a.id}`
  };
}

export const GET: RequestHandler = async ({ request }) => {
  if (request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
    error(401, 'unauthorized');
  }

  const db = adminClient();
  const now = new Date();
  let sent = 0;
  let pruned = 0;

  const { data: users } = await db
    .from('user_settings')
    .select('user_id, locale, lead_days')
    .eq('push_enabled', true);

  for (const user of users ?? []) {
    const [{ data: subs }, { data: tree }] = await Promise.all([
      db
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth')
        .eq('user_id', user.user_id),
      db.from('trees').select('id').eq('owner_id', user.user_id).maybeSingle()
    ]);

    if (!tree || !subs || subs.length === 0) continue;

    const [{ data: people }, { data: spouses }] = await Promise.all([
      db
        .from('people')
        .select(
          'id, tree_id, first_name, last_name, gender, birth_date, died_on, email, phone, telegram, instagram, about, father_id, mother_id'
        )
        .eq('tree_id', tree.id),
      db
        .from('spouses')
        .select('tree_id, person_a_id, person_b_id, married_on')
        .eq('tree_id', tree.id)
    ]);

    const events = upcomingEvents(
      (people ?? []) as PersonWithParents[],
      (spouses ?? []) as Spouse[],
      now,
      user.lead_days as number
    );

    for (const event of events) {
      // Дедупликация: повторный прогон не должен присылать то же дважды.
      const { error: claimError } = await db.from('notifications_sent').insert({
        user_id: user.user_id,
        kind: event.kind,
        subject_key: event.subjectKey,
        event_date: event.date
      });
      if (claimError) continue; // конфликт первичного ключа — уже отправляли

      const payload = describe(event, user.locale as Locale);

      for (const sub of subs) {
        const result = await sendPush(sub, payload);
        if (result === 'sent') sent += 1;
        if (result === 'gone') {
          await db.from('push_subscriptions').delete().eq('id', sub.id);
          pruned += 1;
        }
      }
    }
  }

  return json({ users: users?.length ?? 0, sent, pruned });
};
```

- [ ] **Step 4: Проверить защиту эндпоинта**

```bash
npm run build
npm run preview
```

В другом терминале:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4173/api/cron/events
```

Ожидается: `401`.

- [ ] **Step 5: Проверить рассылку**

1. Убедиться, что уведомления включены в `/settings` и в дереве есть человек, у которого месяц и день рождения совпадают с сегодняшними.
2. Вызвать эндпоинт с секретом (значение взять из `.env`):

```bash
curl -s -H "Authorization: Bearer $(grep '^CRON_SECRET=' .env | cut -d= -f2)" \
  http://localhost:4173/api/cron/events
```

Ожидается JSON вида `{"users":1,"sent":1,"pruned":0}` и всплывшее системное уведомление.

3. Вызвать повторно — ожидается `{"users":1,"sent":0,"pruned":0}`: дедупликация сработала.

```bash
supabase db query "select kind, subject_key, event_date from notifications_sent"
```

- [ ] **Step 6: Залить переменные и задеплоить**

```bash
npx vercel env add VAPID_PRIVATE_KEY production
npx vercel env add VAPID_SUBJECT production
npx vercel env add PUBLIC_VAPID_PUBLIC_KEY production
npx vercel env add CRON_SECRET production
npx vercel --prod
```

`CRON_SECRET` Vercel подставляет в заголовок `Authorization` автоматически при вызове крона — отдельной настройки не требуется.

- [ ] **Step 7: Проверить крон в продакшене**

1. Vercel Dashboard → проект → Settings → Cron Jobs: ожидается задача `/api/cron/events` с расписанием `0 3 * * *`.
2. Запустить вручную кнопкой в дашборде.
3. Vercel Dashboard → Logs: ожидается `200` и JSON со счётчиками.
4. Установить приложение на телефон, включить уведомления, снова запустить крон вручную — ожидается уведомление на телефоне, тап открывает карточку человека.

- [ ] **Step 8: Финальная проверка и коммит**

```bash
npm run check
npm run test:unit
npm run test:e2e
```

Ожидается: типы чистые, все юнит-тесты PASS, e2e PASS.

```bash
git add src/lib/server/supabase.ts src/lib/server/push.ts src/routes/api/cron vercel.json
git commit -m "feat: ночная рассылка уведомлений о ДР и годовщинах через Web Push"
```

---

## Self-Review

**Покрытие спеки.**

| Раздел спеки | Задачи |
|---|---|
| §1 стек, отсутствие Tailwind | 1 |
| §2.1 family-chart | 11 |
| §2.2 модель родства, `spouses` | 3, 8, 14 |
| §2.3 form actions + `@supabase/ssr` | 4, 5 |
| §2.4 смысл тапа (вариант A) | 11 |
| §2.5 shallow routing | 12 |
| §2.6 уведомления, два слоя | 20, 21, 22, 23 |
| §2.7 локаль в БД | 16, 23 |
| §2.8 свой i18n | 2 |
| §3 схема | 3 |
| §3.1 RLS, экспозиция Data API | 3 |
| §3.2 инварианты | 6, 8 |
| §3.3 удаление | 15 |
| §4.1 экраны | 5, 9, 11, 12, 21, 22 |
| §4.2 карточка | 10 |
| §4.3 полный экран | 12 |
| §4.4 стили, глобальные `cards.css` | 1, 10 |
| §5 структура и границы | все |
| §5.3 формат family-chart | 7 |
| §5.4 обновление без пересоздания | 11 |
| §5.5 ошибки | 4, 5, 13, 15, 22, 23 |
| §6 PWA | 17 |
| §7 реализация уведомлений | 22, 23 |
| §8 тесты | 2, 6, 7, 10, 18, 20 |
| §9 деплой | 19, 23 |

**Пробел, найденный при сверке:** спека в §8 требует тест RLS («под пользователем B не видно людей дерева A»), а среди задач его не было. Задача 24 ниже закрывает пробел.

**Согласованность имён.** `PersonWithParents`, `FcDatum`, `Violation`, `PersonWrite`, `FamilyEvent`, `Dict`, `Locale` используются одинаково во всех задачах. `renderCard` (не `renderCardHtml`), `createsCycle` (не `wouldCreateCycle`), `setParent` (не `assignParent`), `upcomingEvents` (не `getUpcoming`).

---

### Task 24: Тест изоляции данных между пользователями

**Files:**
- Create: `e2e/rls.spec.ts`

**Interfaces:**
- Consumes: работающее приложение
- Produces: доказательство, что дерево одного пользователя недоступно другому

Это не формальность: в дереве лежат телефоны и инстаграмы живой родни, и RLS — единственное, что стоит между ними и интернетом.

- [ ] **Step 1: Написать тест**

`e2e/rls.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

const stamp = Date.now();
const userA = { email: `rls-a-${stamp}@example.com`, password: 'test-password-123' };
const userB = { email: `rls-b-${stamp}@example.com`, password: 'test-password-123' };

async function signUp(page: import('@playwright/test').Page, user: typeof userA) {
  await page.goto('/signup');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Пароль').fill(user.password);
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click();
  await expect(page.getByRole('heading', { name: 'Расскажите о себе' })).toBeVisible();
}

test('дерево пользователя A недоступно пользователю B', async ({ browser }) => {
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();

  await signUp(pageA, userA);
  await pageA.getByLabel('Имя').fill('Секретный');
  await pageA.getByLabel('Фамилия').fill('Родственник');
  await pageA.getByRole('button', { name: 'Создать дерево' }).click();
  await expect(pageA.locator('.ft-card')).toContainText('Секретный');

  await pageA.locator('.ft-card--main').click();
  const secretPath = new URL(pageA.url()).pathname;
  expect(secretPath).toMatch(/^\/person\//);

  // Отдельный контекст — отдельные куки, полностью другой пользователь.
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await signUp(pageB, userB);

  // Прямая ссылка на человека из чужого дерева должна дать 404, а не данные.
  const response = await pageB.goto(secretPath);
  expect(response?.status()).toBe(404);
  await expect(pageB.getByText('Секретный')).toHaveCount(0);

  await contextA.close();
  await contextB.close();
});
```

- [ ] **Step 2: Прогнать тест**

```bash
npm run test:e2e -- e2e/rls.spec.ts
```

Ожидается: 1 passed. Если тест вернул 200 вместо 404 — RLS-политики из задачи 3 применены неверно, и это блокер: разбираться до продолжения.

- [ ] **Step 3: Прогнать весь набор и закоммитить**

```bash
npm run test:unit
npm run test:e2e
git add e2e/rls.spec.ts
git commit -m "test: изоляция деревьев между пользователями через RLS"
```
