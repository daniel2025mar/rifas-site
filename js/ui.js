/**
 * PowerApps Sistemas — Componentes de UI reutilizáveis
 */

const UI = (() => {
  /** Toast notification */
  function toast(message, type = 'info', duration = 3200) {
    let host = document.getElementById('toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toast-host';
      host.className = 'toast-host';
      document.body.appendChild(host);
    }
    const el = document.createElement('div');
    el.className = `toast toast--${type} fade-in`;
    el.innerHTML = `<span>${escapeHtml(message)}</span>`;
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 280);
    }, duration);
  }

  /** Loading overlay */
  function showLoading(text = 'Carregando...') {
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'loading-overlay';
      overlay.className = 'loading-overlay';
      overlay.innerHTML = `
        <div class="loading-box">
          <div class="spinner"></div>
          <p class="loading-text">${escapeHtml(text)}</p>
        </div>`;
    } else {
      const label = overlay.querySelector('.loading-text');
      if (label) label.textContent = text;
    }
    // Garante que o overlay fique no topo do DOM (acima do modal)
    document.body.appendChild(overlay);
    overlay.classList.add('active');
  }

  function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('active');
  }

  /**
   * Modal elegante
   * @param {{ title: string, body: string|HTMLElement, actions?: Array<{label:string, className?:string, onClick:Function}>, onClose?: Function }} opts
   */
  function modal(opts) {
    closeModal();
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop fade-in';
    backdrop.id = 'app-modal';

    const dialog = document.createElement('div');
    dialog.className = `modal-dialog slide-up${opts.dialogClass ? ` ${opts.dialogClass}` : ''}`;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    const header = document.createElement('div');
    header.className = 'modal-header';
    header.innerHTML = `<h3>${escapeHtml(opts.title || '')}</h3>
      <button type="button" class="modal-close" aria-label="Fechar">&times;</button>`;

    const body = document.createElement('div');
    body.className = 'modal-body';
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);

    const actions = Array.isArray(opts.actions) ? opts.actions : [];
    let footer = null;
    if (actions.length) {
      footer = document.createElement('div');
      footer.className = 'modal-footer';
      actions.forEach((action) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `btn ${action.className || 'btn-primary'} ripple`;
        btn.textContent = action.label;
        btn.addEventListener('click', async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (btn.disabled) return;
          btn.disabled = true;
          try {
            await action.onClick(closeModal);
          } catch (err) {
            console.error(err);
            toast(err.message || 'Erro inesperado.', 'error');
          } finally {
            if (document.getElementById('app-modal')) btn.disabled = false;
          }
        });
        footer.appendChild(btn);
      });
    }

    dialog.appendChild(header);
    dialog.appendChild(body);
    if (footer) dialog.appendChild(footer);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    const fullNameInput = body.querySelector('#buyer-name, #account-name, #dev-account-name');
    if (fullNameInput) {
      (window.NomeCompleto || window.API)?.bindFullNameInput?.(fullNameInput);
    }

    requestAnimationFrame(() => backdrop.classList.add('show'));

    header.querySelector('.modal-close').addEventListener('click', () => {
      if (opts.onClose) opts.onClose();
      closeModal();
    });
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        if (opts.onClose) opts.onClose();
        closeModal();
      }
    });

    return { close: closeModal, body };
  }

  function closeModal() {
    const el = document.getElementById('app-modal');
    if (!el) return;
    el.classList.remove('show');
    setTimeout(() => el.remove(), 220);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Formata valor em BRL */
  function money(value) {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  /** Converte número → texto do input (R$ 10,00) */
  function moneyInputValue(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return '';
    return money(n);
  }

  /** Lê input mascarado e devolve número (centavos → reais) */
  function parseMoneyInput(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return NaN;
    return Number(digits) / 100;
  }

  /** Aplica máscara de moeda brasileira enquanto digita */
  function bindMoneyInput(input) {
    if (!input || input.dataset.moneyBound) return;
    input.dataset.moneyBound = '1';
    input.setAttribute('inputmode', 'numeric');
    input.setAttribute('autocomplete', 'off');

    const formatFromDigits = (raw) => {
      const digits = String(raw || '').replace(/\D/g, '').slice(0, 12);
      if (!digits) return '';
      return money(Number(digits) / 100);
    };

    // Se veio valor numérico puro (ex.: 10 ou 10.5), formata
    const initial = String(input.value || '').trim();
    if (initial && !initial.includes('R$')) {
      const asNumber = Number(initial.replace(',', '.'));
      if (Number.isFinite(asNumber)) input.value = moneyInputValue(asNumber);
      else input.value = formatFromDigits(initial);
    } else if (initial) {
      input.value = formatFromDigits(initial);
    }

    input.addEventListener('input', () => {
      input.value = formatFromDigits(input.value);
    });

    input.addEventListener('blur', () => {
      const parsed = parseMoneyInput(input.value);
      input.value = Number.isFinite(parsed) && parsed > 0 ? moneyInputValue(parsed) : '';
    });
  }

  function formatCpf(value) {
    const d = String(value || '').replace(/\D/g, '').slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }

  function formatPhoneBR(value) {
    const d = String(value || '').replace(/\D/g, '').slice(0, 11);
    if (!d) return '';
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }

  function formatEmail(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
  }

  function formatPixKeyByType(type, value) {
    const t = String(type || 'cpf').toLowerCase();
    if (t === 'telefone') return formatPhoneBR(value);
    if (t === 'email') return formatEmail(value);
    return formatCpf(value);
  }

  function validatePixKey(type, value) {
    const t = String(type || 'cpf').toLowerCase();
    const raw = String(value || '').trim();
    if (!raw) return { ok: false, error: 'Informe a chave PIX.' };
    if (t === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
        return { ok: false, error: 'Informe um e-mail válido.' };
      }
      return { ok: true, value: formatEmail(raw) };
    }
    const digits = raw.replace(/\D/g, '');
    if (t === 'telefone') {
      if (digits.length < 10 || digits.length > 11) {
        return { ok: false, error: 'Informe um telefone válido com DDD.' };
      }
      return { ok: true, value: formatPhoneBR(digits) };
    }
    if (digits.length !== 11) {
      return { ok: false, error: 'Informe um CPF válido com 11 dígitos.' };
    }
    return { ok: true, value: formatCpf(digits) };
  }

  /**
   * Select de tipo (cpf|telefone|email) + input da chave com máscara.
   */
  function bindPixKeyFields(typeSelect, keyInput) {
    if (!typeSelect || !keyInput || keyInput.dataset.pixBound) return;
    keyInput.dataset.pixBound = '1';

    const applyType = (clearValue) => {
      const type = String(typeSelect.value || 'cpf').toLowerCase();
      if (clearValue) keyInput.value = '';
      else keyInput.value = formatPixKeyByType(type, keyInput.value);

      if (type === 'email') {
        keyInput.setAttribute('inputmode', 'email');
        keyInput.setAttribute('type', 'email');
        keyInput.setAttribute('placeholder', 'seu@email.com');
        keyInput.setAttribute('maxlength', '120');
        keyInput.setAttribute('autocomplete', 'email');
      } else if (type === 'telefone') {
        keyInput.setAttribute('inputmode', 'tel');
        keyInput.setAttribute('type', 'tel');
        keyInput.setAttribute('placeholder', '(00) 00000-0000');
        keyInput.setAttribute('maxlength', '15');
        keyInput.setAttribute('autocomplete', 'tel');
      } else {
        keyInput.setAttribute('inputmode', 'numeric');
        keyInput.setAttribute('type', 'text');
        keyInput.setAttribute('placeholder', '000.000.000-00');
        keyInput.setAttribute('maxlength', '14');
        keyInput.setAttribute('autocomplete', 'off');
      }
    };

    applyType(false);

    typeSelect.addEventListener('change', () => applyType(true));
    keyInput.addEventListener('input', () => {
      const type = String(typeSelect.value || 'cpf').toLowerCase();
      if (type === 'email') {
        keyInput.value = formatEmail(keyInput.value);
        return;
      }
      keyInput.value = formatPixKeyByType(type, keyInput.value);
    });
  }

  /** Máscara pública: (**) *99999-**** */
  function maskPhone(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '(**) *-****';
    const local = digits.length >= 10 ? digits.slice(-9) : digits.slice(-Math.min(digits.length, 8));
    const shown = (local.slice(1, 6) || '*****').padEnd(5, '*');
    return `(**) *${shown}-****`;
  }

  /** Data ISO → BR */
  function formatDateBR(isoDate) {
    if (!isoDate) return '—';
    const [y, m, d] = isoDate.split('-');
    if (!d) return isoDate;
    return `${d}/${m}/${y}`;
  }

  /** Status label + class */
  function statusMeta(status) {
    const map = {
      disponivel: { label: 'Disponível', className: 'status-available' },
      reservado: { label: 'Reservado', className: 'status-reserved' },
      vendido: { label: 'Vendido', className: 'status-sold' }
    };
    return map[status] || map.disponivel;
  }

  /** Ripple effect em botões .ripple */
  function bindRipple(root = document) {
    root.querySelectorAll('.ripple').forEach((btn) => {
      if (btn.dataset.rippleBound) return;
      btn.dataset.rippleBound = '1';
      btn.addEventListener('click', function onRipple(e) {
        const rect = this.getBoundingClientRect();
        const circle = document.createElement('span');
        const size = Math.max(rect.width, rect.height);
        circle.className = 'ripple-circle';
        circle.style.width = `${size}px`;
        circle.style.height = `${size}px`;
        circle.style.left = `${e.clientX - rect.left - size / 2}px`;
        circle.style.top = `${e.clientY - rect.top - size / 2}px`;
        this.appendChild(circle);
        setTimeout(() => circle.remove(), 600);
      });
    });
  }

  /** Mesmo avatar padrão do painel do desenvolvedor (silhueta). */
  const DEFAULT_USER_AVATAR =
    'data:image/svg+xml,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="#111827"/><circle cx="48" cy="36" r="16" fill="#f8fafc"/><path d="M18 82c4-18 16-28 30-28s26 10 30 28" fill="#f8fafc"/></svg>`
    );

  function resolveUserAvatarSrc(photo) {
    if (window.PAS_AVATAR && typeof PAS_AVATAR.resolve === 'function') {
      return PAS_AVATAR.resolve(photo);
    }
    const v = String(photo || '').trim();
    return v || DEFAULT_USER_AVATAR;
  }

  /** Foto do banco ou avatar padrão (silhueta) quando não houver foto */
  function renderUserAvatar(session) {
    const avatarEl = document.getElementById('user-avatar');
    if (!avatarEl) return;

    const photo = String(session?.photo || '').trim();
    const src = resolveUserAvatarSrc(photo);

    avatarEl.setAttribute('data-has-photo', photo ? '1' : '0');
    avatarEl.replaceChildren();
    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    img.addEventListener(
      'error',
      () => {
        img.src = DEFAULT_USER_AVATAR;
      },
      { once: true }
    );
    avatarEl.appendChild(img);
  }

  /** Layout admin: sidebar + header */
  function initAppShell({ active } = {}) {
    const session = Store.getSession();
    const userName = session ? session.name : 'Visitante';
    const userEmail = session ? session.email : '';

    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const toggle = document.getElementById('menu-toggle');
    const userEl = document.getElementById('user-name');
    const emailEl = document.getElementById('user-email');

    if (userEl) {
      userEl.textContent = userName;
      userEl.title = userName;
    }
    if (emailEl) {
      emailEl.textContent = userEmail;
      emailEl.title = userEmail;
    }
    renderUserAvatar(session);

    document.querySelectorAll('[data-action="edit-account"]').forEach((btn) => {
      if (btn.dataset.accountBound) return;
      btn.dataset.accountBound = '1';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        // No celular a conta abre só pelo ícone Perfil do bottom nav
        const isMobileNav = window.matchMedia('(max-width: 1023px)').matches;
        if (isMobileNav && btn.classList.contains('sidebar__account')) return;
        openAccountModal();
      });
    });

    document.querySelectorAll('[data-nav]').forEach((link) => {
      if (link.getAttribute('data-nav') === active) link.classList.add('active');
    });

    function closeSidebar() {
      document.body.classList.remove('sidebar-open');
      if (sidebar) sidebar.classList.remove('open');
      if (overlay) overlay.classList.remove('show');
    }

    function openSidebar() {
      document.body.classList.add('sidebar-open');
      if (sidebar) sidebar.classList.add('open');
      if (overlay) overlay.classList.add('show');
    }

    const profileBtn = document.querySelector('[data-action="bottom-profile"]');
    if (profileBtn && !profileBtn.dataset.profileBound) {
      profileBtn.dataset.profileBound = '1';
      profileBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        profileBtn.classList.add('is-pressed');
        setTimeout(() => profileBtn.classList.remove('is-pressed'), 180);
        openAccountModal();
      });
    }

    document.querySelectorAll('.bottom-nav__item, .bottom-nav__fab').forEach((el) => {
      if (el.dataset.pressBound) return;
      el.dataset.pressBound = '1';
      el.addEventListener('pointerdown', () => {
        el.classList.add('is-pressed');
      });
      el.addEventListener('pointerup', () => {
        setTimeout(() => el.classList.remove('is-pressed'), 120);
      });
      el.addEventListener('pointerleave', () => el.classList.remove('is-pressed'));
      el.addEventListener('click', () => {
        el.classList.add('is-pressed');
        setTimeout(() => el.classList.remove('is-pressed'), 180);
      });
    });

    if (toggle) {
      toggle.addEventListener('click', () => {
        if (sidebar && sidebar.classList.contains('open')) closeSidebar();
        else openSidebar();
      });
    }
    if (overlay) overlay.addEventListener('click', closeSidebar);

    document.querySelectorAll('[data-action="logout"]').forEach((btn) => {
      if (btn.dataset.logoutBound) return;
      btn.dataset.logoutBound = '1';
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        UI.showLoading('Saindo...');
        try {
          await API.logout();
        } finally {
          UI.hideLoading();
          UI.toast('Sessão encerrada.', 'success');
          setTimeout(() => {
            window.location.href =
              typeof ProtecaoRota !== 'undefined' && ProtecaoRota.LOGIN_URL
                ? ProtecaoRota.LOGIN_URL
                : 'login.html';
          }, 350);
        }
      });
    });

    bindRipple();
  }

  async function fileToRawPhoto(file) {
    if (!file) return { ok: false, error: 'Selecione uma imagem.' };
    if (typeof API === 'undefined' || typeof API.uploadImage !== 'function') {
      return { ok: false, error: 'Upload indisponível.' };
    }
    const up = await API.uploadImage(file, { kind: 'avatar' });
    if (!up.ok) return up;
    return { ok: true, dataUrl: up.path || up.dataUrl };
  }

  function loadImageFromDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Falha ao processar a foto.'));
      img.src = dataUrl;
    });
  }

  /** Reduz imagens muito grandes antes do ajuste (mantém qualidade para crop). */
  async function normalizePhotoSource(dataUrl, maxSide = 1600) {
    const img = await loadImageFromDataUrl(dataUrl);
    let w = img.width;
    let h = img.height;
    if (w <= maxSide && h <= maxSide) {
      return { ok: true, dataUrl, width: w, height: h };
    }
    const ratio = Math.min(maxSide / w, maxSide / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    return { ok: true, dataUrl: canvas.toDataURL('image/jpeg', 0.92), width: w, height: h };
  }

  function exportSquareCrop(img, view, outputSize = 320) {
    const scale = view.baseScale * view.zoom;
    const srcSize = view.frameSize / scale;
    const srcX = img.width / 2 - view.offsetX / scale - srcSize / 2;
    const srcY = img.height / 2 - view.offsetY / scale - srcSize / 2;
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, outputSize, outputSize);
    ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, outputSize, outputSize);
    return canvas.toDataURL('image/jpeg', 0.86);
  }

  function openAccountModal() {
    const session = Store.getSession();
    if (!session) return;

    let pendingPhoto = String(session.photo || '').trim();
    let cameraStream = null;
    let cropImg = null;
    let cropView = {
      frameSize: 240,
      baseScale: 1,
      zoom: 1,
      offsetX: 0,
      offsetY: 0
    };
    let cropDragging = false;
    let cropLastX = 0;
    let cropLastY = 0;

    const body = document.createElement('div');
    body.className = 'account-form';
    body.innerHTML = `
      <div class="pas-profile-photo">
        <div class="pas-profile-photo__preview" id="account-photo-preview" aria-hidden="true"></div>
        <div class="pas-profile-photo__actions">
          <label class="btn btn-outline btn-sm ripple">
            Adicionar foto
            <input id="account-photo-input" type="file" accept="image/jpeg,image/png,image/webp" hidden>
          </label>
          <button type="button" class="btn btn-outline btn-sm ripple" id="account-photo-camera">Tirar foto</button>
          <button type="button" class="btn btn-ghost btn-sm" id="account-photo-remove">Remover</button>
        </div>
      </div>
      <div class="account-camera" id="account-camera" hidden>
        <p class="form-hint account-camera__hint">Permita o acesso à câmera para tirar sua foto.</p>
        <video id="account-camera-video" class="account-camera__video" playsinline autoplay muted></video>
        <div class="account-camera__actions">
          <button type="button" class="btn btn-ghost btn-sm" id="account-camera-cancel">Cancelar</button>
          <button type="button" class="btn btn-primary btn-sm" id="account-camera-capture">Capturar</button>
        </div>
      </div>
      <div class="account-crop" id="account-crop" hidden>
        <p class="form-hint account-crop__hint">Arraste para posicionar e use o zoom para enquadrar o rosto antes de confirmar.</p>
        <div class="account-crop__stage" id="account-crop-stage">
          <img id="account-crop-img" class="account-crop__img" alt="Ajuste da foto" draggable="false">
          <div class="account-crop__mask" aria-hidden="true"></div>
        </div>
        <label class="account-crop__zoom-label" for="account-crop-zoom">Zoom</label>
        <input id="account-crop-zoom" class="account-crop__zoom" type="range" min="100" max="300" value="100" step="1">
        <div class="account-crop__actions">
          <button type="button" class="btn btn-ghost btn-sm" id="account-crop-cancel">Cancelar</button>
          <button type="button" class="btn btn-primary btn-sm" id="account-crop-apply">Usar foto</button>
        </div>
      </div>
      <p class="form-hint" style="margin-bottom:0.85rem;">Atualize sua foto, nome ou senha. O e-mail não pode ser alterado.</p>
      <div class="form-group">
        <label for="account-name">Nome Completo</label>
        <input id="account-name" type="text" required value="${escapeHtml(session.name || '')}" autocomplete="name">
      </div>
      <div class="form-group">
        <label for="account-email">E-mail</label>
        <input id="account-email" type="email" value="${escapeHtml(session.email || '')}" readonly disabled>
      </div>
      <div class="form-group">
        <label for="account-current-password">Senha atual</label>
        <input id="account-current-password" type="password" placeholder="Obrigatória para trocar a senha" autocomplete="current-password">
      </div>
      <div class="form-grid form-grid--account-pass">
        <div class="form-group">
          <label for="account-new-password">Nova senha</label>
          <input id="account-new-password" type="password" placeholder="Mín. 6 caracteres" autocomplete="new-password">
        </div>
        <div class="form-group">
          <label for="account-confirm-password">Confirmar senha</label>
          <input id="account-confirm-password" type="password" placeholder="Repita a senha" autocomplete="new-password">
        </div>
      </div>
      <p id="account-error" class="form-error" hidden></p>`;

    function stopCamera() {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
        cameraStream = null;
      }
      const video = body.querySelector('#account-camera-video');
      if (video) video.srcObject = null;
      const panel = body.querySelector('#account-camera');
      if (panel) panel.hidden = true;
    }

    function hideCropPanel() {
      const panel = body.querySelector('#account-crop');
      if (panel) panel.hidden = true;
      cropImg = null;
      cropDragging = false;
    }

    function renderCropView() {
      const imgEl = body.querySelector('#account-crop-img');
      if (!imgEl || !cropImg) return;
      const scale = cropView.baseScale * cropView.zoom;
      const w = cropImg.width * scale;
      const h = cropImg.height * scale;
      imgEl.style.width = `${w}px`;
      imgEl.style.height = `${h}px`;
      imgEl.style.transform = `translate(calc(-50% + ${cropView.offsetX}px), calc(-50% + ${cropView.offsetY}px))`;
    }

    function clampCropOffset() {
      if (!cropImg) return;
      const scale = cropView.baseScale * cropView.zoom;
      const halfW = (cropImg.width * scale) / 2;
      const halfH = (cropImg.height * scale) / 2;
      const halfFrame = cropView.frameSize / 2;
      const maxX = Math.max(0, halfW - halfFrame);
      const maxY = Math.max(0, halfH - halfFrame);
      cropView.offsetX = Math.max(-maxX, Math.min(maxX, cropView.offsetX));
      cropView.offsetY = Math.max(-maxY, Math.min(maxY, cropView.offsetY));
    }

    async function openCropPanel(dataUrl) {
      stopCamera();
      const normalized = await normalizePhotoSource(dataUrl);
      if (!normalized.ok) throw new Error('Falha ao processar a foto.');
      cropImg = await loadImageFromDataUrl(normalized.dataUrl);
      const stage = body.querySelector('#account-crop-stage');
      const imgEl = body.querySelector('#account-crop-img');
      const zoomEl = body.querySelector('#account-crop-zoom');
      const panel = body.querySelector('#account-crop');
      if (!stage || !imgEl || !zoomEl || !panel) throw new Error('Ajuste de foto indisponível.');

      cropView.frameSize = Math.min(240, Math.max(180, stage.clientWidth || 240));
      cropView.baseScale = Math.max(
        cropView.frameSize / cropImg.width,
        cropView.frameSize / cropImg.height
      );
      cropView.zoom = 1;
      cropView.offsetX = 0;
      cropView.offsetY = 0;
      zoomEl.value = '100';
      imgEl.src = normalized.dataUrl;
      panel.hidden = false;
      clampCropOffset();
      renderCropView();
    }

    function setPreviewPhoto(src) {
      const preview = body.querySelector('#account-photo-preview');
      if (!preview) return;
      const photo = String(src || '').trim();
      const imgSrc = resolveUserAvatarSrc(photo);
      preview.replaceChildren();
      const img = document.createElement('img');
      img.src = imgSrc;
      img.alt = 'Foto de perfil';
      img.addEventListener(
        'error',
        () => {
          img.src = DEFAULT_USER_AVATAR;
        },
        { once: true }
      );
      preview.appendChild(img);
    }

    setPreviewPhoto(pendingPhoto);

    body.querySelector('#account-photo-input')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      showLoading('Carregando foto…');
      try {
        const result = await fileToRawPhoto(file);
        hideLoading();
        if (!result.ok) {
          toast(result.error || 'Falha na foto.', 'error');
          return;
        }
        await openCropPanel(result.dataUrl);
        toast('Ajuste o enquadramento e toque em Usar foto.', 'info');
      } catch (err) {
        hideLoading();
        hideCropPanel();
        toast(err.message || 'Falha na foto.', 'error');
      }
    });

    body.querySelector('#account-photo-remove')?.addEventListener('click', () => {
      stopCamera();
      hideCropPanel();
      pendingPhoto = '';
      setPreviewPhoto('');
    });

    body.querySelector('#account-photo-camera')?.addEventListener('click', async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast('Este dispositivo não permite usar a câmera pelo navegador.', 'error');
        return;
      }

      const panel = body.querySelector('#account-camera');
      const video = body.querySelector('#account-camera-video');
      if (!panel || !video) return;

      showLoading('Solicitando permissão da câmera…');
      try {
        hideCropPanel();
        stopCamera();
        cameraStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'user' },
            width: { ideal: 720 },
            height: { ideal: 720 }
          }
        });
        video.srcObject = cameraStream;
        await video.play().catch(() => {});
        panel.hidden = false;
        hideLoading();
        toast('Permissão concedida. Posicione-se e toque em Capturar.', 'success');
      } catch (err) {
        hideLoading();
        stopCamera();
        const denied =
          err?.name === 'NotAllowedError' ||
          err?.name === 'PermissionDeniedError' ||
          /permission|denied|notallowed/i.test(String(err?.message || ''));
        toast(
          denied
            ? 'Permissão da câmera negada. Autorize o acesso nas configurações do navegador.'
            : (err?.message || 'Não foi possível acessar a câmera.'),
          'error'
        );
      }
    });

    body.querySelector('#account-camera-cancel')?.addEventListener('click', () => {
      stopCamera();
    });

    body.querySelector('#account-camera-capture')?.addEventListener('click', async () => {
      const video = body.querySelector('#account-camera-video');
      if (!video || !cameraStream) {
        toast('Câmera não está ativa.', 'error');
        return;
      }
      const w = video.videoWidth || 480;
      const h = video.videoHeight || 480;
      if (!w || !h) {
        toast('Aguarde a câmera carregar e tente de novo.', 'error');
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      // Espelha como na prévia da câmera frontal
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, w, h);
      const raw = canvas.toDataURL('image/jpeg', 0.92);
      stopCamera();
      showLoading('Preparando ajuste…');
      try {
        await openCropPanel(raw);
        hideLoading();
        toast('Ajuste o enquadramento e toque em Usar foto.', 'info');
      } catch (err) {
        hideLoading();
        hideCropPanel();
        toast(err.message || 'Falha na foto.', 'error');
      }
    });

    const cropStage = body.querySelector('#account-crop-stage');
    const cropZoom = body.querySelector('#account-crop-zoom');

    function onCropPointerDown(clientX, clientY) {
      if (!cropImg) return;
      cropDragging = true;
      cropLastX = clientX;
      cropLastY = clientY;
    }

    function onCropPointerMove(clientX, clientY) {
      if (!cropDragging || !cropImg) return;
      cropView.offsetX += clientX - cropLastX;
      cropView.offsetY += clientY - cropLastY;
      cropLastX = clientX;
      cropLastY = clientY;
      clampCropOffset();
      renderCropView();
    }

    cropStage?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      cropStage.setPointerCapture?.(e.pointerId);
      onCropPointerDown(e.clientX, e.clientY);
    });
    cropStage?.addEventListener('pointermove', (e) => {
      onCropPointerMove(e.clientX, e.clientY);
    });
    cropStage?.addEventListener('pointerup', () => {
      cropDragging = false;
    });
    cropStage?.addEventListener('pointercancel', () => {
      cropDragging = false;
    });
    cropStage?.addEventListener(
      'touchmove',
      (e) => {
        if (cropDragging) e.preventDefault();
      },
      { passive: false }
    );

    cropZoom?.addEventListener('input', () => {
      if (!cropImg) return;
      cropView.zoom = Number(cropZoom.value || 100) / 100;
      clampCropOffset();
      renderCropView();
    });

    body.querySelector('#account-crop-cancel')?.addEventListener('click', () => {
      hideCropPanel();
    });

    body.querySelector('#account-crop-apply')?.addEventListener('click', () => {
      if (!cropImg) {
        toast('Nenhuma foto para ajustar.', 'error');
        return;
      }
      try {
        pendingPhoto = exportSquareCrop(cropImg, cropView, 320);
        setPreviewPhoto(pendingPhoto);
        hideCropPanel();
        toast('Foto ajustada. Toque em Salvar para confirmar.', 'success');
      } catch (err) {
        toast(err.message || 'Falha ao cortar a foto.', 'error');
      }
    });

    body.querySelector('#account-name')?.addEventListener('input', (e) => {
      if (!pendingPhoto) setPreviewPhoto('');
    });

    modal({
      title: 'Minha Conta',
      body,
      onClose: () => {
        stopCamera();
        hideCropPanel();
      },
      actions: [
        {
          label: 'Cancelar',
          className: 'btn-ghost',
          onClick: (c) => {
            stopCamera();
            hideCropPanel();
            c();
          }
        },
        {
          label: 'Salvar',
          className: 'btn-primary',
          onClick: async (c) => {
            const errorEl = body.querySelector('#account-error');
            const name = body.querySelector('#account-name')?.value || '';
            const currentPassword = body.querySelector('#account-current-password')?.value || '';
            const newPassword = body.querySelector('#account-new-password')?.value || '';
            const confirmPassword = body.querySelector('#account-confirm-password')?.value || '';

            const showErr = (msg) => {
              if (errorEl) {
                errorEl.textContent = msg;
                errorEl.hidden = false;
              }
              toast(msg, 'error');
            };

            if (!name.trim()) {
              showErr('Informe o nome completo.');
              return;
            }
            const nameCheck = (window.NomeCompleto || window.API)?.validateFullName?.(name);
            if (nameCheck && !nameCheck.ok) {
              showErr(nameCheck.error);
              return;
            }
            const nomeOk = nameCheck?.value || name.trim();
            if (newPassword || confirmPassword) {
              if (!currentPassword) {
                showErr('Informe a senha atual para redefinir.');
                return;
              }
              if (newPassword.length < 6) {
                showErr('A nova senha deve ter no mínimo 6 caracteres.');
                return;
              }
              if (newPassword !== confirmPassword) {
                showErr('As novas senhas não coincidem.');
                return;
              }
            }

            showLoading('Salvando...');
            try {
              const result = await API.updateProfile({
                name: nomeOk,
                currentPassword: newPassword ? currentPassword : '',
                newPassword: newPassword || '',
                photo: pendingPhoto
              });
              if (!result.ok) {
                showErr(result.error);
                return;
              }

              stopCamera();
              hideCropPanel();
              const userEl = document.getElementById('user-name');
              const emailEl = document.getElementById('user-email');
              if (userEl) {
                userEl.textContent = result.session.name;
                userEl.title = result.session.name || '';
              }
              if (emailEl) {
                emailEl.textContent = result.session.email;
                emailEl.title = result.session.email || '';
              }
              renderUserAvatar(result.session);

              c();
              toast(
                result.passwordChanged ? 'Perfil e senha atualizados.' : 'Perfil atualizado com sucesso.',
                'success'
              );
              if (result.needsSchema) {
                toast(
                  'Para persistir a foto, execute supabase/add_foto_perfil_usuarios.sql no Supabase.',
                  'info',
                  6000
                );
              }
            } catch (err) {
              showErr(err.message || 'Erro ao salvar.');
            } finally {
              hideLoading();
            }
          }
        }
      ]
    });
  }

  /** Formulário de comprador reutilizável */
  function buyerFormFields({ includeNumber = false, numberValue = '' } = {}) {
    return `
      <div class="form-grid">
        <div class="form-group">
          <label for="buyer-name">Nome Completo</label>
          <input id="buyer-name" type="text" required placeholder="Ex.: Daniel Antonio Martins" autocomplete="name">
        </div>
        <div class="form-group">
          <label for="buyer-phone">Telefone</label>
          <input id="buyer-phone" type="tel" required placeholder="(00) 00000-0000" autocomplete="tel">
        </div>
        <div class="form-group">
          <label for="buyer-city">Cidade</label>
          <input id="buyer-city" type="text" placeholder="Cidade" autocomplete="address-level2">
        </div>
        ${includeNumber ? `
        <div class="form-group">
          <label for="buyer-number">Número Escolhido</label>
          <input id="buyer-number" type="text" value="${escapeHtml(numberValue)}" readonly>
        </div>` : ''}
        <div class="form-group form-group--full">
          <label for="buyer-obs">Observação</label>
          <textarea id="buyer-obs" rows="2" placeholder="Opcional"></textarea>
        </div>
      </div>`;
  }

  function readBuyerForm() {
    const nameRaw = document.getElementById('buyer-name')?.value || '';
    const nameCheck = (window.NomeCompleto || window.API)?.validateFullName?.(nameRaw);
    return {
      name: nameCheck?.ok ? nameCheck.value : String(nameRaw || '').trim(),
      nameError: nameCheck && !nameCheck.ok ? nameCheck.error : (!String(nameRaw || '').trim() ? 'Informe o nome completo.' : null),
      phone: document.getElementById('buyer-phone')?.value || '',
      city: document.getElementById('buyer-city')?.value || '',
      observation: document.getElementById('buyer-obs')?.value || ''
    };
  }

  /**
   * Modal de sugestões/reclamações — envio pela API (e-mail do dest. só no servidor).
   */
  async function sendFeedbackEmail({
    subject,
    message,
    context = '',
    replyTo = '',
    senderName = ''
  } = {}) {
    if (typeof API === 'undefined' || typeof API.sendPublicFeedback !== 'function') {
      throw new Error('Cliente da API não carregou. Recarregue a página.');
    }
    const res = await API.sendPublicFeedback({
      subject,
      message,
      context,
      replyTo,
      senderName
    });
    if (!res?.ok) {
      throw new Error(res?.error || 'Não foi possível enviar a mensagem.');
    }
    return res;
  }

  function openFeedbackMailModal({ context = '' } = {}) {
    const body = document.createElement('div');
    body.className = 'feedback-modal';
    body.innerHTML = `
      <div class="feedback-modal__hero">
        <span class="feedback-modal__badge">PowerApps Sistemas</span>
        <h4>Fale conosco</h4>
        <p>Escreva sua sugestão ou reclamação. Enviamos direto para a equipe.</p>
      </div>
      <div class="feedback-modal__form">
        <div class="form-group">
          <label for="feedback-subject">Assunto</label>
          <input id="feedback-subject" type="text" maxlength="140"
            value="Sugestão ou reclamação" required>
        </div>
        <div class="form-group">
          <label for="feedback-message">Mensagem</label>
          <textarea id="feedback-message" rows="5" required
            placeholder="Digite sua mensagem..."></textarea>
        </div>
      </div>`;

    modal({
      title: 'Sugestões e reclamações',
      body,
      dialogClass: 'modal-dialog--feedback',
      actions: [
        { label: 'Cancelar', className: 'btn-ghost', onClick: (c) => c() },
        {
          label: 'Enviar',
          className: 'btn-primary',
          onClick: async (c) => {
            const subject = String(body.querySelector('#feedback-subject')?.value || '').trim();
            const message = String(body.querySelector('#feedback-message')?.value || '').trim();
            if (!subject) {
              toast('Informe o assunto.', 'error');
              return;
            }
            if (message.length < 5) {
              toast('Escreva sua mensagem (mínimo 5 caracteres).', 'error');
              return;
            }

            showLoading('Enviando...');
            try {
              await sendFeedbackEmail({
                subject,
                message,
                context,
                replyTo: '',
                senderName: ''
              });
              hideLoading();
              body.innerHTML = `
                <div class="feedback-modal__success">
                  <div class="feedback-modal__success-icon" aria-hidden="true">✓</div>
                  <h4>Mensagem enviada</h4>
                  <p>Recebemos sua mensagem. Obrigado pelo contato.</p>
                </div>`;
              const footer = document.querySelector('#app-modal .modal-footer');
              if (footer) {
                footer.innerHTML = '';
                const okBtn = document.createElement('button');
                okBtn.type = 'button';
                okBtn.className = 'btn btn-primary';
                okBtn.textContent = 'Fechar';
                okBtn.addEventListener('click', () => c());
                footer.appendChild(okBtn);
              }
              toast('Mensagem enviada com sucesso!', 'success');
            } catch (err) {
              hideLoading();
              const msg = err?.message || 'Erro ao enviar.';
              if (/confirm|activation|activate|verificar|confirma/i.test(msg)) {
                toast('Confirme o e-mail de ativação na sua caixa de entrada e tente de novo.', 'info');
              } else {
                toast(msg, 'error');
              }
            }
          }
        }
      ]
    });

    setTimeout(() => body.querySelector('#feedback-message')?.focus(), 50);
  }

  const RATING_AFTER_LOGIN_KEY = 'pas_show_rating';
  const RATING_SNOOZE_PREFIX = 'pas_rating_snooze_until_';
  const RATING_SNOOZE_DAYS = 5;

  function markSystemRatingAfterLogin() {
    try {
      sessionStorage.setItem(RATING_AFTER_LOGIN_KEY, '1');
    } catch {
      /* ignore */
    }
  }

  function hasPendingSystemRating() {
    try {
      return sessionStorage.getItem(RATING_AFTER_LOGIN_KEY) === '1';
    } catch {
      return false;
    }
  }

  function ratingSnoozeKey(userId) {
    return `${RATING_SNOOZE_PREFIX}${userId}`;
  }

  function snoozeSystemRating(userId, days = RATING_SNOOZE_DAYS) {
    if (!userId) return;
    try {
      const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      localStorage.setItem(ratingSnoozeKey(userId), until);
    } catch {
      /* ignore */
    }
  }

  function clearSystemRatingSnooze(userId) {
    if (!userId) return;
    try {
      localStorage.removeItem(ratingSnoozeKey(userId));
    } catch {
      /* ignore */
    }
  }

  function isSystemRatingSnoozed(userId) {
    if (!userId) return false;
    try {
      const until = localStorage.getItem(ratingSnoozeKey(userId));
      if (!until) return false;
      const ts = new Date(until).getTime();
      return Number.isFinite(ts) && ts > Date.now();
    } catch {
      return false;
    }
  }

  /** Já avaliou no Supabase ou está no intervalo de 5 dias após Cancelar. */
  async function canPromptSystemRating() {
    const session = typeof Store !== 'undefined' ? Store.getSession() : null;
    if (!session?.userId) return false;
    if (isSystemRatingSnoozed(session.userId)) return false;

    if (typeof API === 'undefined' || typeof API.getMySystemRating !== 'function') {
      return true;
    }

    try {
      const result = await API.getMySystemRating();
      if (result?.needsSchema) return false;
      if (result?.ok && result.rating) return false;
    } catch {
      /* se falhar a consulta, não força o modal */
      return false;
    }
    return true;
  }

  function isUiBlocked() {
    if (document.getElementById('app-modal')) return true;
    const loading = document.getElementById('loading-overlay');
    return !!(loading && loading.classList.contains('active'));
  }

  function maybeOpenSystemRatingAfterLogin() {
    if (!hasPendingSystemRating()) return;

    let attempts = 0;
    const tryOpen = async () => {
      attempts += 1;
      if (isUiBlocked()) {
        if (attempts < 80) setTimeout(tryOpen, 400);
        return;
      }

      try {
        sessionStorage.removeItem(RATING_AFTER_LOGIN_KEY);
      } catch {
        /* ignore */
      }

      const canShow = await canPromptSystemRating();
      if (!canShow) return;
      openSystemRatingModal({ context: 'Após login — Dashboard' });
    };

    setTimeout(tryOpen, 600);
  }

  function openSystemRatingModal({ context = '' } = {}) {
    const session = typeof Store !== 'undefined' ? Store.getSession() : null;
    if (!session?.userId) {
      toast('Faça login para avaliar o sistema.', 'info');
      return;
    }

    let stars = 0;
    const starLabels = {
      1: 'Ruim',
      2: 'Fraco',
      3: 'Regular',
      4: 'Bom',
      5: 'Excelente'
    };

    const body = document.createElement('div');
    body.className = 'rating-modal';
    body.innerHTML = `
      <div class="rating-modal__hero">
        <span class="rating-modal__badge">PowerApps Sistemas</span>
        <h4>Avalie o sistema</h4>
        <p>Escolha de 1 a 5 estrelas. Com 3 estrelas ou menos, conte o motivo para melhorarmos.</p>
      </div>
      <div class="rating-stars" role="radiogroup" aria-label="Nota de 1 a 5 estrelas">
        ${[1, 2, 3, 4, 5].map((n) => `
          <button type="button" class="rating-star" data-stars="${n}"
            role="radio" aria-checked="false" aria-label="${n} estrela${n > 1 ? 's' : ''}">
            <span class="rating-star__icon" aria-hidden="true">★</span>
          </button>`).join('')}
      </div>
      <p class="rating-stars__label" id="rating-stars-label">Toque nas estrelas para avaliar</p>
      <div class="form-group rating-modal__reason" id="rating-reason-wrap">
        <label for="rating-reason">Por que a nota foi baixa?</label>
        <textarea id="rating-reason" rows="4" maxlength="800"
          placeholder="Descreva o motivo..." disabled></textarea>
      </div>`;

    const reasonWrap = body.querySelector('#rating-reason-wrap');
    const reasonField = body.querySelector('#rating-reason');
    const labelEl = body.querySelector('#rating-stars-label');
    const starBtns = [...body.querySelectorAll('.rating-star')];

    function setStars(value) {
      stars = Number(value) || 0;
      starBtns.forEach((btn) => {
        const n = Number(btn.dataset.stars);
        const active = n <= stars;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-checked', n === stars ? 'true' : 'false');
      });
      if (labelEl) {
        labelEl.textContent = stars
          ? `${stars} estrela${stars > 1 ? 's' : ''} — ${starLabels[stars] || ''}`
          : 'Toque nas estrelas para avaliar';
      }
      const needsReason = stars >= 1 && stars <= 3;
      if (reasonField) {
        reasonField.disabled = !needsReason;
        if (!needsReason) reasonField.value = '';
      }
      if (reasonWrap) reasonWrap.classList.toggle('is-disabled', !needsReason);
      if (needsReason) setTimeout(() => reasonField?.focus(), 40);
    }

    starBtns.forEach((btn) => {
      btn.addEventListener('click', () => setStars(btn.dataset.stars));
    });

    modal({
      title: 'Avaliação do sistema',
      body,
      dialogClass: 'modal-dialog--rating',
      actions: [
        {
          label: 'Cancelar',
          className: 'btn-ghost',
          onClick: (c) => {
            snoozeSystemRating(session.userId, RATING_SNOOZE_DAYS);
            c();
          }
        },
        {
          label: 'Enviar avaliação',
          className: 'btn-primary',
          onClick: async (c) => {
            if (!stars) {
              toast('Escolha de 1 a 5 estrelas.', 'error');
              return;
            }
            const reason = String(reasonField?.value || '').trim();
            if (stars <= 3 && reason.length < 5) {
              toast('Descreva o motivo (mínimo 5 caracteres).', 'error');
              reasonField?.focus();
              return;
            }

            showLoading('Salvando avaliação...');
            try {
              const saved = await API.submitSystemRating({ stars, reason });
              if (!saved.ok) {
                hideLoading();
                if (saved.needsSchema) {
                  toast(saved.error || 'Tabela de avaliações ainda não está ativa no Supabase.', 'info');
                } else {
                  toast(saved.error || 'Não foi possível salvar.', 'error');
                }
                return;
              }

              clearSystemRatingSnooze(session.userId);

              try {
                await sendFeedbackEmail({
                  subject: `Avaliação do sistema: ${stars} estrela${stars > 1 ? 's' : ''}`,
                  message: stars <= 3
                    ? `Nota: ${stars} estrela${stars > 1 ? 's' : ''} (${starLabels[stars] || ''}).\n\nMotivo:\n${reason}`
                    : `Nota: ${stars} estrela${stars > 1 ? 's' : ''} (${starLabels[stars] || ''}).`,
                  context: [
                    context || 'Avaliação do sistema',
                    `Usuário: ${session.name || ''} (${session.email || ''})`,
                    `ID: ${session.userId}`
                  ].filter(Boolean).join(' | ')
                });
              } catch {
                /* avaliação já salva no banco */
              }

              hideLoading();
              body.innerHTML = `
                <div class="feedback-modal__success">
                  <div class="feedback-modal__success-icon" aria-hidden="true">✓</div>
                  <h4>Obrigado pela avaliação</h4>
                  <p>${stars <= 3
                    ? 'Recebemos seu feedback e vamos analisar com atenção.'
                    : `Você deu ${stars} estrela${stars > 1 ? 's' : ''}. Obrigado por avaliar o sistema.`}</p>
                </div>`;
              const footer = document.querySelector('#app-modal .modal-footer');
              if (footer) {
                footer.innerHTML = '';
                const okBtn = document.createElement('button');
                okBtn.type = 'button';
                okBtn.className = 'btn btn-primary';
                okBtn.textContent = 'Fechar';
                okBtn.addEventListener('click', () => c());
                footer.appendChild(okBtn);
              }
              toast('Avaliação enviada!', 'success');
              document.dispatchEvent(new CustomEvent('pas:rating-saved', { detail: saved.rating }));
            } catch (err) {
              hideLoading();
              toast(err?.message || 'Erro ao enviar avaliação.', 'error');
            }
          }
        }
      ]
    });
  }

  /**
   * Card de número
   * @param {object} slot
   * @param {{ clickable?: boolean, onlyAvailable?: boolean }} opts
   * onlyAvailable=true → comprador só clica em verdes
   */
  function numberCardHTML(slot, { clickable = false, onlyAvailable = false, maskPhone: hidePhone = false } = {}) {
    const meta = statusMeta(slot.status);
    const canClick = clickable && (!onlyAvailable || slot.status === 'disponivel');
    const phoneText = slot.buyerPhone
      ? (hidePhone ? maskPhone(slot.buyerPhone) : slot.buyerPhone)
      : '';
    return `
      <button type="button"
        class="number-card ${meta.className} ${canClick ? 'is-clickable' : ''}"
        data-number="${escapeHtml(slot.number)}"
        data-status="${slot.status}"
        ${canClick ? '' : 'disabled'}>
        <span class="number-card__num">${escapeHtml(slot.number)}</span>
        <span class="number-card__status">${meta.label}</span>
        ${slot.buyerName ? `<span class="number-card__buyer">${escapeHtml(slot.buyerName)}</span>` : ''}
        ${phoneText ? `<span class="number-card__meta">${escapeHtml(phoneText)}</span>` : ''}
        ${slot.date ? `<span class="number-card__meta">${escapeHtml(slot.date)} ${escapeHtml(slot.time || '')}</span>` : ''}
      </button>`;
  }

  return {
    toast,
    showLoading,
    hideLoading,
    modal,
    closeModal,
    escapeHtml,
    money,
    moneyInputValue,
    parseMoneyInput,
    bindMoneyInput,
    formatCpf,
    formatPhoneBR,
    formatEmail,
    formatPixKeyByType,
    validatePixKey,
    bindPixKeyFields,
    maskPhone,
    formatDateBR,
    statusMeta,
    bindRipple,
    initAppShell,
    openAccountModal,
    buyerFormFields,
    readBuyerForm,
    openFeedbackMailModal,
    markSystemRatingAfterLogin,
    hasPendingSystemRating,
    maybeOpenSystemRatingAfterLogin,
    openSystemRatingModal,
    numberCardHTML
  };
})();

window.UI = UI;

/** Bloqueia zoom por Ctrl+scroll e atalhos; não interfere na rolagem touch */
(function lockZoom() {
  const blockKeys = new Set(['+', '-', '=', '_']);
  document.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey) e.preventDefault();
    },
    { passive: false }
  );
  document.addEventListener(
    'keydown',
    (e) => {
      if ((e.ctrlKey || e.metaKey) && (blockKeys.has(e.key) || e.keyCode === 187 || e.keyCode === 189 || e.keyCode === 48)) {
        e.preventDefault();
      }
    },
    { passive: false }
  );
})();

document.addEventListener('DOMContentLoaded', () => {
  UI.bindRipple();
});
