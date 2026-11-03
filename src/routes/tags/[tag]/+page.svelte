<script lang="ts">
  import Meta from '$lib/components/Meta.svelte';
  import PostList from '$lib/components/PostList.svelte';

  let { data } = $props();
</script>

<Meta title="#{data.tag.name}" path="/tags/{data.tag.slug}" />

<h1>#{data.tag.name}</h1>

<PostList posts={data.posts} />

<p class="all"><a href="/tags">모든 태그</a></p>

<style>
  h1 {
    margin: 0 0 2rem;
    font-size: 1.3rem;
  }

  .all {
    margin-top: 3rem;
    font-size: 0.8rem;
    color: var(--muted);
  }
</style>
