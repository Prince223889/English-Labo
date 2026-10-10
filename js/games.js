/* Arcade English Arena : 6 mini-jeux de vocabulaire, jouables hors ligne. */
(function () {
  const A = () => window.EAApp, esc = v => A().esc(v), $ = s => document.querySelector(s);
  const V = () => A().DATA.vocab, shuf = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const GAMES = [
    { id: 'memory', icon: '🃏', name: 'Memory', desc: 'Associe 6 mots anglais à leur traduction.' },
    { id: 'speed', icon: '⚡', name: 'Speed Translate', desc: '60 secondes : traduis un maximum de mots, enchaîne les combos.' },
    { id: 'scramble', icon: '🔀', name: 'Mots mêlés', desc: 'Remets les lettres dans l’ordre (indice en français).' },
    { id: 'hangman', icon: '🪢', name: 'Pendu', desc: 'Devine le mot lettre par lettre, 7 erreurs maximum.' },
    { id: 'builder', icon: '🧩', name: 'Phrase en désordre', desc: 'Remets les mots d’une phrase dans le bon ordre.' },
    { id: 'dictation', icon: '🎧', name: 'Dictée éclair', desc: 'Écoute le mot et écris-le sans faute.' }
  ];
  let G = null, tm = null;
  const best = id => ((A().getProgress().games || {})[id]) || 0;
  function record(id, score, perfect) {
    const p = A().getProgress(); p.games = p.games || {}; const isBest = score > (p.games[id] || 0); if (isBest) p.games[id] = score;
    A().bump('games'); if (perfect) A().bump('gamePerfect');
    const xp = 8 + Math.min(20, Math.round(score / 10)) + (perfect ? 10 : 0); A().touchStudy(3); A().addXP(xp, 'Mini-jeu terminé');
    window.EAMascot && EAMascot.react(perfect ? 'win' : 'sim'); return { xp, isBest };
  }
  function over(id, score, label, perfect) {
    stop(); const r = record(id, score, perfect);
    A().openModal(`<div style="text-align:center"><div style="display:flex;justify-content:center">${window.EAMascot ? EAMascot.html(perfect ? 'cheer' : 'happy', 90) : ''}</div><h2>${perfect ? '🌟 Parfait !' : 'Partie terminée'}</h2><div class="result-score">${score}</div><p>${label}${r.isBest ? ' · 🏅 Nouveau record !' : ` · Record : ${best(id)}`}</p><p>+${r.xp} XP</p><div class="button-row" style="justify-content:center"><button class="primary-button" data-action="game-start" data-game="${id}">Rejouer ↻</button><button class="ghost-button" data-action="close-modal">Fermer</button></div></div>`);
  }
  function stop() { clearInterval(tm); tm = null; }
  function header(g, extra) { return `<div class="roleplay-header"><span class="pill green">${g.icon} ${g.name}</span><span class="pill">${extra || ''}</span></div>`; }

  function start(id) {
    stop(); const g = GAMES.find(x => x.id === id); if (!g) return; G = { id, g };
    ({ memory, speed, scramble, hangman, builder, dictation })[id]();
  }
  // ---------- Memory ----------
  function memory() {
    const words = shuf(V()).slice(0, 6), cards = shuf(words.flatMap(w => [{ k: w.id, t: w.word, l: 'en' }, { k: w.id, t: w.fr, l: 'fr' }]));
    G.m = { cards, open: [], done: new Set(), moves: 0, lock: false }; drawMemory();
  }
  function drawMemory() {
    const m = G.m; A().openModal(`${header(G.g, m.moves + ' coups')}<p>Trouve les paires mot ↔ traduction.</p><div class="mem-grid">${m.cards.map((c, i) => `<button class="mem-card ${m.done.has(c.k) ? 'done' : m.open.includes(i) ? 'up' : ''}" data-action="game-act" data-i="${i}">${m.done.has(c.k) || m.open.includes(i) ? esc(c.t) : '?'}</button>`).join('')}</div>`);
  }
  function memoryClick(i) {
    const m = G.m; if (m.lock || m.open.includes(i) || m.done.has(m.cards[i].k)) return; m.open.push(i); drawMemory();
    if (m.open.length === 2) {
      m.moves++; const [a, b] = m.open.map(x => m.cards[x]);
      if (a.k === b.k && a.l !== b.l) { m.done.add(a.k); m.open = []; drawMemory(); if (m.done.size === 6) setTimeout(() => over('memory', Math.max(10, 100 - (m.moves - 6) * 8), m.moves + ' coups', m.moves <= 7), 500); }
      else { m.lock = true; setTimeout(() => { m.open = []; m.lock = false; if (G && G.m === m) drawMemory(); }, 800); }
    }
  }
  // ---------- Speed ----------
  function speed() { G.s = { score: 0, combo: 0, left: 60, ok: 0, total: 0 }; nextSpeed(); tm = setInterval(() => { G.s.left--; const el = $('#spT'); if (el) el.textContent = G.s.left + ' s'; if (G.s.left <= 0) over('speed', G.s.score, `${G.s.ok}/${G.s.total} bonnes réponses`, G.s.total >= 12 && G.s.ok === G.s.total); }, 1000); }
  function nextSpeed() {
    const s = G.s, w = shuf(V())[0], toFr = Math.random() < .6, pool = shuf(V().filter(x => x.id !== w.id)).slice(0, 3), opts = shuf([w, ...pool]);
    s.cur = { w, toFr, ans: opts.findIndex(o => o.id === w.id) };
    A().openModal(`${header(G.g, 'Score ' + s.score)}<div class="notice blue" style="margin:10px 0"><strong>⏱ <span id="spT">${s.left} s</span></strong> · Combo ×${s.combo}</div><h2 style="text-align:center;margin:14px 0">${esc(toFr ? w.word : w.fr)}</h2><div class="quiz-options">${opts.map((o, i) => `<button class="quiz-option" data-action="game-act" data-i="${i}">${esc(toFr ? o.fr : o.word)}</button>`).join('')}</div>`);
  }
  function speedClick(i) {
    const s = G.s; s.total++; if (i === s.cur.ans) { s.ok++; s.combo++; s.score += 10 + Math.min(10, s.combo * 2); } else { s.combo = 0; s.score = Math.max(0, s.score - 5); } if (s.left > 0) nextSpeed();
  }
  // ---------- Scramble / Dictation / Hangman (mot) ----------
  const pickWords = n => shuf(V().filter(w => /^[a-z]{4,10}$/.test(w.word))).slice(0, n);
  function scramble() { G.sc = { words: pickWords(5), i: 0, score: 0, built: '' }; drawScramble(); }
  function drawScramble() {
    const s = G.sc, w = s.words[s.i]; if (!s.letters) { let l; do { l = shuf(w.word.split('')); } while (l.join('') === w.word); s.letters = l; s.used = []; }
    A().openModal(`${header(G.g, 'Mot ' + (s.i + 1) + '/5')}<p>Indice : <b>${esc(w.fr)}</b></p><div class="letter-row">${w.word.split('').map((_, i) => `<span class="slot">${s.used[i] != null ? esc(s.letters[s.used[i]]) : ''}</span>`).join('')}</div><div class="letter-row">${s.letters.map((c, i) => `<button class="letter" data-action="game-act" data-i="${i}" ${s.used.includes(i) ? 'disabled' : ''}>${esc(c)}</button>`).join('')}</div><div class="button-row" style="justify-content:center"><button class="ghost-button" data-action="game-act" data-i="undo">⌫ Effacer</button><button class="ghost-button" data-action="game-act" data-i="skip">Passer</button></div>`);
  }
  function scrambleClick(i) {
    const s = G.sc, w = s.words[s.i]; if (i === 'undo') s.used.pop(); else if (i === 'skip') return nextScramble(false); else s.used.push(Number(i));
    drawScramble(); if (s.used.length === w.word.length) { const guess = s.used.map(x => s.letters[x]).join(''); if (guess === w.word) { s.score += 20; A().toast('✓ ' + w.word); nextScramble(true); } else { A().toast('Pas tout à fait, réessaie !'); s.used = []; drawScramble(); } }
  }
  function nextScramble() { const s = G.sc; s.i++; s.letters = null; if (s.i >= 5) return over('scramble', s.score, s.score / 20 + '/5 mots', s.score === 100); drawScramble(); }
  function dictation() { G.d = { words: pickWords(5), i: 0, score: 0 }; drawDict(); }
  function drawDict() {
    const d = G.d; A().openModal(`${header(G.g, 'Mot ' + (d.i + 1) + '/5')}<p>Écoute et écris le mot (sens : ${esc(d.words[d.i].fr)}).</p><div class="button-row" style="justify-content:center"><button class="secondary-button" data-action="game-act" data-i="say">🔊 Écouter</button></div><input class="form-field" id="dictIn" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Écris le mot…" style="margin:12px 0"><button class="primary-button" data-action="game-act" data-i="check" style="width:100%">Valider</button>`);
    setTimeout(() => speakEn(d.words[d.i].word), 300);
  }
  function speakEn(t) { if (window.EAMascot) EAMascot.speak(t); else if ('speechSynthesis' in window) speechSynthesis.speak(Object.assign(new SpeechSynthesisUtterance(t), { lang: 'en-US' })); }
  function dictClick(i) {
    const d = G.d; if (i === 'say') return speakEn(d.words[d.i].word);
    const v = (($('#dictIn') || {}).value || '').trim().toLowerCase(), w = d.words[d.i]; if (!v) return;
    if (v === w.word) { d.score += 20; A().toast('✓ Bravo !'); } else A().toast('Réponse : ' + w.word);
    d.i++; if (d.i >= 5) return over('dictation', d.score, d.score / 20 + '/5 mots', d.score === 100); drawDict();
  }
  function hangman() { const w = pickWords(1)[0]; G.h = { w, tried: [], lives: 7 }; drawHang(); }
  function drawHang() {
    const h = G.h, shown = h.w.word.split('').map(c => h.tried.includes(c) ? c : '');
    A().openModal(`${header(G.g, '❤ ' + h.lives)}<p>Indice : <b>${esc(h.w.fr)}</b> (${esc(h.w.type)})</p><div class="letter-row">${shown.map(c => `<span class="slot">${esc(c)}</span>`).join('')}</div><div class="letter-row">${'abcdefghijklmnopqrstuvwxyz'.split('').map(c => `<button class="letter" data-action="game-act" data-i="${c}" ${h.tried.includes(c) ? 'disabled' : ''}>${c}</button>`).join('')}</div>`);
  }
  function hangClick(c) {
    const h = G.h; if (h.tried.includes(c)) return; h.tried.push(c); if (!h.w.word.includes(c)) h.lives--;
    if (h.w.word.split('').every(x => h.tried.includes(x))) return over('hangman', 40 + h.lives * 10, 'Mot trouvé : ' + h.w.word, h.lives === 7);
    if (h.lives <= 0) { stop(); A().openModal(`<div style="text-align:center"><h2>Perdu 😅</h2><p>Le mot était <b>${esc(h.w.word)}</b> (${esc(h.w.fr)}).</p><div class="button-row" style="justify-content:center"><button class="primary-button" data-action="game-start" data-game="hangman">Rejouer</button><button class="ghost-button" data-action="close-modal">Fermer</button></div></div>`); A().bump('games'); return; }
    drawHang();
  }
  // ---------- Phrase en désordre ----------
  function builder() {
    const sents = shuf(V().filter(w => w.example.split(' ').length >= 4 && w.example.split(' ').length <= 9)).slice(0, 5).map(w => w.example); G.b = { sents, i: 0, score: 0 }; nextBuilder(true);
  }
  function nextBuilder(first) {
    const b = G.b; if (!first) b.i++; if (b.i >= 5) return over('builder', b.score, b.score / 20 + '/5 phrases', b.score === 100);
    const target = b.sents[b.i], ws = target.replace(/[.!?]$/, '').split(' '); b.target = target; b.pool = shuf(ws.map((w, k) => ({ w, k }))); b.out = []; drawBuilder();
  }
  function drawBuilder() {
    const b = G.b; A().openModal(`${header(G.g, 'Phrase ' + (b.i + 1) + '/5')}<p>Touche les mots dans le bon ordre.</p><div class="notice" style="min-height:48px;margin:10px 0">${b.out.map(x => esc(x.w)).join(' ') || '…'}</div><div class="letter-row">${b.pool.map(x => `<button class="hint-chip" data-action="game-act" data-i="${x.k}" ${b.out.includes(x) ? 'disabled' : ''}>${esc(x.w)}</button>`).join('')}</div><div class="button-row" style="justify-content:center"><button class="ghost-button" data-action="game-act" data-i="undo">⌫ Effacer</button><button class="ghost-button" data-action="game-act" data-i="skip">Passer</button></div>`);
  }
  function builderClick(i) {
    const b = G.b; if (i === 'skip') return nextBuilder(); if (i === 'undo') { b.out.pop(); return drawBuilder(); }
    b.out.push(b.pool.find(x => String(x.k) === String(i) && !b.out.includes(x))); drawBuilder();
    if (b.out.length === b.pool.length) { const got = b.out.map(x => x.w).join(' ') + (/[.!?]$/.test(b.target) ? b.target.slice(-1) : ''); if (got === b.target) { b.score += 20; A().toast('✓ Parfait !'); nextBuilder(); } else { A().toast('Pas tout à fait, réessaie !'); b.out = []; drawBuilder(); } }
  }
  function act(i) {
    if (!G) return; ({ memory: memoryClick, speed: speedClick, scramble: scrambleClick, hangman: hangClick, builder: builderClick, dictation: dictClick })[G.id](i);
  }
  function action(a, btn) { if (a === 'game-start') return start(btn.dataset.game); if (a === 'game-act') return act(btn.dataset.i); }
  function cardsHTML() { return GAMES.map(g => `<article class="card game-card"><span class="game-ico">${g.icon}</span><h3>${g.name}</h3><p>${g.desc}</p><small>Record : ${best(g.id)}</small><button class="primary-button" data-action="game-start" data-game="${g.id}">Jouer</button></article>`).join(''); }
  window.EAGames = { GAMES, action, start, stop, cardsHTML };
})();
