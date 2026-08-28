/**
 * Rifas — criar, visualizar, vender, filtrar (Supabase)
 */

const RifaPage = (() => {
  let currentFilter = 'todas';
  let currentSearch = '';
  let raffleId = null;

  function fileToDataUrl(file, maxWidth = 1000, quality = 0.72) {
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

  async function prepareImageFile(file, kind = 'raffle') {
    if (typeof API !== 'undefined' && typeof API.uploadImage === 'function') {
      const up = await API.uploadImage(file, { kind });
      if (!up.ok) throw new Error(up.error || 'Falha no upload da imagem.');
      return up.path || up.dataUrl;
    }
    return fileToDataUrl(file);
  }

  function bindImageInput(inputId, previewId, onChange, root = document) {
    const input = root.querySelector(`#${inputId}`) || document.getElementById(inputId);
    const preview = root.querySelector(`#${previewId}`) || document.getElementById(previewId);
    if (!input || !preview) return;

    const nameEl = input.closest('.file-field')?.querySelector('.file-field__name');
    const setName = (file) => {
      if (!nameEl) return;
      nameEl.textContent = file ? file.name : 'Nenhuma foto selecionada';
      nameEl.classList.toggle('is-filled', !!file);
    };

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) {
        onChange('');
        preview.hidden = true;
        preview.querySelector('img')?.removeAttribute('src');
        setName(null);
        return;
      }
      try {
        UI.showLoading('Enviando imagem...');
        const ref = await prepareImageFile(file, 'raffle');
        UI.hideLoading();
        onChange(ref);
        preview.hidden = false;
        preview.querySelector('img').src = ref;
        setName(file);
      } catch (err) {
        UI.hideLoading();
        UI.toast(err.message || 'Erro ao carregar imagem.', 'error');
      }
    });
  }

  function fileFieldHTML(id, nameAttr = '') {
    const name = nameAttr ? ` name="${nameAttr}"` : '';
    return `
      <label class="file-field" for="${id}">
        <input id="${id}"${name} class="file-field__input" type="file" accept="image/*">
        <span class="file-field__btn">Escolher foto</span>
        <span class="file-field__name">Nenhuma foto selecionada</span>
      </label>`;
  }

  function purposeMeta(value) {
    if (typeof API !== 'undefined' && API.purposeMeta) return API.purposeMeta(value);
    const raw = String(value || 'beneficente').toLowerCase();
    if (raw === 'empresarial') return { key: 'empresarial', label: 'Empresarial', badge: 'SORTEIO EMPRESARIAL' };
    if (raw === 'outros') return { key: 'outros', label: 'Outros', badge: 'SORTEIO' };
    return { key: 'beneficente', label: 'Beneficente', badge: 'AÇÃO BENEFICENTE' };
  }

  function iconSVG(name) {
    const icons = {
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg>',
      gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8c-2.5-4-6-4-6-1.5S9.5 8 12 8c2.5-4 6-4 6-1.5S14.5 8 12 8z"/></svg>',
      palette: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a9 9 0 1 0 0 18h1.5a2.5 2.5 0 0 0 0-5H12"/><circle cx="7.5" cy="10" r="1"/><circle cx="10.5" cy="7.5" r="1"/><circle cx="14" cy="8" r="1"/><circle cx="16" cy="11" r="1"/></svg>',
      eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
      alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l9 16H3L12 3z"/><path d="M12 10v4M12 17h.01"/></svg>',
      user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5"/></svg>',
      pix: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 7l5-4 5 4v10l-5 4-5-4V7z"/><path d="M9 12h6"/></svg>',
      cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 18h11a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6-1.5A3.5 3.5 0 0 0 7 18z"/><path d="M12 14V9m0 0l-2.5 2.5M12 9l2.5 2.5"/></svg>',
      cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
      clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></svg>',
      hash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 9h14M5 15h14M9 4l-2 16M17 4l-2 16"/></svg>',
      money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5c.8-1 2-1.5 2.5-1.5s1.7.4 1.7 1.5-1 1.5-2.2 1.8-2.5.8-2.5 2.2 1.2 2 2.8 2 2.2-.7 2.7-1.7"/></svg>',
      stack: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8l8-4 8 4-8 4-8-4z"/><path d="M4 12l8 4 8-4M4 16l8 4 8-4"/></svg>',
      arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
      heart: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7-4.4-9.5-8.5C.5 9.2 2.2 5.5 6 5.5c2 0 3.4 1.2 4 2.2.6-1 2-2.2 4-2.2 3.8 0 5.5 3.7 3.5 7C19 16.6 12 21 12 21z"/></svg>',
      tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 12l-8 8-9-9V3h8l9 9z"/><circle cx="7.5" cy="7.5" r="1.2"/></svg>',
      grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
      save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>'
    };
    return icons[name] || '';
  }

  function sectionTitle(icon, text) {
    return `<h2 class="rc-card__title"><span class="rc-card__icon" aria-hidden="true">${iconSVG(icon)}</span>${text}</h2>`;
  }

  function inputWithIcon(icon, inputHtml) {
    return `<div class="rc-input-icon"><span class="rc-input-icon__ico" aria-hidden="true">${iconSVG(icon)}</span>${inputHtml}</div>`;
  }

  function dropzoneHTML(id, nameAttr = '', label = 'Clique ou arraste a imagem aqui') {
    const name = nameAttr ? ` name="${nameAttr}"` : '';
    return `
      <label class="rc-dropzone" for="${id}">
        <input id="${id}"${name} class="rc-dropzone__input" type="file" accept="image/png,image/jpeg,image/jpg">
        <span class="rc-dropzone__icon" aria-hidden="true">${iconSVG('cloud')}</span>
        <span class="rc-dropzone__text">${label}. <em>PNG, JPG ou JPEG (máx. 5MB)</em></span>
        <span class="rc-dropzone__name" id="${id}-name"></span>
      </label>`;
  }

  async function initCreate() {
    const session = await Layout.render({ active: 'nova-rifa', title: 'Cadastro da Rifa' });
    if (!session) return;

    if (typeof API !== 'undefined' && API.isFreePlan?.(session)) {
      try {
        const limitCheck = await API.checkRaffleCreateLimit(session);
        if (!limitCheck?.ok && limitCheck?.reason === 'free-limit') {
          Layout.setContent(
            typeof Layout.novaRifaLimitedPageHTML === 'function'
              ? Layout.novaRifaLimitedPageHTML()
              : '<p>Limite do plano Free: apenas 1 rifa. Torne-se Pro para criar mais.</p>'
          );

          const unlockAndReload = async () => {
            if (typeof Layout.syncPaymentLock === 'function') {
              await Layout.syncPaymentLock({ toast: false });
            } else if (typeof API.refreshPaymentProfile === 'function') {
              await API.refreshPaymentProfile();
            }
            const next = Store.getSession();
            if (!API.isFreePlan?.(next)) {
              window.location.reload();
            }
          };

          document.addEventListener('pas:payment-approved', unlockAndReload);
          document.addEventListener('pas:live-update', async (event) => {
            const source = event.detail?.source;
            if (source === 'usuarios' || source === 'notificacoes') {
              await unlockAndReload();
            }
          });
          return;
        }
      } catch (err) {
        console.warn('checkRaffleCreateLimit', err);
      }
    }

    Layout.setContent(`
      <div class="raffle-create slide-up">
        <div class="raffle-create__top">
          <div class="raffle-create__heading">
            <h1 class="raffle-create__title">Cadastro da Rifa</h1>
            <p class="raffle-create__subtitle raffle-create__subtitle--desk">
              Preencha as informações abaixo para criar sua rifa. Você pode usar para ações beneficentes,
              sorteios com clientes, colaboradores ou campanhas promocionais.
            </p>
            <p class="raffle-create__subtitle raffle-create__subtitle--mobile">
              Preencha os dados para criar sua rifa.
            </p>
          </div>
          <div class="raffle-create__actions">
            <a class="btn btn-outline raffle-btn-cancel" href="minhas-rifas.html">Cancelar</a>
            <button class="btn btn-primary raffle-btn-save" type="submit" form="raffle-form" id="btn-save-raffle">
              <span aria-hidden="true">${iconSVG('save')}</span>
              Salvar Rifa
            </button>
          </div>
        </div>

        <form id="raffle-form" class="raffle-create__layout" novalidate>
          <div class="raffle-create__main">
            <section class="rc-card">
              ${sectionTitle('info', 'INFORMAÇÕES GERAIS')}
              <div class="raffle-fields">
                <div class="raffle-fields__row">
                  <div class="form-group">
                    <label for="name"><span id="name-label-text">Título da Rifa</span> <span class="rc-req">*</span></label>
                    <input id="name" name="name" type="text" required maxlength="120"
                      placeholder="Ex.: Ação Maria Beneficente — Rifa para cirurgia">
                  </div>
                  <div class="form-group">
                    <label for="raffleType">Tipo de Rifa <span class="rc-req">*</span></label>
                    <select id="raffleType" name="raffleType">
                      <option value="">Selecione o tipo</option>
                      <option value="publica">Pública</option>
                      <option value="interna">Interna</option>
                      <option value="promocional">Promocional</option>
                    </select>
                  </div>
                </div>
                <div class="raffle-fields__row raffle-fields__row--purpose">
                  <div class="form-group">
                    <span class="field-label">Finalidade <span class="rc-req">*</span></span>
                    <p class="form-hint purpose-hint">Beneficente: ações sociais (ex.: rifa para cirurgia ou tratamento). Empresarial: sorteios para colaboradores ou clientes da empresa.</p>
                    <div class="purpose-radios" role="radiogroup" aria-label="Finalidade da rifa">
                      <label class="purpose-radio">
                        <input type="radio" name="purpose" value="beneficente" checked>
                        <span>Beneficente</span>
                      </label>
                      <label class="purpose-radio">
                        <input type="radio" name="purpose" value="empresarial">
                        <span>Empresarial</span>
                      </label>
                      <label class="purpose-radio">
                        <input type="radio" name="purpose" value="outros">
                        <span>Outros</span>
                      </label>
                    </div>
                  </div>
                  <div class="form-group">
                    <label class="field-label" for="segment">Segmento / Uso <span class="rc-req" id="segment-req" hidden>*</span></label>
                    <select id="segment" name="segment" disabled>
                      <option value="">Selecione...</option>
                      <option value="Clientes">Clientes</option>
                      <option value="Colaboradores">Colaboradores</option>
                    </select>
                  </div>
                </div>
                <div class="form-group">
                  <label for="description">Descrição da Rifa <span class="rc-req">*</span></label>
                  <textarea id="description" name="description" required maxlength="300" rows="4"
                    placeholder="Conte aqui o objetivo da rifa..."></textarea>
                  <div class="raffle-counter"><span id="desc-count">0</span>/300</div>
                </div>
              </div>
            </section>

            <section class="rc-card">
              ${sectionTitle('gift', 'DETALHES DO SORTEIO')}
              <div class="raffle-fields">
                <div class="form-group">
                  <label for="prize">Prêmio <span class="rc-req">*</span></label>
                  <input id="prize" name="prize" type="text" required placeholder="Ex.: Cesta de Chocolates">
                </div>
                <div class="form-group">
                  <label for="image">Imagem do Prêmio</label>
                  ${dropzoneHTML('image', 'image')}
                  <div id="image-preview" class="image-preview raffle-image-preview" hidden>
                    <img alt="Pré-visualização do prêmio">
                  </div>
                </div>
                <div class="raffle-fields__row">
                  <div class="form-group">
                    <label for="drawDate">Data do Sorteio <span class="rc-req">*</span></label>
                    ${inputWithIcon('cal', '<input id="drawDate" name="drawDate" type="date" required>')}
                  </div>
                  <div class="form-group">
                    <label for="drawTime">Hora do Sorteio</label>
                    ${inputWithIcon('clock', '<input id="drawTime" name="drawTime" type="time" required>')}
                  </div>
                </div>
                <div class="raffle-fields__row raffle-fields__row--3">
                  <div class="form-group">
                    <label for="quantity">Quantidade de Números <span class="rc-req">*</span></label>
                    ${inputWithIcon('hash', '<input id="quantity" name="quantity" type="number" min="1" max="10000" required placeholder="Ex.: 100">')}
                  </div>
                  <div class="form-group">
                    <label for="price">Valor por Número (R$) <span class="rc-req" id="price-req">*</span></label>
                    ${inputWithIcon('money', '<input id="price" name="price" type="text" inputmode="numeric" required placeholder="R$ 0,00">')}
                    <p class="form-hint rc-hint" id="price-hint">Obrigatório em rifas beneficentes.</p>
                  </div>
                  <div class="form-group">
                    <label for="winnersCount">Quantidade de Sorteios</label>
                    ${inputWithIcon('stack', '<input id="winnersCount" name="winnersCount" type="number" min="1" max="50" value="1" required>')}
                  </div>
                </div>
              </div>
            </section>

            <section class="rc-card" id="panel-benefit">
              ${sectionTitle('user', 'BENEFICIÁRIO')}
              <div class="raffle-fields">
                <div class="form-group">
                  <label for="benefitImage">Foto do beneficiário</label>
                  ${dropzoneHTML('benefitImage', 'benefitImage', 'Clique ou arraste a foto aqui')}
                  <div id="benefit-preview" class="image-preview raffle-image-preview" hidden>
                    <img alt="Pré-visualização do beneficiário">
                  </div>
                </div>
              </div>
            </section>

            <section class="rc-card" id="panel-pix">
              ${sectionTitle('pix', 'PIX PARA RECEBER')}
              <p class="form-hint rc-hint">Obrigatório em rifas beneficentes.</p>
              <div class="raffle-fields__row">
                <div class="form-group">
                  <label for="pixName">Nome do favorecido</label>
                  <input id="pixName" name="pixName" type="text" placeholder="Como aparece no banco">
                </div>
                <div class="form-group">
                  <label for="pixBank">Banco</label>
                  <input id="pixBank" name="pixBank" type="text" placeholder="Ex.: Nubank, Inter">
                </div>
              </div>
              <div class="raffle-fields__row">
                <div class="form-group">
                  <label for="pixType">Tipo da chave</label>
                  <select id="pixType" name="pixType">
                    <option value="cpf">CPF</option>
                    <option value="telefone">Telefone</option>
                    <option value="email">E-mail</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="pixKey">Chave PIX</label>
                  <input id="pixKey" name="pixKey" type="text" placeholder="000.000.000-00">
                </div>
              </div>
            </section>

            <section class="rc-card">
              ${sectionTitle('palette', 'PERSONALIZAÇÕES')}
              <div class="raffle-fields__row">
                <div class="form-group">
                  <label for="colorPrimary">Cor Principal</label>
                  <div class="raffle-color">
                    <input id="colorPrimary" name="colorPrimary" type="color" value="#E50914">
                    <input id="colorPrimaryHex" type="text" value="#E50914" maxlength="7" aria-label="Hex cor principal">
                  </div>
                </div>
                <div class="form-group">
                  <label for="colorSecondary">Cor Secundária</label>
                  <div class="raffle-color">
                    <input id="colorSecondary" name="colorSecondary" type="color" value="#000000">
                    <input id="colorSecondaryHex" type="text" value="#000000" maxlength="7" aria-label="Hex cor secundária">
                  </div>
                </div>
              </div>
              <div class="form-group" style="margin-top:.75rem;">
                <label for="bgImage">Imagem de Fundo (Opcional)</label>
                ${dropzoneHTML('bgImage', 'bgImage', 'Clique ou arraste a imagem de fundo')}
                <div id="bg-preview" class="image-preview raffle-image-preview" hidden>
                  <img alt="Pré-visualização do fundo">
                </div>
              </div>
            </section>

            <p id="form-error" class="form-error" hidden></p>
          </div>

          <aside class="raffle-create__side">
            <section class="rc-card">
              ${sectionTitle('eye', 'PRÉ-VISUALIZAÇÃO DA RIFA')}
              <div class="raffle-mock" id="raffle-live-preview">
                <div class="raffle-mock__head">
                  <div class="raffle-mock__brand">
                    <img src="assets/logo.png" alt="" width="22" height="22">
                    <span>POWERAPPS SISTEMAS</span>
                  </div>
                  <h3 class="raffle-mock__title" id="preview-title">TÍTULO DA RIFA</h3>
                  <p class="raffle-mock__desc" id="preview-desc">Descrição da rifa aparecerá aqui para o público.</p>
                  <span class="raffle-mock__badge" id="preview-badge">AÇÃO BENEFICENTE</span>
                </div>
                <div class="raffle-mock__media" id="preview-media">
                  <span>Sem imagem</span>
                  <div class="raffle-mock__stats">
                    <div>
                      <span><i aria-hidden="true">${iconSVG('cal')}</i> Sorteio</span>
                      <strong id="preview-date">--/--/----</strong>
                    </div>
                    <div>
                      <span><i aria-hidden="true">${iconSVG('tag')}</i> Valor</span>
                      <strong id="preview-price">R$ 0,00</strong>
                    </div>
                    <div>
                      <span><i aria-hidden="true">${iconSVG('grid')}</i> Números</span>
                      <strong id="preview-qty">0 disponíveis</strong>
                    </div>
                  </div>
                </div>
                <div class="raffle-mock__prize">
                  <span>PRÊMIO</span>
                  <strong id="preview-prize">Prêmio</strong>
                </div>
                <p class="raffle-mock__footer">
                  <span id="preview-footer">Participe e ajude essa causa! Boa sorte!</span>
                  <i class="raffle-mock__heart" aria-hidden="true">${iconSVG('heart')}</i>
                </p>
              </div>
            </section>

            <section class="rc-card raffle-info-box">
              ${sectionTitle('alert', 'INFORMAÇÕES IMPORTANTES')}
              <ul class="raffle-info-list">
                <li><span class="raffle-info-list__icon" aria-hidden="true">${iconSVG('arrow')}</span><span>A rifa fica disponível para venda logo após a criação.</span></li>
                <li><span class="raffle-info-list__icon" aria-hidden="true">${iconSVG('arrow')}</span><span>Você pode editar as informações enquanto não houver vendas.</span></li>
                <li><span class="raffle-info-list__icon" aria-hidden="true">${iconSVG('arrow')}</span><span>Após o sorteio, os dados não poderão ser editados.</span></li>
              </ul>
            </section>
          </aside>
        </form>
      </div>
    `);

    const form = document.getElementById('raffle-form');
    let imageData = '';
    let benefitData = '';
    let bgData = '';

    function bindDropzone(inputId, previewId, onChange) {
      const input = document.getElementById(inputId);
      const preview = document.getElementById(previewId);
      const nameEl = document.getElementById(`${inputId}-name`);
      if (!input) return;
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) {
          onChange('');
          if (preview) {
            preview.hidden = true;
            preview.querySelector('img')?.removeAttribute('src');
          }
          if (nameEl) nameEl.textContent = '';
          return;
        }
        try {
          UI.showLoading('Enviando imagem...');
          const ref = await prepareImageFile(file, 'raffle');
          UI.hideLoading();
          onChange(ref);
          if (preview) {
            preview.hidden = false;
            preview.querySelector('img').src = ref;
          }
          if (nameEl) nameEl.textContent = file.name;
          refreshPreview();
        } catch (err) {
          UI.hideLoading();
          UI.toast(err.message || 'Erro ao carregar imagem.', 'error');
        }
      });
    }

    bindDropzone('image', 'image-preview', (v) => { imageData = v; });
    bindDropzone('benefitImage', 'benefit-preview', (v) => { benefitData = v; });
    bindDropzone('bgImage', 'bg-preview', (v) => { bgData = v; });
    UI.bindMoneyInput(form?.price);
    UI.bindPixKeyFields(form?.pixType, form?.pixKey);

    function syncColorInputs(colorId, hexId) {
      const color = document.getElementById(colorId);
      const hex = document.getElementById(hexId);
      if (!color || !hex) return;
      color.addEventListener('input', () => {
        hex.value = String(color.value || '').toUpperCase();
        refreshPreview();
      });
      hex.addEventListener('change', () => {
        const val = String(hex.value || '').trim();
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
          color.value = val;
          refreshPreview();
        }
      });
    }
    syncColorInputs('colorPrimary', 'colorPrimaryHex');
    syncColorInputs('colorSecondary', 'colorSecondaryHex');

    function getPurpose() {
      return form.querySelector('input[name="purpose"]:checked')?.value || 'beneficente';
    }

    function syncPurposePanels() {
      const purpose = getPurpose();
      const pixPanel = document.getElementById('panel-pix');
      const benefitPanel = document.getElementById('panel-benefit');
      const pixRequired = purpose === 'beneficente';
      const priceRequired = purpose === 'beneficente';
      if (pixPanel) pixPanel.hidden = purpose === 'empresarial';
      if (benefitPanel) benefitPanel.hidden = purpose !== 'beneficente';
      if (form.pixKey) form.pixKey.required = pixRequired;
      if (form.pixType) form.pixType.required = pixRequired;
      if (form.price) form.price.required = priceRequired;
      const priceReq = document.getElementById('price-req');
      const priceHint = document.getElementById('price-hint');
      if (priceReq) priceReq.hidden = !priceRequired;
      if (priceHint) {
        priceHint.textContent = priceRequired
          ? 'Obrigatório em rifas beneficentes.'
          : 'Opcional em rifas empresariais.';
      }

      const segmentEnabled = purpose === 'empresarial';
      if (form.segment) {
        form.segment.disabled = !segmentEnabled;
        form.segment.required = segmentEnabled;
        if (!segmentEnabled) form.segment.value = '';
      }
      const segmentReq = document.getElementById('segment-req');
      if (segmentReq) segmentReq.hidden = !segmentEnabled;

      const nameLabel = document.getElementById('name-label-text');
      if (nameLabel) {
        nameLabel.textContent = purpose === 'empresarial' ? 'Nome da Campanha' : 'Título da Rifa';
      }
      if (form.name) {
        form.name.placeholder = purpose === 'empresarial'
          ? 'Ex.: Campanha de Incentivo - Clientes'
          : purpose === 'outros'
            ? 'Ex.: Título da sua rifa'
            : 'Ex.: Rifa Beneficente - Cirurgia do João';
      }

      const footer = document.getElementById('preview-footer');
      if (footer) {
        footer.textContent = purpose === 'empresarial'
          ? 'Participe do sorteio! Boa sorte!'
          : 'Participe e ajude essa causa! Boa sorte!';
      }
      refreshPreview();
    }

    function refreshPreview() {
      const meta = purposeMeta(getPurpose());
      const titleFallback = getPurpose() === 'empresarial' ? 'NOME DA CAMPANHA' : 'TÍTULO DA RIFA';
      const title = String(form.name?.value || '').trim().toUpperCase() || titleFallback;
      const desc = String(form.description?.value || '').trim() || 'Descrição da rifa aparecerá aqui para o público.';
      const prize = String(form.prize?.value || '').trim() || 'Prêmio';
      const qty = Number(form.quantity?.value || 0) || 0;
      const price = UI.parseMoneyInput(form.price?.value);
      const date = form.drawDate?.value ? UI.formatDateBR(form.drawDate.value) : '--/--/----';
      const time = form.drawTime?.value || '';
      const primary = document.getElementById('colorPrimary')?.value || '#E50914';
      const mock = document.getElementById('raffle-live-preview');
      if (mock) mock.style.setProperty('--mock-primary', primary);

      const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
      };
      setText('preview-title', title);
      setText('preview-desc', desc);
      setText('preview-badge', meta.badge);
      setText('preview-date', time ? `${date} às ${time}` : date);
      setText('preview-price', `${UI.money(Number.isFinite(price) ? price : 0)} por número`);
      setText('preview-qty', `${qty} disponíveis`);
      setText('preview-prize', prize);

      const mediaEl = document.getElementById('preview-media');
      if (mediaEl) {
        const placeholder = mediaEl.querySelector(':scope > span');
        if (imageData) {
          mediaEl.style.backgroundImage = `url('${imageData}')`;
          mediaEl.classList.add('has-image');
          if (placeholder) placeholder.hidden = true;
        } else {
          mediaEl.style.backgroundImage = '';
          mediaEl.classList.remove('has-image');
          if (placeholder) {
            placeholder.hidden = false;
            placeholder.textContent = 'Sem imagem';
          }
        }
      }
    }

    form.querySelectorAll('input[name="purpose"]').forEach((el) => {
      el.addEventListener('change', syncPurposePanels);
    });
    ['name', 'prize', 'quantity', 'price', 'drawDate', 'drawTime', 'description'].forEach((id) => {
      form.querySelector(`#${id}`)?.addEventListener('input', () => {
        if (id === 'description') {
          const count = document.getElementById('desc-count');
          if (count) count.textContent = String(form.description.value || '').length;
        }
        refreshPreview();
      });
    });

    syncPurposePanels();
    refreshPreview();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById('form-error');
      errorEl.hidden = true;

      const purpose = getPurpose();
      const rawPrice = UI.parseMoneyInput(form.price.value);
      const priceValue = Number.isFinite(rawPrice) ? rawPrice : 0;
      const pixType = form.pixType?.value || 'cpf';
      const pixRaw = form.pixKey?.value || '';
      const pixCheck = purpose === 'empresarial'
        ? { ok: true, value: '' }
        : (purpose === 'beneficente' || String(pixRaw).trim()
          ? UI.validatePixKey(pixType, pixRaw)
          : { ok: true, value: '' });

      const data = {
        name: form.name.value,
        description: form.description.value,
        prize: form.prize.value,
        price: priceValue,
        quantity: form.quantity.value,
        winnersCount: form.winnersCount?.value || 1,
        raffleType: form.raffleType?.value || '',
        drawDate: form.drawDate.value,
        drawTime: form.drawTime.value,
        purpose,
        segment: purpose === 'empresarial' ? (form.segment?.value || '') : '',
        colorPrimary: form.colorPrimary?.value || '#E50914',
        colorSecondary: form.colorSecondary?.value || '#000000',
        pixName: form.pixName?.value || '',
        pixBank: form.pixBank?.value || '',
        pixType,
        pixKey: pixCheck.ok ? pixCheck.value : pixRaw,
        image: imageData,
        benefitImage: purpose === 'beneficente' ? benefitData : '',
        bgImage: bgData
      };

      if (!data.name || !data.description || !data.prize || !data.quantity || !data.drawDate || !data.drawTime) {
        errorEl.textContent = 'Preencha todos os campos obrigatorios.';
        errorEl.hidden = false;
        return;
      }

      if (purpose === 'beneficente' && !pixCheck.ok) {
        errorEl.textContent = pixCheck.error || 'Informe a chave PIX.';
        errorEl.hidden = false;
        return;
      }

      if (purpose === 'empresarial' && !['Clientes', 'Colaboradores'].includes(String(data.segment || '').trim())) {
        errorEl.textContent = 'Selecione o segmento: Clientes ou Colaboradores.';
        errorEl.hidden = false;
        return;
      }

      if (purpose === 'beneficente') {
        if (!Number.isFinite(rawPrice) || rawPrice <= 0) {
          errorEl.textContent = 'Em rifa beneficente, informe um valor por numero maior que zero.';
          errorEl.hidden = false;
          return;
        }
      } else if (String(form.price?.value || '').trim() && (!Number.isFinite(rawPrice) || rawPrice < 0)) {
        errorEl.textContent = 'Informe um valor por numero valido.';
        errorEl.hidden = false;
        return;
      }

      if (Number(data.quantity) < 1) {
        errorEl.textContent = 'A quantidade deve ser maior que zero.';
        errorEl.hidden = false;
        return;
      }

      UI.showLoading('Salvando...');
      try {
        const result = await createRaffle(data);
        UI.hideLoading();
        if (!result.ok) {
          errorEl.textContent = result.error;
          errorEl.hidden = false;
          UI.toast(result.error, result.needsSchema ? 'info' : 'error');
          return;
        }
        UI.toast('Rifa criada com sucesso!', 'success');
        setTimeout(() => {
          if (typeof Layout !== 'undefined' && typeof Layout.go === 'function') {
            Layout.go(`visualizar-rifa.html?id=${result.raffle.id}`);
          } else {
            window.location.href = `visualizar-rifa.html?id=${result.raffle.id}`;
          }
        }, 400);
      } catch (err) {
        UI.hideLoading();
        errorEl.textContent = err.message || 'Erro ao criar rifa.';
        errorEl.hidden = false;
        UI.toast(errorEl.textContent, 'error');
      }
    });
  }

  async function initView() {
    const session = await Layout.render({ active: 'minhas-rifas', title: 'Visualizar Rifa' });
    if (!session) return;

    const params = new URLSearchParams(window.location.search);
    raffleId = params.get('id');

    UI.showLoading('Carregando rifa...');
    try {
      const result = await API.getRaffle(raffleId);
      UI.hideLoading();
      const raffle = result?.raffle;
      const isOwner =
        result?.ok &&
        raffle &&
        (typeof API.isRaffleOwner === 'function'
          ? API.isRaffleOwner(raffle, session.userId)
          : String(raffle.ownerId) === String(session.userId));

      if (!result.ok || !raffle || !isOwner) {
        Layout.setContent(`
          <div class="card empty-state">
            <h3>Rifa não encontrada</h3>
            <p>${UI.escapeHtml(result?.error || 'Verifique o link ou volte para Minhas Rifas.')}</p>
            <a class="btn btn-primary ripple" href="minhas-rifas.html" style="margin-top:1rem;">Minhas Rifas</a>
          </div>`);
        return;
      }
      await renderView();
    } catch (err) {
      UI.hideLoading();
      UI.toast(err.message || 'Erro ao carregar rifa.', 'error');
    }
  }

  function getFilteredNumbers(raffle) {
    let list = filterNumbers(raffle.numbers, currentFilter);
    const q = currentSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((n) =>
        n.number.includes(q) ||
        (n.buyerName || '').toLowerCase().includes(q) ||
        (n.buyerPhone || '').includes(q)
      );
    }
    return list;
  }

  async function renderView() {
    const result = await API.getRaffle(raffleId);
    if (!result.ok) {
      UI.toast(result.error, 'error');
      return;
    }
    const raffle = result.raffle;
    const stats = calculateStatistics([raffle]);
    const numbers = getFilteredNumbers(raffle);

    Layout.setContent(`
      <div class="slide-up">
        <div class="detail-header">
          <div>
            <span class="badge">Rifa #${raffle.id} · ${String(raffle.status || 'ativa')}</span>
            <h1 class="page-title" style="margin-top:.5rem;">${UI.escapeHtml(raffle.name)}</h1>
            <p class="page-subtitle">${UI.escapeHtml(raffle.description)}</p>
            <div class="raffle-card__meta" style="margin-top:.75rem;">
              <span>Prêmio: ${UI.escapeHtml(raffle.prize)}</span>
              <span>${UI.money(raffle.price)} / número</span>
              <span>Sorteio: ${UI.formatDateBR(raffle.drawDate)} às ${UI.escapeHtml(raffle.drawTime)}</span>
            </div>
            ${(raffle.image || raffle.benefitImage) ? `
              <div class="raffle-photos" style="margin-top:1rem;">
                ${raffle.image ? `
                  <figure class="raffle-photo">
                    <img src="${UI.escapeHtml(raffle.image)}" alt="Foto do sorteio">
                    <figcaption>Foto do sorteio</figcaption>
                  </figure>` : ''}
                ${raffle.benefitImage ? `
                  <figure class="raffle-photo">
                    <img src="${UI.escapeHtml(raffle.benefitImage)}" alt="Beneficiário">
                    <figcaption>Beneficiário</figcaption>
                  </figure>` : ''}
              </div>` : ''}
          </div>
        </div>

        <div class="stats-grid">
          <div class="card stat-card"><div class="stat-card__label">Vendidos</div><div class="stat-card__value">${stats.sold}</div></div>
          <div class="card stat-card"><div class="stat-card__label">Reservados</div><div class="stat-card__value">${stats.reserved}</div></div>
          <div class="card stat-card"><div class="stat-card__label">Disponíveis</div><div class="stat-card__value">${stats.available}</div></div>
          <div class="card stat-card"><div class="stat-card__label">Arrecadado</div><div class="stat-card__value stat-card__value--money">${UI.money(stats.raised)}</div></div>
        </div>

        <div class="toolbar">
          <div class="search-box">
            <input id="number-search" type="search" placeholder="Pesquisar número, nome ou telefone..." value="${UI.escapeHtml(currentSearch)}">
          </div>
          <div class="filters" id="filters">
            ${[['todas', 'Todas'], ['disponiveis', 'Disponíveis'], ['reservadas', 'Reservadas'], ['vendidas', 'Vendidas']]
              .map(([id, label]) => `<button type="button" class="filter-chip ${currentFilter === id ? 'active' : ''}" data-filter="${id}">${label}</button>`)
              .join('')}
          </div>
        </div>

        <div class="legend">
          <span><i class="lg-available"></i> Disponível</span>
          <span><i class="lg-reserved"></i> Reservado</span>
          <span><i class="lg-sold"></i> Vendido</span>
        </div>

        <div class="numbers-grid" id="numbers-grid">
          ${numbers.map((n) => UI.numberCardHTML(n, { clickable: true })).join('') || '<div class="empty-state" style="grid-column:1/-1;">Nenhum número neste filtro.</div>'}
        </div>
      </div>
    `);

    document.getElementById('filters')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-filter]');
      if (!btn) return;
      currentFilter = btn.dataset.filter;
      await renderView();
    });

    const search = document.getElementById('number-search');
    search?.addEventListener('input', () => {
      currentSearch = search.value;
      const grid = document.getElementById('numbers-grid');
      const list = getFilteredNumbers(Store.getRaffleById(raffleId));
      if (grid) {
        grid.innerHTML = list.map((n) => UI.numberCardHTML(n, { clickable: true })).join('') ||
          '<div class="empty-state" style="grid-column:1/-1;">Nenhum número neste filtro.</div>';
        bindNumberClicks();
      }
    });

    bindNumberClicks();
  }

  function bindNumberClicks() {
    document.querySelectorAll('.number-card[data-number]').forEach((card) => {
      card.addEventListener('click', () => {
        const number = card.dataset.number;
        const status = card.dataset.status;
        if (status === 'disponivel') openSellModal(number);
        else if (status === 'vendido') openSoldModal(number);
        else if (status === 'reservado') openReservedModal(number);
      });
    });
  }

  function openSellModal(number) {
    const body = document.createElement('div');
    body.innerHTML = `
      <p style="margin-bottom:1rem;color:var(--muted);">Venda manual do número <strong>${UI.escapeHtml(number)}</strong>.</p>
      ${UI.buyerFormFields()}`;

    UI.modal({
      title: `Vender número ${number}`,
      body,
      actions: [
        { label: 'Cancelar', className: 'btn-ghost', onClick: (close) => close() },
        {
          label: 'Confirmar Venda',
          className: 'btn-primary',
          onClick: async (close) => {
            const buyer = UI.readBuyerForm();
            if (buyer.nameError || !buyer.phone) {
              UI.toast(buyer.nameError || 'Informe nome e telefone.', 'error');
              return;
            }
            UI.showLoading('Salvando venda...');
            const result = await sellNumber(raffleId, number, buyer);
            UI.hideLoading();
            if (!result.ok) {
              UI.toast(result.error, 'error');
              return;
            }
            close();
            UI.toast(`Número ${number} vendido.`, 'success');
            await renderView();
          }
        }
      ]
    });
  }

  function openSoldModal(number) {
    const raffle = Store.getRaffleById(raffleId);
    const slot = raffle.numbers.find((n) => n.number === number);
    const body = document.createElement('div');
    body.innerHTML = `
      <div class="detail-box detail-box--sold">
        <p><strong>Nome:</strong> ${UI.escapeHtml(slot.buyerName || '—')}</p>
        <p><strong>Telefone:</strong> ${UI.escapeHtml(slot.buyerPhone || '—')}</p>
        <p><strong>Cidade:</strong> ${UI.escapeHtml(slot.buyerCity || '—')}</p>
        <p><strong>Data:</strong> ${UI.escapeHtml(slot.date || '—')}</p>
        <p><strong>Hora:</strong> ${UI.escapeHtml(slot.time || '—')}</p>
        ${slot.observation ? `<p><strong>Obs:</strong> ${UI.escapeHtml(slot.observation)}</p>` : ''}
      </div>`;

    UI.modal({
      title: `Número ${number} — Vendido`,
      body,
      actions: [
        {
          label: 'Cancelar Venda',
          className: 'btn-danger',
          onClick: async (close) => {
            UI.showLoading('Cancelando...');
            const result = await cancelSale(raffleId, number);
            UI.hideLoading();
            if (!result.ok) {
              UI.toast(result.error, 'error');
              return;
            }
            close();
            UI.toast(`Venda do número ${number} cancelada.`, 'success');
            await renderView();
          }
        }
      ]
    });
  }

  function openReservedModal(number) {
    const raffle = Store.getRaffleById(raffleId);
    const slot = raffle.numbers.find((n) => n.number === number);
    const body = document.createElement('div');
    body.innerHTML = `
      <div class="detail-box detail-box--reserved">
        <p><strong>Reservado por:</strong> ${UI.escapeHtml(slot.buyerName || '—')}</p>
        <p><strong>Telefone:</strong> ${UI.escapeHtml(slot.buyerPhone || '—')}</p>
        <p><strong>Cidade:</strong> ${UI.escapeHtml(slot.buyerCity || '—')}</p>
        <p><strong>Data:</strong> ${UI.escapeHtml(slot.date || '—')}</p>
        <p><strong>Hora:</strong> ${UI.escapeHtml(slot.time || '—')}</p>
      </div>`;

    UI.modal({
      title: `Número ${number} — Reservado`,
      body,
      actions: [
        {
          label: 'Cancelar Reserva',
          className: 'btn-outline',
          onClick: async (close) => {
            UI.showLoading('Cancelando...');
            const result = await cancelReservation(raffleId, number);
            UI.hideLoading();
            if (!result.ok) {
              UI.toast(result.error, 'error');
              return;
            }
            close();
            UI.toast('Reserva cancelada.', 'success');
            await renderView();
          }
        },
        {
          label: 'Confirmar Venda',
          className: 'btn-success',
          onClick: async (close) => {
            UI.showLoading('Confirmando...');
            const result = await sellNumber(raffleId, number);
            UI.hideLoading();
            if (!result.ok) {
              UI.toast(result.error, 'error');
              return;
            }
            close();
            UI.toast(`Número ${number} confirmado como vendido.`, 'success');
            await renderView();
          }
        }
      ]
    });
  }

  function openEditModal(raffle, onSaved) {
    let imageData = raffle.image || '';
    let benefitData = raffle.benefitImage || '';
    const isCorporate = raffle.purpose === 'empresarial';
    const isBeneficente = raffle.purpose === 'beneficente';

    const body = document.createElement('div');
    body.innerHTML = `
      <form id="edit-raffle-form" class="edit-raffle-form" novalidate>
        <div class="form-grid">
          <div class="form-group form-group--full">
            <label for="edit-name">${isCorporate ? 'Nome da Campanha' : 'Nome da Rifa'}</label>
            <input id="edit-name" type="text" required value="${UI.escapeHtml(raffle.name)}">
          </div>
          <div class="form-group form-group--full">
            <label for="edit-description">Descrição</label>
            <textarea id="edit-description" required>${UI.escapeHtml(raffle.description)}</textarea>
          </div>
          <div class="form-group">
            <label for="edit-prize">${isCorporate ? 'Brinde' : 'Prêmio'}</label>
            <input id="edit-prize" type="text" required value="${UI.escapeHtml(raffle.prize)}">
          </div>
          <div class="form-group">
            <label for="edit-price">Valor por Número${isCorporate ? ' (opcional)' : ''}</label>
            <input id="edit-price" type="text" inputmode="numeric" ${isCorporate ? '' : 'required'} value="${UI.escapeHtml(UI.moneyInputValue(raffle.price))}" placeholder="R$ 0,00">
          </div>
          <div class="form-group">
            <label for="edit-drawDate">Data do Sorteio</label>
            <input id="edit-drawDate" type="date" required value="${UI.escapeHtml(raffle.drawDate)}">
          </div>
          <div class="form-group">
            <label for="edit-drawTime">Horário do Sorteio</label>
            <input id="edit-drawTime" type="time" required value="${UI.escapeHtml(raffle.drawTime)}">
          </div>
          ${isCorporate ? `
          <div class="form-group form-group--full">
            <label for="edit-segment">Segmento / Uso *</label>
            <select id="edit-segment" required>
              <option value="">Selecione</option>
              <option value="Clientes" ${raffle.segment === 'Clientes' ? 'selected' : ''}>Clientes</option>
              <option value="Colaboradores" ${raffle.segment === 'Colaboradores' ? 'selected' : ''}>Colaboradores</option>
            </select>
          </div>` : ''}
          ${!isCorporate ? `
          <div class="form-group form-group--full" id="edit-pix-heading">
            <h3 style="margin:0 0 .35rem;font-size:.9rem;">PIX para receber${isBeneficente ? ' *' : ''}</h3>
          </div>
          <div class="form-group">
            <label for="edit-pixName">Nome do favorecido</label>
            <input id="edit-pixName" type="text" value="${UI.escapeHtml(raffle.pixName || '')}" placeholder="Como aparece no banco">
          </div>
          <div class="form-group">
            <label for="edit-pixBank">Banco</label>
            <input id="edit-pixBank" type="text" value="${UI.escapeHtml(raffle.pixBank || '')}" placeholder="Ex.: Nubank">
          </div>
          <div class="form-group">
            <label for="edit-pixType">Tipo da chave${isBeneficente ? ' *' : ''}</label>
            <select id="edit-pixType" ${isBeneficente ? 'required' : ''}>
              <option value="cpf" ${(raffle.pixType || 'cpf') === 'cpf' ? 'selected' : ''}>CPF</option>
              <option value="telefone" ${raffle.pixType === 'telefone' ? 'selected' : ''}>Telefone</option>
              <option value="email" ${raffle.pixType === 'email' ? 'selected' : ''}>E-mail</option>
            </select>
          </div>
          <div class="form-group">
            <label for="edit-pixKey">Chave PIX${isBeneficente ? ' *' : ''}</label>
            <input id="edit-pixKey" type="text" ${isBeneficente ? 'required' : ''} value="${UI.escapeHtml(UI.formatPixKeyByType(raffle.pixType || 'cpf', raffle.pixKey || ''))}" placeholder="000.000.000-00">
          </div>` : ''}
          <div class="form-group">
            <label for="edit-image">${isCorporate ? 'Imagem da campanha' : 'Foto do sorteio / prêmio'}</label>
            ${fileFieldHTML('edit-image')}
            <p class="form-hint">Envie uma nova foto para substituir a atual.</p>
            <div id="edit-image-preview" class="image-preview" ${imageData ? '' : 'hidden'}>
              <img alt="Foto" ${imageData ? `src="${UI.escapeHtml(imageData)}"` : ''}>
            </div>
          </div>
          ${isBeneficente ? `
          <div class="form-group">
            <label for="edit-benefit">Foto do beneficiário</label>
            ${fileFieldHTML('edit-benefit')}
            <p class="form-hint">Foto da pessoa ou causa beneficiada.</p>
            <div id="edit-benefit-preview" class="image-preview" ${benefitData ? '' : 'hidden'}>
              <img alt="Foto do benefício" ${benefitData ? `src="${UI.escapeHtml(benefitData)}"` : ''}>
            </div>
          </div>` : ''}
        </div>
        <p id="edit-raffle-error" class="form-error" hidden></p>
      </form>
    `;

    UI.modal({
      title: `Editar ${isCorporate ? 'campanha' : 'rifa'} #${raffle.id}`,
      dialogClass: 'modal-dialog--wide',
      body,
      actions: [
        { label: 'Cancelar', className: 'btn-ghost', onClick: (c) => c() },
        {
          label: 'Salvar alterações',
          className: 'btn-primary',
          onClick: async (c) => {
            const errorEl = body.querySelector('#edit-raffle-error');
            const name = body.querySelector('#edit-name').value.trim();
            const description = body.querySelector('#edit-description').value.trim();
            const prize = body.querySelector('#edit-prize').value.trim();
            const priceEl = body.querySelector('#edit-price');
            const priceRaw = (priceEl?.value || '').trim();
            const priceValue = priceRaw ? UI.parseMoneyInput(priceEl?.value) : 0;
            const drawDate = body.querySelector('#edit-drawDate').value;
            const drawTime = body.querySelector('#edit-drawTime').value;
            const segment = isCorporate
              ? (body.querySelector('#edit-segment')?.value || '').trim()
              : '';
            const pixName = (body.querySelector('#edit-pixName')?.value || '').trim();
            const pixBank = (body.querySelector('#edit-pixBank')?.value || '').trim();
            const pixType = body.querySelector('#edit-pixType')?.value || 'cpf';
            const pixRaw = body.querySelector('#edit-pixKey')?.value || '';
            const pixCheck = isCorporate
              ? { ok: true, value: '' }
              : (isBeneficente || String(pixRaw).trim()
                ? UI.validatePixKey(pixType, pixRaw)
                : { ok: true, value: '' });

            if (!name || !description || !prize || !drawDate || !drawTime) {
              errorEl.textContent = 'Preencha todos os campos obrigatórios.';
              errorEl.hidden = false;
              return;
            }

            if (isCorporate && !['Clientes', 'Colaboradores'].includes(segment)) {
              errorEl.textContent = 'Selecione o segmento (Clientes ou Colaboradores).';
              errorEl.hidden = false;
              return;
            }

            if (!isCorporate && !pixCheck.ok) {
              errorEl.textContent = pixCheck.error || 'Informe a chave PIX.';
              errorEl.hidden = false;
              return;
            }

            if (isBeneficente && (!Number.isFinite(priceValue) || priceValue <= 0)) {
              errorEl.textContent = 'Informe um valor por número válido.';
              errorEl.hidden = false;
              return;
            }

            if (isCorporate && priceRaw && (!Number.isFinite(priceValue) || priceValue < 0)) {
              errorEl.textContent = 'Informe um valor por número válido ou deixe em branco.';
              errorEl.hidden = false;
              return;
            }

            if (!isCorporate && !isBeneficente && (!Number.isFinite(priceValue) || priceValue <= 0)) {
              errorEl.textContent = 'Informe um valor por número válido.';
              errorEl.hidden = false;
              return;
            }

            UI.showLoading('Salvando rifa...');
            try {
              const payload = {
                name,
                description,
                prize,
                price: Number.isFinite(priceValue) ? priceValue : 0,
                drawDate,
                drawTime,
                purpose: raffle.purpose || (isCorporate ? 'empresarial' : 'beneficente'),
                image: imageData
              };
              if (isCorporate) {
                payload.segment = segment;
                payload.pixName = '';
                payload.pixBank = '';
                payload.pixType = 'cpf';
                payload.pixKey = '';
                payload.benefitImage = '';
              } else {
                payload.pixName = pixName;
                payload.pixBank = pixBank;
                payload.pixType = pixType;
                payload.pixKey = pixCheck.value;
                if (isBeneficente) payload.benefitImage = benefitData;
              }
              const result = await API.editRaffle(raffle.id, payload);
              UI.hideLoading();
              if (!result.ok) {
                errorEl.textContent = result.error || 'Não foi possível salvar.';
                errorEl.hidden = false;
                UI.toast(result.error || 'Erro ao salvar.', 'error');
                return;
              }
              c();
              UI.toast('Rifa atualizada com sucesso.', 'success');
              if (typeof onSaved === 'function') await onSaved(result.raffle);
            } catch (err) {
              UI.hideLoading();
              errorEl.textContent = err.message || 'Erro ao salvar.';
              errorEl.hidden = false;
              UI.toast(errorEl.textContent, 'error');
            }
          }
        }
      ]
    });

    bindImageInput('edit-image', 'edit-image-preview', (v) => { imageData = v; }, body);
    if (isBeneficente) {
      bindImageInput('edit-benefit', 'edit-benefit-preview', (v) => { benefitData = v; }, body);
    }
    UI.bindMoneyInput(body.querySelector('#edit-price'));
    if (!isCorporate) {
      UI.bindPixKeyFields(body.querySelector('#edit-pixType'), body.querySelector('#edit-pixKey'));
    }

    if (imageData) {
      const nameEl = body.querySelector('#edit-image')?.closest('.file-field')?.querySelector('.file-field__name');
      if (nameEl) {
        nameEl.textContent = isCorporate ? 'Imagem atual da campanha' : 'Foto atual do prêmio';
        nameEl.classList.add('is-filled');
      }
    }
    if (isBeneficente && benefitData) {
      const nameEl = body.querySelector('#edit-benefit')?.closest('.file-field')?.querySelector('.file-field__name');
      if (nameEl) {
        nameEl.textContent = 'Foto atual do benefício';
        nameEl.classList.add('is-filled');
      }
    }
  }

  async function initMyRaffles() {
    const session = await Layout.render({
      active: 'minhas-rifas',
      title: 'Minhas Rifas',
      showBottomNav: false
    });
    if (!session) return;

    let query = '';
    let drawing = false;
    let lastFingerprint = '';
    let cycleFilter = 'ativa';

    function soldCount(r) {
      if (Number.isFinite(Number(r.soldCount))) return Number(r.soldCount);
      return (r.numbers || []).filter((n) => n.status === 'vendido').length;
    }

    function fingerprint(list) {
      return `${cycleFilter}::` + (list || [])
        .map((r) => `${r.id}:${r.name}:${r.status}:${soldCount(r)}:${r.reservedCount || 0}:${r.quantity}`)
        .join('|');
    }

    function cycleLabel(status) {
      const st = String(status || 'ativa').toLowerCase();
      if (st === 'arquivada') return 'Arquivada';
      if (st === 'encerrada' || st === 'sorteada') return 'Encerrada';
      return 'Ativa';
    }

    async function draw({ silent = false } = {}) {
      if (drawing) return;
      drawing = true;
      if (!silent) UI.showLoading('Carregando rifas...');
      try {
        const list = await searchRaffle(query, { status: cycleFilter });
        const nextFp = `${query}::${fingerprint(list)}`;
        if (silent && nextFp === lastFingerprint) return;
        lastFingerprint = nextFp;

        if (!silent) UI.hideLoading();
        Layout.setContent(`
          <div class="slide-up">
            <div class="detail-header">
              <div>
                <h1 class="page-title">Minhas Rifas</h1>
                <p class="page-subtitle">Histórico por ciclo: ativas, encerradas e arquivadas permanecem no sistema.</p>
              </div>
            </div>
            <div class="toolbar">
              <div class="search-box">
                <input id="raffle-search" type="search" placeholder="Nome da rifa, prêmio ou data..." value="${UI.escapeHtml(query)}">
              </div>
              <div class="filters" id="cycle-filters">
                ${[['ativa', 'Ativas'], ['encerrada', 'Encerradas'], ['arquivada', 'Arquivadas']]
                  .map(([id, label]) => `<button type="button" class="filter-chip ${cycleFilter === id ? 'active' : ''}" data-cycle="${id}">${label}</button>`)
                  .join('')}
              </div>
            </div>
            <div class="raffles-grid">
              ${list.length ? list.map((r) => {
                const sold = soldCount(r);
                const pct = r.quantity ? Math.round((sold / r.quantity) * 100) : 0;
                const st = String(r.status || 'ativa').toLowerCase();
                const cycleBtns = st === 'ativa'
                  ? `<button class="btn btn-ghost btn-sm ripple" type="button" data-cycle-action="encerrada" data-id="${r.id}">Encerrar</button>
                     <button class="btn btn-ghost btn-sm ripple" type="button" data-cycle-action="arquivada" data-id="${r.id}">Arquivar</button>`
                  : st === 'encerrada'
                    ? `<button class="btn btn-ghost btn-sm ripple" type="button" data-cycle-action="ativa" data-id="${r.id}">Reativar</button>
                       <button class="btn btn-ghost btn-sm ripple" type="button" data-cycle-action="arquivada" data-id="${r.id}">Arquivar</button>`
                    : `<button class="btn btn-ghost btn-sm ripple" type="button" data-cycle-action="ativa" data-id="${r.id}">Reativar</button>`;
                return `
                  <article class="card raffle-card">
                    <div class="raffle-card__media" style="${r.image ? `background-image:linear-gradient(135deg,rgba(10,10,11,.55),rgba(200,16,46,.45)),url('${UI.escapeHtml(r.image)}');` : ''}">
                      <span>#${r.id} · ${cycleLabel(st)}</span>
                    </div>
                    <h3>${UI.escapeHtml(r.name)}</h3>
                    <p>${UI.escapeHtml(r.prize)}</p>
                    <div class="raffle-card__meta">
                      <span>${UI.money(r.price)}</span>
                      <span>${UI.formatDateBR(r.drawDate)}</span>
                      <span>${sold}/${r.quantity} vendidos</span>
                    </div>
                    <div class="progress"><div class="progress__bar" style="width:${pct}%"></div></div>
                    <div class="raffle-card__actions">
                      ${st === 'ativa' ? `<button class="btn btn-outline btn-sm ripple" type="button" data-edit="${r.id}">✏ Editar</button>` : ''}
                      <a class="btn btn-primary btn-sm ripple" href="visualizar-rifa.html?id=${r.id}">Abrir</a>
                      ${cycleBtns}
                    </div>
                  </article>`;
              }).join('') : `
                <div class="card empty-state" style="grid-column:1/-1;">
                  <h3>Nenhuma rifa encontrada</h3>
                  <p>Ajuste a pesquisa ou cadastre uma nova rifa.</p>
                </div>`}
            </div>
          </div>
        `);

        let timer;
        const searchEl = document.getElementById('raffle-search');
        searchEl?.addEventListener('input', (e) => {
          query = e.target.value;
          clearTimeout(timer);
          timer = setTimeout(() => draw({ silent: false }), 350);
        });
        if (silent && searchEl && document.activeElement === searchEl) {
          const pos = searchEl.value.length;
          searchEl.focus();
          searchEl.setSelectionRange(pos, pos);
        }

        document.getElementById('cycle-filters')?.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-cycle]');
          if (!btn) return;
          cycleFilter = btn.getAttribute('data-cycle') || 'ativa';
          draw({ silent: false });
        });

        document.querySelectorAll('[data-cycle-action]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            const status = btn.getAttribute('data-cycle-action');
            UI.showLoading('Atualizando ciclo...');
            const res = await API.setRaffleCycle(id, status);
            UI.hideLoading();
            if (!res.ok) {
              UI.toast(res.error || 'Não foi possível atualizar.', 'error');
              return;
            }
            UI.toast('Ciclo da rifa atualizado.', 'success');
            await draw({ silent: false });
          });
        });

        document.querySelectorAll('[data-edit]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-edit');
            const raffle = list.find((item) => String(item.id) === String(id));
            if (!raffle) {
              UI.toast('Rifa não encontrada.', 'error');
              return;
            }
            openEditModal(raffle, () => draw({ silent: false }));
          });
        });

        document.querySelectorAll('[data-delete]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-delete');
            UI.modal({
              title: 'Excluir rifa',
              body: `
                <p>Esta ação é permanente.</p>
                <p style="margin-top:.65rem;color:var(--muted);">
                  Serão removidos a rifa e todas as vendas e reservas vinculadas a ela.
                </p>`,
              actions: [
                { label: 'Cancelar', className: 'btn-ghost', onClick: (c) => c() },
                {
                  label: 'Excluir definitivamente',
                  className: 'btn-danger',
                  onClick: async (c) => {
                    UI.showLoading('Excluindo rifa e vendas...');
                    try {
                      const res = await API.deleteRaffle(id);
                      UI.hideLoading();
                      if (!res.ok) {
                        UI.toast(res.error || 'Não foi possível excluir.', 'error', 5000);
                        return;
                      }
                      c();
                      UI.toast('Rifa e vendas excluídas com sucesso.', 'success');
                      await draw({ silent: false });
                    } catch (err) {
                      UI.hideLoading();
                      console.error('deleteRaffle', err);
                      UI.toast(err.message || 'Erro ao excluir.', 'error', 5000);
                    }
                  }
                }
              ]
            });
          });
        });
      } catch (err) {
        if (!silent) UI.hideLoading();
        if (!silent) UI.toast(err.message || 'Erro ao listar rifas.', 'error');
        else console.warn('Falha ao atualizar Minhas Rifas', err);
      } finally {
        drawing = false;
      }
    }

    function startLive() {
      document.addEventListener('pas:live-update', () => {
        if (document.hidden) return;
        if (cycleFilter !== 'ativa') return;
        draw({ silent: true });
      });
      window.addEventListener('focus', () => draw({ silent: true }));
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') draw({ silent: true });
      });
    }

    await draw({ silent: false });
    startLive();
  }

  return { initCreate, initView, initMyRaffles, openEditModal };
})();

window.RifaPage = RifaPage;
