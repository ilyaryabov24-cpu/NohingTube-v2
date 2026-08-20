/**
 * app.js — инициализация, маршрутизация, шапка и нижняя навигация.
 */

const App = (() => {
  const VIEWS = {
    home:     { label: 'Лента',   icon: 'home' },
    upload:   { label: 'Загрузка', icon: 'upload' },
    search:   { label: 'Поиск',   icon: 'search' },
    profile:  { label: 'Профиль', icon: 'user' },
  };

  const historyStack = [];

  const main = () => document.getElementById('main');
  const bottomNav = () => document.getElementById('bottom-nav');

  const renderHeader = () => {
    const h = document.getElementById('header');
    const user = Store.currentUser();
    h.innerHTML = `
      <button class="brand" id="brand">
        ${UI.dotLogo(30)}<span class="brand-name">Nothing<span>Tube</span></span>
      </button>
      <div class="header-right">
        <button class="icon-btn" id="h-search" title="Поиск">${UI.icon('search')}</button>
        <button class="icon-btn" id="h-profile" title="Профиль">${UI.avatarHTML(user, 34)}</button>
      </div>`;
    h.querySelector('#brand').addEventListener('click', () => App.showView('home'));
    h.querySelector('#h-search').addEventListener('click', () => App.showView('search'));
    h.querySelector('#h-profile').addEventListener('click', () => App.showView('profile'));
  };

  const renderNav = () => {
    bottomNav().innerHTML = Object.entries(VIEWS)
      .map(([id, v]) => `
        <button class="nav-item" data-view="${id}">
          ${UI.icon(v.icon)}<span>${v.label}</span>
        </button>`)
      .join('');
    bottomNav().querySelectorAll('.nav-item').forEach((b) =>
      b.addEventListener('click', () => App.showView(b.dataset.view)));
  };

  const setActiveNav = (name) => {
    bottomNav().querySelectorAll('.nav-item').forEach((b) =>
      b.classList.toggle('is-active', b.dataset.view === name));
  };

  // ── Роутер ──
  const showView = (name, arg) => {
    const el = main();
    el.scrollTop = 0;
    el.classList.remove('view-fade');
    void el.offsetWidth;
    el.classList.add('view-fade');

    setActiveNav(name);
    if (name === 'player') historyStack.push({ n: 'player', arg });
    else if (VIEWS[name]) { historyStack.push({ n: name }); setActiveNav(name); }

    switch (name) {
      case 'home':    Views.home(el); break;
      case 'upload':  Views.upload(el); break;
      case 'player':  Views.player(el, arg); break;
      case 'search':  Views.search(el); break;
      case 'profile': Views.profile(el, arg); break;
      case 'settings':Views.settings(el); break;
    }
  };

  const goBack = () => {
    historyStack.pop(); // текущий
    const prev = historyStack.pop();
    if (prev) showView(prev.n, prev.arg);
    else showView('home');
  };

  // ── Запуск ──
  const init = async () => {
    historyStack.length = 0;
    UI.loadingOverlay(true);
    try {
      await Store.loadDatabase();
    } catch (e) {
      // база не прочиталась — в live покажем ошибку на auth, в demo стартуем
      console.error(e);
    }

    const logged = Store.isLoggedIn();

    if (!logged) {
      document.body.classList.add('is-auth');
      renderHeaderHidden();
      main().innerHTML = '';
      Views.auth(main());
    } else {
      document.body.classList.remove('is-auth');
      renderHeader();
      renderNav();
      bottomNav().classList.add('nav--visible');
      showView('home');
    }
    UI.loadingOverlay(false);
  };

  const renderHeaderHidden = () => {
    document.getElementById('header').innerHTML = '';
    bottomNav().classList.remove('nav--visible');
    bottomNav().innerHTML = '';
  };

  // Открыть экран входа (например, из настроек до авторизации)
  const openAuth = () => {
    historyStack.length = 0;
    document.body.classList.add('is-auth');
    renderHeaderHidden();
    main().innerHTML = '';
    Views.auth(main());
  };

  // глобально видимое API (нужно вью-коду)
  window.App = { init, showView, goBack, openAuth, VIEWS };

  return { init, showView, goBack, openAuth };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
