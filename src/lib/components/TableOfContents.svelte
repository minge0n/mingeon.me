<script lang="ts">
  import type { TocEntry } from '$lib/server/markdown';

  let { entries, activeId = '' }: { entries: Array<TocEntry>; activeId?: string } = $props();
  let navigation = $state<HTMLElement>();

  function isActiveBranch(entry: TocEntry): boolean {
    return entry.id === activeId || entry.children.some(isActiveBranch);
  }

  $effect(() => {
    const element = navigation;
    const currentId = activeId;
    if (element === undefined) return;

    const groups = [...element.querySelectorAll<HTMLElement>('.subsections')];
    const updateProgress = (): void => {
      const currentLink = [...element.querySelectorAll<HTMLAnchorElement>('a[href]')].find(
        (link) => link.getAttribute('href') === `#${currentId}`,
      );
      const bounds = element.getBoundingClientRect();
      const layoutMoving = groups.some((group) =>
        group.getAnimations().some((animation) => animation.playState === 'running'),
      );
      if (layoutMoving) element.style.setProperty('--toc-progress-duration', '0ms');
      else element.style.removeProperty('--toc-progress-duration');
      const progressHeight =
        currentLink === undefined
          ? 0
          : Math.max(0, Math.min(bounds.height, currentLink.getBoundingClientRect().bottom - bounds.top));
      element.style.setProperty('--toc-progress', `${progressHeight}px`);
    };
    const observer = new ResizeObserver(updateProgress);
    observer.observe(element);
    for (const group of groups) observer.observe(group);
    updateProgress();

    return () => observer.disconnect();
  });
</script>

{#snippet tocList(items: Array<TocEntry>, nested: boolean, visible: boolean)}
  <ul class:children={nested} inert={!visible} aria-hidden={visible ? undefined : true}>
    {#each items as entry (entry.id)}
      {@const expanded = isActiveBranch(entry)}
      <li>
        <a href="#{entry.id}" aria-current={activeId === entry.id ? 'location' : undefined}>{entry.title}</a>
        {#if entry.children.length > 0}
          <div class="subsections" class:expanded>
            {@render tocList(entry.children, true, expanded)}
          </div>
        {/if}
      </li>
    {/each}
  </ul>
{/snippet}

<nav bind:this={navigation} aria-label="글 목차">
  {@render tocList(entries, false, true)}
</nav>

<style>
  nav {
    position: relative;
    padding-left: 1rem;
    border-left: 1px solid var(--border);
  }

  nav::before {
    content: '';
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: -1px;
    width: 2px;
    height: var(--toc-progress, 0px);
    background: var(--foreground);
    pointer-events: none;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li + li {
    margin-top: 0.2rem;
  }

  a {
    display: block;
    padding-block: 0.25rem;
    color: var(--muted);
    font-size: 0.8rem;
    line-height: 1.5;
    text-decoration: none;
    overflow-wrap: anywhere;
  }

  a:hover,
  a:focus-visible {
    color: var(--foreground);
    text-decoration: underline;
  }

  a[aria-current='location'] {
    color: var(--foreground);
    font-weight: 700;
  }

  .subsections {
    display: grid;
    grid-template-rows: 0fr;
    opacity: 0;
    visibility: hidden;
  }

  .subsections.expanded {
    grid-template-rows: 1fr;
    opacity: 1;
    visibility: visible;
  }

  .children {
    min-height: 0;
    overflow: hidden;
    padding-left: 0.75rem;
  }

  .children li:first-child {
    margin-top: 0.15rem;
  }

  .children li:last-child {
    margin-bottom: 0.4rem;
  }

  .children a {
    font-size: 0.75rem;
  }

  @media (prefers-reduced-motion: no-preference) {
    nav::before {
      transition: height var(--toc-progress-duration, 160ms) cubic-bezier(0.2, 0, 0, 1);
    }

    a {
      transition: color 120ms ease-out;
    }

    .subsections {
      transition:
        grid-template-rows 180ms cubic-bezier(0.2, 0, 0, 1),
        opacity 120ms ease-out,
        visibility 180ms;
    }
  }
</style>
