/* English Arena — EATour : visite guidée du site par Kiki + mode « explique-moi chaque bouton ».
 * Kiki marche jusqu'à l'élément, le met en lumière et l'explique (à voix haute si tu veux). */
(function () {
  'use strict';
  const A = () => window.EAApp, $ = s => document.querySelector(s), esc = v => (A() ? A().esc(v) : String(v));
  const VIEWS = {
    home: ['Vue d’ensemble', 'Ton tableau de bord : mission du jour, XP, série de jours et accès rapide aux entraînements.'],
    courses: ['Parcours & cours', 'Les 56 leçons du programme de Terminale + 18 ateliers. Ouvre une leçon, dis les exemples à voix haute, puis marque-la terminée.'],
    speak: ['Speaking Lab', '48 simulations de la vraie vie et 8 modes. Le partenaire te parle à voix haute, tu réponds au micro ou au clavier.'],
    vocab: ['Vocabulaire', 'Des cartes pour apprendre les mots : sens, exemple, prononciation. Marque ceux que tu maîtrises.'],
    practice: ['Quiz & examens', 'Quiz adaptatifs sans répétition (12 000+ questions), modes intenses, duels de classe et jeux d’arcade.'],
    world: ['Monde de l’anglais', 'Explore, mène des enquêtes, évite les pièges et affronte le Boss final. En solo, en équipe, en alliance ou en rivalité.'],
    community: ['Classe & discussion', 'Messages courts, classement de la classe et défi de la semaine.'],
    library: ['Bibliothèque', 'Les PDF du cours (avec ton code) et des ressources gratuites.'],
    profile: ['Mon profil & outils', 'Tes badges et leurs pouvoirs, réglages de voix, rappels, sauvegarde de tes données.']
  };
  const HELP = {
    'view': 'Ouvre une autre page du site.', 'close-modal': 'Ferme cette fenêtre.', 'logout': 'Change de profil sur cet appareil. Tes progrès restent enregistrés.',
    'chat-del': 'Supprime ton message de la discussion.', 'chat-report': 'Signale un message inapproprié au professeur.', 'community-post': 'Envoie ton message à la classe (220 caractères maximum).',
    'community-random': 'Propose une idée de phrase à envoyer.', 'community-challenge': 'Prépare un message pour relever le défi de la semaine.',
    'complete-day': 'Marque la leçon comme terminée et gagne 20 XP.', 'lesson-open': 'Ouvre la leçon : exemple à dire, vocabulaire et défi.', 'start-day': 'Commence la prochaine leçon du parcours.',
    'course-filter': 'Filtre les leçons par niveau ou révisions.', 'mini-course-open': 'Ouvre cet atelier complémentaire.', 'mini-course-complete': 'Termine l’atelier et gagne 10 XP.',
    'mini-course-example': 'Affiche ou masque une réponse modèle.', 'mini-course-hint': 'Ajoute cette phrase utile à ta réponse.', 'mini-course-speak': 'Écoute le modèle lu à voix haute.',
    'download-pdf': 'Télécharge ce PDF (avec ton code élève).', 'open-pdf': 'Ouvre ce PDF dans un nouvel onglet (avec ton code élève).',
    'duel-open': 'Ouvre le duel de classe en temps réel.', 'duel-menu': 'Retourne au menu du duel.', 'duel-create': 'Crée un duel : tu reçois un code à donner à tes camarades.', 'duel-join': 'Rejoins un duel avec son code à 4 lettres.',
    'duel-start': 'Lance le duel : les questions arrivent, les points sont calculés par le serveur.', 'duel-ans': 'Choisis ta réponse : plus tu es rapide, plus tu gagnes de points.', 'duel-leave': 'Quitte le duel.',
    'game-start': 'Lance ce mini-jeu de vocabulaire.', 'game-act': 'Joue ton coup dans le mini-jeu.',
    'exam-tips': 'Affiche la méthode pour réussir les épreuves de Terminale.', 'export-ics': 'Crée un rappel quotidien pour ton calendrier.', 'export-progress': 'Télécharge une sauvegarde de tes progrès (fichier JSON).', 'import-progress': 'Récupère une sauvegarde de tes progrès.',
    'insert-hint': 'Ajoute cette phrase utile dans ta réponse.', 'mission-start': 'Ouvre la mission du jour.', 'mission-done': 'Valide la mission et gagne des XP.', 'onboard-tab': 'Choisis entre créer un profil ou te reconnecter.',
    'phrase-list': 'Affiche tes phrases utiles sauvegardées.', 'save-phrase': 'Garde cette phrase dans ta collection.',
    'quiz-answer': 'Choisis cette réponse.', 'quiz-cfg': 'Règle ton quiz : mode, niveau, type de réponse, thème, nombre de questions.', 'quiz-exit': 'Quitte le quiz.', 'quiz-listen': 'Écoute la phrase à voix haute.', 'quiz-next': 'Passe à la question suivante.',
    'quiz-power': 'Utilise le pouvoir spécial d’un de tes badges (50/50, bouclier, indice…).', 'quiz-review-start': 'Rejoue tes questions ratées, au bon moment pour les retenir.', 'quiz-typed': 'Valide la réponse que tu as tapée.', 'start-quiz': 'Lance un quiz avec tes réglages.',
    'scenario-close': 'Termine la simulation.', 'scenario-mic': 'Parle en anglais : ta voix est transcrite en direct puis envoyée automatiquement.', 'scenario-open': 'Ouvre cette simulation.', 'scenario-restart': 'Recommence la simulation.', 'scenario-sample': 'Affiche un exemple de réponse.', 'scenario-send': 'Envoie ta réponse au partenaire.',
    'sim-voice': 'Active ou coupe la conversation vocale : le partenaire parle et le micro s’ouvre tout seul.', 'sim-stopvoice': 'Arrête la voix du partenaire et le micro.', 'sim-breathe': 'Un exercice de respiration de 10 secondes pour te calmer.', 'sim-listen': 'Le partenaire répète sa phrase à voix haute.', 'sim-modes': 'Change de mode de simulation.', 'simulation-mode': 'Choisis ce mode d’entraînement oral.', 'speak-daily': 'Un défi oral de 60 secondes.',
    'speak-text': 'Écoute ce texte en anglais à voix haute.', 'speech-stop': 'Arrête la voix et le micro.', 'speech-test': 'Teste la voix anglaise avec un long texte.', 'show-cloud-guide': 'Explique comment activer le mode classe en ligne.', 'toggle-reminder': 'Active ou coupe le rappel quotidien.',
    'tour-start': 'Lance la visite guidée avec Kiki.', 'tour-explain': 'Mode « explique-moi » : clique sur un bouton pour que Kiki te dise à quoi il sert.', 'tour-next': 'Étape suivante.', 'tour-prev': 'Étape précédente.', 'tour-stop': 'Quitte la visite.', 'tour-voice': 'Active ou coupe la lecture à voix haute.',
    'vocab-flip': 'Retourne la carte pour voir la traduction.', 'vocab-known': 'Marque le mot comme maîtrisé.', 'vocab-next': 'Mot suivant.', 'vocab-pick': 'Ouvre ce mot.', 'vocab-prev': 'Mot précédent.', 'vocab-shuffle': 'Mélange les cartes.', 'vocab-speak': 'Écoute le mot.', 'vocab-toggle': 'Coche ou décoche « mot maîtrisé ».',
    'voice-play': 'Réécoute ton enregistrement.', 'voice-rec': 'Enregistre ta voix pour t’écouter.', 'voice-test': 'Teste ton micro : le filtre anti-bruit se règle sur ta pièce.'
  };
  const PREFIX = { 'world-': 'Action du Monde de l’anglais : explore, joue ou prépare ton équipe.', 'tourn-': 'Gère le tournoi : manches, matchs et classement.', 'kiki-': 'Action de Kiki la mascotte.' };
  const NAMEHELP = { menuToggle: 'Ouvre ou ferme le menu.', profileShortcut: 'Ouvre ton profil.', installButton: 'Installe English Arena comme une application sur ton appareil.', modalClose: 'Ferme cette fenêtre.' };
  function describe(el) {
    if (!el) return null;
    const b = el.closest('[data-action],[data-view],#menuToggle,#profileShortcut,#installButton,#modalClose,.nav-item,.mobile-nav button'); if (!b) return null;
    if (b.dataset.view && (!b.dataset.action || b.dataset.action === 'view')) { const v = VIEWS[b.dataset.view]; return v ? { el: b, title: v[0], text: v[1] } : { el: b, title: b.textContent.trim(), text: 'Ouvre cette page.' }; }
    if (b.id && NAMEHELP[b.id]) return { el: b, title: b.textContent.trim() || b.getAttribute('aria-label') || 'Bouton', text: NAMEHELP[b.id] };
    const a = b.dataset.action; let t = HELP[a]; if (!t) for (const k in PREFIX) if (a && a.startsWith(k)) t = PREFIX[k];
    return { el: b, title: (b.textContent || b.getAttribute('aria-label') || a || 'Bouton').replace(/\s+/g, ' ').trim().slice(0, 40), text: t || 'Ce bouton fait avancer l’activité en cours.' };
  }

  let T = null, voiceOn = true, spot = null, card = null, explainOn = false, banner = null;
  const STEPS = [
    { title: 'Bienvenue ! 🦜', text: 'Je suis Kiki ! Je vais te faire visiter English Arena en quelques étapes. Tu peux m’arrêter à tout moment.' },
    { sel: '.nav-item[data-view="home"]', view: 'home', title: 'Vue d’ensemble', text: VIEWS.home[1] },
    { sel: '.nav-item[data-view="courses"]', view: 'courses', title: 'Parcours & cours', text: VIEWS.courses[1] },
    { sel: '.nav-item[data-view="speak"]', view: 'speak', title: 'Speaking Lab', text: VIEWS.speak[1] },
    { sel: '.arcade-grid', view: 'speak', title: 'Les modes de simulation', text: 'Guidé, Examen, Calme, Chrono, Débat, Shadowing, Histoire, Surprise : chaque mode change vraiment la façon de s’entraîner.' },
    { sel: '.nav-item[data-view="vocab"]', view: 'vocab', title: 'Vocabulaire', text: VIEWS.vocab[1] },
    { sel: '#flashcard', view: 'vocab', title: 'La carte de vocabulaire', text: 'Touche la carte pour la retourner. Le bouton « Écouter » lit le mot à voix haute.' },
    { sel: '.nav-item[data-view="practice"]', view: 'practice', title: 'Quiz & examens', text: VIEWS.practice[1] },
    { sel: '[data-action="start-quiz"]', view: 'practice', title: 'Lancer un quiz', text: 'Choisis le mode, le niveau (ou « Auto »), le type de réponse et le thème, puis lance. Tu ne reverras pas deux fois la même question.' },
    { sel: '.nav-item[data-view="world"]', view: 'world', title: 'Monde de l’anglais', text: VIEWS.world[1] },
    { sel: '.nav-item[data-view="community"]', view: 'community', title: 'Classe & discussion', text: VIEWS.community[1] },
    { sel: '.nav-item[data-view="library"]', view: 'library', title: 'Bibliothèque', text: VIEWS.library[1] },
    { sel: '.streak-card', view: 'home', title: 'Ton élan', text: 'Étudie chaque jour pour allonger ta série. Même quelques minutes comptent !' },
    { sel: '.nav-item[data-view="profile"]', view: 'profile', title: 'Mon profil & outils', text: VIEWS.profile[1] },
    { sel: '.badge-wall', view: 'profile', title: 'Badges et pouvoirs', text: 'Chaque badge débloqué te donne un pouvoir spécial, rechargé chaque jour : 50/50, bouclier, indice, seconde chance… Utilise-les dans les quiz et dans le Monde.' },
    { title: 'À toi de jouer ! 🎉', text: 'Clique sur moi quand tu veux : je peux te refaire la visite ou t’expliquer chaque bouton avec le mode « Explique-moi les boutons ».' }
  ];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  function ensureUI() {
    if (!spot) { spot = document.createElement('div'); spot.className = 'tour-spot'; spot.hidden = true; document.body.appendChild(spot); }
    if (!card) { card = document.createElement('div'); card.className = 'tour-card'; card.hidden = true; document.body.appendChild(card); }
  }
  async function show(i) {
    if (!T) return; T.i = Math.max(0, Math.min(STEPS.length - 1, i)); const st = STEPS[T.i]; ensureUI();
    if (window.EASpeech) EASpeech.stop();
    if (st.view && A()) { A().view(st.view); await wait(450); }
    document.querySelector('#sidebar') && document.querySelector('#sidebar').classList.add('open');
    let el = st.sel ? $(st.sel) : null;
    if (el && el.getBoundingClientRect().width === 0) el = null;
    if (el) { try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {} await wait(350); }
    if (el) { const r = el.getBoundingClientRect(); Object.assign(spot.style, { left: r.left - 6 + 'px', top: r.top - 6 + 'px', width: r.width + 12 + 'px', height: r.height + 12 + 'px' }); spot.hidden = false; } else spot.hidden = true;
    card.hidden = false;
    card.innerHTML = `<div class="roleplay-header"><span class="pill purple">VISITE · ${T.i + 1}/${STEPS.length}</span><button class="text-button" data-action="tour-voice">${voiceOn ? '🔊 Voix activée' : '🔇 Voix coupée'}</button></div><h3>${esc(st.title)}</h3><p>${esc(st.text)}</p><div class="button-row"><button class="ghost-button" data-action="tour-prev" ${T.i === 0 ? 'disabled' : ''}>← Précédent</button><button class="primary-button" data-action="tour-next">${T.i === STEPS.length - 1 ? 'Terminer ✓' : 'Suivant →'}</button><button class="text-button" data-action="tour-stop">Quitter</button></div>`;
    if (window.EAMascot && EAMascot.isReady()) { if (el) await EAMascot.moveTo(el); else EAMascot.home(); EAMascot.setMood('talk', 1500); }
    if (voiceOn && window.EASpeech) EASpeech.sayFr(st.title + '. ' + st.text);
  }
  function start() { if (!A() || !A().getProgress()) return; stopExplain(); T = { i: 0 }; show(0); }
  function stop() {
    T = null; if (spot) spot.hidden = true; if (card) card.hidden = true; if (window.EASpeech) EASpeech.stop();
    const sb = $('#sidebar'); if (sb) sb.classList.remove('open'); if (window.EAMascot) EAMascot.home();
    try { A().bump('tour'); } catch (_) {}
  }
  // ---------- mode explication ----------
  function intercept(e) {
    if (!explainOn) return; if (e.target.closest('.tour-explain-banner,.tour-card,.kiki-widget')) return;
    const d = describe(e.target); if (!d) return; e.preventDefault(); e.stopPropagation();
    const r = d.el.getBoundingClientRect(); ensureUI(); Object.assign(spot.style, { left: r.left - 5 + 'px', top: r.top - 5 + 'px', width: r.width + 10 + 'px', height: r.height + 10 + 'px' }); spot.hidden = false; spot.style.boxShadow = '0 0 0 3px var(--cyan),0 0 22px var(--cyan)';
    const msg = d.title + ' : ' + d.text;
    if (window.EAMascot && EAMascot.isReady()) { EAMascot.moveTo(d.el).then(() => EAMascot.say(msg, 9000, true)); } else A().toast(msg);
    if (window.EASpeech && voiceOn) EASpeech.sayFr(msg);
  }
  document.addEventListener('click', intercept, true);
  function explain(on) {
    if (on === false) return stopExplain(); stop(); explainOn = true; document.body.classList.add('tour-explain-on');
    if (!banner) { banner = document.createElement('div'); banner.className = 'tour-explain-banner'; banner.innerHTML = '❓ Clique sur n’importe quel bouton : Kiki t’explique <button class="primary-button" data-action="tour-stop" style="padding:4px 12px">Terminer</button>'; document.body.appendChild(banner); }
    banner.hidden = false; if (window.EAMascot) EAMascot.say('Clique sur un bouton et je viens t’expliquer ce qu’il fait ! 🦜', 5000, true);
  }
  function stopExplain() { explainOn = false; document.body.classList.remove('tour-explain-on'); if (banner) banner.hidden = true; if (spot) { spot.hidden = true; spot.style.boxShadow = ''; } }
  function action(a) {
    if (a === 'tour-start') return start(); if (a === 'tour-explain') return explain(true);
    if (a === 'tour-next') { if (!T) return; if (T.i >= STEPS.length - 1) { stop(); if (window.EAMascot) EAMascot.react('say', { text: 'Bravo, tu connais tout le site ! 🎉', force: true }); return; } return show(T.i + 1); }
    if (a === 'tour-prev') return T && show(T.i - 1);
    if (a === 'tour-stop') { stopExplain(); return stop(); }
    if (a === 'tour-voice') { voiceOn = !voiceOn; if (!voiceOn && window.EASpeech) EASpeech.stop(); if (T) show(T.i); return; }
  }
  window.EATour = { start, stop, explain, action, describe, HELP, VIEWS, STEPS };
})();
