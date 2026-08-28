/**
 * Tema claro / escuro — painel (manual) e rifa pública (sistema do dispositivo)
 * O sidebar permanece sempre escuro.
 */
const Theme = (() => {
  const KEY = 'pas_theme';
  let systemBound = false;

  const svg = (paths) =>
    `<svg class="nav-icon__svg" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

  const ICONS = {
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>'),
    moon: svg('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>')
  };

  function get() {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return 'light';
  }

  function systemMode() {
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  }

  function apply(theme) {
    const mode = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.style.colorScheme = mode;
    localStorage.setItem(KEY, mode);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', mode === 'dark' ? '#0c0c0e' : '#000000');
    syncButtons(mode);
    return mode;
  }

  /** Segue o tema do dispositivo sem gravar preferência do painel */
  function applySystem() {
    const mode = systemMode();
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.style.colorScheme = mode;
    return mode;
  }

  function followSystem() {
    applySystem();
    if (systemBound) return;
    systemBound = true;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (document.querySelector('.public-page')) applySystem();
    };
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange);
    else if (typeof mq.addListener === 'function') mq.addListener(onChange);
  }

  function toggle() {
    return apply(get() === 'dark' ? 'light' : 'dark');
  }

  function syncButtons(mode) {
    const isDark = mode === 'dark';
    document.querySelectorAll('[data-action="toggle-theme"], [data-dev-action="tema"]').forEach((btn) => {
      btn.setAttribute('aria-label', isDark ? 'Ativar tema claro' : 'Ativar tema escuro');
      btn.title = isDark ? 'Tema claro' : 'Tema escuro';
      const icon = btn.querySelector('.theme-icon');
      if (icon) icon.innerHTML = isDark ? ICONS.sun : ICONS.moon;
      const label = btn.querySelector('.theme-label');
      if (label) label.textContent = isDark ? 'Tema claro' : 'Tema escuro';
    });
  }

  function bind() {
    document.querySelectorAll('[data-action="toggle-theme"]').forEach((btn) => {
      if (btn.dataset.themeBound) return;
      btn.dataset.themeBound = '1';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        toggle();
      });
    });
    syncButtons(get());
  }

  function init() {
    // Auth e home ficam sempre no tema claro
    if (document.querySelector('.auth-page') || document.body?.dataset?.forceLight === '1') {
      document.documentElement.setAttribute('data-theme', 'light');
      return;
    }

    // Página de compartilhamento pública: tema do dispositivo
    const path = (window.location.pathname || '').toLowerCase();
    const params = new URLSearchParams(window.location.search);
    const isPublicShare = path.includes('compartilhar') && params.get('share') !== '1';
    if (isPublicShare) {
      followSystem();
      return;
    }

    apply(get());
    bind();
  }

  /** Item do menu lateral */
  function menuItemHTML() {
    const isDark = get() === 'dark';
    return `
      <a href="#" data-action="toggle-theme" data-nav="tema"
        aria-label="${isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}">
        <span class="nav-icon theme-icon">${isDark ? ICONS.sun : ICONS.moon}</span>
        <span class="theme-label">${isDark ? 'Tema claro' : 'Tema escuro'}</span>
      </a>`;
  }

  /** Item compacto para menu de perfil (portal / dropdown) */
  function profileMenuItemHTML() {
    const isDark = get() === 'dark';
    return `
      <button type="button" data-dev-action="tema"
        aria-label="${isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}">
        <span class="pas-admin__menu-ico theme-icon" aria-hidden="true">${isDark ? ICONS.sun : ICONS.moon}</span>
        <span class="theme-label">${isDark ? 'Tema claro' : 'Tema escuro'}</span>
      </button>`;
  }

  return {
    get,
    apply,
    applySystem,
    followSystem,
    systemMode,
    toggle,
    bind,
    init,
    syncButtons,
    menuItemHTML,
    profileMenuItemHTML,
    ICONS
  };
})();

window.Theme = Theme;

document.addEventListener('DOMContentLoaded', () => Theme.init());
