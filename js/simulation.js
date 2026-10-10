/* English Arena — Speaking Lab : 8 modes de simulation qui changent vraiment le déroulement.
 * Tout fonctionne hors ligne (indices simples, pas de note officielle). */
(function () {
  const MODES = [
    { id: 'guided', icon: '🧭', label: 'Guidé', turns: 5, desc: 'Phrases utiles, exemple modèle, aucune pression.' },
    { id: 'exam', icon: '🎓', label: 'Examen', turns: 4, timer: 90, desc: 'Sans aide, 90 s par réponse, note indicative sur 20 à la fin.' },
    { id: 'calm', icon: '🌿', label: 'Calme', turns: 4, desc: 'Respiration guidée, voix lente, retours très bienveillants.' },
    { id: 'rapid', icon: '⚡', label: 'Chrono', turns: 5, timer: 25, desc: '25 s par réponse, phrases courtes : parler vite sans stress.' },
    { id: 'debate', icon: '🗣️', label: 'Débat', turns: 4, desc: 'Le partenaire te contredit : utilise opinion, raison, exemple, contraste.' },
    { id: 'shadow', icon: '🦜', label: 'Shadowing', turns: 5, desc: 'Écoute puis répète exactement la phrase : score de précision en %.' },
    { id: 'story', icon: '📖', label: 'Histoire', turns: 5, desc: 'Construis une histoire phrase par phrase au passé.' },
    { id: 'surprise', icon: '🎲', label: 'Surprise', turns: 5, timer: 30, desc: 'Le partenaire t’interrompt avec des questions inattendues (XP doublés).' }
  ];
  const SURPRISES = ['Wait, can you give me an example?', 'Why do you think that?', 'Sorry, could you say that in a different way?', 'Interesting! And how do you feel about it?', 'Can you explain that to a ten-year-old?', 'What would you do if you were me?'];
  const PUSHBACK = ['I’m not sure I agree. ', 'Really? I see it differently. ', 'That’s one view, but ', 'Hmm, are you sure? '];
  const STARTERS = ['One day, a young student found a mysterious bag in the school yard. What happened next?', 'Last summer, I travelled to a city I had never seen. Continue the story.', 'It was a rainy morning when the power suddenly went out. Continue.'];
  const STORY_NEXT = ['And then what happened?', 'What did the character see?', 'How did everybody feel?', 'How did the story end?'];
  const CONNECT = [['in my opinion', 'Opinion (In my opinion…)'], ['because', 'Raison (because)'], ['for example', 'Exemple (for example)'], ['however|on the other hand|but', 'Contraste (however / on the other hand)']];
  let st = null, timerId = null;
  const A = () => window.EAApp, esc = v => A().esc(v), $ = s => document.querySelector(s);
  const modeOf = id => MODES.find(m => m.id === id) || MODES[0];
  const mode = () => { try { return modeOf(A().getProgress().simMode).id; } catch (_) { return 'guided'; } };
  function setMode(id) { const p = A().getProgress(); if (p) { p.simMode = modeOf(id).id; A().saveNow(); } }
  const words = t => t.trim().split(/\s+/).filter(Boolean);
  const norm = t => t.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
  const sentences = t => (t.match(/[^.!?]+[.!?]?/g) || []).map(x => x.trim()).filter(x => x.split(/\s+/).length >= 4);

  function speak(text, rate) {
    if (!('speechSynthesis' in window)) return;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = rate || .92; u.onstart = () => window.EAMascot && EAMascot.react('talk', { ms: 2500 }); speechSynthesis.speak(u); } catch (_) {}
  }
  function promptFor() {
    const s = st.s, m = st.mode;
    if (st.surprise) return st.surprise;
    if (m === 'shadow') return st.targets[st.turn];
    if (m === 'story') return st.turn === 0 ? st.starter : STORY_NEXT[(st.turn - 1) % STORY_NEXT.length];
    const base = st.turn === 0 ? s.opening : s.followups[(st.turn - 1) % s.followups.length];
    return m === 'debate' && st.turn > 0 ? PUSHBACK[(st.turn - 1) % PUSHBACK.length] + base : base;
  }

  function open(id) {
    const s = A().DATA.simulations.find(x => x.id === id) || A().DATA.simulations[0], mid = mode(), m = modeOf(mid);
    const targets = [s.opening, ...s.followups, ...sentences(s.sample)].filter((v, i, a) => a.indexOf(v) === i).slice(0, m.turns);
    st = { s, mode: mid, m, turn: 0, history: [], scores: [], inTime: 0, used: new Set(), story: [], targets, surprise: '', sPoints: 0, starter: STARTERS[Math.floor(Math.random() * STARTERS.length)] };
    render('');
  }
  function startTimer() {
    clearInterval(timerId); const m = st.m; if (!m.timer || st.done) return;
    st.deadline = Date.now() + m.timer * 1000;
    timerId = setInterval(() => {
      const left = Math.max(0, Math.ceil((st.deadline - Date.now()) / 1000)), el = $('#simTimer'), bar = $('#simTimerBar');
      if (el) el.textContent = left + ' s'; if (bar) bar.style.width = (left / m.timer * 100) + '%';
      if (left <= 0) { clearInterval(timerId); send(true); }
    }, 250);
  }
  function stop() { clearInterval(timerId); timerId = null; try { speechSynthesis.cancel(); } catch (_) {} }

  function checklistHTML() {
    if (st.mode !== 'debate') return '';
    return `<div class="hint-list" style="margin:8px 0">${CONNECT.map(([re, label]) => `<span class="hint-chip" style="${st.used.has(re) ? 'background:#8cf0ce33;border-color:var(--mint)' : ''}">${st.used.has(re) ? '✓ ' : ''}${label}</span>`).join('')}</div>`;
  }
  function render(feedback, mood) {
    stop();
    const s = st.s, m = st.m, prompt = promptFor(), A_ = A();
    const showHints = ['guided', 'calm', 'debate', 'story'].includes(st.mode), showSample = st.mode === 'guided' || st.mode === 'calm';
    const coach = { guided: 'Prends ton temps, je suis là.', exam: 'Réponds comme à l’oral du bac !', calm: 'Respire… puis parle doucement.', rapid: 'Vite ! Phrases courtes !', debate: 'Défends ton idée avec une raison.', shadow: 'Écoute bien, puis répète exactement.', story: 'Utilise le passé : was, went, saw…', surprise: 'Reste calme, tout peut arriver !' }[st.mode];
    const transcript = st.history.map(h => `<div class="journey-item"><div class="journey-day" style="font-size:9px">${h.who === 'YOU' ? 'YOU' : 'PARTNER'}</div><div class="journey-copy"><strong>${h.who === 'YOU' ? 'Ta réponse' : 'Partenaire'}</strong><small>${esc(h.text)}</small></div></div>`).join('');
    const km = window.EAMascot ? EAMascot.html(mood || 'idle', 54) : '';
    A_.openModal(`<div class="roleplay"><div class="roleplay-header"><span class="pill green">${esc(s.level)} · ${m.icon} ${m.label}</span><span class="pill">TOUR ${Math.min(st.turn + 1, m.turns)} / ${m.turns}</span></div>
      <div class="eyebrow" style="margin-top:15px">ROLEPLAY SIMULATOR</div><h2 class="roleplay-title">${esc(s.title)}</h2><p class="roleplay-context">${esc(s.setting)} Ton objectif : ${esc(s.goal)}</p>
      <div class="kiki-roleplay">${km}<div class="kiki-say"><strong>${esc(m.label)}</strong> — ${esc(coach)}</div></div>
      ${m.timer ? `<div class="notice blue" style="margin:10px 0"><strong>⏱ Temps : <span id="simTimer">${m.timer} s</span></strong><div class="progress-line"><span id="simTimerBar" style="width:100%"></span></div></div>` : ''}
      ${st.mode === 'calm' ? `<div class="button-row" style="margin:8px 0"><button class="ghost-button" data-action="sim-breathe">🌬️ Respirer 10 secondes</button><span id="simBreath" class="pill"></span></div>` : ''}
      ${transcript ? `<div class="journey-list" style="margin:15px 0">${transcript}</div>` : ''}
      <div class="dialogue-box"><div class="dialogue-person">${esc(st.mode === 'story' ? 'Narrateur' : st.mode === 'shadow' ? '🦜 Répète cette phrase' : s.role)} · PARTNER${st.surprise ? ' · 🎲 SURPRISE' : ''}</div><div class="dialogue-line">${esc(prompt)}</div>
        <div class="button-row" style="margin-top:9px"><button class="ghost-button" data-action="sim-listen">🔊 Écouter</button><button class="text-button" data-action="save-phrase" data-phrase="${esc(prompt)}">＋ Sauver la phrase</button></div></div>
      ${checklistHTML()}
      ${showHints ? `<div><div class="field-label">Helpful phrases</div><div class="hint-list">${s.hints.map(h => `<button class="hint-chip" data-action="insert-hint" data-hint="${esc(h)}">${esc(h)}</button>`).join('')}</div></div>` : ''}
      <label class="field-label" for="scenarioAnswer">${st.mode === 'shadow' ? 'Répète la phrase (écris-la ou dis-la au micro)' : 'Your answer (réponds en anglais)'}</label>
      <textarea id="scenarioAnswer" class="response-area" placeholder="Write your answer in English here…" rows="3"></textarea>
      <div class="voice-panel"><strong>🎧 Micro anti-bruit</strong><small id="microStatus">Appuie sur « Tester mon micro » : le filtre se règle sur le bruit de ta pièce.</small><div class="progress-line"><span id="microMeter" style="width:0%"></span></div><div class="button-row"><button class="ghost-button" data-action="voice-test">🎧 Tester mon micro</button><button class="ghost-button" data-action="voice-rec">⏺ Enregistrer</button><button class="ghost-button" id="voicePlayBtn" data-action="voice-play" hidden>▶ Réécouter</button></div><audio id="voiceAudio" controls hidden style="width:100%;margin-top:8px"></audio></div>
      <div class="roleplay-controls"><button class="primary-button" data-action="scenario-send">Envoyer ma réponse ↗</button><button class="secondary-button" data-action="scenario-mic">🎙 Parler</button>${showSample ? '<button class="ghost-button" data-action="scenario-sample">Voir un exemple</button>' : ''}</div>
      <div class="feedback-box ${feedback ? 'show' : ''}" id="scenarioFeedback">${feedback}</div>
      <p class="tiny" style="margin-top:11px">Retours basés sur des indices simples (mots-clés, longueur, connecteurs) : ce n’est pas un jugement de ta grammaire ni de ta prononciation.</p>
      <div class="button-row" style="margin-top:15px"><button class="ghost-button" data-action="scenario-restart">Recommencer</button><button class="ghost-button" data-action="sim-modes">Changer de mode</button><button class="ghost-button" data-action="scenario-close">Terminer</button></div></div>`);
    if (st.mode === 'calm' || st.mode === 'shadow') setTimeout(() => speak(prompt, st.mode === 'calm' ? .7 : .85), 250);
    startTimer();
  }

  function evaluate(answer, timedOut) {
    const s = st.s, lower = answer.toLowerCase(), w = words(answer).length, hits = s.keywords.filter(k => lower.includes(k.toLowerCase())).length;
    const connectors = CONNECT.filter(([re]) => new RegExp('\\b(' + re + ')\\b', 'i').test(answer));
    connectors.forEach(([re]) => st.used.add(re));
    const polite = /\b(please|thank|thanks|excuse me|could you|would you|i would like)\b/i.test(answer);
    let pts = 0, title = '', tip = '', extra = '';
    pts += w >= 12 ? 2 : w >= 7 ? 1 : 0; pts += hits >= 3 ? 1.5 : hits >= 1 ? .75 : 0; pts += connectors.length ? 1 : 0; pts += polite ? .5 : 0;
    if (/\b(i is|he have|she have|they is|we is|i am agree)\b/i.test(answer)) { pts = Math.max(0, pts - .5); tip += ' Attention à l’accord : “I am / he has / they are”, et “I agree” (sans “am”).'; }
    switch (st.mode) {
      case 'shadow': {
        const t = norm(st.targets[st.turn]), a = norm(answer), bag = a.slice(), ok = t.filter(x => { const i = bag.indexOf(x); if (i >= 0) { bag.splice(i, 1); return true; } return false; });
        const pct = Math.round(ok.length / t.length * 100), missed = t.filter(x => !a.includes(x));
        pts = pct / 20; title = pct >= 90 ? 'Perfect! 🎯 ' + pct + ' %' : pct >= 60 ? 'Presque ! ' + pct + ' %' : 'À retravailler : ' + pct + ' %';
        tip = missed.length ? 'Mots manqués : ' + missed.slice(0, 6).join(', ') + '. Réécoute puis réessaie.' : 'Tous les mots sont là, bravo !'; st.shadowPct = (st.shadowPct || []).concat(pct); break;
      }
      case 'story': {
        const past = /\b(was|were|went|saw|had|did|found|took|felt|said|came|made|\w+ed)\b/i.test(answer), seq = /\b(then|suddenly|after|finally|one day|later|first|next|yesterday)\b/i.test(answer);
        pts = (w >= 6 ? 2 : 0) + (past ? 2 : 0) + (seq ? 1 : 0); st.story.push(answer);
        title = past ? 'Beau passé ! 📖' : 'Essaie le passé (was, went, saw…)'; tip = (past ? '' : 'Mets le verbe au passé. ') + (seq ? 'Super connecteur de temps !' : 'Ajoute “then”, “suddenly” ou “finally”.'); break;
      }
      case 'debate':
        title = connectors.length >= 2 ? 'Argument solide ! 🗣️' : 'Défends ton idée'; tip = (connectors.length ? 'Connecteurs : ' + connectors.map(c => c[1].split(' ')[0]).join(', ') + '. ' : 'Ajoute “In my opinion…” et “because…”. ') + tip; break;
      case 'rapid': {
        const inTime = !timedOut; if (inTime) st.inTime++; title = timedOut ? 'Temps écoulé ⏱' : w <= 20 ? 'Rapide et clair ⚡' : 'Un peu long : vise 20 mots max.';
        tip = timedOut ? 'Pas grave : une phrase simple suffit.' : 'Reste court, donne une raison.' + tip; break;
      }
      case 'surprise': if (st.surprise) { pts *= 2; st.sPoints++; } title = st.surprise ? 'Bien réagi à la surprise ! 🎲' : 'Bien joué !'; tip = 'Quand on t’interrompt : respire, reformule, réponds simplement.' + tip; break;
      case 'calm': title = 'Très bien, doucement mais sûrement 🌿'; tip = w < 7 ? 'Tu peux ajouter une petite raison avec “because”.' : 'Belle réponse, ton rythme est parfait.'; break;
      case 'exam': title = 'Réponse enregistrée 🎓'; tip = 'Le détail de ta note sera donné à la fin.'; break;
      default: title = hits >= 3 ? 'Good effort! Tu as développé ton idée.' : 'Tu as répondu, maintenant enrichis ta réponse.'; tip = (w < 7 ? 'Ajoute une raison avec “because” ou un exemple avec “for example”.' : 'Ajoute un exemple concret et une conclusion.') + tip;
    }
    pts = Math.min(5, Math.max(0, pts)); st.scores.push(pts);
    const kw = ['guided', 'calm', 'debate', 'exam'].includes(st.mode) ? `<br><span style="color:#8a9ca7">Mots-clés détectés : ${hits}/${Math.min(4, s.keywords.length)} (indice approximatif).</span>` : '';
    return { title, html: `<strong>${esc(title)}</strong><p>${esc(tip.trim())}${kw}</p>${extra}`, good: pts >= 3 };
  }

  function send(timedOut) {
    if (!st || st.done) return; const input = $('#scenarioAnswer'); if (!input) return;
    const answer = input.value.trim();
    if (!timedOut && answer.length < 3) { A().toast('Essaie une réponse, même courte.'); return; }
    clearInterval(timerId);
    const text = answer || '(pas de réponse)';
    st.history.push({ who: 'YOU', text }); const ev = answer ? evaluate(answer, timedOut) : { html: '<strong>Temps écoulé ⏱</strong><p>Pas de panique, essaie la prochaine !</p>', good: false };
    if (!answer) st.scores.push(0);
    st.turn++; const wasSurprise = !!st.surprise; st.surprise = '';
    if (st.turn >= st.m.turns) return finish(ev.html);
    if (st.mode === 'surprise' && !wasSurprise && Math.random() < .55) st.surprise = SURPRISES[Math.floor(Math.random() * SURPRISES.length)];
    render(st.mode === 'exam' ? '' : ev.html, ev.good ? 'happy' : 'think');
  }

  function finish(lastHTML) {
    st.done = true; stop();
    const sum = st.scores.reduce((a, b) => a + b, 0), max = st.m.turns * 5, note = Math.round(sum / max * 20 * 10) / 10;
    let xp = 15, extra = '';
    if (st.mode === 'exam') { xp = 25 + Math.round(note); extra = `<div class="result-score">${note}/20</div><p>Note <b>indicative</b> (pas officielle). ${note >= 14 ? 'Très bon niveau pour l’oral !' : note >= 10 ? 'Correct : ajoute des connecteurs et des exemples.' : 'Continue : entraîne-toi en mode Guidé puis réessaie.'}</p>`; }
    else if (st.mode === 'rapid') { xp = 20 + st.inTime * 2; extra = `<p>${st.inTime}/${st.m.turns} réponses dans le temps ⚡</p>`; }
    else if (st.mode === 'debate') { xp = 20 + st.used.size * 3; extra = `<p>Connecteurs utilisés : ${st.used.size}/4 ${st.used.size >= 3 ? '👏' : '— vise 3 ou plus la prochaine fois'}.</p>`; }
    else if (st.mode === 'shadow') { const arr = st.shadowPct || [0], avg = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length); xp = 15 + Math.round(avg / 10); extra = `<div class="result-score">${avg}%</div><p>Précision moyenne de répétition.</p>`; }
    else if (st.mode === 'story') { xp = 20; extra = `<div class="notice blue"><strong>Ton histoire</strong><br>${esc(st.story.join(' '))}</div>`; }
    else if (st.mode === 'surprise') { xp = 20 + st.sPoints * 4; extra = `<p>Surprises gérées : ${st.sPoints} 🎲</p>`; }
    try { const p = A().getProgress(); p.simHistory = (p.simHistory || []).concat({ d: new Date().toISOString().slice(0, 10), m: st.mode, s: st.s.id, n: note }).slice(-12); p.simsDone = (p.simsDone || 0) + 1; p.savedPhrases = [...new Set([...(p.savedPhrases || []), st.s.hints[0], st.s.hints[1]])].slice(0, 60); } catch (_) {}
    A().touchStudy(6); A().addXP(xp, 'Simulation ' + st.m.label);
    window.EAMascot && EAMascot.react('sim');
    A().openModal(`<div class="roleplay" style="text-align:center"><div style="display:flex;justify-content:center">${window.EAMascot ? EAMascot.html('cheer', 96) : ''}</div><span class="pill green">SIMULATION TERMINÉE · ${st.m.icon} ${st.m.label}</span><h2 class="roleplay-title" style="margin-top:12px">${esc(st.s.title)}</h2>${extra}<div class="feedback-box show" style="text-align:left;margin:14px 0">${lastHTML}</div><p>+${xp} XP gagnés 🎉</p><div class="button-row" style="justify-content:center"><button class="primary-button" data-action="scenario-restart">Rejouer ↻</button><button class="secondary-button" data-action="sim-modes">Autre mode</button><button class="ghost-button" data-action="scenario-close">Terminer</button></div></div>`);
  }

  function action(a, btn) {
    if (a === 'sim-listen') { speak(promptFor(), st && st.mode === 'calm' ? .7 : .92); return; }
    if (a === 'sim-modes') { A().closeModal(); A().view('speak'); return; }
    if (a === 'sim-breathe') {
      const el = $('#simBreath'); if (!el) return; let t = 0; const seq = ['Inspire… 4', 'Retiens… 3', 'Expire… 5'], marks = [0, 4, 7];
      const iv = setInterval(() => { const e = $('#simBreath'); if (!e) return clearInterval(iv); if (t >= 10) { e.textContent = 'Prêt(e) ✨'; return clearInterval(iv); } const i = t >= 7 ? 2 : t >= 4 ? 1 : 0; e.textContent = seq[i] + ' (' + (10 - t) + ' s)'; t++; }, 1000);
    }
  }
  function onSpeech() { if (st && st.mode === 'shadow' && !st.done) setTimeout(() => send(false), 300); }
  window.EASim = { MODES, open, send, stop, action, onSpeech, mode, setMode, sample: () => { const f = $('#scenarioAnswer'); if (f && st) f.value = st.s.sample; }, currentId: () => (st ? st.s.id : 'intro') };
})();
