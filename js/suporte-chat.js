/**
 * Chat de suporte (usuário Pro ↔ desenvolvedor)
 */
const SuporteChat = (() => {
  let liveSub = null;
  let pollTimer = null;
  let activeUserId = null;
  let asDev = false;
  let activePeerName = 'Usuário';

  function escape(s) {
    return typeof UI !== 'undefined' && UI.escapeHtml
      ? UI.escapeHtml(String(s ?? ''))
      : String(s ?? '');
  }

  function formatWhen(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  }

  function stopLive() {
    if (liveSub?.unsubscribe) {
      try {
        liveSub.unsubscribe();
      } catch {
        /* ignore */
      }
    }
    liveSub = null;
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    activeUserId = null;
    activePeerName = 'Usuário';
  }

  function peerDisplayName(name) {
    const cleaned = String(name || '').trim();
    return cleaned || 'Usuário';
  }

  const EDIT_WINDOW_MS = 15 * 60 * 1000;

  function messagesSignature(messages = []) {
    return (messages || [])
      .map(
        (m) =>
          `${m.id}:${m.read ? 1 : 0}:${m.editedAt || ''}:${String(m.body || '').length}`
      )
      .join('|');
  }

  function isOwnMessage(m, mineIsDev) {
    return mineIsDev
      ? (m.from || m.sender) === 'dev'
      : (m.from || m.sender) === 'usuario';
  }

  function canEditMessage(m, mineIsDev) {
    if (!isOwnMessage(m, mineIsDev) || !m?.id) return false;
    if (!m.createdAt) return true;
    const created = new Date(m.createdAt).getTime();
    if (!Number.isFinite(created)) return true;
    return Date.now() - created <= EDIT_WINDOW_MS;
  }

  function closeMessageMenu() {
    document.getElementById('pas-chat-msg-menu')?.remove();
    document.getElementById('pas-chat-msg-menu-backdrop')?.remove();
  }

  function showMessageMenu({ bubble, onEdit, anchorRoot = null }) {
    closeMessageMenu();
    const backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.id = 'pas-chat-msg-menu-backdrop';
    backdrop.className = 'pas-chat-msg-menu-backdrop';
    backdrop.setAttribute('aria-label', 'Fechar menu');
    backdrop.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeMessageMenu();
    });

    const menu = document.createElement('div');
    menu.id = 'pas-chat-msg-menu';
    menu.className = 'pas-chat-msg-menu';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = `
      <button type="button" class="pas-chat-msg-menu__item" role="menuitem" data-action="edit">
        <span aria-hidden="true">✎</span> Editar
      </button>
      <button type="button" class="pas-chat-msg-menu__item pas-chat-msg-menu__item--muted" role="menuitem" data-action="cancel">
        Cancelar
      </button>`;

    const rect = bubble.getBoundingClientRect();
    const preferTop = rect.top > 140;
    menu.style.left = `${Math.min(Math.max(12, rect.left), window.innerWidth - 200)}px`;
    if (preferTop) {
      menu.style.top = `${Math.max(12, rect.top - 8)}px`;
      menu.style.transform = 'translateY(-100%)';
    } else {
      menu.style.top = `${Math.min(window.innerHeight - 12, rect.bottom + 8)}px`;
    }

    menu.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const action = btn.getAttribute('data-action');
      closeMessageMenu();
      if (action === 'edit' && typeof onEdit === 'function') onEdit();
    });

    const host = document.body;
    host.appendChild(backdrop);
    host.appendChild(menu);
    // Garante acima de modais do painel
    backdrop.style.zIndex = '5000';
    menu.style.zIndex = '5001';
    void anchorRoot;
  }

  function renderMessages(listEl, messages, { mineIsDev, peerName }) {
    if (!listEl) return;
    // Não recria o DOM enquanto o usuário edita (evita perder o texto no campo)
    if (listEl.dataset.pasEditing === '1') {
      listEl._pasMessages = messages || [];
      return;
    }
    listEl._pasMessages = messages || [];
    if (!messages.length) {
      listEl.innerHTML = '<p class="pas-chat-empty">Nenhuma mensagem ainda. Comece a conversa.</p>';
      return;
    }
    const otherLabel = mineIsDev ? peerDisplayName(peerName) : 'Suporte';
    const nearBottom = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 80;
    listEl.innerHTML = messages
      .map((m) => {
        const mine = isOwnMessage(m, mineIsDev);
        const editable = canEditMessage(m, mineIsDev);
        const delivery = mine ? (m.read ? 'Visualizada' : 'Enviada') : '';
        const edited = m.edited || m.editedAt;
        return `
          <div class="pas-chat-bubble ${mine ? 'is-mine' : 'is-theirs'}${editable ? ' is-editable' : ''}"
               data-msg-id="${escape(String(m.id))}"
               ${mine ? 'data-mine="1"' : ''}
               ${editable ? 'data-can-edit="1"' : ''}>
            <strong>${escape(mine ? 'Você' : otherLabel)}</strong>
            <p>${escape(m.body).replace(/\n/g, '<br>')}</p>
            <span class="pas-chat-bubble__meta">
              ${edited ? '<span class="pas-chat-bubble__edited">Editada</span>' : ''}
              <em>${escape(formatWhen(m.createdAt))}</em>
              ${
                delivery
                  ? `<span class="pas-chat-bubble__read ${m.read ? 'is-read' : ''}" aria-label="${delivery}">${
                      m.read ? '✓✓' : '✓'
                    } ${delivery}</span>`
                  : ''
              }
            </span>
            ${
              editable
                ? `<button type="button" class="pas-chat-bubble__edit" data-edit-msg="${escape(String(m.id))}" aria-label="Editar mensagem">Editar</button>`
                : ''
            }
          </div>`;
      })
      .join('');
    if (nearBottom) listEl.scrollTop = listEl.scrollHeight;
  }

  function setTypingIndicator(root, { peerTyping, peerName }) {
    if (!root) return;
    const typingEl = root.querySelector('[data-pas-chat-typing]');
    const dockTitles = root.closest('.pas-chat-dock-window')?.querySelector('.pas-chat-dock-window__titles em');
    const label = peerDisplayName(peerName);
    if (typingEl) {
      if (peerTyping) {
        typingEl.hidden = false;
        typingEl.innerHTML = `
          <span class="pas-chat-typing__dots" aria-hidden="true"><i></i><i></i><i></i></span>
          <strong>${escape(label)}</strong> está digitando…`;
      } else {
        typingEl.hidden = true;
        typingEl.innerHTML = '';
      }
    }
    if (dockTitles) {
      if (peerTyping) {
        if (!dockTitles.dataset.baseText) {
          dockTitles.dataset.baseText = dockTitles.textContent || '';
        }
        dockTitles.textContent = 'digitando…';
        dockTitles.classList.add('is-typing');
      } else {
        dockTitles.classList.remove('is-typing');
        if (dockTitles.dataset.baseText != null) {
          dockTitles.textContent = dockTitles.dataset.baseText;
        }
      }
    }
  }

  async function reloadThread(userId, listEl, mineIsDev, peerName, { markRead = true, root = null } = {}) {
    const useLive = typeof API.getSupportLive === 'function';
    const prevSig = listEl?.dataset?.msgSig || '';
    const res = useLive
      ? await API.getSupportLive(userId, { sig: prevSig })
      : await API.listSupportMessages(userId, { limit: 200 });
    if (!res?.ok) {
      if (typeof UI !== 'undefined') {
        UI.toast(res?.error || 'Não foi possível carregar o chat.', 'error');
      }
      return res;
    }

    const host = root || listEl?.closest('.pas-chat') || listEl?.closest('.pas-chat-dock-window');
    const peerTyping = mineIsDev ? !!res.typingUser : !!res.typingDev;
    setTypingIndicator(host, { peerTyping, peerName });

    if (res.unchanged) {
      if (listEl && res.signature) listEl.dataset.msgSig = res.signature;
      if (markRead) {
        API.markSupportMessagesRead({ userId, asDev: mineIsDev }).catch(() => {});
      }
      return res;
    }

    const nextSig = res.signature || messagesSignature(res.messages || []);
    if (listEl && nextSig !== prevSig) {
      renderMessages(listEl, res.messages || [], { mineIsDev, peerName });
      listEl.dataset.msgSig = nextSig;
    } else if (listEl && res.signature) {
      listEl.dataset.msgSig = res.signature;
    }

    if (markRead) {
      // Não limpa msgSig (evita recriar a lista a cada 1s e quebrar o toque/edição)
      API.markSupportMessagesRead({ userId, asDev: mineIsDev })
        .then(() => {
          document.dispatchEvent(
            new CustomEvent('pas:support-unread-changed', {
              detail: { userId, asDev: mineIsDev }
            })
          );
        })
        .catch(() => {});
    }
    return res;
  }

  function bindComposer({ listEl, form, input, errorEl, userId, mineIsDev, peerName, shouldMarkRead }) {
    const root = listEl?.closest('.pas-chat') || form?.closest('.pas-chat');
    const editBar = root?.querySelector('[data-pas-chat-edit-bar]');
    const editCancelBtn = root?.querySelector('[data-pas-chat-edit-cancel]');
    let typingTimer = null;
    let typingActive = false;
    let lastTypingSent = 0;
    let editingMessageId = null;
    let pressTimer = null;
    let pressBubble = null;
    let pressMoved = false;
    let openedByLongPress = false;
    let ignoreClickUntil = 0;

    const sendTyping = (typing) => {
      if (typeof API.setSupportTyping !== 'function') return;
      typingActive = !!typing;
      API.setSupportTyping({ userId, asDev: mineIsDev, typing: !!typing }).catch(() => {});
    };

    const pulseTyping = () => {
      const now = Date.now();
      if (!typingActive || now - lastTypingSent > 1200) {
        lastTypingSent = now;
        sendTyping(true);
      }
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => {
        sendTyping(false);
      }, 1800);
    };

    const stopTyping = () => {
      clearTimeout(typingTimer);
      typingTimer = null;
      if (typingActive) sendTyping(false);
    };

    const exitEditMode = () => {
      editingMessageId = null;
      form?.classList.remove('is-editing');
      if (listEl) delete listEl.dataset.pasEditing;
      if (editBar) editBar.hidden = true;
      if (input) {
        input.placeholder = 'Escreva sua mensagem…';
      }
    };

    const enterEditMode = (message) => {
      if (!message?.id || !input) return;
      if (!canEditMessage(message, mineIsDev)) {
        if (typeof UI !== 'undefined') {
          UI.toast('O tempo para editar esta mensagem expirou (15 minutos).', 'info');
        }
        return;
      }
      closeMessageMenu();
      editingMessageId = message.id;
      if (listEl) listEl.dataset.pasEditing = '1';
      form?.classList.add('is-editing');
      if (editBar) editBar.hidden = false;
      input.value = String(message.body || '');
      input.placeholder = 'Edite sua mensagem…';
      autosize();
      // Foco após o menu fechar (mobile)
      setTimeout(() => {
        input.focus();
        const len = input.value.length;
        try {
          input.setSelectionRange(len, len);
        } catch {
          /* ignore */
        }
      }, 30);
    };

    const findMessage = (id) =>
      (listEl?._pasMessages || []).find((m) => String(m.id) === String(id));

    const openActionsForBubble = (bubble) => {
      if (!bubble) return;
      const id = bubble.getAttribute('data-msg-id');
      const message = findMessage(id);
      if (!message) {
        if (typeof UI !== 'undefined') {
          UI.toast('Não foi possível carregar esta mensagem para editar.', 'error');
        }
        return;
      }
      if (!canEditMessage(message, mineIsDev)) {
        if (typeof UI !== 'undefined') {
          UI.toast('O tempo para editar esta mensagem expirou (15 minutos).', 'info');
        }
        return;
      }
      // Vai direto para o campo (mais confiável no celular)
      enterEditMode(message);
    };

    const clearPress = () => {
      clearTimeout(pressTimer);
      pressTimer = null;
      pressBubble = null;
      pressMoved = false;
      openedByLongPress = false;
    };

    const refresh = (opts = {}) => {
      const markRead =
        opts.markRead != null
          ? !!opts.markRead
          : typeof shouldMarkRead === 'function'
            ? !!shouldMarkRead()
            : true;
      return reloadThread(userId, listEl, mineIsDev, peerName, { markRead, root });
    };

    const autosize = () => {
      if (!input) return;
      const maxHeight = 120;
      input.style.overflowY = 'hidden';
      input.style.height = 'auto';
      const nextHeight = Math.min(input.scrollHeight, maxHeight);
      input.style.height = `${nextHeight}px`;
      input.style.overflowY = input.scrollHeight > maxHeight ? 'auto' : 'hidden';
    };

    input?.addEventListener('input', () => {
      autosize();
      if (editingMessageId) return;
      if (String(input.value || '').trim()) pulseTyping();
      else stopTyping();
    });
    input?.addEventListener('blur', () => stopTyping());
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && editingMessageId) {
        e.preventDefault();
        exitEditMode();
        if (input) {
          input.value = '';
          autosize();
        }
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form?.requestSubmit?.();
      }
    });

    editCancelBtn?.addEventListener('click', () => {
      exitEditMode();
      if (input) {
        input.value = '';
        autosize();
        input.focus();
      }
    });

    listEl?.addEventListener('click', (e) => {
      if (Date.now() < ignoreClickUntil) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const editBtn = e.target.closest('[data-edit-msg]');
      if (editBtn && listEl.contains(editBtn)) {
        e.preventDefault();
        e.stopPropagation();
        const message = findMessage(editBtn.getAttribute('data-edit-msg'));
        if (message) enterEditMode(message);
        return;
      }
      const bubble = e.target.closest('.pas-chat-bubble[data-mine="1"]');
      if (!bubble || !listEl.contains(bubble)) return;
      if (window.getSelection && String(window.getSelection()).trim()) return;
      e.preventDefault();
      openActionsForBubble(bubble);
    });

    listEl?.addEventListener('contextmenu', (e) => {
      const bubble = e.target.closest('.pas-chat-bubble[data-mine="1"]');
      if (!bubble || !listEl.contains(bubble)) return;
      e.preventDefault();
      openActionsForBubble(bubble);
    });

    listEl?.addEventListener('dblclick', (e) => {
      const bubble = e.target.closest('.pas-chat-bubble[data-mine="1"]');
      if (!bubble || !listEl.contains(bubble)) return;
      e.preventDefault();
      openActionsForBubble(bubble);
    });

    listEl?.addEventListener(
      'touchstart',
      (e) => {
        const bubble = e.target.closest('.pas-chat-bubble[data-mine="1"]');
        if (!bubble || !listEl.contains(bubble)) return;
        if (e.target.closest('[data-edit-msg]')) return;
        pressMoved = false;
        openedByLongPress = false;
        pressBubble = bubble;
        clearTimeout(pressTimer);
        pressTimer = setTimeout(() => {
          if (!pressBubble || pressMoved) return;
          openedByLongPress = true;
          ignoreClickUntil = Date.now() + 700;
          openActionsForBubble(pressBubble);
          pressTimer = null;
        }, 380);
      },
      { passive: true }
    );

    listEl?.addEventListener(
      'touchmove',
      () => {
        if (!pressTimer && !pressBubble) return;
        pressMoved = true;
        clearTimeout(pressTimer);
        pressTimer = null;
      },
      { passive: true }
    );

    listEl?.addEventListener(
      'touchend',
      () => {
        const bubble = pressBubble;
        const quickTap = !!pressTimer && !pressMoved && !openedByLongPress;
        clearTimeout(pressTimer);
        pressTimer = null;
        pressBubble = null;
        if (openedByLongPress) {
          openedByLongPress = false;
          ignoreClickUntil = Date.now() + 700;
          pressMoved = false;
          return;
        }
        if (quickTap && bubble) {
          ignoreClickUntil = Date.now() + 700;
          openActionsForBubble(bubble);
        }
        pressMoved = false;
      },
      { passive: true }
    );

    listEl?.addEventListener('touchcancel', () => clearPress(), { passive: true });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = String(input?.value || '').trim();
      if (!body) return;
      if (errorEl) errorEl.hidden = true;
      const btn = form.querySelector('[type="submit"]');
      if (btn) btn.disabled = true;
      stopTyping();
      try {
        const editingId = editingMessageId;
        const res = editingId
          ? await API.editSupportMessage({
              id: editingId,
              body,
              asDev: mineIsDev
            })
          : await API.sendSupportMessage({
              userId,
              body,
              asDev: mineIsDev
            });
        if (!res?.ok) {
          if (errorEl) {
            errorEl.textContent = res?.error || (editingId ? 'Falha ao editar.' : 'Falha ao enviar.');
            errorEl.hidden = false;
          }
          if (typeof UI !== 'undefined') {
            UI.toast(res?.error || (editingId ? 'Falha ao editar.' : 'Falha ao enviar.'), 'error');
          }
          return;
        }
        exitEditMode();
        if (input) {
          input.value = '';
          autosize();
        }
        // Atualização otimista: mostra na hora sem esperar o poll
        if (res.message && listEl) {
          const current = Array.isArray(listEl._pasMessages) ? listEl._pasMessages.slice() : [];
          const mapped = {
            ...res.message,
            from: res.message.from || res.message.sender || (mineIsDev ? 'dev' : 'usuario'),
            sender: res.message.sender || res.message.from || (mineIsDev ? 'dev' : 'usuario'),
            body: res.message.body || body,
            read: Boolean(res.message.read),
            edited: Boolean(res.message.edited || res.message.editedAt),
            editedAt: res.message.editedAt || null
          };
          if (editingId) {
            const idx = current.findIndex((m) => String(m.id) === String(editingId));
            if (idx >= 0) current[idx] = { ...current[idx], ...mapped };
            else current.push(mapped);
          } else {
            current.push(mapped);
          }
          renderMessages(listEl, current, { mineIsDev, peerName });
          listEl.dataset.msgSig = '';
          listEl.scrollTop = listEl.scrollHeight;
        } else if (listEl) {
          listEl.dataset.msgSig = '';
        }
        refresh({ markRead: true }).catch(() => {});
        if (editingId && typeof UI !== 'undefined') {
          UI.toast('Mensagem editada.', 'success');
        }
      } finally {
        if (btn) btn.disabled = false;
        input?.focus();
      }
    });

    autosize();
    return Object.assign(refresh, {
      stopTyping: () => {
        stopTyping();
        closeMessageMenu();
        clearPress();
      }
    });
  }

  const LIVE_POLL_MS = 1200;
  const DOCK_POLL_MS = 1200;
  const INCOMING_FAST_MS = 2500;
  const INCOMING_IDLE_MS = 8000;

  function startLive(_userId, refresh) {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    let busy = false;
    pollTimer = setInterval(async () => {
      if (document.hidden || busy) return;
      busy = true;
      try {
        await refresh({ markRead: true });
      } catch {
        /* ignore */
      } finally {
        busy = false;
      }
    }, LIVE_POLL_MS);
  }

  function chatShellHTML({ metaHtml }) {
    return `
      <div class="pas-chat">
        ${metaHtml || ''}
        <div class="pas-chat-list" data-pas-chat-list>
          <p class="pas-chat-empty">Carregando…</p>
        </div>
        <div class="pas-chat-typing" data-pas-chat-typing hidden aria-live="polite"></div>
        <div class="pas-chat-edit-bar" data-pas-chat-edit-bar hidden>
          <div class="pas-chat-edit-bar__text">
            <strong>Editando mensagem</strong>
            <span>Corrija o texto e toque em enviar</span>
          </div>
          <button type="button" class="pas-chat-edit-bar__cancel" data-pas-chat-edit-cancel>Cancelar</button>
        </div>
        <form class="pas-chat-form" data-pas-chat-form>
          <div class="pas-chat-composer">
            <textarea data-pas-chat-input rows="1" maxlength="4000" placeholder="Escreva sua mensagem…" required></textarea>
            <button type="submit" class="pas-chat-send" aria-label="Enviar mensagem">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                <path fill="currentColor" d="M3.4 20.6 21 12 3.4 3.4l.1 6.8L15 12 3.5 13.8z"/>
              </svg>
            </button>
          </div>
        </form>
        <p class="form-error" data-pas-chat-error hidden></p>
      </div>`;
  }

  /* —— Janelas flutuantes estilo Messenger (várias ao mesmo tempo) —— */
  const dockWindows = new Map();
  const MAX_DOCK_WINDOWS = 4;
  let incomingWatchTimer = null;
  let incomingWatchBusy = false;
  let knownUnreadByUser = new Map();

  function avatarUrl(photo) {
    if (window.PAS_AVATAR && typeof PAS_AVATAR.resolve === 'function') {
      return PAS_AVATAR.resolve(photo);
    }
    const list = window.PAS_DEFAULT_AVATARS || [];
    return String(photo || '').trim() || list[0]?.src || '';
  }

  function ensureDockRoot() {
    let root = document.getElementById('pas-chat-dock');
    if (!root) {
      root = document.createElement('div');
      root.id = 'pas-chat-dock';
      root.className = 'pas-chat-dock';
      root.setAttribute('aria-live', 'polite');
      document.body.appendChild(root);
    }
    return root;
  }

  function stopDockEntry(entry) {
    if (!entry) return;
    if (typeof entry.refresh?.stopTyping === 'function') {
      try {
        entry.refresh.stopTyping();
      } catch {
        /* ignore */
      }
    }
    if (entry.liveSub?.unsubscribe) {
      try {
        entry.liveSub.unsubscribe();
      } catch {
        /* ignore */
      }
    }
    if (entry.pollTimer) clearInterval(entry.pollTimer);
    entry.liveSub = null;
    entry.pollTimer = null;
  }

  function layoutDockWindows() {
    const root = document.getElementById('pas-chat-dock');
    if (!root) return;
    const order = Array.from(dockWindows.values()).sort((a, b) => a.openedAt - b.openedAt);
    root.replaceChildren(...order.map((w) => w.el));
  }

  function updateFabUnreadBadge(total) {
    const fab = document.getElementById('dev-message-fab');
    if (!fab) return;
    let badge = fab.querySelector('.pas-admin-fab__badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'pas-admin-fab__badge';
      badge.setAttribute('aria-hidden', 'true');
      fab.appendChild(badge);
    }
    const n = Math.max(0, Number(total) || 0);
    if (n > 0) {
      badge.hidden = false;
      badge.textContent = n > 9 ? '9+' : String(n);
    } else {
      badge.hidden = true;
      badge.textContent = '';
    }
  }

  function setDockUnread(entry, count) {
    if (!entry) return;
    const n = Math.max(0, Number(count) || 0);
    entry.unread = n;
    const badge = entry.el.querySelector('[data-dock-unread]');
    if (!badge) return;
    if (n > 0) {
      badge.hidden = false;
      badge.textContent = n > 9 ? '9+' : String(n);
      entry.el.classList.add('has-unread');
    } else {
      badge.hidden = true;
      badge.textContent = '';
      entry.el.classList.remove('has-unread');
    }
  }

  function closeDockWindow(userId) {
    const id = String(userId);
    const entry = dockWindows.get(id);
    if (!entry) return;
    stopDockEntry(entry);
    entry.el.remove();
    dockWindows.delete(id);
    if (!dockWindows.size) {
      document.getElementById('pas-chat-dock')?.remove();
    } else {
      layoutDockWindows();
    }
    document.dispatchEvent(new CustomEvent('pas:support-dock-changed'));
  }

  function setDockMinimized(entry, minimized) {
    if (!entry) return;
    entry.minimized = !!minimized;
    entry.el.classList.toggle('is-minimized', entry.minimized);
    entry.el.setAttribute('aria-expanded', entry.minimized ? 'false' : 'true');
    if (!entry.minimized) {
      entry
        .refresh?.({ markRead: true })
        ?.then?.(() => {
          setDockUnread(entry, 0);
          knownUnreadByUser.set(String(entry.userId), 0);
        })
        .catch?.(() => {});
      const input = entry.el.querySelector('[data-pas-chat-input]');
      setTimeout(() => input?.focus(), 60);
    }
  }

  function focusDockWindow(userId) {
    const entry = dockWindows.get(String(userId));
    if (!entry) return null;
    entry.openedAt = Date.now();
    setDockMinimized(entry, false);
    layoutDockWindows();
    entry.el.classList.remove('is-pulse');
    void entry.el.offsetWidth;
    entry.el.classList.add('is-pulse');
    return entry;
  }

  function syncDockPresence(users = []) {
    const byId = new Map((users || []).map((u) => [String(u.id), u]));
    dockWindows.forEach((entry, id) => {
      const u = byId.get(id);
      const online =
        u && typeof API !== 'undefined' && typeof API.isUserOnline === 'function'
          ? API.isUserOnline(u)
          : entry.online;
      entry.online = !!online;
      if (u?.photo) {
        const img = entry.el.querySelector('.pas-chat-dock-window__avatar img');
        const next = avatarUrl(u.photo);
        if (img && img.getAttribute('src') !== next) img.setAttribute('src', next);
      }
      if (u?.name) {
        const strong = entry.el.querySelector('.pas-chat-dock-window__titles strong');
        if (strong) strong.textContent = peerDisplayName(u.name);
      }
      const badge = entry.el.querySelector('[data-dock-presence]');
      if (!badge) return;
      badge.classList.toggle('is-online', entry.online);
      badge.classList.toggle('is-offline', !entry.online);
      badge.title = entry.online ? 'Online agora' : 'Offline';
    });
  }

  function evictDockIfNeeded() {
    if (dockWindows.size < MAX_DOCK_WINDOWS) return;
    const list = Array.from(dockWindows.values()).sort((a, b) => a.openedAt - b.openedAt);
    const withoutUnread = list.find((e) => !e.unread);
    const victim = withoutUnread || list[0];
    if (victim) closeDockWindow(victim.userId);
  }

  function openDockWindow({
    userId,
    userName = 'Usuário',
    userEmail = '',
    photo = '',
    online = false,
    asDeveloper = true,
    startMinimized = false,
    unread = 0,
    incoming = false
  } = {}) {
    if (!userId) return null;
    const id = String(userId);
    const existing = dockWindows.get(id);
    if (existing) {
      if (incoming) {
        const prev = Number(existing.unread || 0);
        const next = Math.max(prev, Number(unread) || 0);
        setDockUnread(existing, next);
        if (existing.minimized) {
          existing.el.classList.remove('is-pulse');
          void existing.el.offsetWidth;
          existing.el.classList.add('is-pulse');
          existing.refresh?.({ markRead: false });
        } else {
          existing.refresh?.({ markRead: true })?.then?.(() => setDockUnread(existing, 0));
        }
        return existing;
      }
      return focusDockWindow(id);
    }

    evictDockIfNeeded();

    const peerName = peerDisplayName(userName);
    const mineIsDev = asDeveloper !== false;
    const root = ensureDockRoot();
    const el = document.createElement('section');
    el.className = `pas-chat-dock-window${startMinimized ? ' is-minimized' : ''}`;
    el.setAttribute('data-dock-user-id', id);
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', `Chat com ${peerName}`);
    el.setAttribute('aria-expanded', startMinimized ? 'false' : 'true');
    el.innerHTML = `
      <span class="pas-chat-dock-window__badge" data-dock-unread hidden aria-hidden="true"></span>
      <header class="pas-chat-dock-window__head" data-dock-toggle>
        <span class="pas-chat-dock-window__avatar" aria-hidden="true">
          <img src="${escape(avatarUrl(photo))}" alt="">
          <i class="pas-chat-dock-window__presence ${online ? 'is-online' : 'is-offline'}" data-dock-presence title="${
            online ? 'Online agora' : 'Offline'
          }"></i>
        </span>
        <span class="pas-chat-dock-window__titles">
          <strong>${escape(peerName)}</strong>
          <em>${escape(userEmail || '')}</em>
        </span>
        <span class="pas-chat-dock-window__actions">
          <button type="button" class="pas-chat-dock-window__btn" data-dock-minimize aria-label="Minimizar chat">–</button>
          <button type="button" class="pas-chat-dock-window__btn" data-dock-close aria-label="Fechar chat">×</button>
        </span>
      </header>
      <div class="pas-chat-dock-window__body">
        ${chatShellHTML({ metaHtml: '' })}
      </div>`;

    const listEl = el.querySelector('[data-pas-chat-list]');
    const form = el.querySelector('[data-pas-chat-form]');
    const input = el.querySelector('[data-pas-chat-input]');
    const errorEl = el.querySelector('[data-pas-chat-error]');

    const entry = {
      userId: Number(userId),
      el,
      peerName,
      online: !!online,
      minimized: !!startMinimized,
      unread: 0,
      openedAt: Date.now(),
      liveSub: null,
      pollTimer: null,
      refresh: null
    };

    entry.refresh = bindComposer({
      listEl,
      form,
      input,
      errorEl,
      userId: Number(userId),
      mineIsDev,
      peerName,
      shouldMarkRead: () => !entry.minimized
    });

    el.querySelector('[data-dock-close]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeDockWindow(id);
    });
    el.querySelector('[data-dock-minimize]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      setDockMinimized(entry, !entry.minimized);
    });
    el.querySelector('[data-dock-toggle]')?.addEventListener('click', (e) => {
      if (e.target.closest('[data-dock-close], [data-dock-minimize]')) return;
      if (entry.minimized) setDockMinimized(entry, false);
    });

    dockWindows.set(id, entry);
    root.appendChild(el);
    layoutDockWindows();
    if (Number(unread) > 0) setDockUnread(entry, unread);
    document.dispatchEvent(new CustomEvent('pas:support-dock-changed'));

    entry.refresh({ markRead: !entry.minimized }).then(() => {
      let busy = false;
      entry.pollTimer = setInterval(async () => {
        if (document.hidden || entry.minimized || busy) return;
        busy = true;
        try {
          await entry.refresh({ markRead: true });
        } catch {
          /* ignore */
        } finally {
          busy = false;
        }
      }, DOCK_POLL_MS);
      if (!entry.minimized) setTimeout(() => input?.focus(), 80);
    });

    return entry;
  }

  function resolveUserMeta(thread, users = []) {
    const id = String(thread.userId ?? thread.usuario_id ?? '');
    const fromCache = (users || []).find((u) => String(u.id) === id);
    return {
      userId: Number(thread.userId ?? thread.usuario_id),
      userName: fromCache?.name || thread.userName || thread.usuario_nome || 'Usuário',
      userEmail: fromCache?.email || thread.userEmail || thread.usuario_email || '',
      photo: fromCache?.photo || '',
      online:
        fromCache && typeof API !== 'undefined' && typeof API.isUserOnline === 'function'
          ? API.isUserOnline(fromCache)
          : false
    };
  }

  async function pollIncomingSupport({ users = [] } = {}) {
    if (incomingWatchBusy || typeof API === 'undefined' || typeof API.listSupportThreads !== 'function') {
      return;
    }
    incomingWatchBusy = true;
    try {
      const hasOpenDocks = dockWindows.size > 0;
      const res = await API.listSupportThreads({
        limit: hasOpenDocks ? 100 : 50,
        unreadOnly: !hasOpenDocks
      });
      if (!res?.ok) return;
      const threads = res.threads || [];
      let totalUnread = 0;
      let grew = false;

      // Com unreadOnly, zera badges de docks que não vieram na lista
      if (!hasOpenDocks) {
        knownUnreadByUser.forEach((_, key) => {
          if (!threads.some((t) => String(t.userId ?? t.usuario_id) === key)) {
            knownUnreadByUser.set(key, 0);
          }
        });
      }

      threads.forEach((t) => {
        const userId = Number(t.userId ?? t.usuario_id);
        if (!Number.isFinite(userId) || userId <= 0) return;
        const unread = Math.max(0, Number(t.unreadDev || 0) || 0);
        totalUnread += unread;
        const key = String(userId);
        const prev = knownUnreadByUser.has(key) ? Number(knownUnreadByUser.get(key) || 0) : null;
        knownUnreadByUser.set(key, unread);

        if (unread <= 0) {
          const open = dockWindows.get(key);
          if (open && !open.minimized) setDockUnread(open, 0);
          return;
        }

        if (prev != null && unread > prev) grew = true;

        const meta = resolveUserMeta(t, users);
        openDockWindow({
          ...meta,
          asDeveloper: true,
          startMinimized: true,
          unread,
          incoming: true
        });
      });

      if (hasOpenDocks) {
        updateFabUnreadBadge(totalUnread);
      } else {
        let sum = 0;
        knownUnreadByUser.forEach((n) => {
          sum += Math.max(0, Number(n) || 0);
        });
        updateFabUnreadBadge(Math.max(totalUnread, sum));
      }

      if (grew && typeof Notificacoes !== 'undefined' && typeof Notificacoes.playNotifSound === 'function') {
        try {
          Notificacoes.playNotifSound();
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      console.warn('pollIncomingSupport', err);
    } finally {
      incomingWatchBusy = false;
    }
  }

  function startDevIncomingWatcher(getUsers) {
    if (incomingWatchTimer) {
      clearInterval(incomingWatchTimer);
      incomingWatchTimer = null;
    }
    const tick = () => {
      if (document.hidden) return;
      const users = typeof getUsers === 'function' ? getUsers() : [];
      pollIncomingSupport({ users });
    };
    const schedule = () => {
      if (incomingWatchTimer) clearInterval(incomingWatchTimer);
      const fast =
        dockWindows.size > 0 ||
        document.body.classList.contains('dev-message-open');
      incomingWatchTimer = setInterval(tick, fast ? INCOMING_FAST_MS : INCOMING_IDLE_MS);
    };
    tick();
    schedule();
    if (!document.documentElement.dataset.pasSupportIncomingBound) {
      document.documentElement.dataset.pasSupportIncomingBound = '1';
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          tick();
          schedule();
        }
      });
      // Recalcula intervalo quando abre/fecha painel ou docks
      document.addEventListener('pas:support-unread-changed', schedule);
      document.addEventListener('pas:support-dock-changed', schedule);
      const mo = new MutationObserver(schedule);
      mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
  }

  function openChatModal({
    userId,
    userName = 'Usuário',
    userEmail = '',
    photo = '',
    online = false,
    asDeveloper = false
  } = {}) {
    if (!userId) return;

    // No portal do desenvolvedor: janela flutuante por usuário (estilo Facebook)
    if (asDeveloper) {
      openDockWindow({
        userId,
        userName,
        userEmail,
        photo,
        online,
        asDeveloper: true,
        startMinimized: false,
        incoming: false
      });
      return;
    }

    if (typeof UI === 'undefined' || typeof UI.modal !== 'function') return;

    const peerName = peerDisplayName(userName);
    stopLive();
    activeUserId = Number(userId);
    asDev = false;
    activePeerName = peerName;

    let refresh = null;
    UI.modal({
      title: 'Suporte PowerApps',
      dialogClass: 'modal-dialog--wide pas-chat-dialog',
      body: chatShellHTML({
        metaHtml: `<p class="pas-chat-meta">Converse com o suporte da PowerApps Sistemas.</p>`
      }),
      actions: [],
      onClose: () => {
        if (typeof refresh?.stopTyping === 'function') refresh.stopTyping();
        stopLive();
      }
    });

    const root = document.querySelector('.pas-chat-dialog .pas-chat') || document.querySelector('.pas-chat');
    const listEl = root?.querySelector('[data-pas-chat-list]');
    const form = root?.querySelector('[data-pas-chat-form]');
    const input = root?.querySelector('[data-pas-chat-input]');
    const errorEl = root?.querySelector('[data-pas-chat-error]');

    refresh = bindComposer({
      listEl,
      form,
      input,
      errorEl,
      userId: activeUserId,
      mineIsDev: false,
      peerName: activePeerName
    });

    refresh().then(() => {
      startLive(activeUserId, refresh);
      setTimeout(() => input?.focus(), 80);
    });
  }

  function mountInline(container, {
    userId,
    userName = '',
    userEmail = '',
    asDeveloper = false,
    metaText = ''
  } = {}) {
    if (!container || !userId) return null;
    stopLive();
    activeUserId = Number(userId);
    asDev = !!asDeveloper;
    activePeerName = peerDisplayName(userName);

    const meta =
      metaText ||
      (asDeveloper
        ? userEmail
        : 'Converse com o suporte da PowerApps Sistemas. Respostas aparecem aqui em tempo quase real.');

    container.innerHTML = chatShellHTML({
      metaHtml: `<p class="pas-chat-meta">${escape(meta)}</p>`
    });

    const listEl = container.querySelector('[data-pas-chat-list]');
    const form = container.querySelector('[data-pas-chat-form]');
    const input = container.querySelector('[data-pas-chat-input]');
    const errorEl = container.querySelector('[data-pas-chat-error]');

    const refresh = bindComposer({
      listEl,
      form,
      input,
      errorEl,
      userId: activeUserId,
      mineIsDev: asDev,
      peerName: activePeerName
    });

    refresh().then(() => {
      startLive(activeUserId, refresh);
      setTimeout(() => input?.focus(), 80);
    });

    return { refresh, stop: stopLive };
  }

  function openForCurrentUser() {
    const session = typeof Store !== 'undefined' ? Store.getSession() : null;
    if (!session?.userId) {
      if (typeof UI !== 'undefined') UI.toast('Faça login para falar com o suporte.', 'error');
      return;
    }
    if (typeof API !== 'undefined' && API.isVendasLocked?.(session)) {
      if (typeof Layout !== 'undefined' && typeof Layout.showSuporteLockedMessage === 'function') {
        Layout.showSuporteLockedMessage();
      } else if (typeof UI !== 'undefined') {
        UI.modal({
          title: 'Suporte bloqueado',
          body: `
            <p class="form-hint" style="margin:0">
              Na versão Free o chat de suporte fica bloqueado, como Vendas e Reservas.
              Realize o pagamento para liberar.
            </p>
          `,
          actions: [
            { label: 'Fechar', className: 'btn-ghost', onClick: (c) => c() },
            {
              label: 'Ir para pagamento',
              className: 'btn-primary',
              onClick: (c) => {
                c();
                window.location.href = 'pagamento.html';
              }
            }
          ]
        });
      }
      return;
    }
    openChatModal({
      userId: session.userId,
      userName: session.name || 'Você',
      userEmail: session.email || '',
      asDeveloper: false
    });
  }

  return {
    openChatModal,
    openDockWindow,
    closeDockWindow,
    syncDockPresence,
    startDevIncomingWatcher,
    pollIncomingSupport,
    openForCurrentUser,
    mountInline,
    stopLive
  };
})();

window.SuporteChat = SuporteChat;
