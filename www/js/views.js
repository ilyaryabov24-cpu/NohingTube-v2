/**
 * views.js — рендер всех экранов SPA.
 * Каждая функция принимает контейнер и рисует HTML, затем навешивает обработчики.
 */

const Views = (() => {
  // ── Карточка видео (общая для ленты / поиска / профиля) ──
  const videoCard = (v) => {
    const liked = Store.didLike(v.id);
    const canSubscribe = Store.currentUser() && v.author !== Store.currentUser();
    const sub = canSubscribe && Store.isSubscribed(v.author);
    return `
      <article class="card" data-video-id="${UI.escAttr(v.id)}">
        <div class="thumb" data-open="${UI.escAttr(v.id)}">
          <span class="thumb-title">${UI.esc(v.title)}</span>
          <span class="thumb-author">@${UI.esc(v.author)}</span>
          <span class="thumb-play">${UI.icon('play')}</span>
          <span class="thumb-badge">${UI.timeAgo(v.date)}</span>
        </div>
        <div class="card-body">
          <div class="card-title" data-open="${UI.escAttr(v.id)}">${UI.esc(v.title)}</div>
          <div class="card-meta">
            <button class="meta-like ${liked ? 'is-liked' : ''}" data-like="${UI.escAttr(v.id)}"
              title="Лайк">${UI.icon(liked ? 'heart' : 'heartLine')}
              <span class="like-count">${UI.fmtLikes(v.likes)}</span>
            </button>
            ${canSubscribe
              ? `<button class="meta-sub ${sub ? 'is-sub' : ''}" data-sub="${UI.escAttr(v.author)}">${sub ? 'Вы подписаны' : 'Подписаться'}</button>`
              : `<button class="meta-author" data-author="${UI.escAttr(v.author)}">@${UI.esc(v.author)}</button>`}
          </div>
        </div>
      </article>`;
  };

  const emptyState = (iconName, title, sub) => `
    <div class="empty">
      <div class="empty-icon">${UI.icon(iconName)}</div>
      <div class="empty-title">${UI.esc(title)}</div>
      ${sub ? `<div class="empty-sub">${UI.esc(sub)}</div>` : ''}
    </div>`;

  /* ─────────────── ЭКРАН ВХОДА ─────────────── */
  const auth = (el) => {
    el.innerHTML = `
      <div class="auth">
        <div class="auth-card">
          <div class="auth-logo">${UI.dotLogo(58)}<span>NothingTube</span></div>
          <p class="auth-tagline">Тихая, чистая площадка для твоих видео.</p>

          <label class="field">
            <span class="field-label">Ник</span>
            <input id="auth-nick" type="text" autocomplete="username"
              placeholder="Введите ник" maxlength="24" />
          </label>
          <label class="field">
            <span class="field-label">Пароль</span>
            <input id="auth-pass" type="password" autocomplete="current-password"
              placeholder="Введите пароль" />
          </label>

          <button class="btn btn--primary btn--block" id="auth-submit">
            <span class="btn-label">Войти / Зарегистрироваться</span>
          </button>
          <p class="auth-hint">Нет аккаунта? Он создастся автоматически при первом входе.</p>
        </div>
      </div>`;

    const run = async () => {
      const nick = el.querySelector('#auth-nick').value.trim();
      const pass = el.querySelector('#auth-pass').value;
      UI.loadingOverlay(true);
      try {
        await Store.login(nick, pass);
        UI.toast(`Привет, @${nick} 👋`);
        App.init();
      } catch (e) {
        UI.toastError(e);
      } finally {
        UI.loadingOverlay(false);
      }
    };

    el.querySelector('#auth-submit').addEventListener('click', run);
    el.querySelector('#auth-pass').addEventListener('keydown', (e) => e.key === 'Enter' && run());
  };

  /* ─────────────── ГЛАВНЫЙ ЭКРАН (лента) ─────────────── */
  const home = async (el) => {
    el.innerHTML = `<div class="section-title"><h1>Лента</h1><span class="section-count"></span></div>
      <div class="feed-grid">${UI.skeletonCard()}${UI.skeletonCard()}${UI.skeletonCard()}${UI.skeletonCard()}</div>`;
    try {
      await Store.refresh();
      const list = Store.feedVideos();
      el.querySelector('.section-count').textContent = `${list.length} видео`;
      if (!list.length) {
        el.querySelector('.feed-grid').outerHTML =
          emptyState('upload', 'Пока пусто', 'Опубликуй первое видео через вкладку «Загрузить»');
      } else {
        el.querySelector('.feed-grid').innerHTML = list.map(videoCard).join('');
        bindCards(el);
      }
    } catch (e) {
      el.querySelector('.feed-grid').outerHTML = errBlock(e);
    }
  };

  /* ─────────────── ЭКРАН ЗАГРУЗКИ ─────────────── */
  const upload = (el) => {
    el.innerHTML = `
      <div class="section-title"><h1>Загрузка</h1></div>
      <div class="upload-card">
        <div class="dropzone" id="dropzone">
          <input type="file" id="file-input" accept="video/*" hidden />
          <div class="dz-icon">${UI.icon('upload')}</div>
          <div class="dz-title">Выбери видео</div>
          <div class="dz-sub">MP4, WebM… · до ${CONFIG.MAX_FILE_MB} МБ · или перетащи файл сюда</div>
          <div class="dz-file" id="dz-file" hidden></div>
        </div>

        <label class="field">
          <span class="field-label">Название видео</span>
          <input id="video-title" type="text" maxlength="90" placeholder="Как это называется?" />
        </label>

        <button class="btn btn--primary btn--block" id="publish-btn">
          <span class="btn-label">Опубликовать</span>
        </button>
        <div id="upload-msg" class="upload-msg" hidden></div>
      </div>`;

    const input = el.querySelector('#file-input');
    const dz = el.querySelector('#dropzone');
    const dzFile = el.querySelector('#dz-file');
    const titleInput = el.querySelector('#video-title');
    const publishBtn = el.querySelector('#publish-btn');
    const msg = el.querySelector('#upload-msg');
    let selectedFile = null;

    const setFile = (f) => {
      selectedFile = f;
      dzFile.hidden = false;
      const mb = (f.size / (1024 * 1024)).toFixed(1);
      let txt = `${f.name} · ${mb} МБ`;
      try {
        const { sizeMB } = Publish.validate(f);
        if (Publish.isRisky(sizeMB))
          txt += ` · ⚠️ GitHub может не принять (${sizeMB.toFixed(0)} МБ)`;
      } catch (e) { txt = `⛔ ${e.message}`; }
      dzFile.textContent = txt;
    };

    input.addEventListener('change', () => setFile(input.files[0]));
    dz.addEventListener('click', () => input.click());
    ['dragover', 'dragenter'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('is-drag'); }));
    ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('is-drag'); }));
    dz.addEventListener('drop', (e) => setFile(e.dataTransfer.files[0]));

    publishBtn.addEventListener('click', async () => {
      const title = titleInput.value.trim();
      if (!selectedFile) { UI.toast('Сначала выбери видео', 'error'); return; }
      if (!title) { UI.toast('Введи название видео', 'error'); return; }

      const { sizeMB } = Publish.validate(selectedFile);
      if (CONFIG.MODE === 'live' && sizeMB > CONFIG.GITHUB_HARD_MB) {
        const ok = await UI.confirm(
          'Очень большой файл',
          `Файл ~${sizeMB.toFixed(0)} МБ. GitHub REST API не принимает файлы больше ~100 МБ (base64 в commit). Загрузка, скорее всего, провалится. Попробовать всё равно?`,
          'Всё равно загрузить'
        );
        if (!ok) return;
      }

      publishBtn.disabled = true;
      publishBtn.classList.add('is-busy');
      msg.hidden = false;
      msg.textContent = CONFIG.MODE === 'demo'
        ? 'Обработка (демо-режим, файл останется в браузере)…'
        : 'Загрузка в GitHub… (большие файлы могут занять время)';
      msg.className = 'upload-msg';
      UI.loadingOverlay(true);

      try {
        const res = await Publish.uploadVideo(selectedFile, title);
        const v = {
          id: res.id,
          title,
          author: Store.currentUser(),
          filePath: res.filePath,
          likes: 0,
          likesBy: [],
          date: new Date().toISOString(),
        };
        Store.getDb().videos.push(v);
        await Store.persist();

        msg.textContent = '✓ Видео опубликовано';
        msg.className = 'upload-msg upload-msg--ok';
        UI.toast('Видео опубликовано! 🎉');
        titleInput.value = '';
        selectedFile = null;
        dzFile.hidden = true;
        setTimeout(() => App.showView('home'), 1200);
      } catch (e) {
        msg.textContent = '✕ ' + e.message;
        msg.className = 'upload-msg upload-msg--err';
        UI.toastError(e);
      } finally {
        publishBtn.disabled = false;
        publishBtn.classList.remove('is-busy');
        UI.loadingOverlay(false);
      }
    });
  };

  /* ─────────────── ЭКРАН ВОСПРОИЗВЕДЕНИЯ ─────────────── */
  const player = async (el, videoId) => {
    await Store.refresh();
    const v = (Store.getDb().videos || []).find((x) => x.id === videoId);
    if (!v) {
      el.innerHTML = errBlock(new Error('Видео не найдено'));
      return;
    }
    const liked = Store.didLike(v.id);
    const mine = Store.currentUser() === v.author;
    const src = v.filePath && v.filePath.startsWith('blob:')
      ? v.filePath
      : v.filePath || '';

    el.innerHTML = `
      <div class="player">
        <button class="back-btn" id="player-back">${UI.icon('back')}<span>Назад</span></button>
        <div class="player-frame">
          <video id="player-video" controls preload="metadata" playsinline
            src="${UI.escAttr(src)}"></video>
          <div class="player-err" id="player-err" hidden>
            <div class="empty-title">Не удалось воспроизвести</div>
            <div class="empty-sub">Проверь соединение или попробуй ещё раз.</div>
            <button class="btn btn--primary" id="retry-btn">Повторить</button>
          </div>
          <div class="player-loading" id="player-loading"></div>
        </div>

        <div class="player-info">
          <h1 class="player-title">${UI.esc(v.title)}</h1>
          <div class="player-meta">
            <button class="chip chip--author" data-author="${UI.escAttr(v.author)}">
              ${UI.avatarHTML(v.author, 30)}<span>@${UI.esc(v.author)}</span>
            </button>
            <button class="chip chip--like ${liked ? 'is-liked' : ''}" id="like-btn">
              ${UI.icon(liked ? 'heart' : 'heartLine')}<span>${UI.fmtLikes(v.likes)}</span>
            </button>
            ${!mine
              ? `<button class="chip chip--sub ${Store.isSubscribed(v.author) ? 'is-sub' : ''}" id="sub-btn">
                   ${Store.isSubscribed(v.author) ? 'Вы подписаны' : 'Подписаться'}
                 </button>`
              : ''}
          </div>
          <div class="player-stats">
            <span>${UI.timeAgo(v.date)}</span>
            ${Store.user(v.author) ? `<span>· ${Store.user(v.author).subscribers.length} подписчик(ов)</span>` : ''}
          </div>
        </div>
      </div>`;

    const video = el.querySelector('#player-video');
    const errBox = el.querySelector('#player-err');
    const loading = el.querySelector('#player-loading');

    const showError = () => {
      loading.hidden = true;
      errBox.hidden = false;
    };
    const hideError = () => {
      errBox.hidden = true;
      loading.hidden = false;
    };

    video.addEventListener('waiting', () => { loading.hidden = false; });
    video.addEventListener('playing', () => { loading.hidden = true; hideError(); });
    video.addEventListener('stalled', () => { loading.hidden = false; });
    video.addEventListener('error', () => { loading.hidden = true; showError(); });
    // если медиа недоступно сразу (404 и т.п.)
    video.addEventListener('loadedmetadata', hideError);

    el.querySelector('#retry-btn').addEventListener('click', () => {
      hideError();
      video.load();
      video.play().catch(() => {});
    });

    el.querySelector('#player-back').addEventListener('click', () => App.goBack());
    el.querySelector('.chip--author')?.addEventListener('click', () => App.showView('profile', v.author));

    el.querySelector('#like-btn').addEventListener('click', async () => {
      const likes = await Store.like(v.id);
      const now = Store.didLike(v.id);
      el.querySelector('#like-btn').classList.toggle('is-liked', now);
      el.querySelector('#like-btn span').textContent = UI.fmtLikes(likes);
      el.querySelector('#like-btn').innerHTML =
        `${UI.icon(now ? 'heart' : 'heartLine')}<span>${UI.fmtLikes(likes)}</span>`;
    });

    const subBtn = el.querySelector('#sub-btn');
    subBtn?.addEventListener('click', async () => {
      await Store.toggleSubscribe(v.author);
      const sub = Store.isSubscribed(v.author);
      subBtn.classList.toggle('is-sub', sub);
      subBtn.textContent = sub ? 'Вы подписаны' : 'Подписаться';
      const stat = el.querySelector('.player-stats span:nth-child(2)');
      if (stat) stat.textContent = `· ${Store.user(v.author).subscribers.length} подписчик(ов)`;
      UI.toast(sub ? `Подписан на @${v.author}` : 'Отписка оформлена');
    });
  };

  /* ─────────────── ЭКРАН ПОИСКА ─────────────── */
  const search = async (el) => {
    el.innerHTML = `
      <div class="search-bar">
        <span class="search-ico">${UI.icon('search')}</span>
        <input id="search-input" type="text" placeholder="Поиск по названию видео…" />
        <span class="search-clear" id="search-clear" hidden>${UI.icon('close')}</span>
      </div>
      <div class="section-title"><h1>Результаты</h1><span class="search-count" id="search-count">0 видео</span></div>
      <div class="feed-grid" id="search-results"></div>`;

    await Store.refresh();
    const grid = el.querySelector('#search-results');
    const count = el.querySelector('#search-count');
    const input = el.querySelector('#search-input');
    const clear = el.querySelector('#search-clear');

    const render = (q) => {
      const res = Store.searchVideos(q);
      count.textContent = `${res.length} ${plural(res.length, ['видео', 'видео', 'видео'])}`;
      clear.hidden = !q;
      if (!q) {
        grid.innerHTML = emptyState('search', 'Что будем искать?', 'Введи название видео выше');
      } else if (!res.length) {
        grid.innerHTML = emptyState('search', 'Ничего не найдено', `По запросу «${q}»`);
      } else {
        grid.innerHTML = res.map(videoCard).join('');
        bindCards(grid);
      }
    };

    input.addEventListener('input', () => render(input.value.trim()));
    clear.addEventListener('click', () => { input.value = ''; render(''); input.focus(); });
    render('');
  };

  /* ─────────────── ПРОФИЛЬ ─────────────── */
  const profile = async (el, nick = Store.currentUser()) => {
    await Store.refresh();
    const u = Store.user(nick);
    if (!u) { el.innerHTML = errBlock(new Error('Пользователь не найден')); return; }
    const mine = nick === Store.currentUser();
    const subs = u.subscribers.length;
    const videos = Store.videosByAuthor(nick);
    const totalLikes = videos.reduce((a, v) => a + (v.likes || 0), 0);

    el.innerHTML = `
      <div class="profile-head">
        ${UI.avatarHTML(nick, 76)}
        <h1 class="profile-name">@${UI.esc(nick)}</h1>
        ${mine ? '<span class="chip chip--me">Это вы</span>' : ''}
        <div class="profile-stats">
          <div class="stat"><b>${videos.length}</b><span>видео</span></div>
          <div class="stat"><b>${subs}</b><span>подписчики</span></div>
          <div class="stat"><b>${UI.fmtLikes(totalLikes)}</b><span>лайков</span></div>
        </div>
        <div class="profile-actions">
          ${!mine
            ? `<button class="btn ${Store.isSubscribed(nick) ? 'btn--ghost' : 'btn--primary'}" id="prof-sub">
                 ${Store.isSubscribed(nick) ? 'Вы подписаны' : 'Подписаться'}
               </button>`
            : `<button class="btn btn--ghost" id="prof-settings">${UI.icon('gear')}<span>Настройки</span></button>`}
        </div>
      </div>
      <div class="section-title"><h2>Видео автора</h2><span class="section-count">${videos.length}</span></div>
      <div class="feed-grid">
        ${videos.length ? videos.map(videoCard).join('') : emptyState('upload', 'Видео пока нет')}
      </div>`;

    const grid = el.querySelector('.feed-grid');
    if (grid) bindCards(grid);

    el.querySelector('#prof-sub')?.addEventListener('click', async () => {
      await Store.toggleSubscribe(nick);
      const sub = Store.isSubscribed(nick);
      const b = el.querySelector('#prof-sub');
      b.classList.toggle('btn--ghost', sub);
      b.classList.toggle('btn--primary', !sub);
      b.textContent = sub ? 'Вы подписаны' : 'Подписаться';
      el.querySelector('.profile-stats .stat:nth-child(2) b').textContent = Store.user(nick).subscribers.length;
      UI.toast(sub ? `Подписан на @${nick}` : 'Отписка оформлена');
    });

    el.querySelector('#prof-settings')?.addEventListener('click', () => App.showView('settings'));
  };

  /* ─────────────── НАСТРОЙКИ / ТОКЕН ─────────────── */
  const settings = (el) => {
    el.innerHTML = `
      <button class="back-btn" id="set-back">${UI.icon('back')}<span>Назад</span></button>
      <div class="section-title"><h1>Настройки</h1></div>
      <div class="settings-card">
        ${CONFIG.MODE === 'live' ? `
          <div class="setting">
            <div class="setting-title">Бэкенд</div>
            <div class="setting-sub">Подключён GitHub-репозиторий ${CONFIG.OWNER}/${CONFIG.REPO} · ветка ${CONFIG.BRANCH}. Токен вшит в сборку.</div>
          </div>` : `
          <div class="setting">
            <div class="setting-title">Демо-режим</div>
            <div class="setting-sub">Бэкенд отключён. Данные и видео хранятся только в этом браузере.</div>
          </div>`}
        <div class="setting setting--logout">
          <button class="btn btn--ghost btn--block" id="logout-btn">${UI.icon('logout')}<span>Выйти из аккаунта</span></button>
        </div>
      </div>`;

    el.querySelector('#set-back').addEventListener('click', () =>
      Store.isLoggedIn() ? App.goBack() : App.openAuth());

    el.querySelector('#logout-btn').addEventListener('click', async () => {
      if (await UI.confirm('Выйти?', 'Придётся снова вводить ник и пароль.')) {
        Store.logout();
        App.init();
      }
    });
  };

  /* ─────────────── Общие обработчики карточек ─────────────── */
  const bindCards = (root) => {
    root.addEventListener('click', (e) => {
      const open = e.target.closest('[data-open]');
      if (open) { App.showView('player', open.dataset.open); return; }
      const like = e.target.closest('[data-like]');
      if (like) { likeVideo(like); return; }
      const sub = e.target.closest('[data-sub]');
      if (sub) { subscribe(sub); return; }
      const author = e.target.closest('[data-author]');
      if (author) { App.showView('profile', author.dataset.author); }
    });
  };

  const likeVideo = async (btn) => {
    const likes = await Store.like(btn.dataset.like);
    const now = Store.didLike(btn.dataset.like);
    btn.classList.toggle('is-liked', now);
    btn.innerHTML = `${UI.icon(now ? 'heart' : 'heartLine')}<span class="like-count">${UI.fmtLikes(likes)}</span>`;
    UI.toast(now ? '♥ Лайк поставлен' : 'Лайк убран');
  };

  const subscribe = async (btn) => {
    await Store.toggleSubscribe(btn.dataset.sub);
    const sub = Store.isSubscribed(btn.dataset.sub);
    btn.classList.toggle('is-sub', sub);
    btn.textContent = sub ? 'Вы подписаны' : 'Подписаться';
    UI.toast(sub ? `Подписан на @${btn.dataset.sub}` : 'Отписка оформлена');
  };

  const errBlock = (e) => `
    <div class="empty">
      <div class="empty-icon">${UI.icon('close')}</div>
      <div class="empty-title">Ошибка</div>
      <div class="empty-sub">${UI.esc((e && e.message) || 'Неизвестная ошибка')}</div>
      <button class="btn btn--primary" id="err-retry">Повторить</button>
    </div>`;

  const plural = (n, forms) => {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return forms[2];
    if (b > 1 && b < 5) return forms[1];
    if (b === 1) return forms[0];
    return forms[2];
  };

  return { auth, home, upload, player, search, profile, settings, errBlock };
})();
