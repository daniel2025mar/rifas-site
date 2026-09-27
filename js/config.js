/**
 * PowerApps Sistemas — configuração do front
 *
 * ACTIVE_DATABASE: 'api' → Express + Postgres (Aiven)
 * API_BASE_URL: URL pública da API (Render/Fly/Railway). Em localhost usa 3001.
 */
(function () {
  const host = typeof location !== 'undefined' ? location.hostname : '';
  const isLocal =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '' ||
    host === '[::1]';

  window.PAS_CONFIG = Object.assign(
    {
      ACTIVE_DATABASE: 'api',
      /**
       * Defina a URL da API publicada (ex.: https://rifas-sistemas-api.onrender.com).
       * Em desenvolvimento local aponta para http://localhost:3001.
       */
      API_BASE_URL: isLocal
        ? 'http://localhost:3001'
        : 'https://rifas-sistemas-api.onrender.com',
      DEV_PORTAL: {
        // E-mail e senha NUNCA no front — login só via API (nivel_acesso no servidor)
        name: 'Desenvolvedor PowerApps'
      }
    },
    window.PAS_CONFIG || {}
  );
})();
