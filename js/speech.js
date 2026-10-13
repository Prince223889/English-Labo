/* English Arena — EASpeech : lecture vocale COMPLÈTE + reconnaissance vocale fiable.
 * Corrige : voix qui se coupe (bug Chrome ~15 s), voix pas encore chargées, texte long lu en entier,
 * bouton stop, vitesse réglable, reconnaissance continue avec texte en direct et fin auto au silence. */
(function () {
  'use strict';
  const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
  let voices = [], queueId = 0, keepAlive = null, current = null;
  const prefs = { rate: 0.9, voice: '' };
  try { Object.assign(prefs, JSON.parse(localStorage.getItem('ea_speech_prefs') || '{}')); } catch (_) {}
  const savePrefs = () => { try { localStorage.setItem('ea_speech_prefs', JSON.stringify(prefs)); } catch (_) {} };

  function loadVoices() { if (!synth) return []; voices = synth.getVoices() || []; return voices; }
  if (synth) { loadVoices(); try { synth.addEventListener('voiceschanged', loadVoices); } catch (_) { synth.onvoiceschanged = loadVoices; } }

  function pickVoice(lang) {
    if (!voices.length) loadVoices();
    const want = (lang || 'en-US').toLowerCase(), base = want.slice(0, 2);
    if (prefs.voice && lang !== 'fr-FR') { const v = voices.find(x => x.name === prefs.voice); if (v) return v; }
    const ranked = voices.filter(v => v.lang.toLowerCase().replace('_', '-').startsWith(base));
    return ranked.find(v => v.lang.toLowerCase().replace('_', '-') === want && /google|natural|premium|enhanced/i.test(v.name)) ||
      ranked.find(v => v.lang.toLowerCase().replace('_', '-') === want) || ranked.find(v => /google|natural|premium|enhanced/i.test(v.name)) || ranked[0] || null;
  }
  function englishVoices() { loadVoices(); return voices.filter(v => /^en/i.test(v.lang)); }

  // Découpe en morceaux courts (≤ 160 caractères) aux frontières de phrases : évite la coupure de Chrome.
  function chunk(text) {
    const clean = String(text || '').replace(/\s+/g, ' ').replace(/___+/g, ' blank ').trim();
    if (!clean) return [];
    const parts = clean.match(/[^.!?;:…]+[.!?;:…]*\s*/g) || [clean], out = [];
    parts.forEach(p => {
      p = p.trim(); if (!p) return;
      while (p.length > 160) { let cut = p.lastIndexOf(',', 160); if (cut < 60) cut = p.lastIndexOf(' ', 160); if (cut < 40) cut = 160; out.push(p.slice(0, cut + 1).trim()); p = p.slice(cut + 1).trim(); }
      if (p) out.push(p);
    });
    return out;
  }

  function stop() {
    queueId++; clearInterval(keepAlive); keepAlive = null; current = null;
    if (synth) { try { synth.cancel(); } catch (_) {} }
    document.documentElement.classList.remove('ea-speaking');
  }
  const isSpeaking = () => !!(synth && (synth.speaking || synth.pending)) && !!current;

  /** say(text, {lang, rate, pitch, onstart, onend, onword}) → Promise résolue à la fin de la lecture. */
  function say(text, opt) {
    opt = opt || {};
    return new Promise(resolve => {
      if (!synth) { if (window.EAApp) EAApp.toast('La synthèse vocale n’est pas disponible sur ce navigateur : lis le texte à voix haute.'); return resolve(false); }
      stop();
      const id = queueId, lang = opt.lang || 'en-US', parts = chunk(text);
      if (!parts.length) return resolve(true);
      const rate = Math.min(1.5, Math.max(0.5, opt.rate || prefs.rate));
      current = { text, id };
      document.documentElement.classList.add('ea-speaking');
      // Chrome met la lecture en pause après ~15 s : on la relance régulièrement.
      keepAlive = setInterval(() => { try { if (synth.speaking && !synth.paused) { synth.pause(); synth.resume(); } } catch (_) {} }, 10000);
      let i = 0, started = false;
      const finish = ok => { if (id !== queueId) return; clearInterval(keepAlive); keepAlive = null; current = null; document.documentElement.classList.remove('ea-speaking'); if (opt.onend) try { opt.onend(ok); } catch (_) {} resolve(ok); };
      const next = () => {
        if (id !== queueId) return resolve(false);
        if (i >= parts.length) return finish(true);
        const u = new SpeechSynthesisUtterance(parts[i++]);
        u.lang = lang; u.rate = rate; u.pitch = opt.pitch || 1; u.volume = 1;
        const v = pickVoice(lang); if (v) u.voice = v;
        u.onstart = () => { if (!started) { started = true; if (opt.onstart) try { opt.onstart(); } catch (_) {} } if (window.EAMascot) EAMascot.lip(true); };
        u.onboundary = e => { if (window.EAMascot && e.name === 'word') EAMascot.lip(true); if (opt.onword) try { opt.onword(e); } catch (_) {} };
        u.onend = () => { if (window.EAMascot && i >= parts.length) EAMascot.lip(false); next(); };
        u.onerror = e => { if (e.error === 'canceled' || e.error === 'interrupted') return; next(); };
        try { synth.speak(u); } catch (_) { finish(false); }
      };
      // Petit délai : certains navigateurs ignorent speak() juste après cancel().
      setTimeout(next, 60);
    });
  }
  const sayFr = (text, opt) => say(text, Object.assign({ lang: 'fr-FR' }, opt || {}));

  // ---------- Reconnaissance vocale ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, listening = false;
  const canListen = () => !!SR;
  /** listen({lang, onInterim, onFinal, onEnd, onError, silenceMs, continuous}) → { stop() } */
  function listen(opt) {
    opt = opt || {};
    if (!SR) { if (opt.onError) opt.onError('unsupported'); return null; }
    stopListening();
    const r = new SR(); rec = r; listening = true;
    r.lang = opt.lang || 'en-US'; r.interimResults = true; r.continuous = opt.continuous !== false; r.maxAlternatives = 1;
    let finalText = '', silenceTimer = null, ended = false;
    const silenceMs = opt.silenceMs || 2200;
    const arm = () => { clearTimeout(silenceTimer); silenceTimer = setTimeout(() => { try { r.stop(); } catch (_) {} }, silenceMs); };
    r.onstart = () => { if (window.EAMascot) EAMascot.react('listen'); arm(); };
    r.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) finalText += (finalText ? ' ' : '') + t.trim(); else interim += t; }
      if (opt.onInterim) opt.onInterim((finalText + ' ' + interim).trim());
      arm();
    };
    r.onerror = e => { if (e.error === 'no-speech' || e.error === 'aborted') return; if (opt.onError) opt.onError(e.error); };
    r.onend = () => { if (ended) return; ended = true; clearTimeout(silenceTimer); listening = false; if (window.EAMascot) EAMascot.react('idle'); if (opt.onEnd) opt.onEnd(finalText.trim()); };
    try { r.start(); } catch (e) { listening = false; if (opt.onError) opt.onError('start-failed'); return null; }
    return { stop: () => { try { r.stop(); } catch (_) {} } };
  }
  function stopListening() { if (rec) { try { rec.abort(); } catch (_) {} rec = null; } listening = false; }

  // ---------- Mini panneau de réglages (vitesse / voix) ----------
  function settingsHTML() {
    const ev = englishVoices();
    return `<div class="voice-settings"><label class="field-label" for="eaRate">Vitesse de la voix : <b id="eaRateVal">${prefs.rate.toFixed(2)}×</b></label>
      <input type="range" id="eaRate" min="0.5" max="1.3" step="0.05" value="${prefs.rate}">
      <label class="field-label" for="eaVoice">Voix anglaise</label>
      <select id="eaVoice" class="select-field"><option value="">Automatique (la meilleure)</option>${ev.map(v => `<option value="${v.name.replace(/"/g, '')}" ${prefs.voice === v.name ? 'selected' : ''}>${v.name} (${v.lang})</option>`).join('')}</select>
      <div class="button-row" style="margin-top:8px"><button class="ghost-button" data-action="speech-test">🔊 Tester la voix</button><button class="ghost-button" data-action="speech-stop">⏹ Stop</button></div></div>`;
  }
  document.addEventListener('input', e => { if (e.target.id === 'eaRate') { prefs.rate = Number(e.target.value); const l = document.getElementById('eaRateVal'); if (l) l.textContent = prefs.rate.toFixed(2) + '×'; savePrefs(); } });
  document.addEventListener('change', e => { if (e.target.id === 'eaVoice') { prefs.voice = e.target.value; savePrefs(); } });
  // Un clic n'importe où réveille le moteur audio (politique des navigateurs mobiles).
  document.addEventListener('pointerdown', () => { if (synth && !voices.length) loadVoices(); }, { once: true, passive: true });

  window.EASpeech = { say, sayFr, stop, isSpeaking, listen, stopListening, canListen, canSpeak: () => !!synth, prefs, savePrefs, settingsHTML, chunk, englishVoices };
})();
