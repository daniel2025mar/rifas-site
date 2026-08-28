/**
 * Offline guard — aparece automaticamente sem internet (mobile e desktop) + tenta reconectar
 */
(function () {
  const OVERLAY_ID = 'pas-offline-overlay';
  const CHECK_MS = 3000;
  const FAIL_BEFORE_SHOW = 1;
  let checking = false;
  let pollTimer = null;
  let failStreak = 0;

  function isOfflinePage() {
    return document.body && document.body.dataset && document.body.dataset.page === 'offline';
  }

  function assetUrl(file) {
    try {
      return new URL(file, window.location.href).href;
    } catch {
      return file;
    }
  }

  function ensureOverlay() {
    let el = document.getElementById(OVERLAY_ID);
    if (el) return el;

    el = document.createElement('div');
    el.id = OVERLAY_ID;
    el.className = 'pas-offline-overlay';
    el.hidden = true;
    el.setAttribute('role', 'alertdialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'pas-offline-title');
    el.setAttribute('aria-describedby', 'pas-offline-msg');
    el.innerHTML =
      '<div class="pas-offline-overlay__bg" aria-hidden="true">' +
      '<span class="pas-offline-overlay__orb pas-offline-overlay__orb--a"></span>' +
      '<span class="pas-offline-overlay__orb pas-offline-overlay__orb--b"></span>' +
      '<span class="pas-offline-overlay__grid"></span>' +
      '</div>' +
      '<div class="pas-offline-overlay__content">' +
      '<div class="pas-offline-overlay__logo-wrap">' +
      '<img class="pas-offline-overlay__logo" src="assets/Power2.png" alt="PowerApps" width="112" height="112">' +
      '</div>' +
      '<p class="pas-offline-overlay__brand">Power<span>Apps</span></p>' +
      '<p class="pas-offline-overlay__subtitle">Systems</p>' +
      '<div class="pas-offline-overlay__rule" aria-hidden="true"></div>' +
      '<h2 id="pas-offline-title" class="pas-offline-overlay__title">Sem internet</h2>' +
      '<div class="pas-offline-overlay__message">' +
      '<p class="pas-offline-overlay__msg" id="pas-offline-msg">O sistema está sem conexão no momento. Verifique sua rede e tente novamente.</p>' +
      '</div>' +
      '<button type="button" class="pas-offline-overlay__btn" id="pas-offline-retry">Tentar novamente</button>' +
      '</div>';
    document.body.appendChild(el);

    var retry = el.querySelector('#pas-offline-retry');
    if (retry) {
      retry.addEventListener('click', function () {
        tryReconnect(true);
      });
    }

    return el;
  }

  function setMsg(text) {
    var msg = document.getElementById('pas-offline-msg');
    if (msg) msg.textContent = text;
  }

  function setRetryBusy(busy) {
    var retry = document.getElementById('pas-offline-retry');
    if (!retry) return;
    retry.disabled = !!busy;
    retry.textContent = busy ? 'Conectando...' : 'Tentar novamente';
  }

  function showOffline() {
    if (isOfflinePage()) return;
    var el = ensureOverlay();
    el.hidden = false;
    document.documentElement.classList.add('pas-is-offline');
    setMsg('O sistema está sem conexão no momento. Verifique sua rede e tente novamente.');
    setRetryBusy(false);
  }

  function hideOffline() {
    failStreak = 0;
    var el = document.getElementById(OVERLAY_ID);
    if (el) el.hidden = true;
    document.documentElement.classList.remove('pas-is-offline');
    setRetryBusy(false);
  }

  function probeOnline() {
    if (!navigator.onLine) return Promise.resolve(false);
    var url = assetUrl('assets/Power2.png') + '?ping=' + Date.now();
    return fetch(url, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit'
    })
      .then(function (res) { return !!(res && res.ok); })
      .catch(function () { return false; });
  }

  function markOffline(force) {
    failStreak += 1;
    if (force || failStreak >= FAIL_BEFORE_SHOW || !navigator.onLine) {
      showOffline();
    }
  }

  function tryReconnect(fromButton) {
    if (checking) return;
    checking = true;
    if (fromButton) {
      setRetryBusy(true);
      setMsg('Tentando conectar novamente...');
    }

    probeOnline().then(function (ok) {
      checking = false;
      if (ok) {
        hideOffline();
        if (fromButton) window.location.reload();
        return;
      }
      markOffline(!!fromButton);
      if (fromButton) {
        setMsg('Ainda sem internet. Verifique a conexão e tente de novo.');
        setRetryBusy(false);
      }
    });
  }

  function sync() {
    if (!navigator.onLine) {
      failStreak = FAIL_BEFORE_SHOW;
      showOffline();
      return;
    }
    probeOnline().then(function (ok) {
      if (ok) hideOffline();
      else markOffline(false);
    });
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(function () {
      if (document.hidden) return;
      sync();
    }, CHECK_MS);
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    var path = (window.location.pathname || '/').toLowerCase();
    // Portal do desenvolvedor: sem SW (evita cache antigo de JS/CSS)
    if (/dev(-login)?\.html$/.test(path) || /\/dev\/?$/.test(path)) return;
    var base = path.endsWith('/') ? path : path.replace(/[^/]+$/, '');
    navigator.serviceWorker.register(base + 'sw.js').then(function (reg) {
      if (reg.update) reg.update().catch(function () {});
    }).catch(function () {});
  }

  function boot() {
    if (isOfflinePage()) {
      registerSW();
      return;
    }
    ensureOverlay();
    if (!navigator.onLine) {
      failStreak = FAIL_BEFORE_SHOW;
      showOffline();
    } else {
      probeOnline().then(function (ok) {
        if (ok) hideOffline();
        else markOffline(false);
      });
    }
    startPolling();
    registerSW();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.addEventListener('offline', function () {
    failStreak = FAIL_BEFORE_SHOW;
    showOffline();
  });
  window.addEventListener('online', function () {
    tryReconnect(false);
  });
  window.addEventListener('focus', function () {
    sync();
  });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) sync();
  });
})();
