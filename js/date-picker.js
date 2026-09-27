/**
 * Calendário personalizado PowerApps Sistemas
 * Substitui o seletor nativo type="date" por popup customizado.
 */
(function (global) {
  'use strict';

  const MONTHS = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function toIso(y, m, d) {
    return `${y}-${pad2(m)}-${pad2(d)}`;
  }

  function parseIso(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return { y, m: mo, d };
  }

  function formatDisplay(iso) {
    const p = parseIso(iso);
    if (!p) return '';
    return `${pad2(p.d)}/${pad2(p.m)}/${p.y}`;
  }

  function todayParts() {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
  }

  function daysInMonth(y, m) {
    return new Date(y, m, 0).getDate();
  }

  function compareIso(a, b) {
    if (a === b) return 0;
    return a < b ? -1 : 1;
  }

  function PasDatePicker(wrap, options) {
    this.wrap = wrap;
    this.options = Object.assign(
      {
        maxToday: wrap.dataset.maxToday === 'true',
        minYear: Number(wrap.dataset.minYear) || 1900,
        placeholder: 'Selecione a data'
      },
      options || {}
    );

    this.hidden =
      wrap.querySelector('input[type="hidden"]') ||
      wrap.querySelector('input[name="dataNascimento"]') ||
      wrap.querySelector('input');
    this.trigger = wrap.querySelector('.pas-date-picker__trigger');
    this.labelEl = wrap.querySelector('.pas-date-picker__label');

    if (!this.hidden || !this.trigger) return;

    this.popup = null;
    this.open = false;
    this.viewMode = 'days';
    this.viewY = todayParts().y;
    this.viewM = todayParts().m;

    const initial = parseIso(this.hidden.value);
    if (initial) {
      this.viewY = initial.y;
      this.viewM = initial.m;
    }

    this.syncTriggerLabel();
    this.bind();
  }

  PasDatePicker.prototype.syncTriggerLabel = function syncTriggerLabel() {
    const iso = String(this.hidden.value || '').trim();
    if (this.labelEl) {
      this.labelEl.textContent = iso ? formatDisplay(iso) : this.options.placeholder;
      this.labelEl.classList.toggle('pas-date-picker__label--filled', Boolean(iso));
    }
    this.trigger.classList.toggle('pas-date-picker__trigger--filled', Boolean(iso));
  };

  PasDatePicker.prototype.maxIso = function maxIso() {
    if (!this.options.maxToday) return null;
    const t = todayParts();
    return toIso(t.y, t.m, t.d);
  };

  PasDatePicker.prototype.minIso = function minIso() {
    return toIso(this.options.minYear, 1, 1);
  };

  PasDatePicker.prototype.isDisabledIso = function isDisabledIso(iso) {
    const max = this.maxIso();
    const min = this.minIso();
    if (max && compareIso(iso, max) > 0) return true;
    if (min && compareIso(iso, min) < 0) return true;
    return false;
  };

  PasDatePicker.prototype.maxYear = function maxYear() {
    if (this.options.maxToday) return todayParts().y;
    return todayParts().y + 20;
  };

  PasDatePicker.prototype.clampViewYear = function clampViewYear() {
    if (this.viewY < this.options.minYear) this.viewY = this.options.minYear;
    const maxY = this.maxYear();
    if (this.viewY > maxY) this.viewY = maxY;
  };

  PasDatePicker.prototype.setViewMode = function setViewMode(mode) {
    this.viewMode = mode === 'years' ? 'years' : 'days';
    if (!this.popup) return;
    const calView = this.popup.querySelector('.pas-date-popup__calendar-view');
    const yearView = this.popup.querySelector('.pas-date-popup__year-view');
    const yearToggle = this.popup.querySelector('.pas-date-popup__year-toggle');
    const isYear = this.viewMode === 'years';
    if (calView) calView.hidden = isYear;
    if (yearView) yearView.hidden = !isYear;
    if (yearToggle) {
      yearToggle.setAttribute('aria-expanded', isYear ? 'true' : 'false');
      yearToggle.classList.toggle('pas-date-popup__year-toggle--open', isYear);
    }
    this.popup.classList.toggle('pas-date-popup--year-mode', isYear);
    if (isYear) this.renderYearPicker();
    else this.renderCalendar();
    this.positionPopup();
  };

  PasDatePicker.prototype.renderYearPicker = function renderYearPicker() {
    if (!this.popup) return;
    const grid = this.popup.querySelector('.pas-date-popup__year-grid');
    const hint = this.popup.querySelector('.pas-date-popup__year-hint');
    if (!grid) return;
    grid.innerHTML = '';
    const minY = this.options.minYear;
    const maxY = this.maxYear();
    if (hint) {
      hint.textContent = `Selecione o ano (${minY} — ${maxY})`;
    }
    for (let y = maxY; y >= minY; y -= 1) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pas-date-popup__year-option';
      btn.textContent = String(y);
      btn.setAttribute('data-year', String(y));
      if (y === this.viewY) btn.classList.add('pas-date-popup__year-option--selected');
      grid.appendChild(btn);
    }
    const selected = grid.querySelector('.pas-date-popup__year-option--selected');
    if (selected) {
      selected.scrollIntoView({ block: 'center' });
    }
  };

  PasDatePicker.prototype.selectYear = function selectYear(year) {
    const y = Number(year);
    if (!Number.isFinite(y)) return;
    this.viewY = y;
    this.clampViewYear();
    this.setViewMode('days');
  };

  PasDatePicker.prototype.ensurePopup = function ensurePopup() {
    if (this.popup) return;
    const popup = document.createElement('div');
    popup.className = 'pas-date-popup';
    popup.hidden = true;
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-modal', 'true');
    popup.setAttribute('aria-label', 'Selecionar data');
    popup.innerHTML = `
      <div class="pas-date-popup__panel">
        <div class="pas-date-popup__hero">
          <button type="button" class="pas-date-popup__hero-btn" data-nav="month-prev" aria-label="Mês anterior">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <div class="pas-date-popup__hero-text">
            <span class="pas-date-popup__month"></span>
          </div>
          <button type="button" class="pas-date-popup__hero-btn" data-nav="month-next" aria-label="Próximo mês">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <div class="pas-date-popup__year-row">
          <button type="button" class="pas-date-popup__year-btn" data-nav="year-prev" aria-label="Ano anterior">−</button>
          <button type="button" class="pas-date-popup__year-toggle" aria-expanded="false" aria-label="Selecionar ano rapidamente">
            <span class="pas-date-popup__year"></span>
          </button>
          <button type="button" class="pas-date-popup__year-btn" data-nav="year-next" aria-label="Próximo ano">+</button>
        </div>
        <div class="pas-date-popup__calendar-view">
          <div class="pas-date-popup__weekdays"></div>
          <div class="pas-date-popup__grid" role="grid"></div>
        </div>
        <div class="pas-date-popup__year-view" hidden>
          <p class="pas-date-popup__year-hint">Selecione o ano</p>
          <div class="pas-date-popup__year-grid" role="listbox" aria-label="Anos"></div>
        </div>
        <div class="pas-date-popup__footer">
          <div class="pas-date-popup__actions">
            <button type="button" class="pas-date-popup__action" data-action="clear">Limpar</button>
            <button type="button" class="pas-date-popup__action" data-action="today">Hoje</button>
          </div>
          <span class="pas-date-popup__brand">PowerApps Systems</span>
        </div>
      </div>
    `;

    const weekdays = popup.querySelector('.pas-date-popup__weekdays');
    WEEKDAYS.forEach((day) => {
      const el = document.createElement('span');
      el.className = 'pas-date-popup__weekday';
      el.textContent = day;
      weekdays.appendChild(el);
    });

    document.body.appendChild(popup);
    this.popup = popup;

    popup.addEventListener('click', (e) => {
      const yearToggle = e.target.closest('.pas-date-popup__year-toggle');
      if (yearToggle) {
        e.preventDefault();
        this.setViewMode(this.viewMode === 'years' ? 'days' : 'years');
        return;
      }
      const yearBtn = e.target.closest('[data-year]');
      if (yearBtn) {
        e.preventDefault();
        this.selectYear(yearBtn.getAttribute('data-year'));
        return;
      }
      const nav = e.target.closest('[data-nav]');
      if (nav) {
        e.preventDefault();
        this.onNav(nav.getAttribute('data-nav'));
        return;
      }
      const dayBtn = e.target.closest('[data-day]');
      if (dayBtn) {
        e.preventDefault();
        this.selectIso(dayBtn.getAttribute('data-day'));
        return;
      }
      const action = e.target.closest('[data-action]');
      if (action) {
        e.preventDefault();
        if (action.getAttribute('data-action') === 'clear') this.clear();
        if (action.getAttribute('data-action') === 'today') this.selectToday();
      }
    });
  };

  PasDatePicker.prototype.onNav = function onNav(kind) {
    if (kind === 'month-prev') {
      this.viewM -= 1;
      if (this.viewM < 1) {
        this.viewM = 12;
        this.viewY -= 1;
      }
    } else if (kind === 'month-next') {
      this.viewM += 1;
      if (this.viewM > 12) {
        this.viewM = 1;
        this.viewY += 1;
      }
    } else if (kind === 'year-prev') {
      this.viewY -= 1;
    } else if (kind === 'year-next') {
      this.viewY += 1;
    }
    this.clampViewYear();
    if (this.viewMode === 'years') this.renderYearPicker();
    else this.renderCalendar();
  };

  PasDatePicker.prototype.renderCalendar = function renderCalendar() {
    if (!this.popup) return;
    const monthEl = this.popup.querySelector('.pas-date-popup__month');
    const yearEl = this.popup.querySelector('.pas-date-popup__year');
    const grid = this.popup.querySelector('.pas-date-popup__grid');
    if (!monthEl || !yearEl || !grid) return;
    monthEl.textContent = MONTHS[this.viewM - 1];
    yearEl.textContent = String(this.viewY);

    grid.innerHTML = '';
    const firstDow = new Date(this.viewY, this.viewM - 1, 1).getDay();
    const total = daysInMonth(this.viewY, this.viewM);
    const selected = String(this.hidden.value || '');
    const today = this.maxIso();

    for (let i = 0; i < firstDow; i += 1) {
      const blank = document.createElement('span');
      blank.className = 'pas-date-popup__cell pas-date-popup__cell--empty';
      blank.setAttribute('aria-hidden', 'true');
      grid.appendChild(blank);
    }

    for (let d = 1; d <= total; d += 1) {
      const iso = toIso(this.viewY, this.viewM, d);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pas-date-popup__day';
      btn.textContent = String(d);
      btn.setAttribute('data-day', iso);
      btn.setAttribute('role', 'gridcell');
      if (iso === selected) btn.classList.add('pas-date-popup__day--selected');
      if (iso === today) btn.classList.add('pas-date-popup__day--today');
      if (this.isDisabledIso(iso)) {
        btn.disabled = true;
        btn.classList.add('pas-date-popup__day--disabled');
      }
      grid.appendChild(btn);
    }
  };

  PasDatePicker.prototype.positionPopup = function positionPopup() {
    if (!this.popup) return;
    const rect = this.trigger.getBoundingClientRect();
    const panel = this.popup.querySelector('.pas-date-popup__panel');
    const margin = 8;
    let top = rect.bottom + margin;
    let left = rect.left;
    const panelW = panel.offsetWidth || 320;
    const panelH = panel.offsetHeight || 380;
    if (left + panelW > window.innerWidth - margin) {
      left = window.innerWidth - panelW - margin;
    }
    if (left < margin) left = margin;
    if (top + panelH > window.innerHeight - margin) {
      top = rect.top - panelH - margin;
    }
    this.popup.style.top = `${Math.max(margin, top)}px`;
    this.popup.style.left = `${left}px`;
  };

  PasDatePicker.prototype.show = function show() {
    this.ensurePopup();
    const initial = parseIso(this.hidden.value);
    if (initial) {
      this.viewY = initial.y;
      this.viewM = initial.m;
    } else {
      const t = todayParts();
      this.viewY = t.y;
      this.viewM = t.m;
    }
    this.setViewMode('days');
    this.renderCalendar();
    this.popup.hidden = false;
    this.popup.classList.add('pas-date-popup--open');
    this.wrap.classList.add('pas-date-picker--open');
    this.open = true;
    this.positionPopup();
    this.trigger.setAttribute('aria-expanded', 'true');
  };

  PasDatePicker.prototype.hide = function hide() {
    if (!this.popup) return;
    this.setViewMode('days');
    this.popup.hidden = true;
    this.popup.classList.remove('pas-date-popup--open');
    this.wrap.classList.remove('pas-date-picker--open');
    this.open = false;
    this.trigger.setAttribute('aria-expanded', 'false');
  };

  PasDatePicker.prototype.selectIso = function selectIso(iso) {
    if (!iso || this.isDisabledIso(iso)) return;
    this.hidden.value = iso;
    this.hidden.dispatchEvent(new Event('change', { bubbles: true }));
    this.syncTriggerLabel();
    this.hide();
  };

  PasDatePicker.prototype.selectToday = function selectToday() {
    const t = todayParts();
    this.selectIso(toIso(t.y, t.m, t.d));
  };

  PasDatePicker.prototype.clear = function clear() {
    this.hidden.value = '';
    this.hidden.dispatchEvent(new Event('change', { bubbles: true }));
    this.syncTriggerLabel();
    this.renderCalendar();
  };

  PasDatePicker.prototype.bind = function bind() {
    this.trigger.setAttribute('aria-haspopup', 'dialog');
    this.trigger.setAttribute('aria-expanded', 'false');

    this.trigger.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.open) this.hide();
      else this.show();
    });

    this._onDocClick = (e) => {
      if (!this.open) return;
      if (this.wrap.contains(e.target) || this.popup?.contains(e.target)) return;
      this.hide();
    };

    this._onKeyDown = (e) => {
      if (e.key === 'Escape' && this.open) this.hide();
    };

    this._onResize = () => {
      if (this.open) this.positionPopup();
    };

    document.addEventListener('click', this._onDocClick);
    document.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('resize', this._onResize);
  };

  function attach(target, options) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return null;
    const wrap = el.classList.contains('pas-date-picker') ? el : el.closest('.pas-date-picker');
    if (!wrap) return null;
    return new PasDatePicker(wrap, options);
  }

  function attachAll(selector, options) {
    const list = document.querySelectorAll(selector || '.pas-date-picker');
    return Array.from(list).map((wrap) => new PasDatePicker(wrap, options));
  }

  global.PasDatePicker = {
    attach,
    attachAll,
    formatDisplay,
    parseIso
  };
})(typeof window !== 'undefined' ? window : globalThis);
