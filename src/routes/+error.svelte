<script lang="ts">
  import { page } from '$app/stores';
</script>

<svelte:head>
  <title>{$page.status}</title>
</svelte:head>

<h1>{$page.status}</h1>
<p>{$page.error?.message}</p>
<p><a href="/">홈으로</a></p>

<style>
  h1 {
    margin: 0 0 0.5rem;
    font-size: 1.3rem;
  }

  p {
    color: var(--muted);
    font-size: 0.85rem;
  }
</style>
