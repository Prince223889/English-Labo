/* English Arena — Speaking Lab : 8 modes, vraie conversation vocale.
 * Le partenaire PARLE (voix complète, sans coupure), tu réponds au micro (texte en direct, envoi automatique au silence) ou au clavier.
 * Le partenaire réagit à ce que tu dis (questions → réponses du scénario, mot-clé repris, relances). Tout fonctionne hors ligne.
 * Retours : indices simples (mots-clés, longueur, connecteurs) + erreurs typiques des francophones — pas de note officielle. */
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
  const ACK = ['I see.', 'That’s interesting!', 'Great, thank you.', 'Oh, really?', 'Good answer!', 'Nice, I understand.', 'Okay, got it.', 'That makes sense.'];
  const ASK_MORE = ['Could you tell me a little more?', 'Can you give me more details?'];
  const DEFLECT = ['That’s a good question! I would say it depends. And you?', 'Hmm, let me think… I’m not sure, to be honest. What about you?', 'Good question! I think so, yes. What do you think?'];
  const STOP = new Set('about after again always because before being could every first great there their these those which would should really thing think where while with your yours have this that from they them then than what when will just very much many some more most also into over only other such like been were does done made make going'.split(' '));
  // Erreurs fréquentes des francophones : [regex, conseil]
  const FR_ERRORS = [
    [/\bi am agree\b/i, 'On dit « I agree » (sans « am »).'], [/\b(he|she|it) have\b/i, 'Avec he/she/it : « has » (he has).'], [/\b(i|you|we|they) has\b/i, 'Avec I/you/we/they : « have ».'],
    [/\b(i|we|you|they) is\b|\b(he|she|it) are\b|\bi are\b/i, 'Accorde « to be » : I am, you are, he is.'], [/\bi have \d+ years?\b/i, 'L’âge : « I am 17 » (pas « I have 17 years »).'], [/\b(informations|advices|furnitures|knowledges)\b/i, 'Mot indénombrable : pas de « s » (information, advice).'],
    [/\bmore (better|bigger|easier|faster|cheaper)\b/i, 'Pas de « more » avec -er : « better », « bigger ».'], [/\bexplain me\b/i, 'On dit « explain it to me ».'], [/\b(since|for) \d+ (years|months|days|weeks)\b.*\b(am|is|are|live|study|work)\b(?!.*(have|has))/i, 'Durée jusqu’à maintenant : present perfect (« I have lived here for 3 years »).'],
    [/\byesterday\b.*\b(go|eat|see|come|have|do)\b(?!\w)/i, 'Avec « yesterday », mets le verbe au passé (went, ate, saw…).'], [/\bdepend of\b/i, 'On dit « depend on ».'], [/\blisten the\b/i, 'On dit « listen to ».'], [/\b(do|does) (he|she|it) \w+s\b/i, 'Après do/does, le verbe est à la base (does he like…).'],
    [/\bthe people is\b/i, '« people » est pluriel : « the people are ».'], [/\bi can to\b|\bmust to\b|\bshould to\b/i, 'Après can/must/should : pas de « to ».']
  ];
  const lowerI = /(?:^|[\s,;])i(?=[\s,.!?]|$)/;
  let st = null, timerId = null, micCtl = null, autoSend = null;
  const A = () => window.EAApp, esc = v => A().esc(v), $ = s => document.querySelector(s);
  const rnd = a => a[Math.floor(Math.random() * a.length)];
  const modeOf = id => MODES.find(m => m.id === id) || MODES[0];
  const mode = () => { try { return modeOf(A().getProgress().simMode).id; } catch (_) { return 'guided'; } };
  function setMode(id) { const p = A().getProgress(); if (p) { p.simMode = modeOf(id).id; A().saveNow(); } }
  const words = t => t.trim().split(/\s+/).filter(Boolean);
  const norm = t => t.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
  const sentences = t => (t.match(/[^.!?]+[.!?]?/g) || []).map(x => x.trim()).filter(x => x.split(/\s+/).length >= 4);
  const voiceOK = () => !!(window.EASpeech && EASpeech.canSpeak());
  const micOK = () => !!(window.EASpeech && EASpeech.canListen());

  function speak(text, rate, cb) {
    if (!voiceOK() || !text) { if (cb) cb(); return Promise.resolve(); }
    status('🔊 Le partenaire parle…');
    return EASpeech.say(text, { rate: rate, onstart: () => window.EAMascot && EAMascot.react('talk', { ms: 2500 }) }).then(ok => { if (ok && cb) cb(); });
  }
  function status(t) { const e = $('#simStatus'); if (e) e.textContent = t; }

  function basePrompt() {
    const s = st.s, m = st.mode;
    if (st.surprise) return st.surprise;
    if (m === 'shadow') return st.targets[st.turn];
    if (m === 'story') return st.turn === 0 ? st.starter : STORY_NEXT[(st.turn - 1) % STORY_NEXT.length];
    const base = st.turn === 0 ? s.opening : s.followups[(st.turn - 1) % s.followups.length];
    return m === 'debate' && st.turn > 0 ? PUSHBACK[(st.turn - 1) % PUSHBACK.length] + base : base;
  }
  function stripFirst() { return st.history.length ? st.history[st.history.length - 1].text : ''; }

  // ---------- ouverture ----------
  function open(id) {
    stop();
    const s = A().DATA.simulations.find(x => x.id === id) || A().DATA.simulations[0], mid = mode(), m = modeOf(mid);
    const targets = [s.opening, ...s.followups, ...sentences(s.sample)].filter((v, i, a) => a.indexOf(v) === i).slice(0, m.turns);
    st = { s, mode: mid, m, turn: 0, history: [], scores: [], inTime: 0, used: new Set(), story: [], targets, surprise: '', sPoints: 0, starter: rnd(STARTERS), voice: voiceOK(), listen: micOK(), tips: new Set(), keyws: [] };
    shell(); partnerSays(basePrompt(), true);
  }
  function shell() {
    const s = st.s, m = st.m, A_ = A();
    const showHints = ['guided', 'calm', 'debate', 'story'].includes(st.mode), showSample = st.mode === 'guided' || st.mode === 'calm';
    const coach = { guided: 'Prends ton temps, je suis là.', exam: 'Réponds comme à l’oral du bac !', calm: 'Respire… puis parle doucement.', rapid: 'Vite ! Phrases courtes !', debate: 'Défends ton idée avec une raison.', shadow: 'Écoute bien, puis répète exactement.', story: 'Utilise le passé : was, went, saw…', surprise: 'Reste calme, tout peut arriver !' }[st.mode];
    A_.openModal(`<div class="roleplay"><div class="roleplay-header"><span class="pill green">${esc(s.level)} · ${m.icon} ${m.label}</span><span class="pill" id="simTurn">TOUR 1 / ${m.turns}</span></div>
      <div class="eyebrow" style="margin-top:15px">ROLEPLAY SIMULATOR</div><h2 class="roleplay-title">${esc(s.title)}</h2><p class="roleplay-context">${esc(s.setting)} Ton objectif : ${esc(s.goal)}</p>
      <div class="kiki-roleplay" id="simKiki">${window.EAMascot ? EAMascot.html('idle', 54) : ''}<div class="kiki-say"><strong>${esc(m.label)}</strong> — ${esc(coach)}</div></div>
      <div class="button-row" style="margin:6px 0"><button class="toggle ${st.voice ? 'on' : ''}" id="simVoiceTg" data-action="sim-voice" aria-label="Conversation vocale"></button><span class="tiny">🗣️ Conversation vocale : le partenaire parle${micOK() ? ' et j’écoute ton micro automatiquement' : ' (micro non disponible sur ce navigateur : écris tes réponses)'}</span></div>
      ${m.timer ? `<div class="notice blue" style="margin:10px 0"><strong>⏱ Temps : <span id="simTimer">${m.timer} s</span></strong><div class="progress-line"><span id="simTimerBar" style="width:100%"></span></div></div>` : ''}
      ${st.mode === 'calm' ? `<div class="button-row" style="margin:8px 0"><button class="ghost-button" data-action="sim-breathe">🌬️ Respirer 10 secondes</button><span id="simBreath" class="pill"></span></div>` : ''}
      <div class="journey-list sim-chat" id="simChat" style="margin:12px 0;max-height:240px;overflow:auto"></div>
      <div class="dialogue-box"><div class="dialogue-person" id="simWho"></div><div class="dialogue-line" id="simPrompt"></div>
        <div class="button-row" style="margin-top:9px"><button class="ghost-button" data-action="sim-listen">🔊 Réécouter</button><button class="ghost-button" data-action="sim-stopvoice">⏹ Stop</button><button class="text-button" data-action="save-phrase" id="simSave">＋ Sauver la phrase</button></div></div>
      <div id="simChecklist"></div>
      ${showHints ? `<div><div class="field-label">Helpful phrases</div><div class="hint-list">${s.hints.map(h => `<button class="hint-chip" data-action="insert-hint" data-hint="${esc(h)}">${esc(h)}</button>`).join('')}</div></div>` : ''}
      <label class="field-label" for="scenarioAnswer">${st.mode === 'shadow' ? 'Répète la phrase (dis-la au micro ou écris-la)' : 'Ta réponse (dis-la au micro ou écris-la en anglais)'}</label>
      <textarea id="scenarioAnswer" class="response-area" placeholder="Parle ou écris ta réponse en anglais…" rows="3"></textarea>
      <div class="tiny" id="simStatus" style="min-height:18px" aria-live="polite"></div>
      <div class="roleplay-controls"><button class="primary-button" data-action="scenario-send">Envoyer ma réponse ↗</button><button class="secondary-button" id="simMicBtn" data-action="scenario-mic">🎙 Parler</button>${showSample ? '<button class="ghost-button" data-action="scenario-sample">Voir un exemple</button>' : ''}</div>
      <div class="feedback-box" id="scenarioFeedback"></div>
      <details style="margin-top:10px"><summary class="tiny">🎧 Outils micro avancés (anti-bruit, enregistrement)</summary><div class="voice-panel"><small id="microStatus">Appuie sur « Tester mon micro » : le filtre se règle sur le bruit de ta pièce.</small><div class="progress-line"><span id="microMeter" style="width:0%"></span></div><div class="button-row"><button class="ghost-button" data-action="voice-test">🎧 Tester mon micro</button><button class="ghost-button" data-action="voice-rec">⏺ Enregistrer</button><button class="ghost-button" id="voicePlayBtn" data-action="voice-play" hidden>▶ Réécouter</button></div><audio id="voiceAudio" controls hidden style="width:100%;margin-top:8px"></audio></div></details>
      <p class="tiny" style="margin-top:11px">Retours basés sur des indices simples (mots-clés, longueur, connecteurs) et les erreurs typiques des francophones : ce n’est pas une note officielle de prononciation.</p>
      <div class="button-row" style="margin-top:15px"><button class="ghost-button" data-action="scenario-restart">Recommencer</button><button class="ghost-button" data-action="sim-modes">Changer de mode</button><button class="ghost-button" data-action="scenario-close">Terminer</button></div></div>`);
  }
  function chatHTML() { return st.history.map(h => `<div class="journey-item" style="${h.who === 'YOU' ? 'flex-direction:row-reverse;text-align:right' : ''}"><div class="journey-day" style="font-size:9px">${h.who === 'YOU' ? 'TOI' : '🗣️'}</div><div class="journey-copy"><strong>${h.who === 'YOU' ? 'Ta réponse' : esc(st.mode === 'story' ? 'Narrateur' : st.s.role)}</strong><small>${esc(h.text)}</small></div></div>`).join(''); }
  function refresh(promptText) {
    const chat = $('#simChat'); if (!chat) return; chat.innerHTML = chatHTML(); chat.scrollTop = chat.scrollHeight;
    const who = $('#simWho'); if (who) who.textContent = (st.mode === 'story' ? 'Narrateur' : st.mode === 'shadow' ? '🦜 Répète cette phrase' : st.s.role) + ' · PARTNER' + (st.surprise ? ' · 🎲 SURPRISE' : '');
    const pr = $('#simPrompt'); if (pr) pr.textContent = promptText; const sv = $('#simSave'); if (sv) sv.dataset.phrase = promptText;
    const t = $('#simTurn'); if (t) t.textContent = 'TOUR ' + Math.min(st.turn + 1, st.m.turns) + ' / ' + st.m.turns;
    const cl = $('#simChecklist'); if (cl) cl.innerHTML = st.mode === 'debate' ? `<div class="hint-list" style="margin:8px 0">${CONNECT.map(([re, label]) => `<span class="hint-chip" style="${st.used.has(re) ? 'background:#8cf0ce33;border-color:var(--mint)' : ''}">${st.used.has(re) ? '✓ ' : ''}${label}</span>`).join('')}</div>` : '';
    if (window.EAMascot) { const k = $('#simKiki'); if (k) { const first = k.firstElementChild; if (first && first.classList.contains('kiki-inline')) first.outerHTML = EAMascot.html('idle', 54); } }
  }
  // Le partenaire dit une phrase (affichée + lue en entier), puis on écoute (si conversation vocale).
  function partnerSays(text, first) {
    st.history.push({ who: 'PARTNER', text }); st.current = text; refresh(text);
    const inp = $('#scenarioAnswer'); if (inp) { inp.value = ''; }
    stopTimer(); if (micCtl) { EASpeech.stopListening(); micCtl = null; micBtn(false); }
    const rate = st.mode === 'calm' ? .7 : st.mode === 'shadow' ? .85 : undefined;
    const go = () => { if (!st || st.done) return; status(st.listen && st.voice ? '🎙 À toi ! (je t’écoute, ou écris)' : 'À toi de répondre.'); startTimer(); if (st.voice && st.listen && !st.micDenied) setTimeout(() => { if (st && !st.done && !micCtl) mic(true); }, 350); };
    if (st.voice && voiceOK()) speak(text, rate).then(go); else go();
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
  function stopTimer() { clearInterval(timerId); timerId = null; }
  function stop() { stopTimer(); clearTimeout(autoSend); micCtl = null; if (window.EASpeech) { EASpeech.stop(); EASpeech.stopListening(); } }

  // ---------- micro : transcription en direct, envoi automatique au silence ----------
  function micBtn(on) { const b = $('#simMicBtn'); if (b) b.textContent = on ? '⏹ Arrêter le micro' : '🎙 Parler'; }
  function mic(auto) {
    if (!st || st.done) return;
    if (!micOK()) { A().toast('Reconnaissance vocale non disponible ici (essaie Chrome). Écris ta réponse.'); return; }
    if (micCtl) { EASpeech.stopListening(); micCtl = null; micBtn(false); status('Micro coupé.'); return; }
    EASpeech.stop(); stopTimer(); if (st.m.timer && st.deadline) startTimer(); clearTimeout(autoSend);
    const inp = $('#scenarioAnswer'), base = inp && inp.value ? inp.value.trim() + ' ' : '';
    micBtn(true); status('🎙 Je t’écoute… parle en anglais.');
    micCtl = EASpeech.listen({ lang: 'en-US', silenceMs: st.mode === 'shadow' ? 1700 : 2400,
      onInterim: t => { const i = $('#scenarioAnswer'); if (i) i.value = base + t; },
      onEnd: final => { micCtl = null; micBtn(false); const i = $('#scenarioAnswer'); if (final && i) i.value = (base + final).trim();
        if (final) { status('✅ Texte reconnu : relis-le… envoi automatique dans 2 s (ou modifie-le).'); if (st && !st.done) autoSend = setTimeout(() => { const j = $('#scenarioAnswer'); if (st && !st.done && j && j.value.trim().length > 2 && document.activeElement !== j) send(false); else status('Texte prêt : appuie sur « Envoyer ».'); }, 2000); }
        else status('Je n’ai rien entendu. Appuie sur « Parler » pour réessayer, ou écris.'); },
      onError: e => { micCtl = null; micBtn(false); if (e === 'not-allowed' || e === 'service-not-allowed') { st.micDenied = true; status('Micro refusé : autorise-le dans le navigateur, ou écris ta réponse.'); A().toast('Autorise le micro dans le navigateur, ou réponds par écrit.'); } else status('Micro indisponible (' + e + '). Écris ta réponse.'); } });
    if (!micCtl) { micBtn(false); }
  }

  // ---------- évaluation ----------
  function grammarTips(answer) {
    const tips = []; FR_ERRORS.forEach(([re, tip]) => { if (tip && re.test(answer) && !st.tips.has(tip)) tips.push(tip); });
    if (lowerI.test(answer) && /\bi\b/.test(answer) && !/\bI\b/.test(answer)) tips.push('Le « I » (je) s’écrit toujours en majuscule.');
    tips.slice(0, 2).forEach(t => st.tips.add(t)); return tips.slice(0, 2);
  }
  function evaluate(answer, timedOut) {
    const s = st.s, lower = answer.toLowerCase(), w = words(answer).length, hits = s.keywords.filter(k => lower.includes(k.toLowerCase())).length;
    const connectors = CONNECT.filter(([re]) => new RegExp('\\b(' + re + ')\\b', 'i').test(answer));
    connectors.forEach(([re]) => st.used.add(re));
    const polite = /\b(please|thank|thanks|excuse me|could you|would you|i would like)\b/i.test(answer);
    let pts = 0, title = '', tip = '';
    pts += w >= 12 ? 2 : w >= 7 ? 1 : 0; pts += hits >= 3 ? 1.5 : hits >= 1 ? .75 : 0; pts += connectors.length ? 1 : 0; pts += polite ? .5 : 0;
    const gt = grammarTips(answer); if (gt.length) { pts = Math.max(0, pts - .5); tip += ' ⚠️ ' + gt.join(' '); }
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
        title = past ? 'Beau passé ! 📖' : 'Essaie le passé (was, went, saw…)'; tip = (past ? '' : 'Mets le verbe au passé. ') + (seq ? 'Super connecteur de temps !' : 'Ajoute “then”, “suddenly” ou “finally”.') + tip; break;
      }
      case 'debate':
        title = connectors.length >= 2 ? 'Argument solide ! 🗣️' : 'Défends ton idée'; tip = (connectors.length ? 'Connecteurs : ' + connectors.map(c => c[1].split(' ')[0]).join(', ') + '. ' : 'Ajoute “In my opinion…” et “because…”. ') + tip; break;
      case 'rapid': {
        const inTime = !timedOut; if (inTime) st.inTime++; title = timedOut ? 'Temps écoulé ⏱' : w <= 20 ? 'Rapide et clair ⚡' : 'Un peu long : vise 20 mots max.';
        tip = (timedOut ? 'Pas grave : une phrase simple suffit.' : 'Reste court, donne une raison.') + tip; break;
      }
      case 'surprise': if (st.surprise) { pts *= 2; st.sPoints++; } title = st.surprise ? 'Bien réagi à la surprise ! 🎲' : 'Bien joué !'; tip = 'Quand on t’interrompt : respire, reformule, réponds simplement.' + tip; break;
      case 'calm': title = 'Très bien, doucement mais sûrement 🌿'; tip = (w < 7 ? 'Tu peux ajouter une petite raison avec “because”.' : 'Belle réponse, ton rythme est parfait.') + tip; break;
      case 'exam': title = 'Réponse enregistrée 🎓'; tip = 'Le détail de ta note sera donné à la fin.'; break;
      default: title = hits >= 3 ? 'Good effort! Tu as développé ton idée.' : 'Tu as répondu, maintenant enrichis ta réponse.'; tip = (w < 7 ? 'Ajoute une raison avec “because” ou un exemple avec “for example”.' : 'Ajoute un exemple concret et une conclusion.') + tip;
    }
    pts = Math.min(5, Math.max(0, pts)); st.scores.push(pts);
    const kw = ['guided', 'calm', 'debate', 'exam'].includes(st.mode) ? `<br><span style="color:#8a9ca7">Mots-clés détectés : ${hits}/${Math.min(4, s.keywords.length)} (indice approximatif).</span>` : '';
    return { title, html: `<strong>${esc(title)}</strong><p>${esc(tip.trim())}${kw}</p>`, good: pts >= 3, w };
  }
  // Réaction du partenaire à ce que l'élève vient de dire
  function reactionTo(answer, ev) {
    if (st.mode === 'shadow' || st.mode === 'exam') return '';
    const s = st.s, isQ = /\?/.test(answer) || /^(what|where|when|who|why|how|do you|are you|did you|can you|could you|have you|is there)\b/i.test(answer.trim());
    if (isQ) { const qa = (s.qa || []).find(([re]) => { try { return new RegExp(re, 'i').test(answer); } catch (_) { return false; } }); return qa ? qa[1] : rnd(DEFLECT); }
    const kw = norm(answer).filter(x => x.length > 5 && !STOP.has(x)).sort((a, b) => b.length - a.length)[0];
    let r = ev && ev.w < 5 ? rnd(ASK_MORE) : rnd(ACK);
    if (kw && Math.random() < .6 && st.mode !== 'debate') r = rnd(['You mentioned “' + kw + '” — that is interesting.', 'Ah, “' + kw + '”! I see.', r]);
    return r;
  }

  function send(timedOut) {
    if (!st || st.done) return; const input = $('#scenarioAnswer'); if (!input) return;
    clearTimeout(autoSend); if (micCtl) { EASpeech.stopListening(); micCtl = null; micBtn(false); }
    const answer = input.value.trim();
    if (!timedOut && answer.length < 3) { A().toast('Essaie une réponse, même courte.'); return; }
    stopTimer(); EASpeech.stop();
    const text = answer || '(pas de réponse)';
    st.history.push({ who: 'YOU', text });
    const ev = answer ? evaluate(answer, timedOut) : { html: '<strong>Temps écoulé ⏱</strong><p>Pas de panique, essaie la prochaine !</p>', good: false, w: 0 };
    if (!answer) st.scores.push(0);
    const reaction = answer ? reactionTo(answer, ev) : '';
    st.turn++; const wasSurprise = !!st.surprise; st.surprise = '';
    const fb = $('#scenarioFeedback'); if (fb && st.mode !== 'exam') { fb.innerHTML = ev.html; fb.classList.add('show'); } else if (fb) { fb.classList.remove('show'); fb.innerHTML = ''; }
    if (window.EAMascot) EAMascot.react(ev.good ? 'xp' : 'think', { ms: 1800 });
    if (st.turn >= st.m.turns) { st.lastHTML = ev.html; const closing = st.s.closing || 'Thank you, it was nice talking to you!'; st.history.push({ who: 'PARTNER', text: (reaction ? reaction + ' ' : '') + closing }); refresh(closing); const done = () => finish(ev.html); if (st.voice && voiceOK() && st.mode !== 'shadow') speak((reaction ? reaction + ' ' : '') + closing).then(() => setTimeout(done, 300)); else setTimeout(done, 300); return; }
    if (st.mode === 'surprise' && !wasSurprise && Math.random() < .55) st.surprise = rnd(SURPRISES);
    const next = basePrompt();
    partnerSays((reaction ? reaction + ' ' : '') + next);
  }

  function finish(lastHTML) {
    st.done = true; stop();
    const sum = st.scores.reduce((a, b) => a + b, 0), max = st.m.turns * 5, note = Math.round(sum / max * 20 * 10) / 10;
    let xp = 15, extra = '';
    if (st.mode === 'exam') { xp = 25 + Math.round(note); extra = `<div class="result-score">${note}/20</div><p>Note <b>indicative</b> (pas officielle). ${note >= 14 ? 'Très bon niveau pour l’oral !' : note >= 10 ? 'Correct : ajoute des connecteurs et des exemples.' : 'Continue : entraîne-toi en mode Guidé puis réessaie.'}</p>`; }
    else if (st.mode === 'rapid') { xp = 20 + st.inTime * 2; extra = `<p>${st.inTime}/${st.m.turns} réponses dans le temps ⚡</p>`; }
    else if (st.mode === 'debate') { xp = 20 + st.used.size * 3; extra = `<p>Connecteurs utilisés : ${st.used.size}/4 ${st.used.size >= 3 ? '👏' : '— vise 3 ou plus la prochaine fois'}.</p>`; }
    else if (st.mode === 'shadow') { const arr = st.shadowPct || [0], avg = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length); xp = 15 + Math.round(avg / 10); extra = `<div class="result-score">${avg}%</div><p>Précision moyenne de répétition.</p>`; st.note = Math.round(avg / 100 * 20 * 10) / 10; }
    else if (st.mode === 'story') { xp = 20; extra = `<div class="notice blue"><strong>Ton histoire</strong><br>${esc(st.story.join(' '))}</div>`; }
    else if (st.mode === 'surprise') { xp = 20 + st.sPoints * 4; extra = `<p>Surprises gérées : ${st.sPoints} 🎲</p>`; }
    const stored = st.mode === 'shadow' ? st.note : note;
    try { const p = A().getProgress(); p.simHistory = (p.simHistory || []).concat({ d: new Date().toISOString().slice(0, 10), m: st.mode, s: st.s.id, n: stored }).slice(-12); p.simsDone = (p.simsDone || 0) + 1; p.savedPhrases = [...new Set([...(p.savedPhrases || []), st.s.hints[0], st.s.hints[1]])].slice(0, 60); } catch (_) {}
    A().touchStudy(6); A().addXP(xp, 'Simulation ' + st.m.label);
    window.EAMascot && EAMascot.react('sim');
    A().openModal(`<div class="roleplay" style="text-align:center"><div style="display:flex;justify-content:center">${window.EAMascot ? EAMascot.html('cheer', 96) : ''}</div><span class="pill green">SIMULATION TERMINÉE · ${st.m.icon} ${st.m.label}</span><h2 class="roleplay-title" style="margin-top:12px">${esc(st.s.title)}</h2>${extra}<div class="feedback-box show" style="text-align:left;margin:14px 0">${lastHTML}</div><details style="text-align:left"><summary>📜 Revoir la conversation</summary><div class="journey-list">${chatHTML()}</div></details><p>+${xp} XP gagnés 🎉</p><div class="button-row" style="justify-content:center"><button class="primary-button" data-action="scenario-restart">Rejouer ↻</button><button class="secondary-button" data-action="sim-modes">Autre mode</button><button class="ghost-button" data-action="scenario-close">Terminer</button></div></div>`);
  }

  function action(a) {
    if (a === 'sim-listen') { if (st) { stopTimer(); speak(st.current, st.mode === 'calm' ? .7 : undefined).then(() => st && startTimer()); } return; }
    if (a === 'sim-stopvoice') { EASpeech.stop(); EASpeech.stopListening(); micCtl = null; micBtn(false); status('Voix arrêtée.'); return; }
    if (a === 'sim-voice') { if (!st) return; st.voice = !st.voice; const t = $('#simVoiceTg'); if (t) t.classList.toggle('on', st.voice); if (!st.voice) { EASpeech.stop(); EASpeech.stopListening(); micCtl = null; micBtn(false); } return; }
    if (a === 'sim-modes') { stop(); A().closeModal(); A().view('speak'); return; }
    if (a === 'sim-breathe') {
      const el = $('#simBreath'); if (!el) return; let t = 0; const seq = ['Inspire… 4', 'Retiens… 3', 'Expire… 5'];
      const iv = setInterval(() => { const e = $('#simBreath'); if (!e) return clearInterval(iv); if (t >= 10) { e.textContent = 'Prêt(e) ✨'; return clearInterval(iv); } const i = t >= 7 ? 2 : t >= 4 ? 1 : 0; e.textContent = seq[i] + ' (' + (10 - t) + ' s)'; t++; }, 1000);
    }
  }
  window.EASim = { MODES, open, send, stop, action, mic, mode, setMode, onSpeech() {}, sample: () => { const f = $('#scenarioAnswer'); if (f && st) f.value = st.s.sample; }, currentId: () => (st ? st.s.id : 'intro') };
})();
