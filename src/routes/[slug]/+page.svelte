<script lang="ts">
  import katexStylesheet from 'katex/dist/katex.min.css?url';
  import Comments from '$lib/components/Comments.svelte';
  import Meta from '$lib/components/Meta.svelte';
  import { theme } from '$lib/theme.svelte';

  let { data } = $props();

  let article: HTMLElement;

  $effect(() => {
    if (!data.hasMermaid) return;

    const mermaidTheme = theme.current === 'dark' ? 'dark' : 'neutral';
    const blocks = [...article.querySelectorAll<HTMLElement>('pre.mermaid')];
    for (const block of blocks) block.dataset.source ??= block.textContent ?? '';

    let stale = false;
    import('mermaid')
      .then(async ({ default: mermaid }) => {
        mermaid.initialize({ startOnLoad: false, theme: mermaidTheme, fontFamily: 'inherit' });
        for (const [index, block] of blocks.entries()) {
          const { svg } = await mermaid.render(`mermaid-${index}`, block.dataset.source ?? '');
          if (stale) return;
          block.innerHTML = svg;
        }
      })
      .catch((error: unknown) => console.error('Failed to render mermaid diagrams', error));

    return () => {
      stale = true;
    };
  });
</script>

<Meta
  title={data.post.title}
  description={data.post.description || undefined}
  path="/{data.post.slug}"
  type="article"
/>

<svelte:head>
  {#if data.hasMath}
    <link rel="stylesheet" href={katexStylesheet} />
  {/if}
</svelte:head>

<article bind:this={article}>
  <header>
    <h1>{data.post.title}</h1>
    <div class="meta">
      <time datetime={data.post.date}>{data.post.date}</time>
      {#each data.post.tags as tag (tag.slug)}
        <a href="/tags/{tag.slug}">#{tag.name}</a>
      {/each}
    </div>
  </header>

  <div class="prose">
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- HTML is rendered at build time from Markdown files in this repository -->
    {@html data.html}
  </div>
</article>

{#key data.post.slug}
  <Comments term={data.post.slug} />
{/key}

<style>
  header {
    margin-bottom: 2.5rem;
  }

  h1 {
    margin: 0 0 0.6rem;
    font-size: 1.6rem;
    line-height: 1.35;
    word-break: keep-all;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.8rem;
    color: var(--muted);
    font-size: 0.8rem;
  }

  .meta a {
    text-decoration: none;
  }

  .meta a:hover {
    color: var(--foreground);
  }
</style>
