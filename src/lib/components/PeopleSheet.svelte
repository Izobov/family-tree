<script lang="ts">
  import type { Dict } from '$lib/i18n';
  import { formatYears } from '$lib/i18n';
  import type { Locale } from '$lib/types';
  import type { PersonWithParents } from '$lib/tree/to-family-chart';
  import { initials } from '$lib/tree/card';
  import Icon from './Icon.svelte';

  let {
    t,
    locale,
    people,
    mode,
    onClose,
    onSelect
  }: {
    t: Dict;
    locale: Locale;
    people: PersonWithParents[];
    /**
     * Один компонент, два режима: 'search' рисует строку поиска сверху,
     * 'all' — просто список. Фильтрация в обоих случаях завязана на один
     * и тот же `query`: в режиме 'all' поле ввода не рендерится, поэтому
     * query остаётся пустым и filtered равен полному списку.
     */
    mode: 'search' | 'all';
    onClose: () => void;
    onSelect: (id: string) => void;
  } = $props();

  let query = $state('');

  function fullName(p: PersonWithParents): string {
    return p.last_name ? `${p.first_name} ${p.last_name}` : p.first_name;
  }

  let filtered = $derived(
    query.trim()
      ? people.filter((p) => fullName(p).toLowerCase().includes(query.trim().toLowerCase()))
      : people
  );

  /**
   * Тот же приём, что и у оверлея человека в +page.svelte: role="dialog",
   * aria-modal, tabindex="-1", bind:this + $effect, переводящий фокус внутрь
   * при открытии. В режиме поиска фокус разумнее ставить сразу в поле ввода,
   * а не на контейнер — так пользователь может печатать без лишнего тапа.
   */
  let dialogEl = $state<HTMLDivElement | null>(null);
  let inputEl = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (mode === 'search') inputEl?.focus();
    else dialogEl?.focus();
  });
</script>

<div class="backdrop" onclick={onClose} role="presentation"></div>
<div
  class="sheet"
  role="dialog"
  aria-modal="true"
  aria-label={t.people.title}
  tabindex="-1"
  bind:this={dialogEl}
>
  <header>
    <h2>{t.people.title}</h2>
    <button type="button" class="close" onclick={onClose}>
      <Icon name="close" size={20} label={t.person.close} />
    </button>
  </header>

  {#if mode === 'search'}
    <input
      type="search"
      bind:value={query}
      bind:this={inputEl}
      placeholder={t.people.searchPlaceholder}
      aria-label={t.people.searchPlaceholder}
    />
  {/if}

  {#if filtered.length === 0}
    <p class="empty">{t.people.nothingFound}</p>
  {:else}
    <p class="count">{t.people.count}: {filtered.length}</p>
    <ul>
      {#each filtered as person (person.id)}
        <li>
          <button type="button" class="row" onclick={() => onSelect(person.id)}>
            <span class="avatar avatar--{person.gender}">{initials(person)}</span>
            <span class="info">
              <span class="name">{fullName(person)}</span>
              <span class="years">{formatYears(person.birth_date, person.died_on, locale)}</span>
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 40%);
    z-index: 10;
    animation: fade 0.15s ease-out;
  }

  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 11;
    height: 70vh;
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border-radius: var(--radius) var(--radius) 0 0;
    box-shadow: var(--shadow-2);
    padding: var(--space-4);
    padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom));
    overflow: hidden;
    animation: slide-up 0.2s ease-out;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
    flex: 0 0 auto;
  }
  h2 { margin: 0; font-size: var(--font-4); }
  .close {
    min-width: var(--tap);
    min-height: var(--tap);
    padding: 0;
    border-radius: 50%;
  }

  input[type='search'] {
    flex: 0 0 auto;
    min-height: var(--tap);
    padding: 0 var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--bg);
    color: var(--fg);
    font-size: var(--font-3);
    margin-bottom: var(--space-3);
  }

  .count {
    flex: 0 0 auto;
    margin: 0 0 var(--space-2);
    color: var(--muted);
    font-size: var(--font-2);
  }

  .empty {
    margin: var(--space-4) 0;
    color: var(--muted);
    text-align: center;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    flex: 1 1 auto;
  }

  .row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--tap);
    padding: var(--space-2) var(--space-1);
    border: none;
    background: none;
    text-align: left;
    color: var(--fg);
    border-radius: var(--radius-sm);
  }
  .row:hover, .row:focus-visible {
    background: var(--bg);
  }

  .avatar {
    flex: 0 0 auto;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: var(--font-2);
    font-weight: 600;
    color: #fff;
  }
  .avatar--male { background: var(--accent-male); }
  .avatar--female { background: var(--accent-female); }

  .info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .name {
    font-size: var(--font-3);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .years {
    font-size: var(--font-1);
    color: var(--muted);
  }

  @keyframes fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes slide-up {
    from { transform: translateY(16px); opacity: 0; }
    to { transform: none; opacity: 1; }
  }
</style>
