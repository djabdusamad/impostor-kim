// Check for updates from both the offline and online entry points.
(() => {
  if (!('serviceWorker' in navigator)) return;
  let registration, lastCheck = 0, notified = false;
  const controlledAtLoad = !!navigator.serviceWorker.controller;
  const check = () => {
    if (!navigator.onLine || Date.now() - lastCheck < 60000) return;
    lastCheck = Date.now();
    registration?.update().catch(() => {});
  };
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!controlledAtLoad || notified) return;
    notified = true;
    // Never interrupt a game, discard a draft, or restart a microphone automatically.
    const notice = document.createElement('aside');
    notice.setAttribute('role', 'status');
    notice.style.cssText = 'position:fixed;bottom:12px;left:12px;right:12px;z-index:100;background:#111;color:white;border-radius:14px;padding:13px;text-align:center;font:13px Arial;box-shadow:0 4px 20px #0003';
    const text = document.createElement('span');
    text.textContent = 'Yangilanish tayyor. ';
    const button = document.createElement('button');
    button.textContent = 'Sahifani yangilash';
    button.style.cssText = 'border:0;border-radius:20px;background:white;color:#111;font:inherit;font-weight:bold;padding:10px 14px;margin-left:8px;cursor:pointer';
    button.onclick = () => location.reload();
    const dismiss = document.createElement('button');
    dismiss.textContent = 'Keyinroq';
    dismiss.style.cssText = 'border:0;background:none;color:white;text-decoration:underline;font:inherit;padding:10px;cursor:pointer';
    dismiss.onclick = () => notice.remove();
    notice.append(text, button, dismiss);
    document.body.appendChild(notice);
  });
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(value => {
    registration = value;
    check();
  }).catch(() => {});
  window.addEventListener('online', check);
  window.addEventListener('focus', check);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
})();
