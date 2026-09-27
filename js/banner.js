/**
 * Banner de divulgação do sistema — modal ao abrir o painel
 * Dia dos Pais (BR): 2º domingo de agosto — arte e abertura só nessa data
 */
const SystemBanner = (() => {
  const SEEN_KEY = 'pas_promo_banner_seen_v4';
  const FORCE_FATHERS_KEY = 'pas_force_fathers_day';
  const RIFAS_BANNER_IMAGE = 'assets/banner-rifas.png?v=1';
  const POWERAPPS_BANNER_IMAGE = 'assets/banner-powerapps-sistemas.png?v=1';
  const DEFAULT_BANNER = {
    image: RIFAS_BANNER_IMAGE,
    images: [RIFAS_BANNER_IMAGE, POWERAPPS_BANNER_IMAGE],
    title: '',
    link: '',
    active: true
  };
  const FATHERS_DAY_BANNER = {
    image: 'assets/banner-dia-dos-pais.png?v=1',
    title: 'Feliz Dia dos Pais',
    link: '',
    active: true,
    seasonal: 'dia-dos-pais'
  };
  function isDeveloper(session) {
    if (!session) return false;
    if (typeof API !== 'undefined' && typeof API.isDeveloperAccount === 'function') {
      return !!API.isDeveloperAccount(session);
    }
    const nivel = String(session.nivelAcesso || session.nivel_acesso || '')
      .trim()
      .toLowerCase();
    return nivel === 'super_admin' || session.isDev === true || session.portal === 'dev';
  }

  /** 2º domingo de agosto (Dia dos Pais no Brasil) */
  function fathersDayDate(year) {
    const y = Number(year) || new Date().getFullYear();
    const aug1 = new Date(y, 7, 1);
    const weekday = aug1.getDay();
    const firstSunday = weekday === 0 ? 1 : (8 - weekday);
    return new Date(y, 7, firstSunday + 7);
  }

  function isSameLocalDay(a, b) {
    return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  }

  function isFathersDay(date = new Date()) {
    try {
      if (localStorage.getItem(FORCE_FATHERS_KEY) === '1') return true;
    } catch { /* ignore */ }
    const ref = date instanceof Date ? date : new Date();
    return isSameLocalDay(ref, fathersDayDate(ref.getFullYear()));
  }

  function bannerAssetKey(src) {
    return String(src || '')
      .split('?')[0]
      .replace(/^.*\//, '')
      .trim()
      .toLowerCase();
  }

  function isPowerAppsBusinessSrc(src) {
    const key = bannerAssetKey(src);
    return key === 'banner-powerapps-sistemas.png'
      || key === 'banner-divulgacao.png';
  }

  function isRifasBannerSrc(src) {
    return bannerAssetKey(src) === 'banner-rifas.png';
  }

  function collectImages(data) {
    if (!data) return [];
    if (data.seasonal === 'dia-dos-pais') {
      return data.image ? [data.image] : [];
    }

    const list = [];
    const pushUnique = (src) => {
      const value = String(src || '').trim();
      if (!value) return;
      const key = bannerAssetKey(value);
      if (!key) return;
      if (list.some((existing) => bannerAssetKey(existing) === key)) return;
      list.push(value);
    };

    // Sempre mostra o banner instrutivo de rifas no painel do usuário
    pushUnique(RIFAS_BANNER_IMAGE);

    if (Array.isArray(data.images)) {
      data.images.forEach(pushUnique);
    }
    pushUnique(data.image);

    if (!list.some(isPowerAppsBusinessSrc)) {
      pushUnique(POWERAPPS_BANNER_IMAGE);
    }

    // Garante a ordem: rifas → demais → PowerApps (divulgação)
    const rifas = list.filter(isRifasBannerSrc);
    const business = list.filter(isPowerAppsBusinessSrc);
    const others = list.filter((src) => !isRifasBannerSrc(src) && !isPowerAppsBusinessSrc(src));
    return [...rifas, ...others, ...business];
  }

  function resolveBanner(banner) {
    if (isFathersDay()) return { ...FATHERS_DAY_BANNER };
    if (banner?.active && banner?.image) {
      const img = String(banner.image || '');
      if (/banner-dia-dos-pais/i.test(img)) return { ...DEFAULT_BANNER };
      return banner;
    }
    return { ...DEFAULT_BANNER };
  }

  function fileToDataUrl(file, maxWidth = 1200, quality = 0.82) {
    return new Promise((resolve, reject) => {
      if (!file) {
        resolve('');
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Falha ao ler a imagem.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Imagem inválida.'));
        img.onload = () => {
          const scale = Math.min(1, maxWidth / Math.max(img.width, 1));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = String(reader.result || '');
      };
      reader.readAsDataURL(file);
    });
  }

  function probeImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('fail'));
      img.src = src;
    });
  }

  function open(banner, { markAsSeen = false } = {}) {
    const data = resolveBanner(banner);
    const images = collectImages(data);
    if (!images.length) return;
    if (data.seasonal === 'dia-dos-pais' && !isFathersDay()) return;

    probeImage(images[0]).then((imgProbe) => {
      if (isModalOpen() || isLoadingOpen()) {
        setTimeout(() => open(banner, { markAsSeen }), 450);
        return;
      }

      const w = imgProbe.naturalWidth || 1;
      const h = imgProbe.naturalHeight || 1;
      const ratio = w / h;
      let orient = 'is-square';
      if (ratio < 0.9) orient = 'is-portrait';
      else if (ratio > 1.2) orient = 'is-landscape';

      const vw = window.innerWidth || 360;
      const vh = window.innerHeight || 640;
      let dialogWidth;
      if (orient === 'is-portrait') {
        dialogWidth = Math.min(vw - 24, Math.max(300, 400));
      } else if (orient === 'is-landscape') {
        dialogWidth = Math.min(vw - 20, Math.min(680, Math.max(360, vh * 0.55 * ratio)));
      } else {
        dialogWidth = Math.min(vw - 20, 440);
      }

      const body = document.createElement('div');
      body.className = `promo-banner-modal ${orient}${images.length > 1 ? ' has-multiple' : ''}`;
      const title = data.title
        ? `<h4 class="promo-banner-modal__title">${UI.escapeHtml(data.title)}</h4>`
        : '';
      const linkBtn = data.link
        ? `<a class="btn btn-primary promo-banner-modal__cta" href="${UI.escapeHtml(data.link)}" target="_blank" rel="noopener">Saiba mais</a>`
        : '';
      const hint = images.length > 1
        ? '<p class="promo-banner-modal__hint">Deslize para o lado →</p>'
        : '';
      const slidesHtml = images.map((src, idx) => (
        `<div class="promo-banner-modal__slide" data-slide="${idx}">
          <img src="${UI.escapeHtml(src)}" alt="${UI.escapeHtml(data.title || `Divulgação PowerApps Sistemas ${idx + 1}`)}" draggable="false">
        </div>`
      )).join('');
      const dotsHtml = images.length > 1
        ? `<div class="promo-banner-modal__dots" role="tablist" aria-label="Banners">
            ${images.map((_, idx) => (
              `<button type="button" class="promo-banner-modal__dot${idx === 0 ? ' is-active' : ''}" data-dot="${idx}" aria-label="Banner ${idx + 1}"></button>`
            )).join('')}
          </div>`
        : '';
      const navHtml = images.length > 1
        ? `<div class="promo-banner-modal__nav">
            <button type="button" class="promo-banner-modal__nav-btn" data-nav="prev" aria-label="Banner anterior">‹</button>
            <button type="button" class="promo-banner-modal__nav-btn" data-nav="next" aria-label="Próximo banner">›</button>
          </div>`
        : '';

      body.innerHTML = `
        ${title}
        ${hint}
        <div class="promo-banner-modal__media">
          <div class="promo-banner-modal__track">
            ${slidesHtml}
          </div>
          ${navHtml}
        </div>
        ${dotsHtml}
        ${linkBtn}`;

      UI.modal({
        title: 'PowerApps Systems',
        body,
        dialogClass: `modal-dialog--promo-banner ${orient}`,
        actions: []
      });

      if (markAsSeen) markSeen();

      const dialog = document.querySelector('#app-modal .modal-dialog--promo-banner');
      if (dialog) {
        dialog.style.width = `${Math.round(dialogWidth)}px`;
        dialog.style.maxWidth = 'calc(100vw - 1rem)';
      }

      if (images.length > 1) {
        const track = body.querySelector('.promo-banner-modal__track');
        const dots = [...body.querySelectorAll('.promo-banner-modal__dot')];
        const setActive = (index) => {
          dots.forEach((dot, i) => dot.classList.toggle('is-active', i === index));
        };
        const goTo = (index) => {
          const slide = track?.children?.[index];
          if (!track || !slide) return;
          track.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' });
          setActive(index);
        };
        track?.addEventListener('scroll', () => {
          const width = track.clientWidth || 1;
          const index = Math.round(track.scrollLeft / width);
          setActive(Math.max(0, Math.min(images.length - 1, index)));
        }, { passive: true });
        dots.forEach((dot) => {
          dot.addEventListener('click', () => goTo(Number(dot.dataset.dot) || 0));
        });
        body.querySelector('[data-nav="prev"]')?.addEventListener('click', () => {
          const width = track?.clientWidth || 1;
          const current = Math.round((track?.scrollLeft || 0) / width);
          goTo(Math.max(0, current - 1));
        });
        body.querySelector('[data-nav="next"]')?.addEventListener('click', () => {
          const width = track?.clientWidth || 1;
          const current = Math.round((track?.scrollLeft || 0) / width);
          goTo(Math.min(images.length - 1, current + 1));
        });
      }
    }).catch(() => {
      UI.toast('Não foi possível carregar o banner.', 'error');
    });
  }

  function clearSeenKeys() {
    try {
      sessionStorage.removeItem(SEEN_KEY);
      sessionStorage.removeItem('pas_promo_banner_seen');
      sessionStorage.removeItem('pas_promo_banner_seen_v2');
      sessionStorage.removeItem('pas_promo_banner_seen_v3');
      sessionStorage.removeItem('pas_promo_banner_seen_v4');
      const keys = [];
      for (let i = 0; i < sessionStorage.length; i += 1) {
        const key = sessionStorage.key(i);
        if (key && /^pas_promo_banner_seen/i.test(key)) keys.push(key);
      }
      keys.forEach((key) => sessionStorage.removeItem(key));
    } catch { /* ignore */ }
  }

  function markSeen() {
    try {
      sessionStorage.setItem(seenKeyForToday(), '1');
    } catch { /* ignore */ }
  }

  function isSeen() {
    try {
      return sessionStorage.getItem(seenKeyForToday()) === '1';
    } catch {
      return false;
    }
  }

  function hasPendingRating() {
    try {
      return sessionStorage.getItem('pas_show_rating') === '1';
    } catch {
      return false;
    }
  }

  function hasPendingContribuicao() {
    try {
      return sessionStorage.getItem('pas_show_contribuicao') === '1';
    } catch {
      return false;
    }
  }

  function isModalOpen() {
    return !!document.getElementById('app-modal');
  }

  function isLoadingOpen() {
    const loading = document.getElementById('loading-overlay');
    return !!(loading && loading.classList.contains('active'));
  }

  function seenKeyForToday() {
    if (!isFathersDay()) return SEEN_KEY;
    const d = new Date();
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return `${SEEN_KEY}_dia_dos_pais_${ymd}`;
  }

  function waitUntilReady({ ignoreContribuicao = true } = {}) {
    return new Promise((resolve) => {
      let attempts = 0;
      let stable = 0;
      const tick = () => {
        attempts += 1;
        const busy = hasPendingRating()
          || isModalOpen()
          || isLoadingOpen()
          || (!ignoreContribuicao && hasPendingContribuicao());
        if (!busy) {
          stable += 1;
          if (stable >= 2) {
            resolve(true);
            return;
          }
        } else {
          stable = 0;
        }
        if (attempts >= 120) {
          resolve(false);
          return;
        }
        setTimeout(tick, 450);
      };
      setTimeout(tick, 500);
    });
  }

  async function maybeShowOnOpen() {
    if (isSeen()) return;

    // Avaliação pós-login e loading têm prioridade; banner abre quando a tela estiver livre
    await waitUntilReady({ ignoreContribuicao: true });
    if (isSeen()) return;
    if (hasPendingRating() || isModalOpen() || isLoadingOpen()) {
      setTimeout(maybeShowOnOpen, 700);
      return;
    }

    let banner = DEFAULT_BANNER;
    if (isFathersDay()) {
      banner = { ...FATHERS_DAY_BANNER };
    } else {
      try {
        const result = await API.getSystemBanner();
        if (result.ok && result.banner?.active && result.banner?.image) {
          banner = result.banner;
        }
      } catch (err) {
        console.warn('Banner do sistema indisponível, usando padrão.', err);
      }
      if (/banner-dia-dos-pais/i.test(String(banner.image || ''))) {
        banner = { ...DEFAULT_BANNER };
      }
    }

    if (!banner?.active || !banner?.image) {
      markSeen();
      return;
    }

    if (isModalOpen() || hasPendingRating() || isLoadingOpen()) {
      setTimeout(maybeShowOnOpen, 700);
      return;
    }

    open(banner, { markAsSeen: true });
  }

  return {
    open,
    maybeShowOnOpen,
    clearSeenKeys,
    isSeen,
    isDeveloper,
    isFathersDay,
    fathersDayDate,
    fileToDataUrl,
    DEFAULT_BANNER,
    FATHERS_DAY_BANNER,
    RIFAS_BANNER_IMAGE,
    POWERAPPS_BANNER_IMAGE,
    SEEN_KEY
  };
})();

window.SystemBanner = SystemBanner;
