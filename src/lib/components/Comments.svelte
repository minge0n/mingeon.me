<script lang="ts">
  import { dev } from '$app/environment';
  import { giscus, site } from '$lib/site';
  import { theme } from '$lib/theme.svelte';
  import { untrack } from 'svelte';

  let { term }: { term: string } = $props();

  let container: HTMLDivElement;

  const giscusTheme = (): string => {
    if (dev) return theme.current === 'dark' ? 'noborder_dark' : 'noborder_light';

    return new URL(`/giscus/${theme.current}.css`, site.url).href;
  };

  $effect(() => {
    const script = document.createElement('script');
    script.src = 'https://giscus.app/client.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    Object.assign(script.dataset, {
      repo: giscus.repo,
      repoId: giscus.repoId,
      category: giscus.category,
      categoryId: giscus.categoryId,
      mapping: 'specific',
      term,
      strict: '1',
      reactionsEnabled: '1',
      emitMetadata: '0',
      inputPosition: 'top',
      lang: 'ko',
      loading: 'lazy',
      theme: untrack(giscusTheme),
    });
    container.replaceChildren(script);
  });

  $effect(() => {
    const nextTheme = giscusTheme();
    const frame = container.querySelector<HTMLIFrameElement>('iframe.giscus-frame');
    if (frame === null || frame.contentWindow === null) return;

    frame.contentWindow.postMessage({ giscus: { setConfig: { theme: nextTheme } } }, 'https://giscus.app');
  });
</script>

<div class="comments" bind:this={container}></div>

<style>
  .comments {
    margin-top: 4rem;
  }
</style>
