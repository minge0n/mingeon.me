<script lang="ts">
  import Meta from '$lib/components/Meta.svelte';

  let { data } = $props();
</script>

<Meta title="태그" path="/tags" />

<h1>태그</h1>

{#if data.tags.length === 0}
  <p class="empty">아직 태그가 없습니다.</p>
{:else}
  <ul>
    {#each data.tags as tag (tag.slug)}
      <li>
        <a href="/tags/{tag.slug}">#{tag.name}</a>
        <span class="count">{tag.count}</span>
      </li>
    {/each}
  </ul>
{/if}

<style>
  h1 {
    margin: 0 0 2rem;
    font-size: 1.3rem;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;

    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1.4rem;
  }

  a {
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }

  .count,
  .empty {
    color: var(--muted);
    font-size: 0.8rem;
  }
</style>
