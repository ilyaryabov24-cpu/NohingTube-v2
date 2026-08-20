/**
 * ui.js — мелкие помощники: тосты, модалки, иконки, аватары, форматирование.
 */

const UI = (() => {
  // ── Тосты ──
  const toast = (msg, type = 'info', ms = 3200) => {
    const wrap = document.getElementById('toast-wrap');
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.innerHTML = `<span class="toast-dot"></span><span>${esc(msg)}</span>`;
    wrap.appendChild(el);
    requestAnimationFrame(() => el.classList.add('toast--in'));
    setTimeout(() => {
      el.classList.remove('toast--in');
      setTimeout(() => el.remove(), 300);
    }, ms);
  };

  const toastError = (e) =>
    toast((e && e.message) || 'Что-то пошло не так', 'error', 5000);

  // ── Модалка подтверждения ──
  const confirm = (title, text, okLabel = 'Подтвердить') =>
    new Promise((resolve) => {
      const m = document.getElementById('modal-wrap');
      m.innerHTML = `
        <div class="modal-overlay" data-close="1">
          <div class="modal">
            <h3 class="modal-title">${esc(title)}</h3>
            ${text ? `<p class="modal-text">${esc(text)}</p>` : ''}
            <div class="modal-actions">
              <button class="btn btn--ghost" data-close="1">Отмена</button>
              <button class="btn btn--danger" id="modal-ok">${esc(okLabel)}</button>
            </div>
          </div>
        </div>`;
      m.classList.add('modal-wrap--open');
      const close = () => { m.innerHTML = ''; m.classList.remove('modal-wrap--open'); };
      m.querySelector('[data-close]').addEventListener('click', () => { close(); resolve(false); });
      m.querySelector('#modal-ok').addEventListener('click', () => { close(); resolve(true); });
    });

  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const escAttr = esc;

  // ── Форматирование ──
  const timeAgo = (iso) => {
    const d = new Date(iso).getTime();
    const diff = (Date.now() - d) / 1000;
    if (diff < 60) return 'только что';
    if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
    if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} дн назад`;
    return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const fmtLikes = (n) => {
    n = n || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace('.0', '') + 'K';
    return String(n);
  };

  // ── Аватар: цвет из ника + инициалы ──
  const PALETTE = ['#D5142B', '#5E9CFF', '#5BD6A8', '#FFB13D', '#C58BFF', '#FF6FA5'];
  const avatarHTML = (nick, size = 42) => {
    const hue = [...nick].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length;
    const initials = (nick.slice(0, 2) || '?').toUpperCase();
    return `<span class="avatar" style="width:${size}px;height:${size}px;background:${PALETTE[hue]};font-size:${Math.round(size * 0.38)}px">${esc(initials)}</span>`;
  };

  // ── Иконки (inline SVG) ──
  const icons = {
    home:   '<svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    upload: '<svg viewBox="0 0 24 24"><path d="M12 16V4m0 0l-4 4m4-4l4 4M5 16v3a2 2 0 002 2h10a2 2 0 002-2v-3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    user:   '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    heart:  '<svg viewBox="0 0 24 24"><path d="M20.8 6.4a5.3 5.3 0 00-7.5 0L12 7.7l-1.3-1.3a5.3 5.3 0 10-7.5 7.5l1.3 1.3L12 22.7l7.5-7.5 1.3-1.3a5.3 5.3 0 000-7.5z" fill="currentColor"/></svg>',
    heartLine:'<svg viewBox="0 0 24 24"><path d="M20.8 6.4a5.3 5.3 0 00-7.5 0L12 7.7l-1.3-1.3a5.3 5.3 0 10-7.5 7.5l1.3 1.3L12 22.7l7.5-7.5 1.3-1.3a5.3 5.3 0 000-7.5z" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    bell:   '<svg viewBox="0 0 24 24"><path d="M6 9a6 6 0 1112 0c0 4 2 5 2 5H4s2-1 2-5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M10 20a2 2 0 004 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    gear:   '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6L7 7m10 10l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    play:   '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>',
    back:   '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    close:  '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    logout: '<svg viewBox="0 0 24 24"><path d="M10 17l5-5-5-5M14 12H3M20 3v18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    dot:    '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="2.6" fill="currentColor"/></svg>',
  };
  const icon = (name) => icons[name] || '';

  // ── Nothing-логотип: точечная «N» ──
  const dotLogo = (size = 34) => {
    const grid = [
      'X...X',
      'XX..X',
      'X.X.X',
      'X..XX',
      'X...X',
    ];
    const rows = grid.length, cols = grid[0].length;
    const r = size / (cols + 1);
    let dots = '';
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++)
        if (grid[y][x] === 'X')
          dots += `<circle cx="${(x + 1) * r + r}" cy="${(y + 1) * r + r}" r="${r * 0.42}"/>`;
    const view = size + r * 2;
    return `<svg class="nt-logo" viewBox="0 0 ${view} ${view}" width="${size}" height="${size}" aria-hidden="true">${dots}</svg>`;
  };

  // ── Прелоадер / лоадер ──
  const loadingOverlay = (on = true) => {
    const l = document.getElementById('loading');
    if (on) l.classList.add('loading--on');
    else l.classList.remove('loading--on');
  };

  const skeletonCard = () => `
    <div class="card card--skeleton">
      <div class="thumb thumb--skeleton"></div>
      <div class="card-body">
        <div class="sk sk--line sk--w80"></div>
        <div class="sk sk--line sk--w50"></div>
      </div>
    </div>`;

  return {
    toast, toastError, confirm,
    esc, escAttr, timeAgo, fmtLikes,
    avatarHTML, icon, dotLogo, loadingOverlay, skeletonCard,
  };
})();
