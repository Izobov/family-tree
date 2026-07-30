<script lang="ts">
  import AuthForm from '$lib/components/AuthForm.svelte';
  import { dict } from '$lib/i18n';

  let { data, form } = $props();
  let t = $derived(dict(data.locale));
</script>

<AuthForm
  {t}
  title={t.auth.signInTitle}
  submitLabel={t.auth.signIn}
  altHref="/signup"
  altLabel={t.auth.toSignUp}
  error={form?.error ?? null}
/>
