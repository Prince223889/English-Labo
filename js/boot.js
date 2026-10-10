/* Anti-clickjacking + enregistrement du service worker (fichier externe : la CSP interdit les scripts inline). */
(function () {
  if (window.top !== window.self) { document.documentElement.innerHTML = ''; try { window.top.location = window.self.location; } catch (_) {} return; }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !location.pathname.endsWith('/admin.html')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
})();
