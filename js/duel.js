/* Duel de classe : quiz en temps réel, jusqu'à 60 joueurs.
 * SCORE AUTORITAIRE CÔTÉ SERVEUR : la base de données chronomètre chaque question, vérifie chaque réponse et calcule les points.
 * Les joueurs ne reçoivent la bonne réponse qu'après avoir répondu (ou à la fin du temps). Le Broadcast ne fait que « réveiller » les écrans. */
(function () {
  const A = () => window.EAApp, esc = v => A().esc(v), $ = s => document.querySelector(s);
  const QTIME = 15000;
  let room = null, S = null, tick = null, poll = null;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function leave() { clearInterval(tick); clearInterval(poll); if (room) { try { room.leave(); } catch (_) {} room = null; } S = null; }

  function menu() {
    if (!A().isCloud()) { A().toast('Le duel en temps réel nécessite le mode cloud (connecte-toi avec ton code).'); return; }
    leave();
    const lv = window.EAQuiz ? EAQuiz.LEVELS : ['A1', 'A2', 'B1', 'B2', 'C1'];
    A().openModal(`<div class="eyebrow">TEMPS RÉEL · SCORE PAR LE SERVEUR</div><h2>⚔️ Duel de classe</h2><p>Mêmes questions pour tous, ${QTIME / 1000} s par question, points bonus pour la rapidité. Le serveur compte les points : impossible de tricher.</p>
      <div class="field-label">Niveau des questions</div><select class="select-field" id="duelLevel"><option value="auto">Auto (mon niveau)</option>${lv.map(l => `<option>${l}</option>`).join('')}</select>
      <div class="field-label" style="margin-top:8px">Nombre de questions</div><select class="select-field" id="duelNq"><option>6</option><option selected>8</option><option>10</option><option>12</option><option>15</option></select>
      <div class="button-row" style="margin-top:12px"><button class="primary-button" data-action="duel-create">Créer un duel</button></div>
      <div class="field-label" style="margin-top:16px">Ou rejoindre avec un code</div>
      <div class="button-row"><input class="form-field" id="duelCode" maxlength="4" placeholder="ABCD" style="max-width:130px;text-transform:uppercase"><button class="secondary-button" data-action="duel-join">Rejoindre</button></div>`);
  }
  async function makeQuestions(level, n) {
    const q = A().getProgress().quiz || {}, lvl = level === 'auto' ? (q.lvl || 'A2') : level;
    await EAQuiz.load(lvl); const used = new Set(), out = [];
    for (let i = 0; i < n; i++) { const ref = EAQuiz.pickFrom(lvl, { cat: 'all', type: 'mcq' }, used); if (!ref) break; used.add(ref.lvl + ':' + ref.id); const r = EAQuiz.bank[lvl][ref.id]; out.push({ q: r[0], o: r[1], a: r[2] }); }
    return out;
  }
  async function enter(code, host, level, nq) {
    A().toast('Connexion au duel…');
    try {
      if (host) await EACloud.duel.create(code, await makeQuestions(level, nq), QTIME); else await EACloud.duel.join(code);
      S = { code, host, st: null, fetchedAt: 0, qIdx: -2, advancing: false, rev: false, mine: null };
      room = await EACloud.openRoom('ea-duel-' + code, { presence: { host }, onMessage: m => { if (m && m.t === 'ping') refresh(); } }).catch(() => null);
      poll = setInterval(() => refresh(), 2500);
      await refresh();
    } catch (e) { leave(); A().toast(e.message || 'Duel indisponible.'); }
  }
  const ping = () => { if (room) try { room.send({ t: 'ping' }); } catch (_) {} };
  async function refresh() {
    if (!S || S.busy) return; S.busy = true;
    try { const st = await EACloud.duel.state(S.code); if (!S) return; S.st = st; S.fetchedAt = Date.now(); S.host = st.is_host; draw(); } catch (e) { if (S && /introuvable/i.test(e.message)) { A().toast('Duel terminé ou supprimé.'); leave(); A().closeModal(); } }
    finally { if (S) S.busy = false; }
  }
  function board(players, showAns) { return '<div class="journey-list">' + players.slice(0, 8).map((p, i) => `<div class="journey-item"><div class="journey-day">${['🥇', '🥈', '🥉'][i] || i + 1}</div><div class="journey-copy"><strong>${esc(p.name)}${p.me ? ' (toi)' : ''}</strong></div>${showAns && p.answered ? '<span class="pill green">a répondu</span>' : ''}<span class="pill">${p.score} pts</span></div>`).join('') + '</div>'; }
  function draw() {
    const st = S.st; if (!st) return;
    if (st.status === 'lobby') {
      clearInterval(tick); S.qIdx = -2;
      return A().openModal(`<div class="eyebrow">DUEL · CODE</div><h2 style="letter-spacing:6px;font-size:40px">${esc(S.code)}</h2><p>Donne ce code à tes camarades (Quiz → Duel de classe → Rejoindre).</p>${board(st.players)}<p><b>${st.players.length}</b> joueur${st.players.length > 1 ? 's' : ''} · ${st.nq} questions</p>${st.is_host ? '<div class="button-row"><button class="primary-button" data-action="duel-start">Lancer le duel ▶</button></div>' : '<p>Le créateur va lancer la partie…</p>'}<div class="button-row" style="margin-top:12px"><button class="ghost-button" data-action="duel-leave">Quitter</button></div>`);
    }
    if (st.status === 'done') return end();
    const q = st.question; if (!q) return;
    if (S.qIdx !== q.idx) { S.qIdx = q.idx; S.mine = st.mine; S.rev = false; S.advancing = false; drawQuestion(); startTick(); window.EAMascot && EAMascot.react('duel'); }
    S.mine = st.mine != null ? st.mine : S.mine;
    const b = $('#duelBoard'); if (b) b.innerHTML = board(st.players, true);
    if (st.reveal && !S.rev) reveal();
  }
  function drawQuestion() {
    const st = S.st, q = st.question;
    A().openModal(`<div class="roleplay-header"><span class="pill green">DUEL ${esc(S.code)}</span><span class="pill">QUESTION ${q.idx + 1} / ${st.nq}</span></div>
      <div class="progress-line" style="margin:12px 0"><span id="duelBar" style="width:100%"></span></div><h2 style="margin:8px 0 14px">${esc(q.q)}</h2>
      <div class="quiz-options">${q.o.map((o, k) => `<button class="quiz-option" data-action="duel-ans" data-i="${k}" ${st.mine != null ? 'disabled' : ''}>${esc(o)}</button>`).join('')}</div><div id="duelFb" class="tiny" style="margin-top:8px"></div><div id="duelBoard" style="margin-top:14px"></div>`);
    if (st.mine != null) document.querySelectorAll('[data-action="duel-ans"]').forEach(b => { if (Number(b.dataset.i) === st.mine) b.style.outline = '2px solid var(--cyan)'; });
  }
  function startTick() {
    clearInterval(tick);
    tick = setInterval(() => {
      if (!S || !S.st) return; const st = S.st, left = Math.max(0, st.qtime_ms - (st.elapsed_ms + (Date.now() - S.fetchedAt))), bar = $('#duelBar'); if (bar) bar.style.width = (left / st.qtime_ms * 100) + '%';
      if (left <= 0 && !S.rev) { S.timeUp = true; refresh(); }
    }, 200);
  }
  function reveal() {
    S.rev = true; const st = S.st;
    document.querySelectorAll('[data-action="duel-ans"]').forEach(b => { const k = Number(b.dataset.i); b.disabled = true; if (k === st.answer) b.style.outline = '2px solid var(--mint)'; else if (k === S.mine) b.style.outline = '2px solid var(--bad)'; });
    if (st.is_host && !S.advancing) { S.advancing = true; (async () => { await sleep(2400); for (let i = 0; i < 12 && S; i++) { try { await EACloud.duel.advance(S.code); ping(); refresh(); return; } catch (e) { await sleep(600); } } })(); }
  }
  async function answer(k) {
    if (!S || !S.st || S.mine != null || S.rev) return; S.mine = k;
    document.querySelectorAll('[data-action="duel-ans"]').forEach(b => { b.disabled = true; if (Number(b.dataset.i) === k) b.style.outline = '2px solid var(--cyan)'; });
    try { const r = await EACloud.duel.answer(S.code, S.st.question.idx, k); const f = $('#duelFb'); if (f) f.textContent = r.ok ? `✅ Bonne réponse ! +${r.pts} pts (calculés par le serveur)` : '❌ Raté — la bonne réponse apparaîtra à la fin du temps.'; ping(); refresh(); }
    catch (e) { A().toast(e.message || 'Réponse refusée.'); S.mine = null; document.querySelectorAll('[data-action="duel-ans"]').forEach(b => { b.disabled = false; b.style.outline = ''; }); }
  }
  function end() {
    if (S.over) return; S.over = true; clearInterval(tick); clearInterval(poll);
    const rk = S.st.players, mine = rk.findIndex(r => r.me), win = mine === 0 && rk.length > 1;
    A().bump('duels'); if (win) A().bump('duelWins');
    A().addXP(15 + (win ? 10 : 0), win ? 'Victoire au duel' : 'Duel terminé'); win && window.EAMascot && EAMascot.react('win');
    A().openModal(`<div style="text-align:center"><h2>${win ? '🏆 Victoire !' : '⚔️ Duel terminé'}</h2><p class="tiny">Classement officiel calculé par le serveur.</p><div style="text-align:left">${board(rk)}</div><div class="button-row" style="justify-content:center;margin-top:14px"><button class="primary-button" data-action="duel-menu">Nouveau duel</button><button class="ghost-button" data-action="duel-leave">Fermer</button></div></div>`);
  }
  async function action(a, btn) {
    if (a === 'duel-open' || a === 'duel-menu') return menu();
    if (a === 'duel-create') { const code = 'ABCDEFGHJKLMNPQRSTUVWXYZ'.split('').sort(() => Math.random() - .5).slice(0, 4).join(''), lv = ($('#duelLevel') || {}).value || 'auto', nq = Number(($('#duelNq') || {}).value || 8); return enter(code, true, lv, nq); }
    if (a === 'duel-join') { const c = (($('#duelCode') || {}).value || '').trim().toUpperCase(); if (c.length !== 4) { A().toast('Le code a 4 lettres.'); return; } return enter(c, false); }
    if (a === 'duel-start') { try { await EACloud.duel.start(S.code); ping(); refresh(); } catch (e) { A().toast(e.message); } return; }
    if (a === 'duel-ans') return answer(Number(btn.dataset.i));
    if (a === 'duel-leave') { leave(); A().closeModal(); }
  }
  window.EADuel = { action, leave };
})();
