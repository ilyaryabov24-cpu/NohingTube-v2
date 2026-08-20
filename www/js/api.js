/**
 * api.js — загрузка видеофайлов и служебные операции GitHub.
 * Инкапсулирует различия demo/live; вью вызывает Publish.uploadVideo(file, title).
 */

const Publish = (() => {
  // ── base64 helpers (корректная работа с UTF-8 для JSON) ──
  const toBase64 = (blob) =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1]);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });

  const extensionOf = (name) => (name.split('.').pop() || 'mp4').toLowerCase();

  // ── Валидация ──
  const validate = (file) => {
    if (!file) throw new Error('Сначала выбери файл');
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > CONFIG.MAX_FILE_MB)
      throw new Error(`Файл слишком большой (${sizeMB.toFixed(1)} МБ). Лимит — ${CONFIG.MAX_FILE_MB} МБ.`);
    const ext = extensionOf(file.name);
    if (!CONFIG.ALLOWED_EXT.includes(ext))
      throw new Error(`Расширение .${ext} не поддерживается. Разрешены: ${CONFIG.ALLOWED_EXT.join(', ')}.`);
    return { sizeMB, ext };
  };

  // Большой файл? (> мягкого лимита GitHub). При таком размере base64-commit
  // GitHub обычно отклоняет — предупреждаем заранее, но даём шанс.
  const isRisky = (sizeMB) => CONFIG.MODE === 'live' && sizeMB > CONFIG.GITHUB_WARN_MB;

  const videoExt = (file) => extensionOf(file.name);

  // ── live: публикация в GitHub через base64-commit ──
  const publishLive = async (dataB64, ext, title) => {
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const filename = `${id}.${ext}`;
    await putVideoRaw(`videos/${filename}`, dataB64, title);
    return {
      id,
      filePath: `${RAW_BASE()}/videos/${filename}`,
      filename,
    };
  };

  // Отдельная функция записи видеофайла (чтобы можно было вызывать из Store)
  const putVideoRaw = async (path, dataB64, title) => {
    const res = await fetch(`${API_BASE()}/contents/${encodeURIComponent(path)}`, {
      method: 'PUT',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${Store.getToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `NothingTube: ${title || 'новое видео'}`,
        content: dataB64,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      // GitHub не даёт загрузить файл >100МБ (или отклоняет большой base64)
      throw new Error(
        err.message || `GitHub отклонил загрузку видео (${res.status}). Файл слишком большой для API.`
      );
    }
    return res.json();
  };

  // ── demo: храним видео как Blob-URL на время сессии ──
  const demoUploads = {}; // id -> blob URL
  const publishDemo = (file, ext, title) => {
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const url = URL.createObjectURL(file);
    demoUploads[id] = url;
    return { id, filePath: url, filename: `${id}.${ext}`, isDemoBlob: true };
  };

  const demoUrl = (id) => demoUploads[id];

  // ── Точка входа ──
  const uploadVideo = async (file, title) => {
    const { sizeMB, ext } = validate(file);
    const dataB64 = await toBase64(file);

    if (CONFIG.MODE === 'demo') {
      return { ...publishDemo(file, ext, title), sizeMB };
    }

    return { ...(await publishLive(dataB64, ext, title)), sizeMB };
  };

  return {
    uploadVideo,
    validate,
    isRisky,
    videoExt,
    demoUrl,
  };
})();
