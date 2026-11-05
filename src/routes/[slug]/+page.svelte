<script lang="ts">
  import katexStylesheet from 'katex/dist/katex.min.css?url';
  import Comments from '$lib/components/Comments.svelte';
  import Meta from '$lib/components/Meta.svelte';
  import TableOfContents from '$lib/components/TableOfContents.svelte';
  import { theme } from '$lib/theme.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let article = $state<HTMLElement>();
  let activeId = $state('');

  $effect(() => {
    const element = article;
    if (element === undefined) return;

    const headings = data.toc
      .flatMap((entry) => [entry, ...entry.children])
      .flatMap((entry) => {
        const heading = document.getElementById(entry.id);

        return heading !== null && element.contains(heading) ? [heading] : [];
      });
    let frame = 0;
    const updateReadingPosition = (): void => {
      frame = 0;
      let currentId = '';
      const readingLine = window.innerHeight * 0.25;
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top > readingLine + 1) break;
        currentId = heading.id;
      }
      const lastHeading = headings.at(-1);
      const atPageEnd =
        window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      if (atPageEnd && lastHeading !== undefined) currentId = lastHeading.id;
      activeId = currentId;
    };
    const scheduleUpdate = (): void => {
      if (frame === 0) frame = requestAnimationFrame(updateReadingPosition);
    };
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(element);
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    scheduleUpdate();

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      cancelAnimationFrame(frame);
    };
  });

  $effect(() => {
    if (!data.hasMermaid || article === undefined) return;

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
  imagePath={data.post.ogImage}
  publishedTime={data.post.date}
  tags={data.post.tags.map((tag) => tag.name)}
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
        <TableOfContents entries={data.toc} {activeId} />
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
          <TableOfContents entries={data.toc} {activeId} />
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

  .prose :global(h2),
  .prose :global(h3) {
    scroll-margin-top: 25vh;
  }

  .desktop-toc {
    display: none;
  }

  .mobile-toc {
    margin-bottom: 2rem;
    padding-block: 0.65rem;
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
      scrollbar-width: thin;
      overscroll-behavior: contain;
    }

    .toc-title {
      margin: 0 0 0.5rem 1rem;
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
