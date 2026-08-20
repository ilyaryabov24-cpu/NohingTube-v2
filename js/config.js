/**
 * NothingTube — конфигурация.
 *
 * Два режима работы:
 *  - MODE = 'demo'  → всё работает локально (без GitHub). Данные и загрузки
 *                     живут в браузере. Удобно для предпросмотра UI.
 *  - MODE = 'live'  → полноценный бэкенд через GitHub REST API и публичный
 *                     репозиторий. Требует заполнить OWNER / REPO и токен.
 */
const CONFIG = {
  // 'demo' | 'live'
  MODE: 'live',

  // ── GitHub backend (используется только в режиме 'live') ──────────────
  OWNER: 'ilyaryabov24-cpu',   // владелец репозитория
  REPO: 'NohingTube-v2',       // имя репозитория (публичный)
  BRANCH: 'main',

  // ⚠️ Токен НЕ храним в коде публичного репозитория (иначе GitHub
  //    автоматически отзовёт его при пуше).
  //    Вставь его в приложении: Профиль → ⚙️ Настройки → GitHub-токен.
  //    Там он сохраняется в localStorage устройства.
  //    Создать: GitHub → Settings → Developer settings → Personal access tokens.
  TOKEN: '',

  // ── Лимиты загрузки ──────────────────────────────────────────────────
  MAX_FILE_MB: 100,            // жёсткий лимит размера файла (по ТЗ)
  GITHUB_WARN_MB: 50,          // GitHub предупреждает о файлах > 50 МБ
  GITHUB_HARD_MB: 95,          // base64 в одном commit GitHub API (осторожный запас)

  // Разрешённые типы видео
  ALLOWED_EXT: ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v'],
};

// Псевдонимы для краткости
const RAW_BASE = () =>
  `https://raw.githubusercontent.com/${CONFIG.OWNER}/${CONFIG.REPO}/${CONFIG.BRANCH}`;
const API_BASE = () =>
  `https://api.github.com/repos/${CONFIG.OWNER}/${CONFIG.REPO}`;
