<script lang="ts">
  import IconMoon from '@tabler/icons-svelte-runes/icons/moon';
  import IconSun from '@tabler/icons-svelte-runes/icons/sun';
  import { onMount } from 'svelte';
  import { onNavigate } from '$app/navigation';
  import { watchSystemTheme, toggleTheme } from '$lib/theme.svelte';
  import { site } from '$lib/site';

  let { children } = $props();

  onMount(watchSystemTheme);

  onNavigate((navigation) => {
    if (!('startViewTransition' in document)) return;
    if (
      navigation.to !== null &&
      navigation.from !== null &&
      navigation.to.url.pathname === navigation.from.url.pathname
    ) {
      return;
    }

    return new Promise((resolve) => {
      document.startViewTransition(async () => {
        resolve();
        await navigation.complete;
      });
    });
  });
</script>

<div class="layout">
  <header>
    <div>
      <a class="name" href="/">{site.title}</a>
      <p class="description">{site.description}</p>
    </div>
    <nav>
      <a href="/tags">태그</a>
      <a href="/rss.xml">RSS</a>
      <button type="button" onclick={toggleTheme} aria-label="테마 바꾸기">
        <IconMoon class="to-dark" size={18} stroke={1.75} />
        <IconSun class="to-light" size={18} stroke={1.75} />
      </button>
    </nav>
  </header>

  <main>
    {@render children()}
  </main>

  <footer>
    <span>{site.email.replace('@', ' [at] ')}</span>
    <a href={site.github}>GitHub</a>
  </footer>
</div>

<svelte:head>
  <link rel="alternate" type="application/rss+xml" title={site.title} href="/rss.xml" />
</svelte:head>

<style>
  .layout {
    max-width: 800px;
    min-height: 100vh;
    margin: 0 auto;
    padding: 0 1.25rem;
    box-sizing: border-box;

    display: flex;
    flex-direction: column;
  }

  header {
    view-transition-name: site-header;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 2rem 0 3rem;
  }

  .name {
    font-weight: 700;
    text-decoration: none;
  }

  .description {
    margin: 0.1rem 0 0;
    color: var(--muted);
    font-size: 0.8rem;
  }

  nav {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-size: 0.8rem;
  }

  nav a {
    text-decoration: none;
    color: var(--muted);
  }

  nav a:hover {
    color: var(--foreground);
  }

  button {
    display: flex;
    padding: 0;
    border: 0;
    background: none;
    color: var(--muted);
    font: inherit;
    cursor: pointer;
  }

  button:hover {
    color: var(--foreground);
  }

  :global([data-theme='dark']) button :global(.to-dark),
  :global([data-theme='light']) button :global(.to-light) {
    display: none;
  }

  main {
    flex: 1;
  }

  footer {
    display: flex;
    gap: 1rem;
    padding: 4rem 0 2rem;
    color: var(--muted);
    font-size: 0.75rem;
  }
</style>
