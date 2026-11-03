<script lang="ts">
  import type { PostMeta } from '$lib/server/posts';

  let { posts }: { posts: Array<PostMeta> } = $props();
</script>

{#if posts.length === 0}
  <p class="empty">아직 글이 없습니다.</p>
{:else}
  <ul class="posts">
    {#each posts as post (post.slug)}
      <li>
        <time datetime={post.date}>{post.date}</time>
        <div>
          <a class="title" href="/{post.slug}">{post.title}</a>
          {#if post.description !== ''}
            <p class="description">{post.description}</p>
          {/if}
        </div>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .posts {
    list-style: none;
    margin: 0;
    padding: 0;

    display: flex;
    flex-direction: column;
    gap: 1.4rem;
  }

  li {
    display: grid;
    grid-template-columns: 6.5rem 1fr;
    gap: 1rem;
    align-items: baseline;
  }

  time {
    color: var(--muted);
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
  }

  .title {
    font-weight: 700;
    text-decoration: none;
    word-break: keep-all;
  }

  .title:hover {
    text-decoration: underline;
  }

  .description {
    margin: 0.2rem 0 0;
    color: var(--muted);
    font-size: 0.85rem;
    word-break: keep-all;
  }

  .empty {
    color: var(--muted);
  }

  @media (max-width: 480px) {
    li {
      grid-template-columns: 1fr;
      gap: 0.1rem;
    }
  }
</style>
