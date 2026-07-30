<script lang="ts">
  import AuthForm from '$lib/components/AuthForm.svelte';
  import { dict } from '$lib/i18n';

  let { data, form } = $props();
  let t = $derived(dict(data.locale));
</script>

<AuthForm
  {t}
  title={t.auth.signUpTitle}
  submitLabel={t.auth.signUp}
  altHref="/login"
  altLabel={t.auth.toSignIn}
  error={form?.error ?? null}
/>
