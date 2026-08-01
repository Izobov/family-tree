<script lang="ts">
  import { icons, type IconName } from '$lib/icons';

  let {
    name,
    size = 20,
    label = null
  }: {
    name: IconName;
    size?: number;
    /**
     * Задавать только когда иконка — единственное содержимое кнопки или ссылки.
     * Если рядом есть видимый текст, оставляем null: иначе скринридер прочитает
     * подпись дважды.
     */
    label?: string | null;
  } = $props();
</script>

<svg
  viewBox="0 0 24 24"
  width={size}
  height={size}
  focusable="false"
  role={label ? 'img' : undefined}
  aria-label={label ?? undefined}
  aria-hidden={label ? undefined : 'true'}
>
  <path fill="currentColor" d={icons[name]} />
</svg>

<style>
  svg {
    flex: 0 0 auto;
    display: block;
  }
</style>
