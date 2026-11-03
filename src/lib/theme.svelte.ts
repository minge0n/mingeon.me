import { browser } from '$app/environment';

export type Theme = 'light' | 'dark';

const storageKey = 'theme';

let current = $state<Theme>(browser && document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

export const theme = {
  get current(): Theme {
    return current;
  },
};

function apply(next: Theme): void {
  current = next;
  document.documentElement.dataset.theme = next;
}

export function watchSystemTheme(): () => void {
  const systemDark = matchMedia('(prefers-color-scheme: dark)');
  const followSystem = (event: MediaQueryListEvent): void => {
    if (localStorage.getItem(storageKey) === null) apply(event.matches ? 'dark' : 'light');
  };
  systemDark.addEventListener('change', followSystem);

  return () => systemDark.removeEventListener('change', followSystem);
}

export function toggleTheme(): void {
  const next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem(storageKey, next);

  if (!('startViewTransition' in document)) {
    apply(next);

    return;
  }

  const root = document.documentElement;
  root.dataset.transition = 'theme';
  document.startViewTransition(() => apply(next)).finished.finally(() => root.removeAttribute('data-transition'));
}
