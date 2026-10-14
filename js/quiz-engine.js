/* English Arena — EAQuiz : moteur de quiz adaptatif sur la banque de 12 000+ questions.
 * - jamais deux fois la même question tant que le niveau n'est pas épuisé (mémoire « déjà vues » compacte, conservée dans la progression)
 * - niveau adaptatif (A1→C1) + test de niveau
 * - modes : Normal, Chrono intense, Survie, Marathon, Révision des erreurs (répétition espacée), Test de niveau
 * - types de réponse : choix (QCM), saisie au clavier, écoute (la phrase est lue à voix haute)
 * - pouvoirs des badges utilisables pendant le quiz. */
(function () {
  'use strict';
  const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];
  const MODES = [
    { id: 'normal', icon: '🎯', label: 'Normal', desc: 'Sans pression, explication à chaque réponse.', count: 10 },
    { id: 'chrono', icon: '⚡', label: 'Chrono intense', desc: '15 s par question, bonus de vitesse et de combo.', count: 15, timer: 15 },
    { id: 'survival', icon: '❤️', label: 'Survie', desc: '3 vies. Une erreur = une vie perdue. Jusqu’où iras-tu ?', count: 60, lives: 3 },
    { id: 'marathon', icon: '🏃', label: 'Marathon', desc: '40 questions d’affilée pour ancrer les bases.', count: 40 },
    { id: 'review', icon: '🔁', label: 'Révision des erreurs', desc: 'Retravaille tes erreurs au bon moment (répétition espacée).', count: 15 },
    { id: 'placement', icon: '🧭', label: 'Test de niveau', desc: '15 questions de A1 à C1 pour régler ton niveau automatiquement.', count: 15 }
  ];
  const TYPES = [['mcq', '🔘 Choix'], ['typed', '⌨️ Je tape'], ['listen', '🎧 J’écoute']];
  const CATS = ['all', 'Grammar', 'Tenses', 'Vocabulary', 'Prepositions', 'Phrasal verbs', 'Idioms', 'Numbers & Time', 'Word forms', 'Spelling'];
  const CAT_LABEL = { all: 'Tout' };
  const DAY = 86400000, STAGES = [10 * 60000, DAY, 3 * DAY, 7 * DAY];
  const bank = {};
  let S = null, tick = null;
  const A = () => window.EAApp, esc = v => A().esc(v), $ = s => document.querySelector(s);
  const rnd = n => Math.floor(Math.random() * n);

  // ---------- état persistant (compatible avec les anciens comptes : tout est optionnel) ----------
  function Q() {
    const p = A().getProgress(); if (!p) return null;
    if (!p.quiz || typeof p.quiz !== 'object') p.quiz = {};
    const q = p.quiz; q.lvl = LEVELS.includes(q.lvl) ? q.lvl : 'A2'; q.seen = q.seen || {}; q.wrong = Array.isArray(q.wrong) ? q.wrong : []; q.stats = q.stats || {}; q.cfg = Object.assign({ mode: 'normal', level: 'auto', count: 10, cat: 'all', type: 'mcq' }, q.cfg || {}); q.best = q.best || {};
    return q;
  }
  const b64enc = u8 => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };
  const b64dec = (s, n) => { const u = new Uint8Array(Math.ceil(n / 8)); try { const r = atob(s || ''); for (let i = 0; i < Math.min(r.length, u.length); i++) u[i] = r.charCodeAt(i); } catch (_) {} return u; };
  function seenSet(lvl, n) { const q = Q(); return b64dec(q.seen[lvl], n); }
  const bit = (u, i) => (u[i >> 3] >> (i & 7)) & 1;
  function markSeen(lvl, id) { const q = Q(), n = bank[lvl] ? bank[lvl].length : id + 1, u = seenSet(lvl, n); u[id >> 3] |= 1 << (id & 7); q.seen[lvl] = b64enc(u); }
  const seenCount = (lvl) => { const q = Q(), n = bank[lvl] ? bank[lvl].length : 0; if (!n || !q.seen[lvl]) return q.seen[lvl] ? '·' : 0; const u = b64dec(q.seen[lvl], n); let c = 0; for (let i = 0; i < n; i++) c += bit(u, i); return c; };

  // ---------- chargement des fichiers de niveau ----------
  async function load(lvl) {
    if (bank[lvl]) return bank[lvl];
    try {
      const r = await fetch('data/quiz/' + lvl + '.json', { cache: 'force-cache' }); if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json(); bank[lvl] = d.q; return bank[lvl];
    } catch (e) {
      // Secours hors-ligne : petite banque intégrée
      const small = (A().DATA.quizzes || []).map(q => [q.question, q.options, q.answer, q.explanation, q.category || 'Grammar', 'other', '']);
      bank[lvl] = small; bank[lvl].offline = true; return bank[lvl];
    }
  }
  const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘`]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();

  // ---------- sélection ----------
  function eligible(row, cfg) {
    if (cfg.cat !== 'all' && row[4] !== cfg.cat) return false;
    if (cfg.type === 'typed' && !(row[5] === 'cloze' || row[5] === 'vocab_enfr' || row[5] === 'vocab_fren')) return false;
    if (cfg.type === 'listen' && !(row[5] === 'cloze' || row[5] === 'meaning' || row[6])) return false;
    return true;
  }
  function pickFrom(lvl, cfg, used) {
    const rows = bank[lvl] || [], n = rows.length, q = Q(); let u = seenSet(lvl, n);
    const collect = () => { const out = []; for (let i = 0; i < n; i++) if (!bit(u, i) && !used.has(lvl + ':' + i) && eligible(rows[i], cfg)) out.push(i); return out; };
    let c = collect();
    if (!c.length) { q.seen[lvl] = ''; u = b64dec('', n); c = collect(); if (c.length) A().toast('Tu as parcouru toutes les questions disponibles de ce type au niveau ' + lvl + ' : on recommence un nouveau tour !'); }
    if (!c.length) return null;
    const id = c[rnd(c.length)];
    return { lvl, id };
  }
  function build(ref) {
    const r = bank[ref.lvl][ref.id];
    return { lvl: ref.lvl, id: ref.id, question: r[0], options: r[1].slice(), answer: r[2], explanation: r[3], category: r[4], kind: r[5], say: r[6] || '', key: ref.lvl + ':' + ref.id };
  }
  function levelPlan(cfg, count) {
    const q = Q(); const plan = [];
    if (cfg.mode === 'placement') { for (let i = 0; i < count; i++) plan.push(LEVELS[Math.min(4, Math.floor(i / 3))]); return plan; }
    const base = cfg.level === 'auto' ? q.lvl : cfg.level, bi = LEVELS.indexOf(base);
    for (let i = 0; i < count; i++) {
      if (cfg.level !== 'auto') { plan.push(base); continue; }
      const r = Math.random(); plan.push(LEVELS[r < .6 ? bi : r < .8 ? Math.max(0, bi - 1) : Math.min(4, bi + 1)]);
    }
    return plan;
  }
  async function buildSession(cfg) {
    const q = Q(), m = MODES.find(x => x.id === cfg.mode) || MODES[0], used = new Set(), list = [];
    const count = cfg.mode === 'normal' ? cfg.count : m.count;
    if (cfg.mode === 'review') {
      const now = Date.now(), due = q.wrong.filter(w => w.due <= now).sort((a, b) => a.due - b.due).slice(0, count);
      for (const w of due) { await load(w.l); if (bank[w.l][w.i]) list.push(build({ lvl: w.l, id: w.i })); }
      return { m, list };
    }
    const plan = levelPlan(cfg, count); await Promise.all([...new Set(plan)].map(load));
    // une partie des erreurs échues revient naturellement (max 20 %)
    if (cfg.mode === 'normal' || cfg.mode === 'marathon') {
      const now = Date.now(), due = q.wrong.filter(w => w.due <= now).slice(0, Math.floor(count * .2));
      for (const w of due) { await load(w.l); if (bank[w.l][w.i] && eligible(bank[w.l][w.i], cfg)) { list.push(build({ lvl: w.l, id: w.i })); used.add(w.l + ':' + w.i); } }
    }
    for (const lvl of plan) { if (list.length >= count) break; const ref = pickFrom(lvl, cfg, used); if (ref) { used.add(ref.lvl + ':' + ref.id); list.push(build(ref)); } }
    for (let i = list.length - 1; i > 0 && cfg.mode !== 'placement'; i--) { const j = rnd(i + 1); [list[i], list[j]] = [list[j], list[i]]; }
    return { m, list, used };
  }
  async function swapOne(lvl) { const ref = pickFrom(lvl, S.cfg, S.used || new Set()); if (!ref) return null; S.used.add(ref.lvl + ':' + ref.id); return build(ref); }

  // ---------- démarrage ----------
  async function start(over) {
    const q = Q(); if (!q) return; const cfg = Object.assign({}, q.cfg, over || {}); if (['normal', 'chrono', 'survival', 'marathon'].includes(cfg.mode)) q.cfg = Object.assign(q.cfg, { mode: cfg.mode, level: cfg.level, count: cfg.count, cat: cfg.cat, type: cfg.type });
    A().toast('Préparation des questions…');
    const { m, list, used } = await buildSession(cfg);
    if (!list.length) { A().toast(cfg.mode === 'review' ? 'Aucune erreur à revoir pour le moment : bravo ! 🎉' : 'Aucune question disponible avec ces réglages.'); return; }
    S = { cfg, m, list, used: used || new Set(), i: 0, answers: [], correct: 0, combo: 0, bestCombo: 0, lives: m.lives || 0, shield: false, xp2: false, xpBonus: 0, startTime: Date.now(), usedPower: false, finished: false, hidden: [], second: false, byLevel: {} };
    A().view('practice');
  }
  function active() { return !!S; }

  // ---------- affichage ----------
  const bar = () => { const pw = window.EABadges ? EABadges.usable(A().getProgress()) : []; if (!pw.length) return '<div class="tiny" style="margin:8px 0">🏅 Gagne des badges pour débloquer des pouvoirs spéciaux utilisables ici.</div>'; return '<div class="power-bar">' + pw.map(p => `<button class="power-btn" data-action="quiz-power" data-id="${p.id}" title="${esc(p.desc + ' — ' + p.badge)}" ${S.usedPower || S.answers[S.i] !== undefined ? 'disabled' : ''}>${p.icon} ${esc(p.name)}<small>×${p.charges}</small></button>`).join('') + '</div>'; };
  function render() {
    const host = $('#quizLiveHost'); if (!host || !S) return;
    clearInterval(tick);
    if (S.finished) { host.innerHTML = results(); return; }
    const q = S.list[S.i]; if (!q) return finish();
    const chosen = S.answers[S.i], answered = chosen !== undefined, typed = S.cfg.type === 'typed' && !answered, listen = S.cfg.type === 'listen';
    const total = S.m.id === 'survival' ? '∞' : S.list.length, hearts = S.m.lives ? '❤️'.repeat(Math.max(0, S.lives)) + '🖤'.repeat(Math.max(0, S.m.lives - S.lives)) : '';
    const hide = S.hidden[S.i] || [];
    const qtext = listen && !answered ? '🎧 Écoute la phrase… puis choisis la bonne réponse.' : q.question;
    const optsHTML = S.cfg.type === 'typed' && !answered ? `<div class="notice blue" style="margin:10px 0">Écris la réponse exacte dans la case (pas de choix proposé).</div><div class="button-row"><input class="form-field" id="quizTyped" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Ta réponse…" style="max-width:340px"><button class="primary-button" data-action="quiz-typed">Valider</button></div>`
      : `<div class="answer-list">${q.options.map((o, i) => `<button class="answer-option ${answered && i === q.answer ? 'correct' : ''} ${answered && i === chosen && chosen !== q.answer ? 'incorrect' : ''}" data-action="quiz-answer" data-answer="${i}" ${answered || hide.includes(i) ? 'disabled' : ''} style="${hide.includes(i) ? 'opacity:.2' : ''}"><span class="option-letter">${String.fromCharCode(65 + i)}</span><span>${esc(o)}</span>${answered && i === q.answer ? '<b style="margin-left:auto;color:var(--mint)">✓</b>' : ''}</button>`).join('')}</div>`;
    const ok = answered && chosen === q.answer, fb = answered ? (ok ? 'Correct ! 🎉' + (S.combo >= 3 ? ` Combo ×${S.combo} 🔥` : '') : (chosen === -1 ? 'Temps écoulé ⏱' : 'Pas tout à fait — retiens-le :')) : 'Feedback';
    host.innerHTML = `<div class="quiz-layout"><section class="card quiz-main"><div class="quiz-meta"><span><span class="pill purple">${esc(q.category)}</span> <span class="pill">${q.lvl}</span></span><span class="tiny">${hearts} Question ${S.i + 1} / ${total}${S.combo >= 2 ? ' · 🔥 ×' + S.combo : ''}</span></div><div class="quiz-progress"><span id="quizBar" style="width:${S.m.timer ? 100 : S.i / Math.max(1, S.list.length) * 100}%"></span></div>
      <h2 class="quiz-question">${esc(qtext)} ${(listen || q.say) ? '<button class="text-button" data-action="quiz-listen" aria-label="Écouter">🔊</button>' : ''}</h2>${S.hint && S.hint.i === S.i ? `<div class="notice blue">💡 ${esc(S.hint.text)}</div>` : ''}${optsHTML}
      <div class="quiz-feedback ${answered ? 'show' : ''}"><strong>${fb}</strong><p>${answered ? esc(q.explanation) + (ok ? '' : ' Bonne réponse : « ' + esc(q.options[q.answer]) + ' ».') : ''}</p></div>
      ${answered ? '' : bar()}
      <div class="quiz-bottom"><button class="ghost-button" data-action="quiz-exit">Quitter</button>${answered ? `<button class="primary-button" data-action="quiz-next">${(S.i + 1 === S.list.length || (S.m.lives && S.lives <= 0)) ? 'Voir mon score' : 'Question suivante →'}</button>` : '<span class="tiny">' + (S.second ? '🔁 Seconde chance active' : S.shield ? '🛡️ Bouclier actif' : 'Choisis une réponse.') + '</span>'}</div></section>
      <aside class="quiz-side"><div class="card"><h3>${S.m.icon} ${S.m.label}</h3><p>${esc(S.m.desc)}</p></div><div class="card"><h3>Ton score</h3><div class="result-score" style="font-size:35px">${S.correct}</div><p>bonne${S.correct === 1 ? '' : 's'} réponse${S.correct === 1 ? '' : 's'} · meilleur combo ${S.bestCombo}</p></div><div class="card"><h3>Pas de répétition</h3><p>Tu ne revois pas la même question avant d’avoir parcouru toute la banque du niveau.</p></div></aside></div>`;
    if (!answered) { if (listen) say(q); if (S.m.timer) startTimer(q); const t = $('#quizTyped'); if (t) t.focus(); }
  }
  function say(q) { if (window.EASpeech) EASpeech.say(q.say || q.question); }
  function startTimer(q) {
    S.timeLeft = (S.m.timer || 0) * 1000 + (S.extra || 0); S.extra = 0; S.total = S.timeLeft; S.last = Date.now(); S.frozen = false;
    tick = setInterval(() => { const now = Date.now(); if (!S.frozen) S.timeLeft -= now - S.last; S.last = now; const b = $('#quizBar'); if (b) b.style.width = Math.max(0, S.timeLeft / S.total * 100) + '%'; if (S.timeLeft <= 0) { clearInterval(tick); answer(-1); } }, 200);
  }

  // ---------- réponses ----------
  function record(q, ok) {
    const st = Q().stats, c = (st[q.category] = st[q.category] || { c: 0, t: 0 }); c.t++; if (ok) c.c++;
    S.byLevel[q.lvl] = S.byLevel[q.lvl] || { c: 0, t: 0 }; S.byLevel[q.lvl].t++; if (ok) S.byLevel[q.lvl].c++;
    const w = Q().wrong, idx = w.findIndex(x => x.l === q.lvl && x.i === q.id);
    if (ok) { if (idx >= 0) { const e = w[idx]; e.s = (e.s || 0) + 1; if (e.s >= STAGES.length) w.splice(idx, 1); else e.due = Date.now() + STAGES[e.s]; } }
    else if (idx >= 0) { w[idx].s = 0; w[idx].due = Date.now() + STAGES[0]; } else { w.push({ l: q.lvl, i: q.id, s: 0, due: Date.now() + STAGES[0] }); if (w.length > 300) w.shift(); }
  }
  function answer(idx) {
    if (!S || S.finished || S.answers[S.i] !== undefined) return;
    const q = S.list[S.i]; let ok = idx === q.answer;
    if (!ok && idx >= 0 && S.second) { S.second = false; S.hidden[S.i] = (S.hidden[S.i] || []).concat(idx); A().toast('🔁 Seconde chance : essaie encore !'); return render(); }
    clearInterval(tick);
    markSeen(q.lvl, q.id);
    let shielded = false;
    if (!ok && S.shield) { S.shield = false; shielded = true; }
    S.answers[S.i] = idx;
    if (ok) {
      S.correct++; S.combo++; S.bestCombo = Math.max(S.bestCombo, S.combo);
      let b = 3 + (S.combo >= 3 ? Math.min(5, S.combo - 2) : 0); if (S.m.timer && S.timeLeft > 0) b += Math.round(S.timeLeft / S.total * 3); if (S.xp2) b *= 2; S.xpBonus += b - 3; if (S.xp2) S.xp2 = false;
      if (window.EAMascot && S.combo >= 3) EAMascot.react('say', { text: 'Combo ×' + S.combo + ' ! 🔥', ms: 1800, force: true });
    } else {
      if (!shielded) { S.combo = 0; if (S.m.lives) S.lives--; record(q, false); } else A().toast('🛡️ Le bouclier a absorbé l’erreur !');
    }
    if (ok) record(q, true);
    S.usedPower = false; S.wasShield = shielded;
    render(); A().saveNow();
  }
  function typedSubmit() { const i = $('#quizTyped'); if (!i || !i.value.trim()) return A().toast('Écris ta réponse.'); const q = S.list[S.i], good = norm(q.options[q.answer]); answer(norm(i.value) === good ? q.answer : (q.answer + 1) % q.options.length); }
  async function next() {
    if (!S) return;
    if (S.i + 1 >= S.list.length || (S.m.lives && S.lives <= 0)) return finish();
    S.i++; S.usedPower = false; render();
  }
  async function power(id) {
    if (!S || S.usedPower || S.answers[S.i] !== undefined) return; const p = A().getProgress(), info = EABadges.usable(p).find(x => x.id === id); if (!info) return;
    const q = S.list[S.i], kind = info.kind;
    if ((kind === 'time' || kind === 'freeze') && !S.m.timer) return A().toast('Ce pouvoir sert dans les modes chronométrés (Chrono intense).');
    if (kind === 'revive' && !(S.m.lives && S.lives < S.m.lives)) return A().toast('Tu as déjà toutes tes vies (mode Survie).');
    if (kind === 'fifty' && S.cfg.type === 'typed') return A().toast('Pas de choix à réduire en mode « Je tape ».');
    EABadges.use(p, id); S.usedPower = true;
    if (kind === 'fifty') { const wrong = q.options.map((_, i) => i).filter(i => i !== q.answer && !(S.hidden[S.i] || []).includes(i)); S.hidden[S.i] = (S.hidden[S.i] || []).concat(wrong.sort(() => Math.random() - .5).slice(0, 2)); }
    else if (kind === 'skip') { S.list.splice(S.i, 1); S.answers.splice(S.i, 1); S.hidden.splice(S.i, 1); S.usedPower = false; A().saveNow(); if (S.i >= S.list.length) return finish(); return render(); }
    else if (kind === 'time') S.extra = 10000;
    else if (kind === 'freeze') S.frozen = true;
    else if (kind === 'shield') S.shield = true;
    else if (kind === 'second') S.second = true;
    else if (kind === 'xp2') S.xp2 = true;
    else if (kind === 'revive') S.lives++;
    else if (kind === 'hint') { const a = q.options[q.answer]; S.hint = { i: S.i, text: 'La réponse commence par « ' + a.charAt(0) + ' » et fait ' + a.length + ' caractères.' }; }
    else if (kind === 'swap') { const n = await swapOne(q.lvl); if (!n) { A().toast('Pas d’autre question disponible.'); S.usedPower = false; return; } S.list[S.i] = n; S.hidden[S.i] = []; S.usedPower = false; A().toast('🔀 Nouvelle question !'); A().saveNow(); return render(); }
    A().toast(info.icon + ' ' + info.name + ' activé !'); A().saveNow();
    if (kind === 'time' || kind === 'freeze') { if (kind === 'time') { S.timeLeft += 10000; S.total += 10000; } return; }
    render();
  }

  // ---------- fin de session ----------
  function finish() {
    if (!S || S.finished) return; clearInterval(tick); S.finished = true;
    const total = S.answers.filter(a => a !== undefined && a !== -2).length || 1, correct = S.correct, score = Math.round(correct / total * 100), q = Q(), p = A().getProgress();
    const minutes = Math.max(1, Math.round((Date.now() - S.startTime) / 60000));
    // niveau adaptatif
    let msg = '';
    if (S.cfg.mode === 'placement') {
      let lvl = 'A1'; LEVELS.forEach(l => { const b = S.byLevel[l]; if (b && b.c / b.t >= .6) lvl = l; }); q.lvl = lvl; q.cfg.level = 'auto'; msg = 'Ton niveau estimé : <b>' + lvl + '</b>. Les quiz « Auto » s’y adaptent désormais.';
    } else if (S.cfg.level === 'auto' && total >= 8) {
      const bi = LEVELS.indexOf(q.lvl); if (score >= 85 && bi < 4) { q.lvl = LEVELS[bi + 1]; msg = '🚀 Niveau supérieur ! Tu passes en <b>' + q.lvl + '</b>.'; } else if (score < 45 && bi > 0) { q.lvl = LEVELS[bi - 1]; msg = 'On consolide : retour en <b>' + q.lvl + '</b> pour mieux réussir.'; } else msg = 'Niveau actuel : <b>' + q.lvl + '</b>.';
    }
    S.msg = msg;
    const xp = 10 + correct * 3 + S.xpBonus + (S.m.id === 'survival' ? Math.floor(correct / 5) * 2 : 0) + (S.m.id === 'chrono' ? 5 : 0); S.xp = xp;
    const key = S.m.id; q.best[key] = Math.max(q.best[key] || 0, key === 'survival' ? correct : score);
    p.quizHistory = (p.quizHistory || []).concat({ date: new Date().toISOString(), score, correct, total, label: S.m.label + (S.cfg.cat !== 'all' ? ' · ' + S.cfg.cat : '') }).slice(-30);
    p.totalAnswers = (p.totalAnswers || 0) + total; p.correctAnswers = (p.correctAnswers || 0) + correct;
    A().touchStudy(minutes); A().addXP(xp, 'Quiz terminé'); A().bump('quizzes');
    if (window.EAMascot) EAMascot.react('quiz', { score });
    A().saveNow(); render();
  }
  function results() {
    const total = S.answers.filter(a => a !== undefined && a !== -2).length || 1, score = Math.round(S.correct / total * 100), rev = S.list.map((q, i) => ({ q, a: S.answers[i] })).filter(x => x.a !== undefined && x.a !== -2);
    return `<div class="card quiz-main" style="text-align:center"><span class="pill green">SESSION TERMINÉE · ${S.m.icon} ${esc(S.m.label)}</span><h2 style="font-size:26px;margin:20px 0 8px">${score >= 80 ? 'Excellent travail !' : score >= 50 ? 'Bien joué, tu progresses !' : 'Courage, on y retourne !'}</h2><div class="result-score">${score}%</div><p>${S.correct}/${total} bonnes réponses · meilleur combo ${S.bestCombo} · +${S.xp} XP</p>${S.msg ? `<div class="notice blue" style="max-width:480px;margin:10px auto">${S.msg}</div>` : ''}<div class="progress-line" style="max-width:420px;margin:20px auto"><span style="width:${score}%"></span></div><div class="button-row" style="justify-content:center"><button class="primary-button" data-action="start-quiz">Rejouer ↻ (nouvelles questions)</button><button class="secondary-button" data-action="quiz-review-start">🔁 Revoir mes erreurs</button><button class="ghost-button" data-action="quiz-exit">Retour</button></div><div class="section-title" style="text-align:left"><h3>À revoir</h3><span>Réponses expliquées</span></div><div class="journey-list" style="text-align:left">${rev.map(({ q, a }) => `<div class="journey-item"><div class="journey-day" style="background:${a === q.answer ? '#8cf0ce14' : '#ff8e9d10'};color:${a === q.answer ? 'var(--mint)' : 'var(--bad)'}">${a === q.answer ? '✓' : '↻'}</div><div class="journey-copy"><strong>${esc(q.question)}</strong><small>${a >= 0 && a !== q.answer ? 'Ta réponse : ' + esc(q.options[a]) + ' · ' : ''}Réponse : ${esc(q.options[q.answer])}<br>${esc(q.explanation)}</small></div></div>`).join('')}</div></div>`;
  }

  // ---------- page d'accueil du quiz ----------
  function homeHTML() {
    const q = Q(), c = q.cfg, due = q.wrong.filter(w => w.due <= Date.now()).length;
    const chip = (k, v, label, on) => `<button class="filter-chip ${on ? 'active' : ''}" data-action="quiz-cfg" data-k="${k}" data-v="${v}">${label}</button>`;
    const total = q.best && q.best.survival ? q.best.survival : 0;
    const weak = Object.entries(q.stats).filter(([, v]) => v.t >= 5).map(([k, v]) => [k, Math.round(v.c / v.t * 100)]).sort((a, b) => a[1] - b[1]).slice(0, 3);
    return `<div class="section-head"><div><h3>🎯 Compose ton quiz</h3><p>Niveau actuel (auto) : <b>${q.lvl}</b> · banque de 12 000+ questions, sans répétition.</p></div><span class="pill purple">NIVEAU ${c.level === 'auto' ? 'AUTO ' + q.lvl : c.level}</span></div>
      <div class="card panel-pad"><div class="field-label">Mode</div><div class="arcade-grid" style="margin-bottom:12px">${MODES.map(m => `<button class="card game-card" style="text-align:left;${c.mode === m.id ? 'border-color:var(--mint);box-shadow:0 0 0 1px var(--mint) inset' : ''}" data-action="quiz-cfg" data-k="mode" data-v="${m.id}"><span class="game-ico">${m.icon}</span><strong>${m.label}${m.id === 'review' && due ? ' (' + due + ')' : ''}</strong><small>${m.desc}</small></button>`).join('')}</div>
      <div class="field-label">Niveau</div><div class="button-row">${chip('level', 'auto', 'Auto 🤖', c.level === 'auto')}${LEVELS.map(l => chip('level', l, l, c.level === l)).join('')}</div>
      <div class="field-label" style="margin-top:10px">Type de réponse</div><div class="button-row">${TYPES.map(([v, l]) => chip('type', v, l, c.type === v)).join('')}</div>
      <div class="field-label" style="margin-top:10px">Thème</div><div class="button-row">${CATS.map(k => chip('cat', k, CAT_LABEL[k] || k, c.cat === k)).join('')}</div>
      ${c.mode === 'normal' ? `<div class="field-label" style="margin-top:10px">Nombre de questions</div><div class="button-row">${[10, 20, 30].map(n => chip('count', n, n, c.count === n)).join('')}</div>` : ''}
      <div class="button-row" style="margin-top:16px"><button class="primary-button" data-action="start-quiz">▶ Lancer le quiz</button><button class="ghost-button" data-action="exam-tips">Conseils d’examen</button></div>
      ${weak.length ? `<p class="tiny" style="margin-top:10px">📉 Points à travailler : ${weak.map(([k, v]) => esc(k) + ' (' + v + ' %)').join(' · ')}</p>` : ''}${total ? `<p class="tiny">🏆 Record Survie : ${total} bonnes réponses d’affilée.</p>` : ''}</div>
      <div class="section-title" style="margin-top:22px"><h3>Questions déjà vues par niveau</h3><span>Rien ne se répète avant la fin du tour</span></div>
      <div class="card panel-pad" id="quizSeenBox">${LEVELS.map(l => `<div class="progress-label"><span>${l}</span><span>${q.seen[l] ? 'tour en cours' : 'jamais commencé'}</span></div>`).join('')}</div>`;
  }

  function action(a, btn) {
    if (a === 'start-quiz') return start(btn && btn.dataset.category ? { cat: btn.dataset.category } : {});
    if (a === 'quiz-cfg') { const q = Q(), k = btn.dataset.k; let v = btn.dataset.v; if (k === 'count') v = Number(v); q.cfg[k] = v; if (k === 'mode' && v === 'normal' && !q.cfg.count) q.cfg.count = 10; A().saveNow(); return A().view('practice'); }
    if (a === 'quiz-answer') return answer(Number(btn.dataset.answer));
    if (a === 'quiz-typed') return typedSubmit();
    if (a === 'quiz-next') return next();
    if (a === 'quiz-listen') { const q = S && S.list[S.i]; if (q) say(q); return; }
    if (a === 'quiz-power') return power(btn.dataset.id);
    if (a === 'quiz-review-start') return start({ mode: 'review' });
    if (a === 'quiz-exit') { clearInterval(tick); if (window.EASpeech) EASpeech.stop(); S = null; return A().view('practice'); }
  }
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target && e.target.id === 'quizTyped') { e.preventDefault(); typedSubmit(); } });

  window.EAQuiz = { MODES, LEVELS, start, active, render, homeHTML, action, load, norm, pickFrom, markSeen, bank, state: () => S };
})();
