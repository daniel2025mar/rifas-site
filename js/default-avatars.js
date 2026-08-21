/**
 * Avatar padrão do PowerApps Sistemas
 * Usado quando usuarios.foto_perfil está vazio.
 */
(function () {
  const DEFAULT =
    'data:image/svg+xml,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="#111827"/><circle cx="48" cy="36" r="16" fill="#f8fafc"/><path d="M18 82c4-18 16-28 30-28s26 10 30 28" fill="#f8fafc"/></svg>`
    );

  function resolve(photo) {
    const v = String(photo || '').trim();
    return v || DEFAULT;
  }

  window.PAS_DEFAULT_AVATARS = [];
  window.PAS_AVATAR = {
    DEFAULT,
    list: [],
    resolve
  };
})();
