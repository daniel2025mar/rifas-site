/**
 * Sorteio de rifas — modal reutilizável
 */
const Sorteio = (() => {
  let delegated = false;

  function open(raffle) {
    if (!raffle?.id) {
      UI.toast('Rifa inválida para sorteio.', 'error');
      return;
    }

    const soldPool = (raffle.numbers || []).filter((n) => n.status === 'vendido');
    if (!soldPool.length) {
      UI.modal({
        title: 'Sorteio da rifa',
        body: `
          <p>Não há números <strong>vendidos</strong> cadastrados nesta rifa para sortear.</p>
          <p class="form-hint" style="margin-top:.65rem;">
            Confirme vendas em Visualizar Rifa e tente novamente.
          </p>`,
        actions: [{ label: 'Entendi', className: 'btn-primary', onClick: (c) => c() }]
      });
      return;
    }

    const raffleId = raffle.id;
    const maxWinners = soldPool.length;
    const body = document.createElement('div');
    body.innerHTML = `
      <div class="draw-setup" id="draw-setup">
        <p class="form-hint" style="margin-bottom:0.5rem;">
          <strong>${UI.escapeHtml(raffle.name || 'Rifa')}</strong>
        </p>
        <p class="form-hint" style="margin-bottom:0.85rem;">
          O sorteio usa apenas números <strong>vendidos</strong> cadastrados
          (${maxWinners} participante${maxWinners > 1 ? 's' : ''}).
        </p>
        <div class="form-group">
          <label for="draw-winners-count">Quantidade de ganhadores</label>
          <input id="draw-winners-count" type="number" min="1" max="${maxWinners}" value="1">
        </div>
      </div>
      <div class="draw-stage" id="draw-stage" hidden>
        <p class="draw-stage__label">Sorteando...</p>
        <div class="draw-stage__number" id="draw-spin-number">—</div>
        <p class="draw-stage__hint">Aguarde o resultado</p>
      </div>
      <div class="draw-result" id="draw-result" hidden></div>`;

    UI.modal({
      title: 'Sorteio da rifa',
      body,
      actions: [
        {
          label: 'Iniciar sorteio',
          className: 'btn-success',
          onClick: async () => {
            const setup = document.getElementById('draw-setup');
            const stage = document.getElementById('draw-stage');
            const resultBox = document.getElementById('draw-result');
            const countInput = document.getElementById('draw-winners-count');
            const actionBtn = document.querySelector('#app-modal .modal-footer .btn-success');
            let count = Number(countInput?.value || 1);
            if (!Number.isFinite(count) || count < 1) count = 1;
            if (count > maxWinners) count = maxWinners;

            if (setup) setup.hidden = true;
            if (resultBox) {
              resultBox.hidden = true;
              resultBox.innerHTML = '';
            }
            if (stage) stage.hidden = false;
            if (actionBtn) {
              actionBtn.disabled = true;
              actionBtn.textContent = 'Sorteando...';
            }

            const spinEl = document.getElementById('draw-spin-number');
            const poolNums = soldPool.map((n) => n.number);
            let ticks = 0;
            const spinTimer = setInterval(() => {
              const random = poolNums[Math.floor(Math.random() * poolNums.length)];
              if (spinEl) spinEl.textContent = random;
              ticks += 1;
              if (ticks > 18) clearInterval(spinTimer);
            }, 90);

            await new Promise((r) => setTimeout(r, 2000));
            clearInterval(spinTimer);

            const result = await API.drawWinners(raffleId, count);
            if (!result.ok) {
              if (stage) stage.hidden = true;
              if (setup) setup.hidden = false;
              if (actionBtn) {
                actionBtn.disabled = false;
                actionBtn.textContent = 'Iniciar sorteio';
              }
              UI.toast(result.error, result.needsSchema ? 'info' : 'error');
              return;
            }

            if (stage) stage.hidden = true;
            if (resultBox) {
              resultBox.hidden = false;
              resultBox.innerHTML = `
                <p class="draw-result__title">Ganhador${result.winners.length > 1 ? 'es' : ''} do sorteio</p>
                <p class="form-hint" style="margin-bottom:0.75rem;">
                  ${result.poolSize} número${result.poolSize > 1 ? 's' : ''} participante${result.poolSize > 1 ? 's' : ''}
                </p>
                ${result.winners.map((w) => `
                  <div class="draw-winner-card">
                    <div class="draw-winner-card__place">${w.place}º lugar</div>
                    <div class="draw-winner-card__num">${UI.escapeHtml(w.number)}</div>
                    <p><strong>Nome:</strong> ${UI.escapeHtml(w.name)}</p>
                    <p><strong>Telefone:</strong> ${w.phone && w.phone !== '—' ? UI.escapeHtml(UI.maskPhone(w.phone)) : '—'}</p>
                    <p><strong>Cidade:</strong> ${UI.escapeHtml(w.city)}</p>
                  </div>
                `).join('')}`;
            }

            if (actionBtn) {
              actionBtn.disabled = false;
              actionBtn.textContent = 'Sortear novamente';
            }
            burstConfetti();
            UI.toast('Sorteio concluido! Resultado visivel na rifa publica.', 'success');
          }
        }
      ]
    });
  }

  function burstConfetti() {
    document.getElementById('confetti-canvas')?.remove();
    const canvas = document.createElement('canvas');
    canvas.id = 'confetti-canvas';
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:9999;pointer-events:none;';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();

    const colors = ['#e11d2e', '#ff8a8a', '#fbbf24', '#34d399', '#60a5fa', '#ffffff', '#f472b6', '#c8102e'];
    const pieces = [];
    for (let i = 0; i < 110; i += 1) {
      pieces.push({
        x: Math.random() * w,
        y: -20 - Math.random() * h * 0.35,
        w: 6 + Math.random() * 8,
        h: 4 + Math.random() * 7,
        vx: (Math.random() - 0.5) * 6,
        vy: 2.5 + Math.random() * 4.5,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.35,
        color: colors[i % colors.length],
        round: Math.random() > 0.55
      });
    }

    const started = performance.now();
    const life = 3200;

    function frame(now) {
      const elapsed = now - started;
      ctx.clearRect(0, 0, w, h);
      pieces.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.045;
        p.vx *= 0.995;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, 1 - elapsed / life);
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w * 0.45, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      });

      if (elapsed < life) {
        requestAnimationFrame(frame);
      } else {
        canvas.remove();
        window.removeEventListener('resize', resize);
      }
    }

    window.addEventListener('resize', resize);
    requestAnimationFrame(frame);
  }

  async function openById(raffleId) {
    if (!raffleId) {
      UI.toast('Rifa não informada.', 'error');
      return;
    }

    UI.showLoading('Carregando rifa...');
    try {
      const result = await API.getRaffle(raffleId);
      UI.hideLoading();
      if (!result.ok) {
        UI.toast(result.error || 'Rifa não encontrada.', 'error');
        return;
      }
      open(result.raffle);
    } catch (err) {
      UI.hideLoading();
      console.error(err);
      UI.toast(err.message || 'Erro ao carregar rifa.', 'error');
    }
  }

  function onClick(e) {
    const btn = e.target.closest('[data-action="sortear"]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const id = btn.getAttribute('data-raffle-id') || btn.dataset.raffleId;
    openById(id);
  }

  function bind() {
    if (delegated) return;
    delegated = true;
    document.addEventListener('click', onClick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  return { open, openById, bind, burstConfetti };
})();

window.Sorteio = Sorteio;
