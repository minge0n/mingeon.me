<script lang="ts">
  import Meta from '$lib/components/Meta.svelte';
  import PostList from '$lib/components/PostList.svelte';

  let { data } = $props();
</script>

<Meta path="/" />

<PostList posts={data.posts} />
