// Telegram is an optional presentation layer. Room permissions still use server sessions.
(() => {
  const query = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.slice(1));
  const rawCode = query.get('tgWebAppStartParam') || query.get('room') || '';
  const code = /^[A-Z0-9]{6}$/i.test(rawCode) ? rawCode.toUpperCase() : '';
  const api = window.GameTelegram = { code, name: '', active: false, bot: '' };
  fetch('/telegram-config').then(r => r.json()).then(c => {
    if (/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(c.botUsername || '')) api.bot = c.botUsername;
  }).catch(() => {});
  api.inviteURL = roomCode => api.bot
    ? `https://t.me/${api.bot}?startapp=${encodeURIComponent(roomCode)}`
    : `${location.origin}/online.html?room=${encodeURIComponent(roomCode)}`;
  api.share = roomCode => {
    const url = 'https://t.me/share/url?url=' + encodeURIComponent(api.inviteURL(roomCode)) + '&text=' + encodeURIComponent('IMPOSTOR KIM? Birga o‘ynaymiz! Xona kodi: ' + roomCode);
    if (api.active) window.Telegram.WebApp.openTelegramLink(url);
    else window.open(url, '_blank', 'noopener,noreferrer');
  };
  api.sync = (visible, inRoom) => {
    const tg = api.active && window.Telegram.WebApp;
    if (!tg) return;
    try {
      tg.BackButton[visible ? 'show' : 'hide']();
      tg[inRoom ? 'enableClosingConfirmation' : 'disableClosingConfirmation']();
    } catch (_) {}
  };
  function initialize() {
    const tg = window.Telegram?.WebApp;
    if (!tg || tg.platform === 'unknown') return;
    api.active = true;
    // Display suggestion only: never use unverified Telegram fields for authentication.
    api.name = String(tg.initDataUnsafe?.user?.first_name || '').slice(0, 24);
    const start = tg.initDataUnsafe?.start_param;
    if (/^[A-Z0-9]{6}$/i.test(start || '')) api.code = start.toUpperCase();
    document.documentElement.classList.add('telegram-app');
    const safe = () => {
      for (const edge of ['top', 'right', 'bottom', 'left']) {
        const inset = Math.max(0, Number(tg.safeAreaInset?.[edge]) || 0) + Math.max(0, Number(tg.contentSafeAreaInset?.[edge]) || 0);
        document.documentElement.style.setProperty('--game-safe-' + edge, inset + 'px');
      }
    };
    safe();
    tg.onEvent('safeAreaChanged', safe);
    tg.onEvent('contentSafeAreaChanged', safe);
    tg.BackButton.onClick(() => window.dispatchEvent(new Event('game-telegram-back')));
    try { tg.setHeaderColor('#ffffff'); tg.setBackgroundColor('#ffffff'); tg.expand(); tg.ready(); } catch (_) {}
    window.dispatchEvent(new Event('game-telegram-ready'));
  }
  if (window.Telegram?.WebApp) initialize();
  else if (hash.has('tgWebAppData') || hash.has('tgWebAppPlatform')) {
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-web-app.js?64';
    script.onload = initialize;
    document.head.appendChild(script);
  }
})();
