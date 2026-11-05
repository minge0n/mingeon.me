<script lang="ts">
  import katexStylesheet from 'katex/dist/katex.min.css?url';
  import Comments from '$lib/components/Comments.svelte';
  import Meta from '$lib/components/Meta.svelte';
  import TableOfContents from '$lib/components/TableOfContents.svelte';
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

<div class="post-layout">
  {#if data.toc.length > 0}
    <aside class="desktop-toc">
      <div class="toc-panel">
        <p class="toc-title">목차</p>
        <TableOfContents entries={data.toc} />
      </div>
    </aside>
  {/if}

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

    {#if data.toc.length > 0}
      <details class="mobile-toc">
        <summary>목차</summary>
        <div class="mobile-toc-links">
          <TableOfContents entries={data.toc} />
        </div>
      </details>
    {/if}

    <div class="prose">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- HTML is rendered at build time from Markdown files in this repository -->
      {@html data.html}
    </div>
  </article>
</div>

{#key data.post.slug}
  <Comments term={data.post.slug} />
{/key}

<style>
  .post-layout {
    position: relative;
  }

  .desktop-toc {
    display: none;
  }

  .mobile-toc {
    margin-bottom: 2rem;
    padding-block: 0.65rem;
    border-block: 1px solid var(--border);
  }

  .mobile-toc summary {
    min-height: 24px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 700;
  }

  .mobile-toc-links {
    max-height: 60dvh;
    overflow-y: auto;
    padding-top: 0.75rem;
    overscroll-behavior: contain;
  }

  @media (min-width: 1280px) {
    .mobile-toc {
      display: none;
    }

    .desktop-toc {
      display: block;
      position: absolute;
      inset-block: 0;
      left: calc(100% + 2rem);
      width: 12.5rem;
    }

    .toc-panel {
      position: sticky;
      top: 1.5rem;
      max-height: calc(100dvh - 3rem);
      overflow-y: auto;
      padding-left: 1rem;
      border-left: 1px solid var(--border);
      scrollbar-width: thin;
      overscroll-behavior: contain;
    }

    .toc-title {
      margin: 0 0 0.5rem;
      font-size: 0.75rem;
      font-weight: 700;
    }
  }
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
