/**
 * Store — единое состояние приложения и слой доступа к данным.
 * Абстрагирует режим demo/live, чтобы вью-код не знал про GitHub.
 */

const Store = (() => {
  let db = null;          // кэш database.json
  let session = null;     // текущая сессия пользователя

  const SESSION_KEY = 'nt_session';
  const TOKEN_KEY = 'nt_token';
  const DEMO_DB_KEY = 'nt_demo_db';

  const readSession = () => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch { return null; }
  };

  const saveSession = (s) => {
    session = s;
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  };

  const getToken = () => localStorage.getItem(TOKEN_KEY) || CONFIG.TOKEN || '';
  const setToken = (t) => {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  };

  /* ─────────────── DEMO-данные (заготовка) ─────────────── */
  const seedDemo = () => {
    const now = Date.now();
    const v = (title, author, likes, hoursAgo, likesBy) => ({
      id: 'd' + (now - hoursAgo * 3600e3).toString(36),
      title,
      author,
      filePath: 'videos/demo-video.mp4',
      likes,
      likesBy: likesBy || [],
      date: new Date(now - hoursAgo * 3600e3).toISOString(),
    });
    return {
      users: {
        'nikita': { password: '12345', subscribers: ['alex', 'marta'] },
        'alex':   { password: '12345', subscribers: ['nikita'] },
        'marta':  { password: '12345', subscribers: [] },
      },
      videos: [
        v('Nothing Phone (3) — Unboxing & First Look', 'nikita', 128, 3, ['alex', 'marta']),
        v('Lo-fi beats to code to · 1 hour mix', 'marta', 342, 9, ['nikita', 'alex']),
        v('Designing in the dark: Nothing aesthetic guide', 'nikita', 76, 26, ['alex']),
        v('Building a minimal OS for the phone', 'alex', 201, 40, ['nikita']),
        v('NothingTube: making my own YouTube clone', 'nikita', 54, 70, []),
      ],
    };
  };

  const readDemoDb = () => {
    try { return JSON.parse(localStorage.getItem(DEMO_DB_KEY) || 'null') || seedDemo(); }
    catch { return seedDemo(); }
  };
  const writeDemoDb = (data) => localStorage.setItem(DEMO_DB_KEY, JSON.stringify(data));

  /* ─────────────── GitHub (live) ─────────────── */
  const ghHeaders = (extra = {}) => {
    const h = { Accept: 'application/vnd.github+json', ...extra };
    const t = getToken();
    if (t) h.Authorization = `Bearer ${t}`;
    return h;
  };

  const readLiveDb = async () => {
    const res = await fetch(`${RAW_BASE()}/database.json`, { headers: ghHeaders() });
    if (!res.ok) throw new Error(`Не удалось получить database.json (${res.status})`);
    return res.json();
  };

  const getFileSha = async (path) => {
    const res = await fetch(`${API_BASE()}/contents/${encodeURIComponent(path)}`, { headers: ghHeaders() });
    if (res.status === 404) return null;               // файла ещё нет
    if (!res.ok) throw new Error(`Ошибка GitHub API (${res.status})`);
    const j = await res.json();
    return j.sha;
  };

  const putFile = async (path, contentB64, message) => {
    const sha = await getFileSha(path);
    const body = { message, content: contentB64 };
    if (sha) body.sha = sha;                            // обязателен для перезаписи
    const res = await fetch(`${API_BASE()}/contents/${encodeURIComponent(path)}`, {
      method: 'PUT',
      headers: ghHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.message || `GitHub отклонил запись (${res.status}). Проверь токен и репозиторий.`
      );
    }
    return res.json();
  };

  const writeLiveDb = async (data) => {
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
    await putFile('database.json', b64, 'NothingTube: обновление базы');
  };

  /* ─────────────── Публичный API для вью ─────────────── */

  // Загрузить/обновить базу. Возвращает db и кладёт в кэш.
  const loadDatabase = async () => {
    db = CONFIG.MODE === 'demo'
      ? readDemoDb()
      : await readLiveDb();
    return db;
  };

  const getDb = () => db;

  // Сохранить базу после мутаций.
  const persist = async () => {
    if (CONFIG.MODE === 'demo') writeDemoDb(db);
    else await writeLiveDb(db);
  };

  const refresh = () => loadDatabase();

  // 20 последних видео (сортировка по дате DESC).
  const feedVideos = () =>
    (db?.videos || []).slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20);

  const searchVideos = (q) => {
    const t = (q || '').trim().toLowerCase();
    if (!t) return [];
    return (db?.videos || []).filter((v) => v.title.toLowerCase().includes(t));
  };

  const videosByAuthor = (nick) =>
    (db?.videos || []).filter((v) => v.author === nick);

  const user = (nick) => db?.users?.[nick];

  /* ─────────────── Аутентификация ─────────────── */

  const isLoggedIn = () => !!readSession();

  const currentUser = () => readSession()?.nick || null;

  const login = async (nick, password) => {
    await loadDatabase();
    nick = nick.trim();
    if (!nick || !password) throw new Error('Введи ник и пароль');
    const existing = db.users[nick];
    if (existing) {
      if (existing.password !== password) throw new Error('Неверный пароль');
    } else {
      // новый пользователь
      db.users[nick] = { password, subscribers: [] };
      await persist();
    }
    saveSession({ nick });
    return nick;
  };

  const logout = () => {
    saveSession(null);
  };

  /* ─────────────── Действия (лайк / подписка) ─────────────── */

  const like = async (videoId) => {
    const nick = currentUser();
    const v = (db.videos || []).find((x) => x.id === videoId);
    if (!v || !nick) return v?.likes || 0;
    v.likesBy = v.likesBy || [];
    const i = v.likesBy.indexOf(nick);
    if (i >= 0) {
      v.likesBy.splice(i, 1);
      v.likes = Math.max(0, v.likes - 1);
    } else {
      v.likesBy.push(nick);
      v.likes = (v.likes || 0) + 1;
    }
    await persist();
    return v.likes;
  };

  const didLike = (videoId) => {
    const nick = currentUser();
    const v = (db.videos || []).find((x) => x.id === videoId);
    return nick ? !!v?.likesBy?.includes(nick) : false;
  };

  const toggleSubscribe = async (author) => {
    const nick = currentUser();
    const u = db.users[author];
    if (!u || !nick || author === nick) return;
    const i = (u.subscribers || []).indexOf(nick);
    if (i >= 0) u.subscribers.splice(i, 1);
    else u.subscribers.push(nick);
    await persist();
  };

  const isSubscribed = (author) => {
    const nick = currentUser();
    return nick ? (db.users[author]?.subscribers || []).includes(nick) : false;
  };

  return {
    isLoggedIn,
    currentUser,
    login,
    logout,
    loadDatabase,
    refresh,
    getDb,
    feedVideos,
    searchVideos,
    videosByAuthor,
    user,
    like,
    didLike,
    toggleSubscribe,
    isSubscribed,
    getToken,
    setToken,
  };
})();
