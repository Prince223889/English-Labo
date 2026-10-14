/* Système de badges : 40 badges, 4 raretés, progression visible. */
(function () {
  const n = (v) => Number(v) || 0, len = (a) => (Array.isArray(a) ? a.length : 0), st = (p, k) => n((p.stats || {})[k]);
  const modes = p => new Set((p.simHistory || []).map(h => h.m)).size;
  // [id, emoji, titre, description, rareté(1-4), [valeur actuelle, objectif]]
  const C = [
    ['firstLesson', '📘', 'Premier pas', 'Terminer une leçon', 1, p => [len(p.completedDays), 1]],
    ['week1', '🧭', 'Une semaine', 'Terminer 7 leçons', 1, p => [len(p.completedDays), 7]],
    ['week4', '🏔️', 'Mi-parcours', 'Terminer 28 leçons', 3, p => [len(p.completedDays), 28]],
    ['course56', '🎓', 'Diplômé des 56 jours', 'Terminer les 56 leçons', 4, p => [len(p.completedDays), 56]],
    ['mini5', '📚', 'Curieux', 'Terminer 5 ateliers complémentaires', 2, p => [len(p.completedMiniCourses), 5]],
    ['minutes120', '⏱️', 'Deux heures', 'Étudier 120 minutes au total', 2, p => [n(p.studyMinutes), 120]],
    ['word10', '🔤', 'Mots en poche', 'Maîtriser 10 mots', 1, p => [len(p.knownWords), 10]],
    ['word40', '🧠', 'Cerveau lexical', 'Maîtriser 40 mots', 2, p => [len(p.knownWords), 40]],
    ['word80', '📖', 'Dictionnaire vivant', 'Maîtriser 80 mots', 3, p => [len(p.knownWords), 80]],
    ['quiz80', '🎯', 'Précision', 'Atteindre 80 % à un quiz', 1, p => [Math.max(0, ...(p.quizHistory || []).map(q => n(q.score))), 80]],
    ['quizPerfect', '💯', 'Sans faute', 'Obtenir 100 % à un quiz', 3, p => [Math.max(0, ...(p.quizHistory || []).map(q => n(q.score))), 100]],
    ['quiz10', '📝', 'Quizzeur', 'Terminer 10 quiz', 2, p => [len(p.quizHistory), 10]],
    ['phrase5', '💬', 'Voix confiante', 'Sauver 5 phrases utiles', 1, p => [len(p.savedPhrases), 5]],
    ['sim1', '🎤', 'Première prise de parole', 'Terminer une simulation', 1, p => [n(p.simsDone), 1]],
    ['sim10', '🎙️', 'À l’aise à l’oral', 'Terminer 10 simulations', 2, p => [n(p.simsDone), 10]],
    ['modes4', '🎭', 'Caméléon', 'Essayer 4 modes de simulation', 2, p => [modes(p), 4]],
    ['modes8', '🌍', 'Maître des modes', 'Essayer les 8 modes', 4, p => [modes(p), 8]],
    ['exam14', '🏅', 'Prêt pour l’oral', 'Note indicative ≥ 14/20 en mode Examen', 3, p => [Math.max(0, ...(p.simHistory || []).filter(h => h.m === 'exam').map(h => n(h.n))), 14]],
    ['shadow90', '🦜', 'Perroquet parfait', '≥ 90 % de précision en Shadowing', 3, p => [Math.max(0, ...(p.simHistory || []).filter(h => h.m === 'shadow').map(h => n(h.n))), 18]],
    ['streak3', '🔥', 'Bien lancé', '3 jours de suite', 1, p => [n(p.streak), 3]],
    ['streak7', '🔥', 'Une vraie série', '7 jours de suite', 2, p => [n(p.streak), 7]],
    ['streak14', '⚡', 'Inarrêtable', '14 jours de suite', 3, p => [n(p.streak), 14]],
    ['streak30', '👑', 'Légende de la régularité', '30 jours de suite', 4, p => [n(p.streak), 30]],
    ['xp500', '⭐', '500 XP', 'Gagner 500 XP', 1, p => [n(p.xp), 500]],
    ['xp1500', '🌟', '1 500 XP', 'Gagner 1 500 XP', 2, p => [n(p.xp), 1500]],
    ['xp3000', '💎', '3 000 XP', 'Gagner 3 000 XP', 4, p => [n(p.xp), 3000]],
    ['mission7', '🎯', 'Missionnaire', 'Valider 7 missions du jour', 2, p => [len(p.completedMissions), 7]],
    ['chat1', '👋', 'Bonjour la classe', 'Envoyer un premier message', 1, p => [st(p, 'msgs'), 1]],
    ['chat10', '🗣️', 'Moteur de la classe', 'Envoyer 10 messages', 2, p => [st(p, 'msgs'), 10]],
    ['duel1', '⚔️', 'Duelliste', 'Jouer un duel de classe', 1, p => [st(p, 'duels'), 1]],
    ['duelWin', '🏆', 'Champion de la classe', 'Gagner un duel', 3, p => [st(p, 'duelWins'), 1]],
    ['game1', '🎮', 'Joueur', 'Terminer un mini-jeu', 1, p => [st(p, 'games'), 1]],
    ['game15', '🕹️', 'Accro à l’Arcade', 'Terminer 15 mini-jeux', 2, p => [st(p, 'games'), 15]],
    ['gamePerfect', '🧩', 'Parfait !', 'Faire un score parfait dans un mini-jeu', 3, p => [st(p, 'gamePerfect'), 1]],
    ['mic1', '🎧', 'Micro testé', 'Tester le micro anti-bruit', 1, p => [st(p, 'mic'), 1]],
    ['mascot', '✨', 'Meilleur ami de Kiki', 'Personnaliser Kiki', 1, p => [st(p, 'mascot'), 1]],
    ['world1', '🌍', 'Explorateur', 'Terminer une partie du Monde', 1, p => [st(p, 'worlds'), 1]],
    ['case3', '🕵️', 'Détective', 'Résoudre 3 enquêtes', 2, p => [st(p, 'cases'), 3]],
    ['team1', '🤝', 'Esprit d’équipe', 'Terminer une partie en équipe (coop, alliance ou rivalité)', 2, p => [st(p, 'teamGames'), 1]],
    ['boss1', '👹', 'Tueur de boss', 'Vaincre le Boss final', 3, p => [st(p, 'bossWins'), 1]],
    ['tour1', '🦜', 'Visiteur curieux', 'Faire la visite guidée avec Kiki', 1, p => [st(p, 'tour'), 1]],
    ['tourney1', '🏟️', 'Champion de tournoi', 'Gagner un tournoi complet', 4, p => [st(p, 'tournaments'), 1]]
  ].map(([id, emoji, title, desc, tier, f]) => ({ id, emoji, title, desc, tier, f }));
  const TIERS = ['', 'Bronze', 'Argent', 'Or', 'Diamant'], COL = ['', '#cd7f32', '#b8c4d6', '#ffd166', '#7cf0ff'];

  // ---------- Capacités spéciales : chaque badge débloqué donne un pouvoir rechargé chaque jour ----------
  const KINDS = {
    fifty: ['✂️', '50/50', 'Retire 2 mauvaises réponses.'], skip: ['⏭️', 'Passe-droit', 'Passe la question sans pénalité.'], time: ['⏳', 'Temps bonus', '+10 secondes sur la question.'],
    shield: ['🛡️', 'Bouclier', 'Ta prochaine erreur ne coûte rien.'], hint: ['💡', 'Indice', 'Révèle la première lettre et la longueur de la réponse.'], second: ['🔁', 'Seconde chance', 'Tu peux répondre une deuxième fois.'],
    xp2: ['✨', 'XP doublés', 'Cette question rapporte le double de XP.'], freeze: ['❄️', 'Gel du temps', 'Arrête le chronomètre sur cette question.'], revive: ['❤️', 'Soin', 'Récupère une vie (mode Survie / Monde).'], swap: ['🔀', 'Autre question', 'Remplace la question par une nouvelle.']
  };
  const KORDER = Object.keys(KINDS);
  C.forEach((b, i) => { b.power = KORDER[i % KORDER.length]; b.cap = b.tier >= 3 ? 2 : 1; });
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  function powers(p) {
    p.powers = p.powers && typeof p.powers === 'object' ? p.powers : {}; p.powers.c = p.powers.c || {};
    const got = new Set(p.achievements || []), t = today();
    if (p.powers.day !== t) { p.powers.day = t; C.forEach(b => { if (got.has(b.id)) p.powers.c[b.id] = Math.max(p.powers.c[b.id] || 0, b.cap); }); }
    C.forEach(b => { if (got.has(b.id) && p.powers.c[b.id] == null) p.powers.c[b.id] = b.cap; });
    return p.powers;
  }
  /** Liste des pouvoirs disponibles : [{id (badge), kind, icon, name, desc, charges}] */
  function usable(p) { const pw = powers(p); return C.filter(b => (pw.c[b.id] || 0) > 0).map(b => ({ id: b.id, badge: b.title, emoji: b.emoji, kind: b.power, icon: KINDS[b.power][0], name: KINDS[b.power][1], desc: KINDS[b.power][2], charges: pw.c[b.id] })); }
  function use(p, id) { const pw = powers(p); if ((pw.c[id] || 0) <= 0) return false; pw.c[id]--; return true; }
  function grant(p, n) { const pw = powers(p), got = C.filter(b => (p.achievements || []).includes(b.id)); if (!got.length) return false; const b = got[Math.floor(Math.random() * got.length)]; pw.c[b.id] = (pw.c[b.id] || 0) + (n || 1); return b; }

  function check(p) {
    p.achievements = p.achievements || []; const fresh = [];
    C.forEach(b => { if (!p.achievements.includes(b.id)) { let ok = false; try { const [c, t] = b.f(p); ok = c >= t; } catch (_) {} if (ok) { p.achievements.push(b.id); fresh.push(b); } } });
    if (fresh.length) powers(p);
    return fresh;
  }
  function wall(p) {
    const got = new Set(p.achievements || []);
    return `<div class="badge-wall">${C.map(b => { let c = 0, t = 1; try { [c, t] = b.f(p); } catch (_) {} const on = got.has(b.id), pct = Math.min(100, Math.round(c / t * 100));
      return `<div class="badge ${on ? 'on' : ''}" style="--bc:${COL[b.tier]}" title="${b.desc}"><span class="badge-emoji">${b.emoji}</span><strong>${b.title}</strong><small>${b.desc}</small><em>${TIERS[b.tier]}</em><span class="badge-power" title="${KINDS[b.power][2]}">${KINDS[b.power][0]} ${KINDS[b.power][1]}${on ? ' · ' + ((p.powers && p.powers.c && p.powers.c[b.id]) || 0) + '/' + b.cap : ' 🔒'}</span>${on ? '' : `<div class="progress-line"><span style="width:${pct}%"></span></div><small>${Math.min(c, t)}/${t}</small>`}</div>`; }).join('')}</div>`;
  }
  window.EABadges = { CATALOG: C, KINDS, check, wall, total: C.length, powers, usable, use, grant };
})();
