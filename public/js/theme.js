(() => {
  const root = document.documentElement;
  const preferred = root.dataset.themePreference;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = () => { root.dataset.bsTheme = preferred === 'system' ? (media.matches ? 'dark' : 'light') : preferred === 'dark' ? 'dark' : 'light'; };
  apply();
  media.addEventListener('change', apply);
})();
