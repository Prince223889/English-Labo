/* Kiki, la mascotte perroquet d'English Arena (SVG + CSS, aucune image, aucune dépendance).
 * Elle grandit avec l'XP, réagit à tes actions, répète la phrase du jour et se personnalise. */
(function () {
  const COLORS = { green: ['#5fe3ab', '#34b983', '#d9fbe9'], blue: ['#7cc7ff', '#3d8fe0', '#e0f2ff'], pink: ['#ff9fc4', '#e0558f', '#ffe3ee'], orange: ['#ffbf6b', '#e8892c', '#fff0d6'] };
  const STAGES = [[0, 'Poussin', .86], [100, 'Apprenti', .92], [300, 'Étudiant', .97], [700, 'Speaker', 1], [1500, 'Légende', 1.04]];
  const PHRASES = [
    ['Nice to meet you!', 'Enchanté(e) !'], ['Could you repeat that, please?', 'Pouvez-vous répéter, s’il vous plaît ?'], ['I would like a glass of water.', 'Je voudrais un verre d’eau.'],
    ['What do you think about it?', 'Qu’en penses-tu ?'], ['I’m looking forward to the weekend.', 'J’attends le week-end avec impatience.'], ['It depends on the situation.', 'Ça dépend de la situation.'],
    ['Let me think for a moment.', 'Laisse-moi réfléchir un instant.'], ['I see your point, but I disagree.', 'Je vois ton point de vue, mais je ne suis pas d’accord.'], ['How long have you been learning English?', 'Depuis combien de temps apprends-tu l’anglais ?'],
    ['Practice makes perfect.', 'C’est en forgeant qu’on devient forgeron.'], ['I’m not sure I understand.', 'Je ne suis pas sûr(e) de comprendre.'], ['Could you speak more slowly?', 'Pouvez-vous parler plus lentement ?'],
    ['In my opinion, education is the key.', 'À mon avis, l’éducation est la clé.'], ['Better late than never.', 'Mieux vaut tard que jamais.'], ['I used to play football every day.', 'Je jouais au foot tous les jours.'],
    ['If I had more time, I would travel.', 'Si j’avais plus de temps, je voyagerais.'], ['That’s a great idea!', 'C’est une excellente idée !'], ['I have been studying for two hours.', 'J’étudie depuis deux heures.'],
    ['Don’t be afraid of making mistakes.', 'N’aie pas peur de faire des erreurs.'], ['What are your plans for the future?', 'Quels sont tes projets d’avenir ?'], ['On the one hand… on the other hand…', 'D’un côté… de l’autre…'],
    ['I’m interested in science and technology.', 'Je m’intéresse aux sciences et à la technologie.'], ['Thank you for your help.', 'Merci pour ton aide.'], ['Success comes step by step.', 'Le succès vient pas à pas.'],
    ['Let’s work on it together.', 'Travaillons dessus ensemble.'], ['I’ve never been to London.', 'Je ne suis jamais allé(e) à Londres.'], ['It’s a matter of practice.', 'C’est une question de pratique.'],
    ['Speak up, your voice matters!', 'Exprime-toi, ta voix compte !'], ['Take it easy, you’re doing great.', 'Détends-toi, tu te débrouilles très bien.'], ['One more try!', 'Encore un essai !']
  ];
  const TIPS = {
    home: ['Un peu d’anglais chaque jour vaut mieux qu’une longue séance de temps en temps !', 'Clique sur moi pour entendre la phrase du jour 🔊'],
    courses: ['Fais une leçon par jour : le jour 7 est une révision.', 'Dis les exemples à voix haute, c’est le secret !'],
    speak: ['Parle avant de chercher la phrase parfaite 🎙', 'Essaie un nouveau mode de simulation : Débat ou Shadowing !'],
    vocab: ['5 mots par jour, c’est 150 mots par mois !', 'Invente une phrase personnelle avec chaque mot.'],
    practice: ['Lis toujours l’explication, même quand tu as juste.', 'Lance un duel avec la classe pour t’amuser !'],
    community: ['Reste positif : un bon message donne envie de parler anglais.', 'Relève le défi de la semaine !'],
    library: ['Les PDF s’ouvrent seulement avec ton code actif 🔐'], profile: ['Personnalise-moi : clique sur moi, puis « Personnaliser » ✨']
  };
  const MSG = {
    lesson: ['Une leçon de plus ! Tu avances vite 🎉', 'Bravo ! Continue comme ça !'],
    quizHigh: ['Excellent score ! 🔥', 'Tu maîtrises ! Chapeau !'], quizMid: ['Pas mal du tout ! Relis les explications.', 'Tu progresses, encore un quiz ?'], quizLow: ['On révise les erreurs ensemble, pas de souci 💪', 'Chaque erreur t’apprend quelque chose.'],
    listen: ['Je t’écoute… parle clairement 🎧'], noisy: ['Il y a du bruit autour 🙉 Va dans un coin calme ou rapproche-toi du micro.'], sim: ['Bien joué ! Tu as pratiqué à l’oral 🎤'],
    streak: ['{n} jours de suite ! Quelle régularité 🔥'], win: ['Victoire ! Tu es le champion de la classe 🏆'], duel: ['Duel lancé ! Que le meilleur gagne ⚔️']
  };
  let root, svgBox, bubble, bubbleText, panel, cfg = { name: 'Kiki', color: 'green', muted: false }, state = { xp: 0, streak: 0 }, mood = 'idle', moodTimer, bubbleTimer, idleTimer, lastBubble = 0, shownViews = {}, stageNow = 0, ready = false;
  const rnd = a => a[Math.floor(Math.random() * a.length)];
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const stageOf = xp => { let s = 0; STAGES.forEach((st, i) => { if (xp >= st[0]) s = i; }); return s; };
  const firstName = () => { try { return (window.EAApp.getProfile().name || '').split(' ')[0]; } catch (_) { return ''; } };

  function svg(m, stage, color) {
    const c = COLORS[color] || COLORS.green;
    const acc = [
      stage >= 1 ? '<path d="M50 74 Q70 88 90 74 L88 82 Q70 96 52 82Z" fill="#79d9fa"/><path d="M84 82 l6 16 l-8 -2z" fill="#79d9fa"/>' : '',
      stage >= 2 && stage < 4 ? '<g><path d="M40 28 L70 14 L100 28 L70 40Z" fill="#232a4d"/><rect x="58" y="36" width="24" height="9" rx="3" fill="#232a4d"/><path d="M96 29 v18" stroke="#ffd166" stroke-width="2.5"/><circle cx="96" cy="49" r="3" fill="#ffd166"/></g>' : '',
      stage >= 3 ? '<g class="k-glasses"><rect x="46" y="37" width="22" height="14" rx="6" fill="#111327" opacity=".82"/><rect x="72" y="37" width="22" height="14" rx="6" fill="#111327" opacity=".82"/><path d="M68 43 h4" stroke="#111327" stroke-width="3"/><path d="M50 40 l6 0" stroke="#fff" stroke-width="1.5" opacity=".6"/></g>' : '',
      stage >= 4 ? '<path d="M48 22 L52 6 L61 16 L70 2 L79 16 L88 6 L92 22Z" fill="#ffd166" stroke="#e8a317" stroke-width="2"/><circle cx="70" cy="9" r="2.5" fill="#ff6b8a"/>' : ''
    ].join('');
    return `<svg class="kiki mood-${m}" viewBox="0 0 140 150" role="img" aria-label="Kiki, la mascotte" style="--k-main:${c[0]};--k-dark:${c[1]};--k-light:${c[2]}">
<g class="k-all"><g class="k-scale" style="transform:scale(${STAGES[stage][2]});transform-origin:70px 140px">
<path d="M62 116 Q48 148 66 146 Q72 132 72 116Z" fill="#ff8fb1"/><path d="M70 116 Q76 152 92 142 Q86 130 80 116Z" fill="#79d9fa"/>
<path d="M56 126 v12 M52 140 h9 M84 126 v12 M80 140 h9" stroke="#ffa94d" stroke-width="4" stroke-linecap="round" fill="none"/>
<ellipse cx="70" cy="90" rx="38" ry="42" fill="var(--k-main)"/><ellipse cx="70" cy="100" rx="24" ry="30" fill="var(--k-light)"/>
<g class="k-wing-l"><path d="M38 76 Q12 92 28 122 Q44 110 46 88Z" fill="var(--k-dark)"/></g>
<g class="k-wing-r"><path d="M102 76 Q128 92 112 122 Q96 110 94 88Z" fill="var(--k-dark)"/></g>
<g class="k-head"><circle cx="70" cy="48" r="30" fill="var(--k-main)"/>
<path d="M58 22 Q52 2 64 8 Q64 16 68 22Z" fill="#ff8fb1"/><path d="M67 20 Q69 -2 79 5 Q76 14 74 22Z" fill="#ffd166"/><path d="M76 22 Q88 5 92 14 Q85 20 82 27Z" fill="#79d9fa"/>
<ellipse cx="70" cy="52" rx="23" ry="17" fill="var(--k-light)"/>
<g class="eyes-open"><circle cx="57" cy="44" r="8.5" fill="#fff"/><circle cx="83" cy="44" r="8.5" fill="#fff"/><g class="k-pupils"><circle cx="58" cy="45" r="4.6" fill="#1b2040"/><circle cx="82" cy="45" r="4.6" fill="#1b2040"/><circle cx="59.6" cy="43" r="1.6" fill="#fff"/><circle cx="83.6" cy="43" r="1.6" fill="#fff"/></g></g>
<g class="eyes-happy"><path d="M49 46 Q57 36 65 46" stroke="#1b2040" stroke-width="3.4" fill="none" stroke-linecap="round"/><path d="M75 46 Q83 36 91 46" stroke="#1b2040" stroke-width="3.4" fill="none" stroke-linecap="round"/></g>
<g class="eyes-sleep"><path d="M49 44 Q57 51 65 44" stroke="#1b2040" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M75 44 Q83 51 91 44" stroke="#1b2040" stroke-width="3.2" fill="none" stroke-linecap="round"/></g>
<circle cx="46" cy="58" r="5" fill="#ff8fa3" opacity=".5"/><circle cx="94" cy="58" r="5" fill="#ff8fa3" opacity=".5"/>
<path class="k-mouth" d="M64 62 Q70 77 76 62Z" fill="#c2412f"/>
<path class="k-beak" d="M61 53 Q70 44 79 53 Q77 66 70 71 Q63 66 61 53Z" fill="#ffa94d"/><path d="M64 57 Q70 53 76 57" stroke="#e8892c" stroke-width="1.6" fill="none"/>
${acc}</g></g></g>
<g class="k-fx"><text class="k-z" x="104" y="30" font-size="16" fill="#9ba4c3">z</text><text class="k-z k-z2" x="116" y="16" font-size="12" fill="#9ba4c3">z</text><text class="k-q" x="102" y="28" font-size="22" fill="#ffd166">?</text>
<path class="k-wave" d="M112 52 q8 8 0 16 M120 46 q13 14 0 28" stroke="#79d9fa" stroke-width="3" fill="none" stroke-linecap="round"/>
<g class="k-confetti"><circle cx="20" cy="30" r="3" fill="#ff8fb1"/><circle cx="118" cy="26" r="3" fill="#ffd166"/><rect x="28" y="12" width="5" height="5" fill="#79d9fa" transform="rotate(30 30 14)"/><rect x="108" y="10" width="5" height="5" fill="#8cf0ce" transform="rotate(-20 110 12)"/><circle cx="130" cy="60" r="2.5" fill="#ffd166"/><circle cx="8" cy="64" r="2.5" fill="#79d9fa"/></g></g></svg>`;
  }
  function html(m, size, stageOverride) { const st = stageOverride == null ? stageNow : stageOverride; return `<span class="kiki-inline" style="width:${size || 64}px;height:${(size || 64) * 1.07}px">${svg(m || 'idle', st, cfg.color)}</span>`; }

  function setMood(m, ms) {
    mood = m; clearTimeout(moodTimer);
    const el = svgBox && svgBox.querySelector('svg'); if (el) el.setAttribute('class', 'kiki mood-' + m);
    if (ms) moodTimer = setTimeout(() => setMood('idle'), ms);
    resetIdle();
  }
  function resetIdle() { clearTimeout(idleTimer); idleTimer = setTimeout(() => { setMood('sleep'); say('Zzz… réveille-moi en cliquant sur moi 😴', 0, true); }, 120000); }
  function render() { if (!svgBox) return; svgBox.innerHTML = svg(mood, stageNow, cfg.color); }
  function say(text, ms, force) {
    if (!ready || (cfg.muted && !force)) return;
    const now = Date.now(); if (!force && now - lastBubble < 5000) return; lastBubble = now;
    bubbleText.textContent = text; bubble.hidden = false; bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
    clearTimeout(bubbleTimer); if (ms !== 0) bubbleTimer = setTimeout(() => { bubble.hidden = true; }, ms || 6500);
  }
  function speakEn(text) {
    if (!('speechSynthesis' in window)) return;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = .9; u.onstart = () => setMood('talk'); u.onend = () => setMood('idle'); speechSynthesis.speak(u); } catch (_) {}
  }
  const phraseOfDay = () => { const d = new Date(); return PHRASES[Math.floor(d / 864e5) % PHRASES.length]; };

  function openPanel() {
    const stg = STAGES[stageNow], nxt = STAGES[stageNow + 1], p = phraseOfDay();
    const pct = nxt ? Math.min(100, Math.round((state.xp - stg[0]) / (nxt[0] - stg[0]) * 100)) : 100;
    panel.innerHTML = `<button class="kiki-x" data-k="close" aria-label="Fermer">×</button><div class="kiki-title"><b>${esc(cfg.name)}</b> · ${stg[1]}</div>
      <div class="progress-line"><span style="width:${pct}%"></span></div><small>${nxt ? `${state.xp} / ${nxt[0]} XP pour devenir « ${nxt[1]} »` : 'Niveau maximum : Légende 👑'}</small>
      <div class="kiki-phrase"><small>PHRASE DU JOUR</small><strong>${esc(p[0])}</strong><span>${esc(p[1])}</span><button class="ghost-button" data-k="say">🔊 Répète avec moi</button></div>
      <div class="button-row"><button class="ghost-button" data-k="custom">✨ Personnaliser</button><button class="ghost-button" data-k="mute">${cfg.muted ? '🔔 Réactiver mes messages' : '🔕 Me faire taire'}</button></div><div id="kikiCustom"></div>`;
    panel.hidden = false;
  }
  function customForm() {
    document.getElementById('kikiCustom').innerHTML = `<div class="kiki-custom"><label class="field-label" for="kikiName">Son prénom</label><input class="form-field" id="kikiName" maxlength="14" value="${esc(cfg.name)}"><div class="field-label" style="margin-top:8px">Sa couleur</div><div class="kiki-colors">${Object.keys(COLORS).map(k => `<button data-k="color" data-c="${k}" class="${cfg.color === k ? 'on' : ''}" style="background:${COLORS[k][0]}" aria-label="${k}"></button>`).join('')}</div><button class="primary-button" data-k="save" style="margin-top:10px;width:100%">Enregistrer</button></div>`;
  }
  function persist() { try { const p = window.EAApp.getProgress(); if (p) { p.mascot = Object.assign({}, cfg); window.EAApp.saveNow(); } } catch (_) {} }

  function onClick(e) {
    const b = e.target.closest('[data-k]'); if (!b) return; const k = b.dataset.k;
    if (k === 'close') panel.hidden = true;
    else if (k === 'say') { speakEn(phraseOfDay()[0]); }
    else if (k === 'mute') { cfg.muted = !cfg.muted; persist(); openPanel(); }
    else if (k === 'custom') customForm();
    else if (k === 'color') { cfg.color = b.dataset.c; render(); customForm(); }
    else if (k === 'save') { const n = (document.getElementById('kikiName').value || '').trim().slice(0, 14); if (n) cfg.name = n; try { window.EAApp.bump('mascot'); } catch (_) {} persist(); render(); openPanel(); say('Merci ! Je m’appelle ' + cfg.name + ' 💚', 4000, true); setMood('happy', 2500); }
  }

  function mount() {
    if (root) return;
    root = document.createElement('div'); root.className = 'kiki-widget'; root.hidden = true;
    root.innerHTML = '<div class="kiki-panel" hidden></div><div class="kiki-bubble" hidden><span></span></div><button class="kiki-btn" aria-label="Ouvrir la mascotte"><span class="kiki-svg"></span></button>';
    document.body.appendChild(root);
    panel = root.querySelector('.kiki-panel'); bubble = root.querySelector('.kiki-bubble'); bubbleText = bubble.querySelector('span'); svgBox = root.querySelector('.kiki-svg');
    bubble.addEventListener('click', () => { bubble.hidden = true; });
    root.querySelector('.kiki-btn').addEventListener('click', () => {
      if (mood === 'sleep') { setMood('happy', 2500); say('Je suis réveillé(e) ! On s’entraîne ? 🦜', 4500, true); return; }
      if (!panel.hidden) { panel.hidden = true; return; }
      bubble.hidden = true; setMood('happy', 2200); openPanel();
    });
    panel.addEventListener('click', onClick);
    ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { if (ready && mood !== 'sleep') resetIdle(); }, { passive: true }));
    render(); ready = true;
  }

  function update(progress) {
    mount();
    if (!progress) { root.hidden = true; return; }
    root.hidden = false;
    if (progress.mascot) cfg = Object.assign({ name: 'Kiki', color: 'green', muted: false }, progress.mascot);
    state = { xp: progress.xp || 0, streak: progress.streak || 0 };
    const ns = stageOf(state.xp);
    let saved = -1; try { saved = Number(localStorage.getItem('ea_kiki_stage')); if (isNaN(saved)) saved = -1; } catch (_) {}
    if (saved >= 0 && ns > saved) { stageNow = ns; render(); setMood('cheer', 3500); say(`Niveau supérieur : ${STAGES[ns][1]} ! 🎉`, 7000, true); } else if (ns !== stageNow) { stageNow = ns; render(); }
    try { localStorage.setItem('ea_kiki_stage', String(ns)); } catch (_) {}
  }

  function react(ev, d) {
    if (!ready || root.hidden) return; d = d || {};
    switch (ev) {
      case 'hello': { const h = new Date().getHours(), n = firstName(); setMood('happy', 3000); say(`${h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'}${n ? ' ' + n : ''} ! Prêt(e) pour un peu d’anglais ?`, 6500, true); break; }
      case 'view': { if (shownViews[d.view]) break; shownViews[d.view] = 1; const t = TIPS[d.view]; if (t) say(rnd(t), 6000); break; }
      case 'xp': setMood('happy', 1800); break;
      case 'lesson': setMood('cheer', 3000); say(rnd(MSG.lesson), 5500, true); break;
      case 'quiz': if (d.score >= 80) { setMood('cheer', 3500); say(rnd(MSG.quizHigh), 6000, true); } else if (d.score >= 50) { setMood('happy', 2500); say(rnd(MSG.quizMid), 6000, true); } else { setMood('think', 3000); say(rnd(MSG.quizLow), 6000, true); } break;
      case 'listen': setMood('listen'); say(rnd(MSG.listen), 3500); break;
      case 'idle': if (mood === 'listen') setMood('idle'); break;
      case 'noisy': say(rnd(MSG.noisy), 5000); setMood('think', 2500); break;
      case 'think': setMood('think', d.ms || 2500); break;
      case 'talk': setMood('talk', d.ms || 2500); break;
      case 'sim': setMood('cheer', 3000); say(rnd(MSG.sim), 5000, true); break;
      case 'win': setMood('cheer', 5000); say(rnd(MSG.win), 8000, true); break;
      case 'duel': setMood('happy', 3000); say(rnd(MSG.duel), 5000, true); break;
      case 'badge': setMood('cheer', 3500); say(d.text, 7000, true); break;
      case 'say': say(d.text, d.ms || 5000, !!d.force); break;
      case 'streak': if (d.n >= 2) say(rnd(MSG.streak).replace('{n}', d.n), 6000); break;
    }
  }
  window.EAMascot = { mount, update, react, html, svg: (m, s) => svg(m || 'idle', s == null ? stageNow : s, cfg.color), speak: speakEn };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
