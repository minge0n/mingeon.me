<script lang="ts">
  let { children } = $props();
</script>

<div class="layout">
  {@render children()}
</div>

<svelte:head>
  <title>Mingeon Kim</title>
  <meta name="description" content="Software developer in Korea." />

  <!-- Facebook Meta Tags -->
  <meta property="og:url" content="https://mingeon.me" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Mingeon Kim" />
  <meta property="og:description" content="Software developer in Korea." />
  <meta property="og:image" content="/og.png" />

  <!-- Twitter Meta Tags -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta property="twitter:domain" content="mingeon.me" />
  <meta property="twitter:url" content="https://mingeon.me" />
  <meta name="twitter:title" content="Mingeon Kim" />
  <meta name="twitter:description" content="Software developer in Korea." />
  <meta name="twitter:image" content="/og.png" />
</svelte:head>

<style>
  .layout {
    width: 100%;
    height: 100%;
  }
</style>
