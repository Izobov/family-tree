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
