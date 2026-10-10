/* Duel de classe : quiz en temps réel, jusqu'à toute la classe, sans rien stocker (Supabase Broadcast + Presence).
 * Le créateur (idéalement le prof, sur le projecteur) lance la partie et fait avancer les questions. */
(function () {
  const A = () => window.EAApp, esc = v => A().esc(v), $ = s => document.querySelector(s);
  const QTIME = 15000, NQ = 8;
  let room = null, S = null, tick = null;
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  function questions(seed) { const r = rng(seed), a = A().DATA.quizzes.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, NQ); }
  const me = () => (A().getProfile() || {}).name || 'Élève';
  function leave() { clearInterval(tick); if (room) { room.leave(); room = null; } S = null; }

  function menu() {
    if (!A().isCloud()) { A().toast('Le duel en temps réel nécessite le mode cloud (connecte-toi avec ton code).'); return; }
    leave();
    A().openModal(`<div class="eyebrow">TEMPS RÉEL</div><h2>⚔️ Duel de classe</h2><p>Mêmes questions pour tous, ${QTIME / 1000} s par question, points bonus pour la rapidité. Rien n’est enregistré.</p>
      <div class="button-row"><button class="primary-button" data-action="duel-create">Créer un duel</button></div>
      <div class="field-label" style="margin-top:16px">Ou rejoindre avec un code</div>
      <div class="button-row"><input class="form-field" id="duelCode" maxlength="4" placeholder="ABCD" style="max-width:130px;text-transform:uppercase"><button class="secondary-button" data-action="duel-join">Rejoindre</button></div>`);
  }
  async function enter(code, host) {
    A().toast('Connexion au duel…');
    S = { code, host, players: [], scores: {}, names: {}, i: -1, answers: {}, qs: [], locked: true };
    try {
      room = await EACloud.openRoom('ea-duel-' + code, { presence: { name: me(), host }, onMessage: onMsg, onPresence: list => { if (!S) return; S.players = list; if (S.i < 0) lobby(); else if (!S.host && !list.some(p => p.host) && !S.over) { A().toast('Le créateur a quitté le duel.'); end(); } } });
      S.key = room.key; lobby();
    } catch (e) { leave(); A().toast(e.message || 'Duel indisponible.'); }
  }
  function lobby() {
    if (!S || S.i >= 0) return;
    A().openModal(`<div class="eyebrow">DUEL · CODE</div><h2 style="letter-spacing:6px;font-size:40px">${esc(S.code)}</h2><p>Donne ce code à tes camarades (ils vont dans Quiz → Duel de classe).</p>
      <div class="journey-list">${S.players.map(p => `<div class="journey-item"><div class="journey-day">${esc((p.name || '?').charAt(0).toUpperCase())}</div><div class="journey-copy"><strong>${esc(p.name || '?')}${p.host ? ' 👑' : ''}</strong></div></div>`).join('') || '<p>En attente…</p>'}</div>
      <p><b>${S.players.length}</b> joueur${S.players.length > 1 ? 's' : ''}</p>
      ${S.host ? '<div class="button-row"><button class="primary-button" data-action="duel-start">Lancer le duel ▶</button></div>' : '<p>Le créateur va lancer la partie…</p>'}
      <div class="button-row" style="margin-top:12px"><button class="ghost-button" data-action="duel-leave">Quitter</button></div>`);
  }
  function onMsg(m) {
    if (!S) return;
    if (m.t === 'start') { S.qs = questions(m.seed); S.i = -1; S.started = true; S.scores = {}; S.names = {}; window.EAMascot && EAMascot.react('duel'); if (S.host) setTimeout(() => room.send({ t: 'q', i: 0 }), 2500); showWait(); }
    else if (m.t === 'q') showQ(m.i);
    else if (m.t === 'a') { S.names[m.key] = m.name; if (S.i === m.i) { S.answers[m.key] = 1; S.scores[m.key] = (S.scores[m.key] || 0) + m.pts; liveBoard(); if (S.host && !S.advancing && Object.keys(S.answers).length >= S.players.length) { S.advancing = true; setTimeout(next, 1800); } } }
    else if (m.t === 'end') end();
  }
  function showWait() { A().openModal('<div style="text-align:center;padding:30px 0"><h2>⚔️ Prépare-toi…</h2><p>Le duel commence !</p></div>'); }
  function showQ(i) {
    clearInterval(tick); S.i = i; S.answers = {}; S.locked = false; S.advancing = false; S.chosen = null; S.qStart = Date.now();
    const q = S.qs[i];
    A().openModal(`<div class="roleplay-header"><span class="pill green">DUEL ${esc(S.code)}</span><span class="pill">QUESTION ${i + 1} / ${S.qs.length}</span></div>
      <div class="progress-line" style="margin:12px 0"><span id="duelBar" style="width:100%"></span></div>
      <h2 style="margin:8px 0 14px">${esc(q.question)}</h2>
      <div class="quiz-options">${q.options.map((o, k) => `<button class="quiz-option" data-action="duel-ans" data-i="${k}">${esc(o)}</button>`).join('')}</div>
      <div id="duelBoard" style="margin-top:14px"></div>`);
    liveBoard();
    tick = setInterval(() => {
      const left = Math.max(0, QTIME - (Date.now() - S.qStart)), b = $('#duelBar'); if (b) b.style.width = (left / QTIME * 100) + '%';
      if (left <= 0) { clearInterval(tick); reveal(); if (S.host && !S.advancing) { S.advancing = true; setTimeout(next, 2500); } }
    }, 200);
  }
  function reveal() {
    S.locked = true; const q = S.qs[S.i];
    document.querySelectorAll('[data-action="duel-ans"]').forEach(b => { const k = Number(b.dataset.i); if (k === q.answer) b.style.outline = '2px solid var(--mint)'; else if (k === S.chosen) b.style.outline = '2px solid var(--bad)'; });
  }
  function next() { if (!S || !room) return; if (S.i + 1 >= S.qs.length) room.send({ t: 'end' }); else room.send({ t: 'q', i: S.i + 1 }); }
  function answer(k) {
    if (!S || S.locked || S.chosen != null) return; S.chosen = k; const q = S.qs[S.i], ms = Date.now() - S.qStart, ok = k === q.answer;
    const pts = ok ? 100 + Math.round(Math.max(0, QTIME - ms) / 150) : 0;
    document.querySelectorAll('[data-action="duel-ans"]').forEach(b => { b.disabled = true; if (Number(b.dataset.i) === k) b.style.outline = '2px solid var(--cyan)'; });
    room.send({ t: 'a', key: S.key, name: me(), i: S.i, pts });
  }
  function ranking() { return Object.keys(S.scores).concat(S.players.map(p => p.key).filter(k => !(k in S.scores))).map(k => ({ key: k, name: S.names[k] || (S.players.find(p => p.key === k) || {}).name || '?', pts: S.scores[k] || 0 })).sort((a, b) => b.pts - a.pts); }
  function liveBoard() { const el = $('#duelBoard'); if (!el) return; el.innerHTML = '<div class="journey-list">' + ranking().slice(0, 5).map((r, i) => `<div class="journey-item"><div class="journey-day">${i + 1}</div><div class="journey-copy"><strong>${esc(r.name)}${r.key === S.key ? ' (toi)' : ''}</strong></div><span class="pill ${S.answers[r.key] ? 'green' : ''}">${r.pts} pts</span></div>`).join('') + '</div>'; }
  function end() {
    if (!S) return; S.over = true; clearInterval(tick); const rk = ranking(), mine = rk.findIndex(r => r.key === S.key), win = mine === 0 && rk.length > 1;
    A().bump('duels'); if (win) A().bump('duelWins');
    A().addXP(15 + (win ? 10 : 0), win ? 'Victoire au duel' : 'Duel terminé'); win && window.EAMascot && EAMascot.react('win');
    A().openModal(`<div style="text-align:center"><h2>${win ? '🏆 Victoire !' : '⚔️ Duel terminé'}</h2><div class="journey-list" style="text-align:left">${rk.map((r, i) => `<div class="journey-item"><div class="journey-day">${['🥇', '🥈', '🥉'][i] || i + 1}</div><div class="journey-copy"><strong>${esc(r.name)}${r.key === S.key ? ' (toi)' : ''}</strong></div><span class="pill">${r.pts} pts</span></div>`).join('')}</div><div class="button-row" style="justify-content:center;margin-top:14px"><button class="primary-button" data-action="duel-menu">Nouveau duel</button><button class="ghost-button" data-action="duel-leave">Fermer</button></div></div>`);
    if (room) { room.leave(); room = null; }
  }
  function action(a, btn) {
    if (a === 'duel-open' || a === 'duel-menu') return menu();
    if (a === 'duel-create') return enter('ABCDEFGHJKLMNPQRSTUVWXYZ'.split('').sort(() => Math.random() - .5).slice(0, 4).join(''), true);
    if (a === 'duel-join') { const c = (($('#duelCode') || {}).value || '').trim().toUpperCase(); if (c.length !== 4) { A().toast('Le code a 4 lettres.'); return; } return enter(c, false); }
    if (a === 'duel-start') { if (room) room.send({ t: 'start', seed: Math.floor(Math.random() * 1e9) }); return; }
    if (a === 'duel-ans') return answer(Number(btn.dataset.i));
    if (a === 'duel-leave') { leave(); A().closeModal(); }
  }
  window.EADuel = { action, leave };
})();
