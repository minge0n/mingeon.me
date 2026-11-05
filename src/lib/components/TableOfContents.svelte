<script lang="ts">
  import type { TocEntry } from '$lib/server/markdown';

  let { entries }: { entries: Array<TocEntry> } = $props();
</script>

<nav aria-label="글 목차">
  <ul>
    {#each entries as entry (entry.id)}
      <li>
        <a href="#{entry.id}">{entry.title}</a>
        {#if entry.children.length > 0}
          <ul class="children">
            {#each entry.children as child (child.id)}
              <li><a href="#{child.id}">{child.title}</a></li>
            {/each}
          </ul>
        {/if}
      </li>
    {/each}
  </ul>
</nav>

<style>
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

  .children {
    margin: 0.2rem 0 0.35rem 0.35rem;
    padding-left: 0.7rem;
    border-left: 1px solid var(--border);
  }
</style>
