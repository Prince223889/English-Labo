/* English Arena — EAWorld : le Monde de l'anglais.
 * Modes : Solo (carte, lieux, énigmes), Coopératif (une équipe, missions), Alliance (plusieurs équipes, objectif commun),
 * Rivalité (mêmes missions, résultats comparés), Boss final (grammaire, vocabulaire, lecture, compréhension) et Tournoi complet.
 * Tout se joue à plusieurs sur le même appareil (équipes de 2 joueurs ou plus). Enquêtes, pièges, énigmes, défis oraux, pouvoirs des badges. */
(function () {
  'use strict';
  const A = () => window.EAApp, esc = v => A().esc(v), $ = s => document.querySelector(s), D = () => window.EA_WORLD;
  const LV = ['A1', 'A2', 'B1', 'B2', 'C1'], li = l => Math.max(0, LV.indexOf(l));
  const rnd = n => Math.floor(Math.random() * n), pick = a => a[rnd(a.length)];
  const shuffle = a => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = rnd(i + 1); [r[i], r[j]] = [r[j], r[i]]; } return r; };
  const TEAM_ICON = ['🔴', '🔵', '🟢', '🟡'], TEAM_NAME = ['Baobab', 'Fleuve', 'Lion', 'Soleil'];
  const PTS = { quiz: 20, trap: 30, riddle: 30, clue: 25, speak: 40, read: 20, listen: 25, accuse: 100 };
  const KIND_LABEL = { quiz: '📚 Quiz', trap: '🪤 Piège', riddle: '🧩 Énigme', clue: '🕵️ Indice', speak: '🎤 Oral', read: '📖 Lecture', listen: '🎧 Écoute', accuse: '⚖️ Accusation' };
  const PLACES = [
    { id: 'village', name: 'Village de Kita', icon: '🏘️', lvl: 'A1', desc: 'Salutations, nombres et premiers mots.' }, { id: 'market', name: 'Marché de Bamako', icon: '🧺', lvl: 'A1', desc: 'Acheter, vendre, négocier.' },
    { id: 'school', name: 'Lycée', icon: '🏫', lvl: 'A2', desc: 'Cours, devoirs et vie scolaire.' }, { id: 'river', name: 'Fleuve Niger', icon: '⛵', lvl: 'A2', desc: 'Voyages, directions, météo.' },
    { id: 'library', name: 'Grande Bibliothèque', icon: '📚', lvl: 'B1', desc: 'Lire, comprendre, résumer.' }, { id: 'mine', name: 'Mine d’or', icon: '⛏️', lvl: 'B1', desc: 'Travail, économie, environnement.' },
    { id: 'museum', name: 'Musée de Ségou', icon: '🏛️', lvl: 'B2', desc: 'Histoire, culture, débat.' }, { id: 'tower', name: 'Tour de la Capitale', icon: '🗼', lvl: 'C1', desc: 'Idées complexes et nuances.' }
  ];
  const SQUARES = ['start', 'quiz', 'trap', 'clue', 'riddle', 'speak', 'event', 'quiz', 'trap', 'clue', 'powerup', 'riddle', 'speak', 'quiz', 'trap', 'event', 'clue', 'riddle', 'quiz', 'speak', 'trap', 'clue', 'event', 'boss'];
  const SQ_ICON = { start: '🏁', quiz: '📚', trap: '🪤', clue: '🕵️', riddle: '🧩', speak: '🎤', event: '🎲', powerup: '⚡', boss: '👹' };
  const ABORT = new Error('abort');
  let W = { screen: 'home', setup: null, G: null, T: null, ch: null, busy: false };

  const chk = r => { if (r && r.aborted) throw ABORT; return r; };
  function abort() { if (W.G) W.G.rolled = false; if (W.ch) { const r = W.ch.resolve; W.ch = null; r({ aborted: true, ok: false, skipped: true, mult: 1 }); } if (W.caseGo) { const r = W.caseGo; W.caseGo = null; r(false); } }
  async function guard(fn) { try { await fn(); } catch (e) { W.busy = false; if (e !== ABORT) { console.error(e); A().toast('Oups : ' + (e.message || 'erreur')); } } }

  // ---------- état persistant (additif : ne touche à aucune donnée existante) ----------
  function WP() {
    const p = A().getProgress(); if (!p.world || typeof p.world !== 'object') p.world = {}; const w = p.world;
    w.solo = w.solo || { place: 0, stars: {}, pts: 0 }; w.boss = w.boss || { wins: 0, best: 0 }; w.seen = w.seen || {}; w.cases = w.cases || []; w.tourn = w.tourn || null;
    return w;
  }
  const save = () => A().saveNow();
  const userLevel = () => { const q = (A().getProgress().quiz || {}).lvl; return LV.includes(q) ? q : 'A2'; };

  // ---------- fabrique d'épreuves ----------
  function mix(it) { const idx = it.options.map((_, i) => i), sh = shuffle(idx); return Object.assign({}, it, { options: sh.map(i => it.options[i]), answer: sh.indexOf(it.answer) }); }
  function nearby(list, level) { const l = li(level), near = list.filter(x => Math.abs(li(x.level) - l) <= 1); return near.length >= 4 ? near : list; }
  function unseen(type, list, level) {
    const w = WP(); w.seen[type] = w.seen[type] || []; let c = nearby(list, level).filter(x => !w.seen[type].includes(x.id));
    if (!c.length) { w.seen[type] = []; c = nearby(list, level); }
    const it = pick(c); w.seen[type].push(it.id); if (w.seen[type].length > 400) w.seen[type].shift(); return it;
  }
  async function pickRef(type, level, caseObj) {
    const d = D();
    if (type === 'trap') return { t: 'trap', id: unseen('trap', d.traps, level).id };
    if (type === 'riddle') return { t: 'riddle', id: unseen('riddle', d.riddles, level).id };
    if (type === 'speak') return { t: 'speak', id: unseen('speak', d.speaking, level).id };
    if (type === 'read' || type === 'listen') { const p = unseen('read', d.passages, level); return { t: type, id: p.id, q: rnd(3) }; }
    if (type === 'quiz') { await EAQuiz.load(level); const ref = EAQuiz.pickFrom(level, { cat: 'all', type: 'mcq' }, new Set()); if (!ref) return { t: 'trap', id: unseen('trap', d.traps, level).id }; EAQuiz.markSeen(ref.lvl, ref.id); return { t: 'quiz', l: ref.lvl, i: ref.id }; }
    return null;
  }
  async function build(ref) {
    const d = D();
    if (ref.t === 'trap') { const t = d.traps.find(x => x.id === ref.id); return mix({ kind: 'trap', tag: '🪤 Piège de francophone · ' + t.level, q: t.q, options: t.options, answer: t.answer, expl: t.explanation, pts: PTS.trap, penalty: 20, say: '' }); }
    if (ref.t === 'riddle') { const t = d.riddles.find(x => x.id === ref.id); return mix({ kind: 'riddle', tag: '🧩 Énigme · ' + t.level, q: t.q, options: t.options, answer: t.answer, expl: t.explanation, pts: PTS.riddle, say: t.q }); }
    if (ref.t === 'speak') { const t = d.speaking.find(x => x.id === ref.id); return { kind: 'speak', tag: '🎤 Défi oral · ' + t.level, q: t.prompt, fr: t.promptFr, keywords: t.keywords, minWords: t.minWords, tip: t.tip, pts: PTS.speak, say: t.prompt }; }
    if (ref.t === 'quiz') { await EAQuiz.load(ref.l); const r = EAQuiz.bank[ref.l][ref.i]; return { kind: 'quiz', tag: '📚 Quiz ' + ref.l + ' · ' + r[4], q: r[0], options: r[1].slice(), answer: r[2], expl: r[3], pts: PTS.quiz, say: r[6] || '' }; }
    if (ref.t === 'read' || ref.t === 'listen') { const p = d.passages.find(x => x.id === ref.id), q = p.qs[ref.q]; const it = mix({ kind: ref.t, tag: (ref.t === 'read' ? '📖 Lecture · ' : '🎧 Compréhension orale · ') + p.level, ctx: ref.t === 'read' ? p.title + ' — ' + p.text : '', listenText: p.text, q: q.q, options: q.options, answer: q.answer, expl: q.explanation, pts: PTS[ref.t], say: ref.t === 'listen' ? p.text : '' }); return it; }
    if (ref.t === 'clue') { const c = d.cases.find(x => x.id === ref.c), cl = c.clues[ref.k]; return mix({ kind: 'clue', tag: '🕵️ Indice · ' + c.title, ctx: cl.text, q: cl.q.q, options: cl.q.options, answer: cl.q.answer, expl: cl.q.explanation, pts: PTS.clue, clue: { c: c.id, k: ref.k, text: cl.text }, say: cl.text }); }
    if (ref.t === 'accuse') { const c = d.cases.find(x => x.id === ref.c); const names = c.suspects.map(s => s.name), ans = c.suspects.findIndex(s => s.id === c.culprit); return mix({ kind: 'accuse', tag: '⚖️ Accusation · ' + c.title, ctx: '', q: 'Qui est le coupable ?', options: names, answer: ans, expl: c.solutionFr, pts: PTS.accuse, penalty: 30, caseId: c.id, say: '' }); }
    return null;
  }
  async function refItem(type, level, extra) { const ref = await pickRef(type, level); return build(ref); }
  function pickCase(level) { const l = li(level), c = D().cases.filter(x => Math.abs(li(x.level) - l) <= 1), done = WP().cases; const fresh = c.filter(x => !done.includes(x.id)); return pick(fresh.length ? fresh : (c.length ? c : D().cases)); }

  // ---------- fenêtre d'épreuve (QCM, oral) avec pouvoirs des badges ----------
  function powersHTML(item) {
    if (!window.EABadges) return ''; const ch = W.ch, ok = ['fifty', 'skip', 'hint', 'second', 'shield', 'xp2', 'revive', 'swap'];
    const list = EABadges.usable(A().getProgress()).filter(p => ok.includes(p.kind) && !(item.kind === 'speak' && ['fifty', 'second'].includes(p.kind)) && !(p.kind === 'revive' && ch.hearts == null));
    if (!list.length) return '<div class="tiny" style="margin:8px 0">🏅 Pouvoirs des badges : débloque des badges pour en gagner.</div>';
    return '<div class="power-bar">' + list.map(p => `<button class="power-btn" data-action="world-ch-power" data-id="${p.id}" title="${esc(p.desc)}" ${ch.usedPower || ch.answered ? 'disabled' : ''}>${p.icon} ${esc(p.name)}<small>×${p.charges}</small></button>`).join('') + '</div>';
  }
  function drawChallenge() {
    const ch = W.ch, it = ch.item; if (!ch) return;
    const hid = ch.hidden, ans = ch.answered;
    let body;
    if (it.kind === 'speak') {
      body = `<h2 class="quiz-question">${esc(it.q)}</h2><p>${esc(it.fr || '')}</p><div class="notice blue">💡 ${esc(it.tip)} · au moins ${Math.ceil(it.minWords * .6)} mots · utilise : <b>${esc(it.keywords.slice(0, 5).join(', '))}</b></div>${ch.hint ? `<div class="notice">Indice : ${esc(ch.hint)}</div>` : ''}
        <textarea id="worldSpeech" class="response-area" rows="4" placeholder="Parle (🎙) ou écris ta réponse en anglais…" ${ans ? 'disabled' : ''}></textarea><div class="tiny" id="worldMicSt" style="min-height:18px"></div>
        ${ans ? '' : '<div class="button-row"><button class="secondary-button" data-action="world-ch-mic" id="worldMic">🎙 Parler</button><button class="primary-button" data-action="world-ch-speak-ok">Valider ✓</button></div>'}`;
    } else {
      body = (it.ctx ? `<div class="notice" style="margin:8px 0;white-space:pre-wrap">${esc(it.ctx)}</div>` : '') + (it.kind === 'listen' && !ans ? '<div class="notice blue">🎧 Écoute bien le texte (tu peux le réécouter), puis réponds.</div>' : '') +
        `<h2 class="quiz-question">${esc(it.q)} ${it.say ? '<button class="text-button" data-action="world-ch-listen" aria-label="Écouter">🔊</button>' : ''}</h2>${ch.hint ? `<div class="notice blue">💡 ${esc(ch.hint)}</div>` : ''}<div class="answer-list">${it.options.map((o, i) => `<button class="answer-option ${ans && i === it.answer ? 'correct' : ''} ${ans && i === ch.chosen && ch.chosen !== it.answer ? 'incorrect' : ''}" data-action="world-ch-ans" data-i="${i}" ${ans || hid.includes(i) ? 'disabled' : ''} style="${hid.includes(i) ? 'opacity:.2' : ''}"><span class="option-letter">${String.fromCharCode(65 + i)}</span><span>${esc(o)}</span></button>`).join('')}</div>`;
    }
    const fb = ans ? `<div class="quiz-feedback show"><strong>${ch.result.ok ? 'Bravo ! 🎉' : ch.result.skipped ? 'Question passée ⏭️' : 'Pas tout à fait…'}</strong><p>${esc(ch.fbText || it.expl || '')}${!ch.result.ok && !ch.result.skipped && it.kind !== 'speak' ? ' Bonne réponse : « ' + esc(it.options[it.answer]) + ' ».' : ''}</p></div>` : '';
    A().openModal(`<div class="roleplay-header"><span class="pill purple">${esc(it.tag)}</span><span class="pill">${esc(ch.who || '')}</span></div>${ch.hearts != null ? `<div class="tiny">${'❤️'.repeat(Math.max(0, ch.hearts))}${'🖤'.repeat(Math.max(0, (ch.maxHearts || 0) - ch.hearts))}</div>` : ''}${body}${fb}${ans ? '' : powersHTML(it)}${ans ? `<div class="button-row" style="margin-top:12px"><button class="primary-button" data-action="world-ch-next">Continuer →</button></div>` : ''}`);
    if (ch.autoSay && !ans) { ch.autoSay = false; if (window.EASpeech) EASpeech.say(it.say); }
  }
  /** Lance une épreuve et renvoie {ok, skipped, mult, noPenalty, revive}. */
  function runChallenge(item, ctx) {
    ctx = ctx || {};
    return new Promise(resolve => {
      W.ch = { item, resolve, hidden: [], usedPower: false, answered: false, mult: 1, noPenalty: false, second: false, hint: '', who: ctx.who, hearts: ctx.hearts, maxHearts: ctx.maxHearts, swap: ctx.swap, revive: false, result: null, autoSay: item.kind === 'listen' || item.kind === 'riddle' };
      drawChallenge();
    });
  }
  function finishCh(ok, extra) { const ch = W.ch; ch.answered = true; ch.result = Object.assign({ ok, skipped: false, mult: ch.mult, noPenalty: ch.noPenalty, revive: ch.revive }, extra || {}); drawChallenge(); }
  async function powerCh(id) {
    const ch = W.ch; if (!ch || ch.usedPower || ch.answered) return; const p = A().getProgress(), info = EABadges.usable(p).find(x => x.id === id); if (!info) return; const it = ch.item, k = info.kind;
    if (k === 'swap' && !ch.swap) return A().toast('Pas d’autre question disponible ici.');
    EABadges.use(p, id); ch.usedPower = true;
    if (k === 'fifty') { const wr = it.options.map((_, i) => i).filter(i => i !== it.answer && !ch.hidden.includes(i)); ch.hidden = ch.hidden.concat(shuffle(wr).slice(0, 2)); }
    else if (k === 'skip') { ch.answered = true; ch.result = { ok: false, skipped: true, mult: 1 }; save(); return drawChallenge(); }
    else if (k === 'hint') ch.hint = it.kind === 'speak' ? 'Commence par : « ' + it.keywords[0] + ' … »' : 'La bonne réponse commence par « ' + it.options[it.answer].charAt(0) + ' » (' + it.options[it.answer].length + ' caractères).';
    else if (k === 'second') ch.second = true; else if (k === 'shield') ch.noPenalty = true; else if (k === 'xp2') ch.mult = 2;
    else if (k === 'revive') { ch.revive = true; if (ch.hearts != null) ch.hearts = Math.min(ch.maxHearts || 9, ch.hearts + 1); }
    else if (k === 'swap') { const n = await ch.swap(); if (n) { ch.item = n; ch.hidden = []; ch.usedPower = false; } }
    A().toast(info.icon + ' ' + info.name + ' activé !'); save(); drawChallenge();
  }
  function evalSpeech(it, text) {
    const w = text.trim().split(/\s+/).filter(Boolean).length, lower = text.toLowerCase(), hits = it.keywords.filter(k => lower.includes(k.toLowerCase())), need = Math.ceil(it.minWords * .6), miss = it.keywords.filter(k => !hits.includes(k));
    const ok = w >= need && hits.length >= 2;
    return { ok, text: `${w} mot${w > 1 ? 's' : ''} (objectif ${need}+), mots-clés trouvés : ${hits.length}/${it.keywords.length}${miss.length && !ok ? ' · à ajouter : ' + miss.slice(0, 3).join(', ') : ''}. ${ok ? 'Très bien !' : 'Essaie une réponse plus développée la prochaine fois.'}` };
  }
  function chAction(a, btn) {
    const ch = W.ch; if (!ch) return;
    if (a === 'world-ch-ans') {
      if (ch.answered) return; const i = Number(btn.dataset.i), it = ch.item; ch.chosen = i;
      if (i === it.answer) return finishCh(true);
      if (ch.second) { ch.second = false; ch.hidden.push(i); A().toast('🔁 Seconde chance : essaie encore !'); return drawChallenge(); }
      return finishCh(false);
    }
    if (a === 'world-ch-power') return powerCh(btn.dataset.id);
    if (a === 'world-ch-listen') { if (window.EASpeech) EASpeech.say(ch.item.say); return; }
    if (a === 'world-ch-mic') {
      if (!window.EASpeech || !EASpeech.canListen()) return A().toast('Micro non disponible sur ce navigateur (essaie Chrome) : écris ta réponse.');
      const ta = $('#worldSpeech'), base = ta ? ta.value.trim() + ' ' : ''; EASpeech.stop(); const st = $('#worldMicSt'); if (st) st.textContent = '🎙 Je t’écoute…';
      EASpeech.listen({ lang: 'en-US', silenceMs: 3000, onInterim: t => { const x = $('#worldSpeech'); if (x) x.value = base + t; }, onEnd: f => { const x = $('#worldSpeech'), s2 = $('#worldMicSt'); if (f && x) x.value = (base + f).trim(); if (s2) s2.textContent = f ? '✅ Reconnu : relis puis valide.' : 'Rien entendu : réessaie ou écris.'; }, onError: e => { const s2 = $('#worldMicSt'); if (s2) s2.textContent = 'Micro indisponible (' + e + '). Écris ta réponse.'; } });
      return;
    }
    if (a === 'world-ch-speak-ok') { const ta = $('#worldSpeech'), txt = ta ? ta.value.trim() : ''; if (txt.length < 3) return A().toast('Dis ou écris quelque chose en anglais.'); if (window.EASpeech) { EASpeech.stopListening(); EASpeech.stop(); } const r = evalSpeech(ch.item, txt); ch.fbText = r.text; return finishCh(r.ok); }
    if (a === 'world-ch-next') { if (window.EASpeech) { EASpeech.stop(); EASpeech.stopListening(); } const res = ch.result, r = ch.resolve; W.ch = null; A().closeModal(); r(res); }
  }

  // ---------- utilitaires d'équipes ----------
  const speaker = t => t.players[t.turns % t.players.length] || t.name;
  const sumPts = G => G.teams.reduce((s, t) => s + t.pts, 0);
  function newTeam(i, name, players) { return { name: name || 'Équipe ' + TEAM_NAME[i % 4], players: players && players.length ? players : ['Joueur ' + (i + 1) + 'A', 'Joueur ' + (i + 1) + 'B'], icon: TEAM_ICON[i % 4], pts: 0, pos: 0, correct: 0, total: 0, turns: 0, clues: [], speakers: {} }; }
  function persistSession() { try { const w = WP(); w.session = W.G && !W.G.over ? { G: W.G, screen: W.screen } : null; save(); } catch (_) {} }

  // ---------- écrans ----------
  function head(eyebrow, title, desc, extra) { return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${desc}</p></div>${extra ? `<div class="button-row">${extra}</div>` : ''}</div>`; }
  function view() {
    if (!A().getProgress()) return '';
    const s = W.screen;
    if (s === 'setup') return setupHTML(); if (s === 'board') return boardHTML(); if (s === 'rivalry') return rivalryHTML(); if (s === 'solo') return soloHTML(); if (s === 'cases') return casesHTML(); if (s === 'tourn') return tournHTML(); if (s === 'result') return resultHTML();
    return homeHTML();
  }
  function after() { if (W.screen === 'board' || W.screen === 'rivalry') persistSession(); }
  function render() { A().view('world'); }
  function homeHTML() {
    const w = WP(), sess = w.session, lv = userLevel();
    const card = (id, ic, t, d, act) => `<button class="card game-card" style="text-align:left" data-action="${act}" data-mode="${id}"><span class="game-ico">${ic}</span><strong>${t}</strong><small>${d}</small></button>`;
    return `${head('MONDE DE L’ANGLAIS', 'Explore. <em>Enquête.</em> Deviens fort(e).', 'Un monde à explorer seul ou en équipe : lieux, énigmes, enquêtes, pièges de francophones, défis oraux et Boss final. Tes pouvoirs de badges t’aident partout.', `<button class="ghost-button" data-action="world-cases">🕵️ Enquêtes libres</button>`)}
      ${sess ? `<div class="notice blue" style="margin-bottom:14px"><strong>Partie en cours :</strong> ${esc(sess.G.mode)} · ${sess.G.teams.length} équipe(s) <div class="button-row" style="margin-top:8px"><button class="primary-button" data-action="world-resume">Reprendre ↗</button><button class="ghost-button" data-action="world-discard">Abandonner</button></div></div>` : ''}
      <div class="arcade-grid">${card('solo', '🧭', 'Solo · Explorateur', 'Explore 8 lieux, résous des énigmes et progresse grâce à l’anglais.', 'world-mode')}${card('coop', '🤝', 'Coopératif', 'Une équipe de 2+ joueurs : missions à accomplir ensemble, vies partagées, Boss final.', 'world-mode')}${card('alliance', '🛡️', 'Alliance', 'Plusieurs équipes coopèrent vers un objectif commun et s’entraident.', 'world-mode')}${card('rivalry', '⚔️', 'Rivalité', 'Deux équipes (ou plus) font les mêmes missions : comparaison des résultats.', 'world-mode')}${card('boss', '👹', 'Boss final', 'Grammaire, vocabulaire, lecture et compréhension orale : bats le Boss !', 'world-mode')}${card('tourn', '🏟️', 'Tournoi complet', 'Toutes les manches générées automatiquement (toutes rondes ou élimination directe).', 'world-mode')}</div>
      <div class="section-title" style="margin-top:22px"><h3>Ton niveau : ${lv}</h3><span>Les épreuves s’adaptent à ton niveau</span></div>
      <div class="card panel-pad"><p>🕵️ ${D().cases.length} enquêtes · 🪤 ${D().traps.length} pièges de francophones · 🧩 ${D().riddles.length} énigmes · 🎤 ${D().speaking.length} défis oraux · 📖 ${D().passages.length} lectures · 📚 12 000+ questions de quiz.</p><p class="tiny">Astuce : tu joues à plusieurs sur le même appareil (téléphone, tablette, ordinateur ou projecteur). Chaque équipe a au moins 2 joueurs qui se relaient.</p></div>`;
  }

  // ----- Solo -----
  function soloHTML() {
    const w = WP(), s = w.solo, total = Object.values(s.stars).reduce((a, b) => a + b, 0);
    const unlocked = i => i === 0 || (s.stars[PLACES[i - 1].id] || 0) >= 1;
    return `${head('MODE SOLO', 'Carte du <em>monde</em>', `${total}/24 étoiles · ${s.pts} points. Termine chaque lieu avec au moins 1 ⭐ pour ouvrir le suivant.`, `<button class="ghost-button" data-action="world-home">← Retour</button><button class="secondary-button" data-action="world-cases">🕵️ Enquêtes</button><button class="secondary-button" data-action="world-train">🎯 Entraînement libre</button>`)}
      <div class="course-grid">${PLACES.map((pl, i) => { const st = s.stars[pl.id] || 0, ok = unlocked(i); return `<article class="card course-card" style="${ok ? '' : 'opacity:.5'}"><div class="course-meta"><span class="course-icon" style="font-size:26px">${pl.icon}</span><span class="pill ${st ? 'green' : 'purple'}">${pl.lvl}</span></div><h3>${esc(pl.name)}</h3><p>${esc(pl.desc)}</p><div class="course-end"><span>${'⭐'.repeat(st)}${'☆'.repeat(3 - st)}</span><button class="text-button" data-action="world-place" data-i="${i}" ${ok ? '' : 'disabled'}>${ok ? (st ? 'Rejouer ↗' : 'Visiter ↗') : '🔒 Verrouillé'}</button></div></article>`; }).join('')}</div>
      <div class="card panel-pad" style="margin-top:16px"><h3>👹 Boss final</h3><p>${total >= 8 ? 'Tu es prêt(e) : affronte le Boss !' : 'Récolte au moins 8 étoiles pour être bien préparé(e) (tu peux tenter ta chance avant).'}</p><button class="primary-button" data-action="world-start-boss-solo">Défier le Boss</button></div>`;
  }
  async function playPlace(i) {
    if (W.busy) return; W.busy = true; const pl = PLACES[i], lv = pl.lvl, w = WP(); let hearts = 5, ok = 0; const types = shuffle(['quiz', 'quiz', 'trap', 'trap', 'riddle', pick(['speak', 'read'])]);
    try {
      for (let k = 0; k < types.length && hearts > 0; k++) {
        const it = await refItem(types[k], lv), res = chk(await runChallenge(it, { who: `${pl.icon} ${pl.name} · ${k + 1}/6`, hearts, maxHearts: 5, swap: () => refItem(types[k], lv) }));
        if (res.revive) hearts = Math.min(5, hearts + 1);
        if (res.ok) { ok++; w.solo.pts += it.pts * res.mult; A().addXP(Math.round(it.pts / 5) * res.mult, 'Bonne réponse'); } else if (!res.skipped && it.kind === 'trap' && !res.noPenalty) hearts--;
      }
    } finally { W.busy = false; }
    const stars = ok >= 6 ? 3 : ok >= 5 ? 2 : ok >= 3 ? 1 : 0, prev = w.solo.stars[pl.id] || 0; if (stars > prev) { w.solo.stars[pl.id] = stars; A().addXP(15 * (stars - prev), 'Étoiles gagnées'); }
    A().bump('worlds'); A().touchStudy(5); save();
    A().openModal(`<div style="text-align:center"><div style="font-size:54px">${pl.icon}</div><h2>${esc(pl.name)}</h2><div style="font-size:34px">${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</div><p>${ok}/6 épreuves réussies${hearts <= 0 ? ' · plus de vies !' : ''}.</p><p>${stars >= 1 ? (i < 7 ? 'Le lieu suivant est ouvert ! 🎉' : 'Le Boss final t’attend ! 👹') : 'Il faut au moins 3 réussites pour une étoile. Réessaie !'}</p><div class="button-row" style="justify-content:center"><button class="primary-button" data-action="world-solo-back">Retour à la carte</button></div></div>`);
    if (window.EAMascot) EAMascot.react(stars ? 'win' : 'think');
  }
  async function trainFree() {
    if (W.busy) return; W.busy = true; const lv = userLevel(); let n = 0, ok = 0;
    try { for (;;) { const t = pick(['trap', 'riddle', 'quiz', 'speak', 'read']), it = await refItem(t, lv), res = chk(await runChallenge(it, { who: 'Entraînement · ' + (n + 1), swap: () => refItem(t, lv) })); n++; if (res.ok) { ok++; A().addXP(Math.round(it.pts / 6) * res.mult, 'Entraînement'); } if (n >= 5) break; } } finally { W.busy = false; }
    A().bump('worlds'); A().touchStudy(4); save(); A().toast(`Entraînement terminé : ${ok}/${n} réussies.`); render();
  }

  // ----- Enquêtes -----
  function casesHTML() {
    const w = WP(); return `${head('ENQUÊTES', 'Mène l’<em>enquête</em>', 'Lis les indices, réponds aux questions de compréhension pour les débloquer, puis accuse le bon suspect. Un seul coupable est déductible des indices.', `<button class="ghost-button" data-action="world-home">← Retour</button>`)}
      <div class="course-grid">${D().cases.map(c => `<article class="card course-card"><div class="course-meta"><span class="course-icon" style="font-size:26px">${c.icon}</span><span class="pill ${w.cases.includes(c.id) ? 'green' : 'purple'}">${w.cases.includes(c.id) ? 'RÉSOLUE' : c.level}</span></div><h3>${esc(c.title)}</h3><p>${esc(c.introFr)}</p><div class="course-end"><span>${c.clues.length} indices · ${c.suspects.length} suspects</span><button class="text-button" data-action="world-case" data-id="${c.id}">Enquêter ↗</button></div></article>`).join('')}</div>`;
  }
  async function playCase(id) {
    if (W.busy) return; W.busy = true; const c = D().cases.find(x => x.id === id), w = WP(); const notebook = []; let okCount = 0;
    try {
      A().openModal(`<div class="eyebrow">ENQUÊTE · ${c.level}</div><h2>${c.icon} ${esc(c.title)}</h2><p>${esc(c.intro)}</p><p class="tiny">${esc(c.introFr)}</p><div class="journey-list">${c.suspects.map(s => `<div class="journey-item"><div class="journey-day" style="font-size:22px">${s.emoji}</div><div class="journey-copy"><strong>${esc(s.name)}</strong><small>${esc(s.desc)}</small></div></div>`).join('')}</div><div class="button-row" style="margin-top:12px"><button class="primary-button" data-action="world-case-go">Commencer l’enquête ▶</button></div>`);
      if ((await new Promise(r => { W.caseGo = r; })) !== true) throw ABORT; if (window.EASpeech) EASpeech.say(c.intro);
      for (let k = 0; k < c.clues.length; k++) {
        const it = await build({ t: 'clue', c: c.id, k }), res = chk(await runChallenge(it, { who: `${c.icon} Indice ${k + 1}/${c.clues.length}` }));
        if (res.ok) { okCount++; } notebook.push(it.clue.text);
      }
      const acc = await build({ t: 'accuse', c: c.id }); acc.ctx = 'Carnet d’enquête :\n' + notebook.map((t, i) => (i + 1) + '. ' + t).join('\n'); acc.say = '';
      const res = chk(await runChallenge(acc, { who: '⚖️ Accusation finale' }));
      const won = res.ok; if (won && !w.cases.includes(c.id)) { w.cases.push(c.id); A().bump('cases'); }
      const xp = 30 + okCount * 8 + (won ? 40 * res.mult : 0); A().addXP(xp, won ? 'Enquête résolue' : 'Enquête terminée'); A().touchStudy(8); save();
      A().openModal(`<div class="roleplay" style="text-align:center"><div style="font-size:50px">${won ? '🕵️‍♂️🎉' : '🤔'}</div><h2>${won ? 'Affaire résolue !' : 'Le coupable t’a échappé…'}</h2><p>Indices compris : ${okCount}/${c.clues.length} · +${xp} XP</p><div class="notice blue" style="text-align:left"><strong>La déduction</strong><ul style="margin:6px 0 0 18px">${c.deduction.map(d => `<li>${esc(d)}</li>`).join('')}</ul><p style="margin:8px 0 0">${esc(c.solutionFr)}</p></div><div class="button-row" style="justify-content:center;margin-top:12px"><button class="primary-button" data-action="world-cases">Autres enquêtes</button></div></div>`);
      if (window.EAMascot) EAMascot.react(won ? 'win' : 'think');
    } finally { W.busy = false; }
  }

  // ----- Boss final -----
  async function bossItems(level) {
    const l = li(level), L = LV[l], gram = [], items = [];
    for (let i = 0; i < 3; i++) items.push(await refItem('trap', L)); for (let i = 0; i < 2; i++) items.push(await refItem('quiz', L));
    const lex = []; for (let i = 0; i < 3; i++) lex.push(await refItem('quiz', L)); lex.push(await refItem('riddle', L)); lex.push(await refItem('trap', L));
    const p = unseen('read', D().passages, L), rd = [0, 1, 2].map(q => build({ t: 'read', id: p.id, q })), p2 = unseen('read', D().passages, L), ls = [0, 1, 2].map(q => build({ t: 'listen', id: p2.id, q }));
    const phases = [['📝 Grammaire', items], ['📚 Vocabulaire', lex], ['📖 Lecture', await Promise.all(rd)], ['🎧 Compréhension orale', await Promise.all(ls)]];
    return phases;
  }
  async function bossFight(level, team, hearts0) {
    const phases = await bossItems(level), maxH = hearts0 || 3; let hearts = maxH, hp = 160, ok = 0, total = 0, pts = 0, k = 0;
    outer: for (const [name, items] of phases) {
      for (const it of items) {
        if (hearts <= 0) break outer; k++;
        const res = chk(await runChallenge(it, { who: `👹 Boss · ${name} · ${k}/16`, hearts, maxHearts: maxH, swap: () => refItem(it.kind === 'riddle' ? 'riddle' : it.kind === 'trap' ? 'trap' : 'quiz', level) }));
        total++; if (res.revive) hearts = Math.min(maxH, hearts + 1);
        if (res.ok) { ok++; hp -= 10; pts += it.pts * res.mult; } else if (!res.skipped && !res.noPenalty) hearts--;
      }
    }
    return { win: hp <= 0 || (ok >= 12 && hearts > 0), hp: Math.max(0, hp), hearts, ok, total, pts };
  }
  async function playBossSolo() {
    if (W.busy) return; W.busy = true; let r;
    try { r = await bossFight(userLevel(), null, 3); } finally { W.busy = false; }
    const w = WP(); const xp = r.win ? 120 + r.ok * 5 : 20 + r.ok * 3; w.boss.best = Math.max(w.boss.best, r.ok); if (r.win) { w.boss.wins++; A().bump('bossWins'); } A().bump('worlds'); A().addXP(xp, r.win ? 'Boss vaincu !' : 'Combat contre le Boss'); A().touchStudy(10); save();
    A().openModal(`<div style="text-align:center"><div style="font-size:60px">${r.win ? '🏆' : '👹'}</div><h2>${r.win ? 'Boss vaincu !' : 'Le Boss résiste…'}</h2><p>${r.ok}/${r.total} bonnes réponses · PV du Boss restants : ${r.hp}/160 · vies : ${r.hearts}</p><p>+${xp} XP</p><div class="button-row" style="justify-content:center"><button class="primary-button" data-action="world-home">Retour au Monde</button><button class="ghost-button" data-action="world-start-boss-solo">Rejouer</button></div></div>`);
    if (window.EAMascot) EAMascot.react(r.win ? 'win' : 'think');
  }

  // ----- Préparation des équipes -----
  function startSetup(mode) {
    const n = MODE_INFO[mode][2];
    W.setup = { mode, level: userLevel(), teams: Array.from({ length: n }, (_, i) => ({ name: 'Équipe ' + TEAM_NAME[i], players: '' })), format: 'roundrobin', withCase: true }; W.screen = 'setup'; render();
  }
  function syncSetup() { const S = W.setup; if (!S) return; S.teams.forEach((t, i) => { const a = $('#tn' + i), b = $('#tp' + i); if (a) t.name = a.value; if (b) t.players = b.value; }); const lv = $('#setLevel'); if (lv) S.level = lv.value; const f = $('#setFormat'); if (f) S.format = f.value; const c = $('#setCase'); if (c) S.withCase = c.checked; }
  const MODE_INFO = { coop: ['🤝 Coopératif', 'Une seule équipe (2 joueurs minimum). Missions : résoudre l’enquête, atteindre l’objectif de points, puis vaincre le Boss. 5 vies partagées, 30 tours.', 1, 1], alliance: ['🛡️ Alliance', 'Plusieurs équipes avancent sur le même plateau pour un objectif commun : indices partagés, vies communes, sauvetage entre équipes.', 2, 4], rivalry: ['⚔️ Rivalité', 'Les équipes font exactement les mêmes missions (mêmes questions, même ordre). Les résultats sont comparés à la fin.', 2, 4], boss: ['👹 Boss final (équipe)', 'Une équipe affronte le Boss : grammaire, vocabulaire, lecture, compréhension. Les joueurs se relaient.', 1, 1], tourn: ['🏟️ Tournoi complet', 'Entre 3 et 8 équipes : toutes les manches sont générées automatiquement. Chaque match est une rivalité.', 3, 8] };
  function setupHTML() {
    const S = W.setup, info = MODE_INFO[S.mode], min = info[2], max = info[3];
    return `${head(info[0].toUpperCase(), 'Prépare tes <em>équipes</em>', esc(info[1]), `<button class="ghost-button" data-action="world-home">← Retour</button>`)}
      <div class="card panel-pad"><div class="field-label">Niveau des épreuves</div><select id="setLevel" class="select-field">${LV.map(l => `<option ${S.level === l ? 'selected' : ''}>${l}</option>`).join('')}</select>
      ${S.mode === 'tourn' ? `<div class="field-label" style="margin-top:10px">Format</div><select id="setFormat" class="select-field"><option value="roundrobin" ${S.format === 'roundrobin' ? 'selected' : ''}>Toutes rondes (chaque équipe rencontre toutes les autres)</option><option value="knockout" ${S.format === 'knockout' ? 'selected' : ''}>Élimination directe (tableau complet)</option></select>` : ''}
      ${S.mode === 'rivalry' ? `<label style="display:flex;gap:8px;margin-top:10px;align-items:center"><input type="checkbox" id="setCase" ${S.withCase ? 'checked' : ''}> Inclure une enquête (5 indices + accusation) dans les missions</label>` : ''}
      <div class="section-head" style="margin-top:14px"><h3>Équipes (${S.teams.length})</h3><div class="button-row">${S.teams.length < max ? '<button class="ghost-button" data-action="world-team-add">＋ Équipe</button>' : ''}${S.teams.length > min ? '<button class="ghost-button" data-action="world-team-del">− Équipe</button>' : ''}</div></div>
      ${S.teams.map((t, i) => `<div class="card panel-pad" style="margin-bottom:10px"><div class="field-label">${TEAM_ICON[i % 4]} Nom de l’équipe</div><input class="form-field" id="tn${i}" maxlength="24" value="${esc(t.name)}"><div class="field-label" style="margin-top:8px">Joueurs (séparés par des virgules, au moins 2)</div><input class="form-field" id="tp${i}" maxlength="120" placeholder="Awa, Moussa, Rokia" value="${esc(t.players)}"></div>`).join('')}
      <div class="button-row" style="margin-top:12px"><button class="primary-button" data-action="world-setup-go">Lancer ▶</button></div></div>`;
  }
  function readTeams() {
    const S = W.setup; syncSetup(); const names = new Set(), teams = [];
    for (let i = 0; i < S.teams.length; i++) {
      const t = S.teams[i], players = t.players.split(',').map(x => x.trim()).filter(Boolean).slice(0, 8), name = t.name.trim() || 'Équipe ' + (i + 1);
      if (players.length < 2) throw new Error('Chaque équipe doit avoir au moins 2 joueurs (' + name + ').'); if (names.has(name.toLowerCase())) throw new Error('Deux équipes ont le même nom.'); names.add(name.toLowerCase()); teams.push(newTeam(i, name, players));
    }
    return teams;
  }
  async function setupGo() {
    const S = W.setup; let teams; try { teams = readTeams(); } catch (e) { return A().toast(e.message); }
    if (S.mode === 'boss') return guard(() => startBossTeam(teams[0], S.level)); if (S.mode === 'tourn') return startTournament(teams, S);
    if (S.mode === 'rivalry') return startRivalry(teams, S.level, S.withCase);
    return startBoard(S.mode, teams, S.level);
  }

  // ----- Plateau (coop / alliance) -----
  async function startBoard(mode, teams, level) {
    const c = pickCase(level); const G = { mode, level, teams, turn: 0, round: 1, hearts: mode === 'coop' ? 5 : 6, maxHearts: mode === 'coop' ? 5 : 6, caseId: c.id, notebook: [], solved: false, accuse: 0, goal: mode === 'coop' ? 500 : 300 * teams.length, maxTurns: mode === 'coop' ? 30 : 12 * teams.length, turnsPlayed: 0, log: ['Partie lancée. Bonne chance !'], over: false, rolled: false, bossDone: false };
    W.G = G; W.screen = 'board'; render(); if (window.EAMascot) EAMascot.react('say', { text: 'Enquête : ' + c.title + ' 🕵️', ms: 4000, force: true });
  }
  const missionsDone = G => G.solved && sumPts(G) >= G.goal;
  function boardHTML() {
    const G = W.G; if (!G) return homeHTML(); const t = G.teams[G.turn], c = D().cases.find(x => x.id === G.caseId);
    const grid = SQUARES.map((s, i) => `<div class="wsq wsq-${s}" title="${s}"><span>${SQ_ICON[s]}</span><em>${i}</em><div class="wpawns">${G.teams.filter(x => x.pos === i).map(x => x.icon).join('')}</div></div>`).join('');
    return `${head(G.mode === 'coop' ? 'COOPÉRATIF' : 'ALLIANCE', esc(c.icon + ' ' + c.title), `Niveau ${G.level} · tour ${G.turnsPlayed + 1}/${G.maxTurns}`, `<button class="ghost-button" data-action="world-quit">Quitter la partie</button>`)}
      <div class="two-column"><div><div class="card panel-pad"><div class="wboard">${grid}</div><p class="tiny">🏁 départ · 📚 quiz · 🪤 piège (−1 vie) · 🕵️ indice · 🧩 énigme · 🎤 oral · 🎲 événement · ⚡ pouvoir · 👹 Boss (verrouillé tant que les missions ne sont pas finies)</p></div>
        <div class="card panel-pad" style="margin-top:12px"><h3>${t.icon} ${esc(t.name)} — c’est au tour de <b>${esc(speaker(t))}</b></h3><div class="button-row"><button class="primary-button" data-action="world-roll" ${G.rolled || W.busy ? 'disabled' : ''}>🎲 Lancer le dé</button><button class="secondary-button" data-action="world-notebook">🔦 Carnet (${G.notebook.length})</button><button class="secondary-button" data-action="world-accuse" ${G.notebook.length >= 3 && !G.solved ? '' : 'disabled'}>⚖️ Accuser</button></div><div class="journey-list" style="margin-top:10px">${G.log.slice(-4).reverse().map(l => `<div class="journey-item"><div class="journey-copy"><small>${esc(l)}</small></div></div>`).join('')}</div></div></div>
      <div class="right-stack"><div class="card progress-card"><h3>🎯 Missions communes</h3><div class="journey-list"><div class="journey-item"><div class="journey-day">${G.solved ? '✅' : '⬜'}</div><div class="journey-copy"><strong>Résoudre l’enquête</strong><small>${G.notebook.length}/${c.clues.length} indices · accusations ${G.accuse}/2</small></div></div><div class="journey-item"><div class="journey-day">${sumPts(G) >= G.goal ? '✅' : '⬜'}</div><div class="journey-copy"><strong>Objectif : ${G.goal} points</strong><small>${sumPts(G)} / ${G.goal}</small></div></div><div class="journey-item"><div class="journey-day">${G.bossDone ? '✅' : '⬜'}</div><div class="journey-copy"><strong>Vaincre le Boss final</strong><small>Case 👹 en fin de plateau</small></div></div></div><div class="progress-line"><span style="width:${Math.min(100, sumPts(G) / G.goal * 100)}%"></span></div><p>${'❤️'.repeat(Math.max(0, G.hearts))}${'🖤'.repeat(Math.max(0, G.maxHearts - G.hearts))} vies communes</p></div>
        <div class="card progress-card"><h3>Équipes</h3>${G.teams.map((x, i) => `<div class="journey-item"><div class="journey-day">${x.icon}</div><div class="journey-copy"><strong>${esc(x.name)}${i === G.turn ? ' ◀' : ''}</strong><small>${x.pts} pts · case ${x.pos} · ${x.correct}/${x.total} réussies</small></div></div>`).join('')}</div></div></div>`;
  }
  const logG = m => { W.G.log.push(m); if (W.G.log.length > 30) W.G.log.shift(); };
  async function rollDice() {
    const G = W.G; if (!G || G.rolled || W.busy) return; W.busy = true; G.rolled = true; const t = G.teams[G.turn];
    try {
      const d = 1 + rnd(4); let np = t.pos + d; const last = SQUARES.length - 1;
      if (np >= last && !missionsDone(G)) { np = last - 1; logG(`${t.icon} ${speaker(t)} lance 🎲${d} : la porte du Boss est verrouillée (finis d’abord les missions).`); } else { np = Math.min(last, np); logG(`${t.icon} ${speaker(t)} lance 🎲${d} → case ${np}.`); }
      t.pos = np; render(); await sleepUI(450);
      await landOn(t, SQUARES[np]);
    } finally { W.busy = false; }
    endTurn();
  }
  const sleepUI = ms => new Promise(r => setTimeout(r, ms));
  async function squareItem(type, G) {
    const c = D().cases.find(x => x.id === G.caseId);
    if (type === 'clue') { const have = G.notebook.map(n => n.k), k = c.clues.findIndex((_, i) => !have.includes(i)); if (k >= 0) return build({ t: 'clue', c: c.id, k }); return refItem('quiz', G.level); }
    return refItem(type, G.level);
  }
  async function landOn(t, type) {
    const G = W.G, who = `${t.icon} ${t.name} · ${speaker(t)}`;
    if (type === 'start') return;
    if (type === 'boss') { const r = await bossFight(G.level, t, G.hearts); G.bossDone = !!r.win; t.pts += r.pts; logG(r.win ? '👹 Boss vaincu !' : '👹 Le Boss résiste… les vies sont perdues.'); if (!r.win) G.hearts = 0; else G.hearts = Math.max(1, r.hearts); return; }
    if (type === 'event') { const ev = pick(D().events); logG('🎲 ' + ev.text); A().toast(ev.text); t.pts = Math.max(0, t.pts + ev.points); if (ev.move) t.pos = Math.max(0, Math.min(SQUARES.length - 2, t.pos + ev.move)); if (ev.kind === 'powerup') { const b = EABadges.grant(A().getProgress(), 1); if (b) A().toast('⚡ +1 charge : ' + b.title); } if (ev.kind === 'swap' && G.teams.length > 1) { const o = G.teams[(G.turn + 1) % G.teams.length]; [t.pos, o.pos] = [o.pos, t.pos]; } return; }
    if (type === 'powerup') { const b = EABadges.grant(A().getProgress(), 1); logG(b ? '⚡ +1 charge de pouvoir (' + b.title + ')' : '⚡ Débloque des badges pour gagner des pouvoirs !'); save(); return; }
    const it = await squareItem(type, G), res = chk(await runChallenge(it, { who, hearts: G.hearts, maxHearts: G.maxHearts, swap: () => refItem(type === 'clue' ? 'quiz' : type, G.level) })); t.total++; t.turns++;
    if (res.revive) G.hearts = Math.min(G.maxHearts, G.hearts + 1);
    if (res.ok) { t.correct++; const gain = it.pts * res.mult; t.pts += gain; logG(`✅ ${KIND_LABEL[it.kind] || it.kind} réussi : +${gain} pts`); if (it.clue && !G.notebook.some(n => n.k === it.clue.k)) { G.notebook.push(it.clue); A().bump('clues'); logG('🔦 Nouvel indice dans le carnet commun !'); } }
    else {
      logG(`❌ ${KIND_LABEL[it.kind] || it.kind} raté${res.skipped ? ' (passé)' : ''}.`);
      if (!res.skipped && it.kind === 'trap' && !res.noPenalty) { G.hearts--; t.pts = Math.max(0, t.pts - 20); logG('🪤 Piège ! −1 vie, −20 pts.'); }
      if (!res.skipped && G.mode === 'alliance' && G.teams.length > 1) { const ally = G.teams[(G.turn + 1) % G.teams.length], again = await build(it.clue ? { t: 'clue', c: G.caseId, k: it.clue.k } : (await pickRef(it.kind === 'accuse' ? 'quiz' : it.kind, G.level))); const r2 = chk(await runChallenge(again, { who: `🛟 Sauvetage · ${ally.icon} ${ally.name} aide ${t.name}`, hearts: G.hearts, maxHearts: G.maxHearts })); if (r2.ok) { const half = Math.round(again.pts / 2); t.pts += half; ally.pts += half; logG(`🤝 ${ally.name} sauve ${t.name} : +${half} pts chacun !`); if (again.clue && !G.notebook.some(n => n.k === again.clue.k)) G.notebook.push(again.clue); } }
    }
  }
  function endTurn() {
    const G = W.G; if (!G) return; G.rolled = false; G.turnsPlayed++; G.turn = (G.turn + 1) % G.teams.length;
    if (G.hearts <= 0) return finishGame('hearts'); if (G.bossDone && missionsDone(G)) return finishGame('win'); if (G.turnsPlayed >= G.maxTurns) return finishGame('turns');
    render();
  }
  function notebookModal() {
    const G = W.G, c = D().cases.find(x => x.id === G.caseId);
    A().openModal(`<div class="eyebrow">CARNET D’ENQUÊTE</div><h2>${c.icon} ${esc(c.title)}</h2><p>${esc(c.intro)}</p><div class="journey-list">${G.notebook.map((n, i) => `<div class="journey-item"><div class="journey-day">${i + 1}</div><div class="journey-copy"><small>${esc(n.text)}</small></div><button class="text-button" data-action="speak-text" data-text="${esc(n.text)}">🔊</button></div>`).join('') || '<p>Aucun indice pour l’instant : va sur une case 🕵️ !</p>'}</div><h3>Suspects</h3><div class="journey-list">${c.suspects.map(s => `<div class="journey-item"><div class="journey-day" style="font-size:20px">${s.emoji}</div><div class="journey-copy"><strong>${esc(s.name)}</strong><small>${esc(s.desc)}</small></div></div>`).join('')}</div>`);
  }
  async function accuse() {
    const G = W.G; if (!G || W.busy || G.solved) return; W.busy = true; const c = D().cases.find(x => x.id === G.caseId), t = G.teams[G.turn];
    try {
      const it = await build({ t: 'accuse', c: c.id }); it.ctx = 'Carnet d’enquête :\n' + G.notebook.map((n, i) => (i + 1) + '. ' + n.text).join('\n'); G.accuse++;
      const res = chk(await runChallenge(it, { who: `⚖️ ${t.icon} ${t.name} accuse`, hearts: G.hearts, maxHearts: G.maxHearts }));
      if (res.ok) { G.solved = true; t.pts += 100 * res.mult; t.correct++; A().bump('cases'); const w = WP(); if (!w.cases.includes(c.id)) w.cases.push(c.id); logG('🎉 Enquête résolue ! +100 pts'); A().openModal(`<div class="roleplay" style="text-align:center"><h2>🕵️ Affaire résolue !</h2><div class="notice blue" style="text-align:left"><ul style="margin:0 0 0 18px">${c.deduction.map(d => `<li>${esc(d)}</li>`).join('')}</ul><p>${esc(c.solutionFr)}</p></div><div class="button-row" style="justify-content:center"><button class="primary-button" data-action="close-modal">Continuer</button></div></div>`); }
      else if (!res.skipped) { if (!res.noPenalty) { G.hearts--; t.pts = Math.max(0, t.pts - 30); } logG('⚖️ Mauvaise accusation ! −1 vie, −30 pts.'); if (G.accuse >= 2) { G.solved = true; logG('Le coupable était : ' + c.suspects.find(s => s.id === c.culprit).name + '. L’enquête est clôturée.'); } }
    } finally { W.busy = false; }
    if (G.hearts <= 0) return finishGame('hearts'); render();
  }
  function finishGame(reason) {
    const G = W.G; G.over = true; G.reason = reason; G.won = reason === 'win'; W.screen = 'result';
    const total = sumPts(G), accGood = G.teams.reduce((s, t) => s + t.correct, 0);
    const xp = (G.won ? 100 : 30) + Math.round(total / 10) + accGood * 3; A().bump('worlds'); A().bump('teamGames'); A().addXP(xp, G.won ? 'Mission accomplie !' : 'Partie terminée'); A().touchStudy(15); G.xp = xp; WP().session = null; save();
    if (window.EAMascot) EAMascot.react(G.won ? 'win' : 'think'); render();
  }
  function resultHTML() {
    const G = W.G; if (!G) return homeHTML(); const sorted = G.teams.slice().sort((a, b) => b.pts - a.pts || b.correct - a.correct);
    if (G.mode === 'rivalry') { const win = sorted[0], tie = sorted.length > 1 && sorted[0].pts === sorted[1].pts && sorted[0].correct === sorted[1].correct; return `${head('RÉSULTATS · RIVALITÉ', tie ? 'Égalité parfaite !' : esc(win.icon + ' ' + win.name) + ' <em>gagne !</em>', 'Mêmes missions pour tout le monde : voici la comparaison.', `<button class="primary-button" data-action="world-home">Retour au Monde</button>`)}<div class="card panel-pad"><div class="journey-list">${sorted.map((t, i) => `<div class="journey-item"><div class="journey-day">${['🥇', '🥈', '🥉'][i] || i + 1}</div><div class="journey-copy"><strong>${t.icon} ${esc(t.name)}</strong><small>${t.pts} pts · ${t.correct}/${t.total} réussies (${t.total ? Math.round(t.correct / t.total * 100) : 0} %) · joueurs : ${esc(t.players.join(', '))}</small></div></div>`).join('')}</div><h3 style="margin-top:14px">Mission par mission</h3><div class="journey-list">${(G.rows || []).map(r => `<div class="journey-item"><div class="journey-day">${r.n}</div><div class="journey-copy"><strong>${esc(r.label)}</strong><small>${r.res.map((x, i) => G.teams[i].icon + (x.ok ? ' ✅ ' : x.skipped ? ' ⏭️ ' : ' ❌ ')).join(' · ')}</small></div></div>`).join('')}</div></div>`; }
    return `${head('RÉSULTATS', G.won ? 'Mission <em>accomplie</em> ! 🎉' : 'Partie <em>terminée</em>', G.won ? 'Enquête résolue, objectif atteint et Boss vaincu : bravo à toute l’équipe !' : ({ hearts: 'Vous n’avez plus de vies.', turns: 'Le temps imparti est écoulé.' }[G.reason] || ''), `<button class="primary-button" data-action="world-home">Retour au Monde</button>`)}<div class="card panel-pad"><p>Points totaux : <b>${sumPts(G)}</b> · +${G.xp} XP pour toi.</p><div class="journey-list">${sorted.map((t, i) => `<div class="journey-item"><div class="journey-day">${['🥇', '🥈', '🥉'][i] || i + 1}</div><div class="journey-copy"><strong>${t.icon} ${esc(t.name)}</strong><small>${t.pts} pts · ${t.correct}/${t.total} réussies</small></div></div>`).join('')}</div></div>`;
  }

  // ----- Rivalité (mêmes missions pour tous) -----
  async function makeDeck(level, n, withCase) {
    const types = shuffle(['quiz', 'trap', 'riddle', 'speak', 'read', 'trap', 'quiz', 'riddle']), refs = [], nMixed = withCase ? Math.max(4, n - 6) : n;
    for (let i = 0; i < nMixed; i++) refs.push(await pickRef(types[i % types.length], level));
    if (!withCase) return { deck: refs, caseId: null };
    const c = pickCase(level), deck = interleave(refs, c.clues.map((_, k) => ({ t: 'clue', c: c.id, k })));  // les indices d'abord, l'accusation à la fin
    deck.push({ t: 'accuse', c: c.id }); return { deck, caseId: c.id };
  }
  function interleave(a, b) { const out = [], n = Math.max(a.length, b.length); for (let i = 0; i < n; i++) { if (a[i]) out.push(a[i]); if (b[i]) out.push(b[i]); } return out; }
  async function startRivalry(teams, level, withCase, opts) {
    opts = opts || {}; const dk = await makeDeck(level, withCase ? 12 : (opts.n || 10), withCase);
    W.G = { mode: 'rivalry', level, teams, deck: dk.deck, caseId: dk.caseId, step: 0, rows: [], over: false, items: {}, onFinish: opts.onFinish || null, tournMatch: opts.tournMatch || null }; W.screen = 'rivalry'; render();
  }
  function rivalryHTML() {
    const G = W.G; if (!G) return homeHTML(); const T = G.teams.length, mi = Math.floor(G.step / T), ti = G.step % T, t = G.teams[ti];
    return `${head('RIVALITÉ', `Mission <em>${mi + 1}/${G.deck.length}</em>`, 'Chaque équipe reçoit exactement la même mission. Les points et la précision sont comparés à la fin.', `<button class="ghost-button" data-action="world-quit">Quitter</button>`)}
      <div class="card panel-pad"><h3>${t.icon} ${esc(t.name)} — c’est au tour de <b>${esc(speaker(t))}</b></h3><div class="button-row"><button class="primary-button" data-action="world-rival-go" ${W.busy ? 'disabled' : ''}>▶ Jouer la mission ${mi + 1}</button></div></div>
      <div class="card panel-pad" style="margin-top:12px"><h3>Score en direct</h3><div class="journey-list">${G.teams.map(x => `<div class="journey-item"><div class="journey-day">${x.icon}</div><div class="journey-copy"><strong>${esc(x.name)}</strong><small>${x.correct}/${x.total} réussies</small></div><span class="pill">${x.pts} pts</span></div>`).join('')}</div></div>`;
  }
  async function rivalGo() {
    const G = W.G; if (!G || W.busy) return; W.busy = true;
    try {
      const T = G.teams.length, mi = Math.floor(G.step / T), ti = G.step % T, t = G.teams[ti], ref = G.deck[mi];
      let it = G.items[mi + '-' + ti] || await build(ref); const row = G.rows[mi] || (G.rows[mi] = { n: mi + 1, label: '', res: [] });
      if (ref.t === 'accuse') { it.ctx = 'Carnet d’enquête de ' + t.name + ' :\n' + (t.clues.map((c, i) => (i + 1) + '. ' + c).join('\n') || '(aucun indice obtenu)'); }
      row.label = (KIND_LABEL[it.kind] || it.kind) + ' — ' + (it.q.length > 60 ? it.q.slice(0, 57) + '…' : it.q);
      const res = chk(await runChallenge(it, { who: `${t.icon} ${t.name} · ${speaker(t)}`, swap: null })); t.total++; t.turns++; row.res[ti] = { ok: res.ok, skipped: res.skipped };
      if (res.ok) { t.correct++; t.pts += it.pts * res.mult; if (it.clue) t.clues.push(it.clue.text); } else if (!res.skipped && it.kind === 'trap' && !res.noPenalty) t.pts = Math.max(0, t.pts - 20);
      G.step++; if (G.step >= G.deck.length * T) { G.over = true; if (!G.onFinish) { const sorted = G.teams.slice().sort((a, b) => b.pts - a.pts); A().bump('worlds'); A().bump('teamGames'); A().addXP(40 + Math.round(sumPts(G) / 20), 'Rivalité terminée'); A().touchStudy(12); if (window.EAMascot) EAMascot.react('win'); } W.screen = 'result'; if (G.onFinish) { W.busy = false; return G.onFinish(G); } }
    } finally { W.busy = false; }
    render();
  }

  // ----- Boss d'équipe -----
  async function startBossTeam(team, level) {
    if (W.busy) return; W.busy = true; let r; try { r = await bossFight(level, team, 5); } finally { W.busy = false; }
    const xp = r.win ? 150 + r.ok * 5 : 30 + r.ok * 3; if (r.win) A().bump('bossWins'); A().bump('worlds'); A().bump('teamGames'); A().addXP(xp, r.win ? 'Boss vaincu !' : 'Combat contre le Boss'); A().touchStudy(12); WP().boss.best = Math.max(WP().boss.best, r.ok); if (r.win) WP().boss.wins++; save();
    A().openModal(`<div style="text-align:center"><div style="font-size:60px">${r.win ? '🏆' : '👹'}</div><h2>${r.win ? esc(team.name) + ' a vaincu le Boss !' : 'Le Boss résiste…'}</h2><p>${r.ok}/${r.total} bonnes réponses · vies restantes : ${r.hearts}/5 · +${xp} XP</p><div class="button-row" style="justify-content:center"><button class="primary-button" data-action="world-home">Retour au Monde</button></div></div>`);
    if (window.EAMascot) EAMascot.react(r.win ? 'win' : 'think');
  }

  // ----- Tournoi complet -----
  function startTournament(teams, S) {
    let T; try { T = EATournament.generate(teams.map(t => t.name), S.format); } catch (e) { return A().toast(e.message); }
    WP().tourn = { T, level: S.level, teams, cloudId: null, log: [] }; save(); W.screen = 'tourn'; render(); A().toast(`Tournoi créé : ${T.matches.filter(m => !m.bye).length} matchs, ${T.rounds} manches générées automatiquement.`);
  }
  function tournHTML() {
    const w = WP(), TT = w.tourn; if (!TT) return homeHTML(); const T = TT.T, done = EATournament.isDone(T), champ = EATournament.champion(T), rounds = Array.from({ length: T.rounds }, (_, i) => i + 1), tn = s => (T.teams.find(t => t.seed === s) || {}).name || '—';
    const roundName = r => T.format === 'knockout' ? (r === T.rounds ? 'Finale' : r === T.rounds - 1 ? 'Demi-finales' : r === T.rounds - 2 ? 'Quarts de finale' : 'Tour ' + r) : 'Manche ' + r;
    const next = T.matches.find(m => !m.bye && m.a != null && m.b != null && m.sa == null);
    return `${head('TOURNOI COMPLET', done ? '🏆 <em>' + esc(champ ? champ.name : '') + '</em> est championne !' : 'Le tournoi est <em>lancé</em>', `${T.format === 'knockout' ? 'Élimination directe' : 'Toutes rondes'} · ${T.teams.length} équipes · ${T.matches.filter(m => !m.bye).length} matchs · ${T.rounds} manches. Toutes les manches sont générées automatiquement.`, `<button class="ghost-button" data-action="world-home">← Retour</button>${next ? '<button class="primary-button" data-action="tourn-next">▶ Jouer le prochain match</button>' : ''}${A().isCloud() ? '<button class="secondary-button" data-action="tourn-cloud">☁️ Publier à la classe</button>' : ''}`)}
      ${TT.cloudId ? '<div class="notice blue" style="margin-bottom:12px">☁️ Ce tournoi est publié : le serveur a généré les mêmes manches et enregistre les scores.</div>' : ''}
      <div class="two-column"><div>${rounds.map(r => `<div class="card panel-pad" style="margin-bottom:10px"><h3>${roundName(r)}</h3><div class="journey-list">${T.matches.filter(m => m.round === r).map(m => m.bye ? `<div class="journey-item"><div class="journey-day">⏭️</div><div class="journey-copy"><strong>${esc(tn(m.a != null ? m.a : m.b))}</strong><small>Exempt${T.format === 'knockout' ? ' (qualifié d’office)' : ''}</small></div></div>` : `<div class="journey-item"><div class="journey-day">${m.sa != null ? '✓' : '⚔️'}</div><div class="journey-copy"><strong>${esc(tn(m.a))} <span style="color:var(--muted)">vs</span> ${esc(tn(m.b))}</strong><small>${m.sa != null ? m.sa + ' – ' + m.sb + (m.winner ? ' · victoire : ' + esc(tn(m.winner)) : ' · égalité') : (m.a != null && m.b != null ? 'À jouer' : 'En attente des qualifiés')}</small></div>${m.a != null && m.b != null && m.sa == null ? `<button class="text-button" data-action="tourn-play" data-id="${m.id}">Jouer ↗</button>` : ''}</div>`).join('')}</div></div>`).join('')}</div>
      <div class="right-stack"><div class="card progress-card"><h3>Classement</h3>${EATournament.standings(T).map((s, i) => `<div class="journey-item"><div class="journey-day">${['🥇', '🥈', '🥉'][i] || i + 1}</div><div class="journey-copy"><strong>${esc(s.name)}</strong><small>${s.w}V ${s.d}N ${s.l}D · ${s.gf}-${s.ga}</small></div><span class="pill">${s.pts} pts</span></div>`).join('')}</div>${done ? '<div class="card progress-card"><h3>🏆 Tournoi terminé</h3><p>Bravo à toutes les équipes !</p><button class="ghost-button" data-action="tourn-reset">Nouveau tournoi</button></div>' : ''}</div></div>`;
  }
  async function playMatch(id) {
    const w = WP(), TT = w.tourn, T = TT.T; if (W.busy) return; const m = T.matches.find(x => x.id === id); if (!m || m.a == null || m.b == null || m.sa != null) return;
    const ta = TT.teams[m.a - 1], tb = TT.teams[m.b - 1], a = newTeam(0, ta.name, ta.players), b = newTeam(1, tb.name, tb.players);
    await startRivalry([a, b], TT.level, false, { n: 8, tournMatch: id, onFinish: async G => {
      let sa = G.teams[0].pts, sb = G.teams[1].pts, note = '';
      if (T.format === 'knockout' && sa === sb) { if (G.teams[0].correct !== G.teams[1].correct) { if (G.teams[0].correct > G.teams[1].correct) sa++; else sb++; note = 'Égalité de points : départage par le nombre de réussites.'; } else { if (Math.random() < .5) sa++; else sb++; note = 'Égalité parfaite : tirage au sort.'; } }
      try { const done = EATournament.report(T, id, sa, sb); if (TT.cloudId) await syncCloudReport(TT, m, sa, sb); A().bump('teamGames'); A().addXP(25, 'Match de tournoi'); if (done) { const ch = EATournament.champion(T); A().bump('tournaments'); A().toast('🏆 Champion : ' + ch.name); if (window.EAMascot) EAMascot.react('win'); } } catch (e) { A().toast(e.message || 'Score non enregistré.'); }
      save(); W.G = null; W.screen = 'tourn'; A().openModal(`<div style="text-align:center"><h2>${sa > sb ? esc(ta.name) : esc(tb.name)} gagne !</h2><p>${esc(ta.name)} ${sa} – ${sb} ${esc(tb.name)}</p>${note ? `<p class="tiny">${note}</p>` : ''}<div class="button-row" style="justify-content:center"><button class="primary-button" data-action="close-modal">Continuer</button></div></div>`); render();
    } });
  }
  async function syncCloudReport(TT, m, sa, sb) { const st = await EACloud.tournament.state(TT.cloudId), cm = st.matches.find(x => x.round === m.round && x.slot === m.slot); if (cm && cm.a != null && cm.b != null && cm.sa == null) await EACloud.tournament.report(cm.id, sa, sb); }
  async function publishCloud() {
    const TT = WP().tourn; if (!TT || TT.cloudId) return; try { const id = await EACloud.tournament.create('Tournoi ' + new Date().toLocaleDateString('fr-FR'), TT.T.format, TT.T.teams.map(t => t.name)); TT.cloudId = id; for (const m of TT.T.matches.filter(x => !x.bye && x.sa != null)) await syncCloudReport(TT, m, m.sa, m.sb); save(); A().toast('Tournoi publié : le serveur a généré toutes les manches.'); render(); } catch (e) { A().toast(e.message || 'Publication impossible.'); }
  }

  // ---------- actions ----------
  function action(a, btn) {
    if (a.startsWith('world-ch-')) return chAction(a, btn);
    switch (a) {
      case 'world-home': W.screen = 'home'; W.busy = false; return render();
      case 'world-mode': { const m = btn.dataset.mode; if (m === 'solo') { W.screen = 'solo'; return render(); } return startSetup(m); }
      case 'world-team-add': { syncSetup(); const S = W.setup; if (S.teams.length < MODE_INFO[S.mode][3]) S.teams.push({ name: 'Équipe ' + TEAM_NAME[S.teams.length % 4], players: '' }); return render(); }
      case 'world-team-del': { syncSetup(); const S = W.setup; if (S.teams.length > MODE_INFO[S.mode][2]) S.teams.pop(); return render(); }
      case 'world-setup-go': return guard(setupGo);
      case 'world-roll': return guard(rollDice); case 'world-notebook': return notebookModal(); case 'world-accuse': return guard(accuse);
      case 'world-rival-go': return guard(rivalGo);
      case 'world-place': return guard(() => playPlace(Number(btn.dataset.i))); case 'world-solo-back': A().closeModal(); W.screen = 'solo'; return render();
      case 'world-train': return guard(trainFree); case 'world-cases': A().closeModal(); W.screen = 'cases'; return render(); case 'world-case': return guard(() => playCase(btn.dataset.id));
      case 'world-case-go': { const r = W.caseGo; W.caseGo = null; if (r) { A().closeModal(); r(true); } return; }
      case 'world-start-boss-solo': A().closeModal(); return guard(playBossSolo);
      case 'world-quit': if (confirm('Quitter la partie en cours ?')) { W.G = null; WP().session = null; save(); W.screen = 'home'; render(); } return;
      case 'world-resume': { const s = WP().session; if (s) { W.G = s.G; W.G.rolled = false; W.screen = s.screen; W.busy = false; render(); } return; }
      case 'world-discard': WP().session = null; save(); return render();
      case 'tourn-next': { const TT = WP().tourn, m = TT && TT.T.matches.find(x => !x.bye && x.a != null && x.b != null && x.sa == null); if (m) guard(() => playMatch(m.id)); return; }
      case 'tourn-play': return guard(() => playMatch(btn.dataset.id));
      case 'tourn-reset': WP().tourn = null; save(); W.screen = 'home'; return render();
      case 'tourn-cloud': return publishCloud();
    }
  }
  window.EAWorld = { view, after, action, abort, PLACES, SQUARES, _internals: { evalSpeech, makeDeck, build, pickRef } };
})();
