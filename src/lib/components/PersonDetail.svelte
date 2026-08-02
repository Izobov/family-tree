<script lang="ts">
  import type { Dict } from '$lib/i18n';
  import { formatDate, formatYears } from '$lib/i18n';
  import type { Locale } from '$lib/types';
  import type { PersonWithParents } from '$lib/tree/to-family-chart';
  import { initials } from '$lib/tree/card';
  import ContactRow from './ContactRow.svelte';
  import Icon from './Icon.svelte';

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
      <button type="button" class="close" onclick={onClose}>
        <!-- label задаём здесь: иконка — единственное содержимое кнопки,
             без него скринридер прочитал бы её как безымянную. -->
        <Icon name="close" size={20} label={t.person.close} />
      </button>
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
    <a class="btn" href="/person/{person.id}/add">{t.person.addRelative}</a>
    {#if onShowInTree}
      <button type="button" onclick={() => onShowInTree(person.id)}>{t.person.showInTree}</button>
    {/if}
    <a class="btn btn--danger" href="/person/{person.id}/delete">{t.person.delete}</a>
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
