/**
 * Sorteios a partir de comentários do Instagram
 *
 * Lista e detalhe na mesma página: sorteios.html abre a lista,
 * sorteios.html?id=123 abre o sorteio.
 */
const SorteioInstagram = (() => {
  const STATUS = {
    rascunho: { label: 'Rascunho', className: 'pill' },
    coletando: { label: 'Coletando', className: 'pill pill--soon' },
    pronto: { label: 'Pronto para sortear', className: 'pill pill--purpose-empresarial' },
    sorteado: { label: 'Sorteado', className: 'pill pill--purpose-beneficente' }
  };

  let currentDraw = null;
  let participantFilter = 'todos';
  let igConnection = null;

  function statusPill(status) {
    const meta = STATUS[status] || STATUS.rascunho;
    return `<span class="${meta.className}">${meta.label}</span>`;
  }

  function connectionBanner() {
    if (igConnection?.connected) {
      const account = igConnection.account || {};
      const photo = account.profile_picture_url
        ? `<img class="ig-conn-chip__avatar" src="${UI.escapeHtml(account.profile_picture_url)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">`
        : '';
      return `
        <div class="ig-conn-chip ig-conn-chip--ok">
          ${photo}
          <span>Conectado como <strong>@${UI.escapeHtml(account.username || '')}</strong></span>
        </div>`;
    }
    return `
      <div class="ig-conn-chip ig-conn-chip--warn">
        <span>Conecte sua conta do Instagram em Configurações para criar sorteios e buscar comentários.</span>
        <a class="btn btn-sm btn-primary ripple" href="configuracoes.html">Conectar</a>
      </div>`;
  }

  function captionPreview(caption) {
    const text = String(caption || '').trim().replace(/\s+/g, ' ');
    if (!text) return 'Sem legenda';
    return text.length > 72 ? `${text.slice(0, 72)}…` : text;
  }

  /** Traduz o JSON de regras para uma frase que o usuário entende */
  function rulesSummary(rules) {
    const items = [];
    if (rules.minCaracteres > 0) items.push(`mínimo de ${rules.minCaracteres} caracteres`);
    if (rules.marcarAmigos > 0) items.push(`marcar ${rules.marcarAmigos} amigo(s)`);
    if (rules.palavraChave) items.push(`conter "${rules.palavraChave}"`);
    if (rules.umPorUsuario) items.push('um comentário por perfil');
    return items.length ? items.join(' · ') : 'Sem regras — todos os comentários valem';
  }

  /** UI.formatDateBR espera YYYY-MM-DD; aqui os campos são timestamps completos */
  function formatMoment(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async function copyText(text, successMessage) {
    try {
      await navigator.clipboard.writeText(text);
      UI.toast(successMessage || 'Copiado.', 'success');
    } catch {
      UI.toast('Não foi possível copiar. Selecione e copie manualmente.', 'error');
    }
  }

  function go(href) {
    if (typeof Layout !== 'undefined' && typeof Layout.go === 'function') {
      Layout.go(href);
      return;
    }
    window.location.href = href;
  }

  /* ─── Formulário de sorteio (novo / editar) ──────────────── */

  function drawFormFields(draw) {
    const editing = !!draw?.id;
    const rules = draw?.rules || { minCaracteres: 0, marcarAmigos: 2, palavraChave: '', umPorUsuario: true };
    if (editing) {
      return `
        <div class="card ig-draw-form">
          <h3 class="section-title">Post publicado</h3>
          ${draw.postUrl
            ? `<p><a href="${UI.escapeHtml(draw.postUrl)}" target="_blank" rel="noopener">${UI.escapeHtml(draw.postUrl)}</a></p>`
            : '<p class="form-hint">Post sem link salvo.</p>'}
          <p class="form-hint" style="margin-top:0.5rem;">A foto e a legenda já estão no Instagram. Aqui você só ajusta as regras usadas no sorteio.</p>
        </div>
        <div class="card ig-draw-form" style="margin-top:1rem;">
          <h3 class="section-title">Regras do sorteio</h3>
          ${rulesFieldsHtml(rules)}
        </div>`;
    }

    return `
      <div class="card ig-draw-form">
        <h3 class="section-title">1. Dados do sorteio</h3>
        <div class="form-group">
          <label for="draw-titulo">Título</label>
          <input id="draw-titulo" type="text" maxlength="120"
            placeholder="Ex: Sorteio especial">
        </div>
        <div class="form-group">
          <label for="draw-descricao">Descrição / prêmio</label>
          <textarea id="draw-descricao" rows="4"
            placeholder="Conte o que está sendo sorteado..."></textarea>
        </div>
        <div class="form-group">
          <label for="draw-data">Data do sorteio</label>
          <input id="draw-data" type="date">
        </div>
      </div>

      <div class="card ig-draw-form" style="margin-top:1rem;">
        <h3 class="section-title">2. Foto do post</h3>
        <p class="form-hint" style="margin-bottom:0.75rem;">
          Essa imagem será publicada no Instagram da conta conectada (JPG/PNG, até 8 MB).
        </p>
        <div class="ig-photo-drop">
          <input id="draw-foto" type="file" accept="image/jpeg,image/png,image/webp,image/jpg">
          <div class="ig-photo-preview" id="draw-foto-preview" hidden></div>
        </div>
      </div>

      <div class="card ig-draw-form" style="margin-top:1rem;">
        <h3 class="section-title">3. Regras para os participantes</h3>
        <p class="form-hint" style="margin-bottom:0.85rem;">
          Essas regras entram na legenda do post e também filtram quem concorre no sorteio.
        </p>
        <div class="form-group">
          <label class="config-toggle">
            <input id="draw-pedir-curtir" type="checkbox" checked>
            <span>Pedir para curtir a publicação</span>
          </label>
        </div>
        <div class="form-group">
          <label class="config-toggle">
            <input id="draw-pedir-seguir" type="checkbox" checked>
            <span>Pedir para seguir o perfil</span>
          </label>
        </div>
        ${rulesFieldsHtml(rules)}
        <div class="form-group">
          <label for="draw-texto-extra">Regra extra (opcional)</label>
          <input id="draw-texto-extra" type="text" maxlength="160"
            placeholder="Ex: Compartilhar nos stories e marcar o perfil">
        </div>
      </div>

      <div class="card ig-draw-form" style="margin-top:1rem;">
        <h3 class="section-title">Prévia da legenda</h3>
        <pre class="ig-caption-preview" id="draw-caption-preview">Preencha os campos para ver a legenda...</pre>
      </div>`;
  }

  function rulesFieldsHtml(rules) {
    return `
      <div class="form-group">
        <label for="draw-tag-friends">Marcar amigos no comentário</label>
        <input id="draw-tag-friends" type="number" min="0" max="20" value="${Number(rules.marcarAmigos) || 0}">
        <p class="form-hint">0 = não exigir. Ex.: 2 amigos.</p>
      </div>
      <div class="form-group">
        <label for="draw-keyword">Palavra-chave no comentário</label>
        <input id="draw-keyword" type="text" maxlength="60"
          value="${UI.escapeHtml(rules.palavraChave || '')}" placeholder="Ex: quero">
      </div>
      <div class="form-group">
        <label for="draw-min-chars">Mínimo de caracteres</label>
        <input id="draw-min-chars" type="number" min="0" max="500" value="${Number(rules.minCaracteres) || 0}">
      </div>
      <div class="form-group">
        <label class="config-toggle">
          <input id="draw-one-per-user" type="checkbox" ${rules.umPorUsuario ? 'checked' : ''}>
          <span>Contar apenas o primeiro comentário de cada perfil</span>
        </label>
      </div>`;
  }

  function buildCaptionPreview() {
    const titulo = document.getElementById('draw-titulo')?.value || '';
    const descricao = document.getElementById('draw-descricao')?.value || '';
    const dataSorteio = document.getElementById('draw-data')?.value || '';
    const marcarAmigos = Number(document.getElementById('draw-tag-friends')?.value) || 0;
    const palavraChave = document.getElementById('draw-keyword')?.value || '';
    const minCaracteres = Number(document.getElementById('draw-min-chars')?.value) || 0;
    const textoExtra = document.getElementById('draw-texto-extra')?.value || '';
    const pedirCurtir = !!document.getElementById('draw-pedir-curtir')?.checked;
    const pedirSeguir = !!document.getElementById('draw-pedir-seguir')?.checked;

    const lines = [];
    if (titulo.trim()) lines.push(`🎉 ${titulo.trim().toUpperCase()} 🎉`, '');
    if (descricao.trim()) lines.push(descricao.trim(), '');
    if (dataSorteio) {
      const [y, m, d] = dataSorteio.split('-');
      lines.push(`📅 O sorteio será realizado no dia ${d}/${m}/${y}`, '');
    }
    lines.push('Para participar é muito fácil:');
    if (pedirCurtir) lines.push('✅ Curtir a publicação');
    if (pedirSeguir) lines.push('✅ Seguir o perfil');
    if (marcarAmigos > 0) lines.push(`✅ Marcar ${marcarAmigos} amigo${marcarAmigos > 1 ? 's' : ''} no comentário`);
    if (palavraChave.trim()) lines.push(`✅ Comentar a palavra: ${palavraChave.trim()}`);
    if (minCaracteres > 0) lines.push(`✅ Comentário com pelo menos ${minCaracteres} caracteres`);
    if (textoExtra.trim()) lines.push(`✅ ${textoExtra.trim()}`);
    lines.push('', '⚠️ Não vale marcar perfis fakes, famosos ou lojas.');
    return lines.join('\n');
  }

  function refreshCaptionPreview() {
    const el = document.getElementById('draw-caption-preview');
    if (el) el.textContent = buildCaptionPreview();
  }

  let pendingImageDataUrl = '';

  function setSelectedPost() { /* legado do seletor de posts */ }

  function readDrawForm() {
    return {
      titulo: document.getElementById('draw-titulo')?.value || '',
      descricao: document.getElementById('draw-descricao')?.value || '',
      dataSorteio: document.getElementById('draw-data')?.value || '',
      textoExtra: document.getElementById('draw-texto-extra')?.value || '',
      pedirCurtir: document.getElementById('draw-pedir-curtir')
        ? !!document.getElementById('draw-pedir-curtir').checked
        : true,
      pedirSeguir: document.getElementById('draw-pedir-seguir')
        ? !!document.getElementById('draw-pedir-seguir').checked
        : true,
      imageDataUrl: pendingImageDataUrl,
      postUrl: document.getElementById('draw-post-url')?.value || '',
      mediaId: document.getElementById('draw-media-id')?.value || '',
      rules: {
        minCaracteres: Number(document.getElementById('draw-min-chars')?.value) || 0,
        marcarAmigos: Number(document.getElementById('draw-tag-friends')?.value) || 0,
        palavraChave: document.getElementById('draw-keyword')?.value || '',
        umPorUsuario: !!document.getElementById('draw-one-per-user')?.checked
      }
    };
  }

  function bindDrawFormActions(draw) {
    const editing = !!draw?.id;
    pendingImageDataUrl = '';

    if (!editing) {
      ['draw-titulo', 'draw-descricao', 'draw-data', 'draw-tag-friends', 'draw-keyword',
        'draw-min-chars', 'draw-texto-extra', 'draw-pedir-curtir', 'draw-pedir-seguir'
      ].forEach((id) => {
        document.getElementById(id)?.addEventListener('input', refreshCaptionPreview);
        document.getElementById(id)?.addEventListener('change', refreshCaptionPreview);
      });
      refreshCaptionPreview();

      document.getElementById('draw-foto')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        const preview = document.getElementById('draw-foto-preview');
        if (!file) {
          pendingImageDataUrl = '';
          if (preview) {
            preview.hidden = true;
            preview.innerHTML = '';
          }
          return;
        }
        UI.showLoading('Preparando imagem...');
        const result = await API.uploadInstagramImage(file);
        UI.hideLoading();
        if (!result.ok) {
          UI.toast(result.error, 'error');
          e.target.value = '';
          return;
        }
        pendingImageDataUrl = result.dataUrl;
        if (preview) {
          preview.hidden = false;
          preview.innerHTML = `<img src="${result.dataUrl}" alt="Prévia da foto">`;
        }
      });
    }

    document.getElementById('btn-salvar-sorteio')?.addEventListener('click', async () => {
      const form = readDrawForm();

      if (editing) {
        if (!form.titulo && draw.titulo) form.titulo = draw.titulo;
        UI.showLoading('Salvando regras...');
        const result = await API.updateInstagramDraw(draw.id, {
          titulo: draw.titulo,
          postUrl: draw.postUrl,
          mediaId: draw.mediaId,
          rules: form.rules
        });
        UI.hideLoading();
        if (!result.ok) {
          UI.toast(result.error, 'error', 6000);
          return;
        }
        if ((draw.participants || []).length) {
          UI.showLoading('Revalidando participantes...');
          await API.validateInstagramParticipants(draw.id, form.rules);
          UI.hideLoading();
        }
        UI.toast('Regras atualizadas.', 'success');
        go(`sorteios.html?id=${draw.id}`);
        return;
      }

      if (!form.titulo.trim()) {
        UI.toast('Informe o título do sorteio.', 'error');
        return;
      }
      if (!form.imageDataUrl) {
        UI.toast('Escolha a foto que será publicada no Instagram.', 'error');
        return;
      }

      UI.showLoading('Publicando no Instagram...');
      const result = await API.publishInstagramDraw(form);
      UI.hideLoading();

      if (!result.ok) {
        UI.toast(
          result.needsDeploy
            ? 'Integração ainda não publicada no servidor.'
            : result.error,
          result.needsDeploy ? 'info' : 'error',
          7000
        );
        return;
      }

      const id = result.sorteio?.id;
      UI.toast('Post publicado no Instagram e sorteio criado.', 'success');
      go(id ? `sorteios.html?id=${id}` : 'sorteios.html');
    });
  }

  function renderDrawFormPage(draw) {
    const editing = !!draw?.id;
    Layout.setContent(`
      <div class="slide-up">
        <a class="btn btn-ghost btn-sm ripple" href="sorteios.html">← Voltar</a>
        <div class="page-head-row" style="margin-top:0.75rem;">
          <div>
            <h1 class="page-title">${editing ? 'Editar regras do sorteio' : 'Criar e publicar sorteio'}</h1>
            <p class="page-subtitle">
              ${editing
                ? 'Ajuste as regras usadas para validar os comentários.'
                : 'Monte a publicação e envie direto para a conta Instagram conectada.'}
            </p>
          </div>
        </div>
        ${connectionBanner()}
        <div style="margin-top:1rem;">
          ${drawFormFields(draw)}
        </div>
        <div class="detail-actions" style="margin-top:1.25rem;">
          <a class="btn btn-ghost ripple" href="sorteios.html">Cancelar</a>
          <button class="btn btn-primary ripple" type="button" id="btn-salvar-sorteio">
            ${editing ? 'Salvar regras' : 'Publicar no Instagram'}
          </button>
        </div>
      </div>
    `);
    bindDrawFormActions(draw);
  }

  function openDrawForm(draw) {
    if (!igConnection?.connected) {
      UI.toast('Conecte sua conta do Instagram em Configurações antes de criar o sorteio.', 'info', 5000);
      return;
    }

    // Edição continua em tela cheia (só regras)
    if (draw?.id) {
      try {
        history.pushState({ sorteioView: 'editar', id: draw.id }, '', `sorteios.html?editar=${draw.id}`);
      } catch { /* ignore */ }
      renderDrawFormPage(draw);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    pendingImageDataUrl = '';
    UI.modal({
      title: 'Criar e publicar sorteio',
      dialogClass: 'modal-dialog--wide modal-dialog--ig-draw',
      body: drawFormFields(null),
      actions: [
        {
          label: 'Publicar no Instagram',
          className: 'btn-primary',
          onClick: async (close) => {
            const form = readDrawForm();
            if (!form.titulo.trim()) {
              UI.toast('Informe o título do sorteio.', 'error');
              return;
            }
            if (!form.imageDataUrl) {
              UI.toast('Escolha a foto que será publicada no Instagram.', 'error');
              return;
            }

            UI.showLoading('Publicando no Instagram...');
            const result = await API.publishInstagramDraw(form);
            UI.hideLoading();

            if (!result.ok) {
              UI.toast(
                result.needsDeploy
                  ? 'Integração ainda não publicada no servidor.'
                  : result.error,
                result.needsDeploy ? 'info' : 'error',
                7000
              );
              return;
            }

            close();
            const id = result.sorteio?.id;
            UI.toast('Post publicado no Instagram e sorteio criado.', 'success');
            go(id ? `sorteios.html?id=${id}` : 'sorteios.html');
          }
        }
      ]
    });

    // Listeners do formulário (foto, prévia da legenda)
    ['draw-titulo', 'draw-descricao', 'draw-data', 'draw-tag-friends', 'draw-keyword',
      'draw-min-chars', 'draw-texto-extra', 'draw-pedir-curtir', 'draw-pedir-seguir'
    ].forEach((id) => {
      document.getElementById(id)?.addEventListener('input', refreshCaptionPreview);
      document.getElementById(id)?.addEventListener('change', refreshCaptionPreview);
    });
    refreshCaptionPreview();

    document.getElementById('draw-foto')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      const preview = document.getElementById('draw-foto-preview');
      if (!file) {
        pendingImageDataUrl = '';
        if (preview) {
          preview.hidden = true;
          preview.innerHTML = '';
        }
        return;
      }
      UI.showLoading('Preparando imagem...');
      const result = await API.uploadInstagramImage(file);
      UI.hideLoading();
      if (!result.ok) {
        UI.toast(result.error, 'error');
        e.target.value = '';
        return;
      }
      pendingImageDataUrl = result.dataUrl;
      if (preview) {
        preview.hidden = false;
        preview.innerHTML = `<img src="${result.dataUrl}" alt="Prévia da foto">`;
      }
    });
  }

  /* ─── Lista ──────────────────────────────────────────────── */

  function renderList(draws) {
    const canCreate = !!igConnection?.connected;
    Layout.setContent(`
      <div class="slide-up">
        <div class="page-head-row">
          <div>
            <h1 class="page-title">Sorteios do Instagram</h1>
            <p class="page-subtitle">
              Sorteie entre quem comentou no post, com comprovante de que o resultado não foi escolhido a dedo.
            </p>
          </div>
          <div class="detail-actions">
            ${canCreate
              ? `<button class="btn btn-primary ripple" type="button" data-action="criar-publicar-sorteio">
                   Criar e publicar sorteio
                 </button>`
              : `<a class="btn btn-outline ripple" href="configuracoes.html">
                   Conta do Instagram
                 </a>`}
          </div>
        </div>

        ${connectionBanner()}

        ${draws.length ? `
          <div class="raffles-grid" style="margin-top:1.25rem;">
            ${draws.map((d) => `
              <article class="card raffle-card draw-card" data-open="${d.id}">
                <div class="draw-card__head">
                  <h3>${UI.escapeHtml(d.titulo)}</h3>
                  ${statusPill(d.status)}
                </div>
                <p class="draw-card__rules">${UI.escapeHtml(rulesSummary(d.rules))}</p>
                <div class="raffle-card__meta">
                  <span>${d.totalValid} participante${d.totalValid === 1 ? '' : 's'} válido${d.totalValid === 1 ? '' : 's'}</span>
                  ${d.drawnAt ? `<span>Sorteado em ${formatMoment(d.drawnAt)}</span>` : ''}
                </div>
                <div class="raffle-card__actions">
                  <button class="btn btn-outline btn-sm ripple" type="button" data-open="${d.id}">Abrir</button>
                  <button class="btn btn-outline btn-sm ripple" type="button" data-delete="${d.id}">Excluir</button>
                </div>
              </article>`).join('')}
          </div>
        ` : `
          <div class="card empty-state" style="margin-top:1.25rem;">
            <h3>Nenhum sorteio criado</h3>
            <p>${canCreate
              ? 'Crie a publicação com título, foto e regras — o sistema envia direto para o Instagram conectado.'
              : 'Conecte o Instagram em Configurações para começar.'}</p>
            ${canCreate ? '' : `
              <a class="btn btn-primary ripple" href="configuracoes.html" style="margin-top:1rem;">
                Conectar Instagram
              </a>`}
          </div>`}
      </div>
    `);

    document.querySelectorAll('[data-action="criar-publicar-sorteio"]').forEach((btn) => {
      btn.addEventListener('click', () => openDrawForm(null));
    });

    document.querySelectorAll('[data-open]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        go(`sorteios.html?id=${el.getAttribute('data-open')}`);
      });
    });

    document.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-delete');
        UI.modal({
          title: 'Excluir sorteio',
          body: '<p>Isso apaga o sorteio e todos os participantes importados. Não dá para desfazer.</p>',
          actions: [
            {
              label: 'Excluir',
              className: 'btn-danger',
              onClick: async (close) => {
                UI.showLoading('Excluindo...');
                const result = await API.deleteInstagramDraw(id);
                UI.hideLoading();
                close();
                if (!result.ok) {
                  UI.toast(result.error, 'error');
                  return;
                }
                UI.toast('Sorteio excluído.', 'success');
                loadList();
              }
            }
          ]
        });
      });
    });
  }

  async function ensureConnection() {
    const result = await API.getInstagramConnection();
    if (result.ok) {
      igConnection = result;
    } else {
      igConnection = { connected: false, error: result.error, needsDeploy: result.needsDeploy };
    }
    return igConnection;
  }

  async function loadList() {
    UI.showLoading('Carregando sorteios...');
    await ensureConnection();
    const result = await API.listInstagramDraws();
    UI.hideLoading();

    if (!result.ok) {
      Layout.setContent(`
        <div class="slide-up">
          <h1 class="page-title">Sorteios do Instagram</h1>
          ${connectionBanner()}
          <div class="card empty-state" style="margin-top:1.25rem;">
            <h3>${result.needsSchema ? 'Recurso ainda não instalado' : 'Não foi possível carregar'}</h3>
            <p>${UI.escapeHtml(result.error)}</p>
          </div>
        </div>`);
      return;
    }

    renderList(result.draws);
  }

  /* ─── Detalhe ────────────────────────────────────────────── */

  function participantRow(p) {
    return `
      <tr>
        <td><strong>@${UI.escapeHtml(p.username)}</strong></td>
        <td class="draw-participant__comment">${UI.escapeHtml(p.comment || '—')}</td>
        <td>
          ${p.valid
            ? '<span class="pill pill--purpose-empresarial">Válido</span>'
            : `<span class="pill" title="${UI.escapeHtml(p.reason || '')}">${UI.escapeHtml(p.reason || 'Inválido')}</span>`}
        </td>
      </tr>`;
  }

  /** Texto que a empresa publica para provar que o sorteio foi honesto */
  function proofText(draw) {
    const r = draw.result;
    if (!r) return '';
    return [
      `Sorteio: ${draw.titulo}`,
      `Post: ${draw.postUrl || '—'}`,
      `Data/hora (UTC): ${r.timestamp}`,
      `Participantes válidos: ${r.totalValidos}`,
      '',
      ...(r.vencedores || []).map((w) => `${w.place}º lugar: @${w.nomeInstagram}`),
      '',
      `Seed: ${r.seed}`,
      `Hash da lista: ${r.listaHash}`,
      `Hash do comprovante: ${r.proofHash}`
    ].join('\n');
  }

  function auditPanel(draw) {
    const r = draw.result;
    if (!r) return '';

    const winners = r.vencedores || [];

    return `
      <div class="card draw-audit" style="margin-top:1.25rem;">
        <h3 class="section-title">Resultado</h3>
        ${winners.map((w) => `
          <div class="draw-winner-card">
            <div class="draw-winner-card__place">${w.place}º lugar</div>
            <div class="draw-winner-card__num">@${UI.escapeHtml(w.nomeInstagram)}</div>
            <p>${UI.escapeHtml(w.comentario || '')}</p>
          </div>`).join('')}

        <h4 class="section-title" style="margin-top:1.5rem;">Comprovante de sorteio justo</h4>
        <p class="form-hint" style="margin-bottom:0.85rem;">
          O vencedor foi calculado a partir do seed e da lista de participantes. Publique estes
          dados para que qualquer pessoa possa refazer a conta e chegar no mesmo nome.
        </p>
        <dl class="draw-audit__grid">
          <dt>Data e hora</dt>
          <dd>
            ${formatMoment(r.timestamp)}
            <span class="draw-audit__hash">${UI.escapeHtml(r.timestamp)}</span>
          </dd>
          <dt>Participantes válidos</dt><dd>${r.totalValidos}</dd>
          <dt>Seed</dt><dd class="draw-audit__hash">${UI.escapeHtml(r.seed)}</dd>
          <dt>Hash da lista</dt><dd class="draw-audit__hash">${UI.escapeHtml(r.listaHash)}</dd>
          <dt>Hash do comprovante</dt><dd class="draw-audit__hash">${UI.escapeHtml(r.proofHash)}</dd>
        </dl>
        <button class="btn btn-outline btn-sm ripple" type="button"
          data-action="copiar-comprovante">Copiar comprovante</button>
      </div>`;
  }

  function renderDetail(draw) {
    currentDraw = draw;
    const all = draw.participants || [];
    const valid = all.filter((p) => p.valid);
    const invalid = all.filter((p) => !p.valid);
    const alreadyDrawn = draw.status === 'sorteado';

    const filtered =
      participantFilter === 'validos' ? valid : participantFilter === 'invalidos' ? invalid : all;

    Layout.setContent(`
      <div class="slide-up">
        <a class="btn btn-ghost btn-sm ripple" href="sorteios.html">← Todos os sorteios</a>

        <div class="page-head-row">
          <div>
            <h1 class="page-title">${UI.escapeHtml(draw.titulo)}</h1>
            <p class="page-subtitle">${statusPill(draw.status)}</p>
          </div>
          ${alreadyDrawn ? '' : `
            <button class="btn btn-outline ripple" type="button" data-action="editar">
              Editar regras
            </button>`}
        </div>

        <div class="card" style="margin-top:1.25rem;">
          <h3 class="section-title">Post do Instagram</h3>
          ${draw.postUrl
            ? `<p><a href="${UI.escapeHtml(draw.postUrl)}" target="_blank" rel="noopener">${UI.escapeHtml(draw.postUrl)}</a></p>`
            : '<p class="form-hint">Nenhum post selecionado.</p>'}
          ${alreadyDrawn ? '' : `
            <button class="btn btn-primary btn-sm ripple" type="button"
              data-action="importar" style="margin-top:0.85rem;"
              ${draw.mediaId || draw.postUrl ? '' : 'disabled'}>
              ${all.length ? 'Atualizar comentários' : 'Buscar comentários'}
            </button>
            ${!(draw.mediaId || draw.postUrl)
              ? '<p class="form-hint" style="margin-top:0.5rem;">Escolha o post em "Editar regras" para liberar a busca.</p>'
              : ''}`}
        </div>

        <div class="card" style="margin-top:1rem;">
          <h3 class="section-title">Regras de participação</h3>
          <p>${UI.escapeHtml(rulesSummary(draw.rules))}</p>
        </div>

        <div class="stats-grid" style="margin-top:1rem;">
          <div class="card stat-card">
            <span class="stat-card__label">Comentários</span>
            <span class="stat-card__value">${all.length}</span>
          </div>
          <div class="card stat-card stat-card--accent">
            <span class="stat-card__label">Válidos</span>
            <span class="stat-card__value">${valid.length}</span>
          </div>
          <div class="card stat-card">
            <span class="stat-card__label">Fora das regras</span>
            <span class="stat-card__value">${invalid.length}</span>
          </div>
        </div>

        ${all.length ? `
          <div class="card" style="margin-top:1rem;">
            <div class="page-head-row">
              <h3 class="section-title" style="margin:0;">Participantes</h3>
              <div class="detail-actions">
                <button class="btn btn-sm ripple ${participantFilter === 'todos' ? 'btn-primary' : 'btn-outline'}" type="button" data-filter="todos">Todos</button>
                <button class="btn btn-sm ripple ${participantFilter === 'validos' ? 'btn-primary' : 'btn-outline'}" type="button" data-filter="validos">Válidos</button>
                <button class="btn btn-sm ripple ${participantFilter === 'invalidos' ? 'btn-primary' : 'btn-outline'}" type="button" data-filter="invalidos">Fora das regras</button>
              </div>
            </div>

            <div class="table-wrap" style="margin-top:0.85rem;">
              <table class="data-table">
                <thead>
                  <tr><th>Perfil</th><th>Comentário</th><th>Situação</th></tr>
                </thead>
                <tbody>
                  ${filtered.length
                    ? filtered.map(participantRow).join('')
                    : '<tr><td colspan="3">Nenhum participante neste filtro.</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        ` : `
          <div class="card empty-state" style="margin-top:1rem;">
            <h3>Nenhum comentário importado</h3>
            <p>Busque os comentários do post para ver quem participou.</p>
          </div>`}

        ${alreadyDrawn ? '' : `
          <div class="card draw-cta" style="margin-top:1rem;">
            <div>
              <h3 class="section-title" style="margin:0;">Realizar o sorteio</h3>
              <p class="form-hint" style="margin-top:0.35rem;">
                ${valid.length
                  ? `${valid.length} perfil(is) concorrendo. O resultado gera um comprovante público.`
                  : 'Nenhum participante válido ainda.'}
              </p>
            </div>
            <button class="btn btn-success ripple" type="button" data-action="sortear-instagram"
              ${valid.length ? '' : 'disabled'}>Sortear</button>
          </div>`}

        ${auditPanel(draw)}
      </div>
    `);

    bindDetailEvents(draw, valid.length);
  }

  function bindDetailEvents(draw, validCount) {
    document.querySelector('[data-action="editar"]')?.addEventListener('click', () => {
      openDrawForm(draw);
    });

    document.querySelector('[data-action="importar"]')?.addEventListener('click', async () => {
      UI.showLoading('Buscando comentários no Instagram...');
      const result = await API.importInstagramComments(draw.id, draw.mediaId, draw.postUrl);
      UI.hideLoading();

      if (!result.ok) {
        UI.toast(
          result.needsDeploy
            ? 'Integração do Instagram ainda não publicada no servidor.'
            : result.error,
          result.needsDeploy ? 'info' : 'error',
          6000
        );
        return;
      }
      if (!result.totalComentarios) {
        UI.toast('Nenhum comentário encontrado nesse post ainda.', 'info');
      } else {
        UI.toast(
          `${result.totalComentarios} comentário(s) importado(s), ${result.totalValidos} válido(s).`,
          'success'
        );
      }
      loadDetail(draw.id);
    });

    document.querySelectorAll('[data-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        participantFilter = btn.getAttribute('data-filter');
        renderDetail(currentDraw);
      });
    });

    document.querySelector('[data-action="copiar-comprovante"]')?.addEventListener('click', () => {
      copyText(proofText(draw), 'Comprovante copiado.');
    });

    // Ação com nome próprio: js/sorteio.js captura [data-action="sortear"] no documento
    document.querySelector('[data-action="sortear-instagram"]')?.addEventListener('click', () => {
      openDrawModal(draw, validCount);
    });
  }

  /* ─── Modal do sorteio ───────────────────────────────────── */

  function openDrawModal(draw, validCount) {
    const pool = (draw.participants || []).filter((p) => p.valid).map((p) => `@${p.username}`);
    let concluido = false;

    const body = document.createElement('div');
    body.innerHTML = `
      <div class="draw-setup" id="ig-draw-setup">
        <p class="form-hint" style="margin-bottom:0.85rem;">
          ${validCount} perfil(is) concorrendo, seguindo as regras:
          <strong>${UI.escapeHtml(rulesSummary(draw.rules))}</strong>
        </p>
        <div class="form-group">
          <label for="ig-draw-count">Quantidade de ganhadores</label>
          <input id="ig-draw-count" type="number" min="1" max="${validCount}" value="1">
        </div>
      </div>
      <div class="draw-stage" id="ig-draw-stage" hidden>
        <p class="draw-stage__label">Sorteando...</p>
        <div class="draw-stage__number" id="ig-draw-spin">—</div>
        <p class="draw-stage__hint">Gerando o seed no servidor</p>
      </div>
      <div class="draw-result" id="ig-draw-result" hidden></div>`;

    UI.modal({
      title: 'Sorteio do Instagram',
      body,
      actions: [
        {
          label: 'Iniciar sorteio',
          className: 'btn-success',
          onClick: async (close) => {
            if (concluido) {
              close();
              loadDetail(draw.id);
              return;
            }

            const setup = document.getElementById('ig-draw-setup');
            const stage = document.getElementById('ig-draw-stage');
            const resultBox = document.getElementById('ig-draw-result');
            const actionBtn = document.querySelector('#app-modal .modal-footer .btn-success');

            let count = Number(document.getElementById('ig-draw-count')?.value) || 1;
            count = Math.min(Math.max(1, count), validCount);

            if (setup) setup.hidden = true;
            if (stage) stage.hidden = false;
            if (actionBtn) {
              actionBtn.disabled = true;
              actionBtn.textContent = 'Sorteando...';
            }

            const spinEl = document.getElementById('ig-draw-spin');
            const spinTimer = setInterval(() => {
              if (spinEl && pool.length) {
                spinEl.textContent = pool[Math.floor(Math.random() * pool.length)];
              }
            }, 90);

            const [result] = await Promise.all([
              API.drawInstagramWinners(draw.id, count),
              new Promise((r) => setTimeout(r, 2000))
            ]);
            clearInterval(spinTimer);

            if (!result.ok) {
              if (stage) stage.hidden = true;
              if (setup) setup.hidden = false;
              if (actionBtn) {
                actionBtn.disabled = false;
                actionBtn.textContent = 'Iniciar sorteio';
              }
              UI.toast(result.error, 'error');
              return;
            }

            const winners = result.resultado?.vencedores || [];
            if (stage) stage.hidden = true;
            if (resultBox) {
              resultBox.hidden = false;
              resultBox.innerHTML = `
                <p class="draw-result__title">Ganhador${winners.length > 1 ? 'es' : ''}</p>
                ${winners.map((w) => `
                  <div class="draw-winner-card">
                    <div class="draw-winner-card__place">${w.place}º lugar</div>
                    <div class="draw-winner-card__num">@${UI.escapeHtml(w.nomeInstagram)}</div>
                    <p>${UI.escapeHtml(w.comentario || '')}</p>
                  </div>`).join('')}
                <p class="form-hint" style="margin-top:0.85rem;">
                  O comprovante com o seed ficou salvo na página do sorteio.
                </p>`;
            }

            concluido = true;
            if (actionBtn) {
              actionBtn.disabled = false;
              actionBtn.textContent = 'Ver comprovante';
            }

            if (typeof Sorteio !== 'undefined') Sorteio.burstConfetti();
            UI.toast('Sorteio concluído.', 'success');
          }
        }
      ],
      onClose: () => loadDetail(draw.id)
    });
  }

  async function loadDetail(id) {
    UI.showLoading('Carregando sorteio...');
    await ensureConnection();
    const result = await API.getInstagramDraw(id);
    UI.hideLoading();

    if (!result.ok) {
      UI.toast(result.error, 'error');
      go('sorteios.html');
      return;
    }
    renderDetail(result.draw);
  }

  /* ─── Init ───────────────────────────────────────────────── */

  function showEmDesenvolvimentoModal() {
    Layout.setContent(`
      <div class="slide-up">
        <h1 class="page-title">Sorteios do Instagram</h1>
        <p class="page-subtitle">Esta função ainda não está disponível para uso.</p>
        <div class="card empty-state" style="margin-top:1.25rem;">
          <h3>Em testes e desenvolvimento</h3>
          <p>Estamos finalizando a integração com o Instagram. Em breve você poderá criar e sortear por aqui.</p>
        </div>
      </div>`);

    UI.modal({
      title: 'Sorteios do Instagram',
      body: `
        <p style="margin:0;">
          Esta função está em <strong>testes e desenvolvimento</strong>.
          Ainda não está liberada para uso.
        </p>`,
      actions: [
        { label: 'Entendi', className: 'btn-primary', onClick: (close) => close() }
      ]
    });
  }

  async function init() {
    const session = await Layout.render({ active: 'sorteios', title: 'Sorteios do Instagram' });
    if (!session) return;
    showEmDesenvolvimentoModal();
  }

  return { init, loadList, loadDetail };
})();

window.SorteioInstagram = SorteioInstagram;
