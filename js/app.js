(function () {
  'use strict';
  const $ = (selector, root=document) => root.querySelector(selector);
  const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
  const DATA = window.EA_DATA;
  const PROFILE_KEY = 'ea_profiles_v1';
  const ACTIVE_KEY = 'ea_active_v1';
  const COMMUNITY_KEY = 'ea_community_v1';
  const PROGRESS_PREFIX = 'ea_progress_v1_';
  let activeView = 'home';
  let profile = null;
  let progress = null;
  let courseFilter = 'all';
  let courseSearch = '';
  let vocabIndex = 0;
  let vocabFlipped = false;
  let quizSession = null;
  let scenarioId = null;
  let scenarioTurn = 0;
  let scenarioHistory = [];
  let deferredInstallPrompt = null;
  let saveTimer = null;
  let toastTimer = null;
  let classStatsCache = null;
  let classStatsFetched = false;
  let quizStartTime = 0;
  let simulationMode = 'guided';
  let voiceGuard = { enabled: true, level: 'medium', meter: 0 };

  const defaultProgress = () => ({
    xp: 0, completedDays: [], completedMiniCourses: [], completedMissions: [], knownWords: [], reviewWords: {}, notes: '',
    streak: 0, lastStudyDate: '', studyMinutes: 0, goalMinutes: 30, quizHistory: [], achievements: [], stats: {}, games: {}, simHistory: [], simMode: 'guided',
    savedPhrases: [], reminder: { enabled: false, time: '19:00', notificationAsked: false },
    level: 'mixte', totalAnswers: 0, correctAnswers: 0, lastMissionDate: ''
  });
  const getProfiles = () => safeJSON(localStorage.getItem(PROFILE_KEY), []);
  function safeJSON(value, fallback) { try { return value ? JSON.parse(value) : fallback; } catch (_) { return fallback; } }
  function randomId() { return 'ea-' + Array.from(crypto.getRandomValues(new Uint8Array(8))).map(x=>x.toString(16).padStart(2,'0')).join(''); }
  async function hashText(text) {
    try { const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); return [...new Uint8Array(buffer)].map(b=>b.toString(16).padStart(2,'0')).join(''); }
    catch (_) { return btoa(unescape(encodeURIComponent(text))).replace(/[^a-z0-9]/gi,'').slice(0,64); }
  }
  function todayKey(date=new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
  function getCommunityMessages() { return safeJSON(localStorage.getItem(COMMUNITY_KEY), []).slice(0, 30); }
  function addCommunityMessage(text, author = profile ? profile.name : 'Classe') {
    const clean = String(text || '').trim(); if (!clean || clean.length > 220) return;
    const cur = getCommunityMessages(); cur.unshift({ id: null, author, body: clean.slice(0, 220), createdAt: new Date().toISOString() });
    localStorage.setItem(COMMUNITY_KEY, JSON.stringify(cur.slice(0, 30)));
  }
  function getLeaderBoard() {
    return getProfiles().map(p => { const d = getLocalProgress(p.id); return { name: p.name, xp: Number(d.xp || 0), streak: Number(d.streak || 0), lessons: (d.completedDays || []).length }; }).sort((a, b) => b.xp - a.xp || b.streak - a.streak).slice(0, 5);
  }
  function escapeHTML(value='') { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function shuffle(items) { const array=[...items]; for(let i=array.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[array[i],array[j]]=[array[j],array[i]];} return array; }
  function formatNum(n) { return new Intl.NumberFormat('fr-FR').format(n || 0); }
  function isCloudMode() { return window.EACloud && window.EACloud.isEnabled(); }
  const COURSE_PDF='English_for_Terminale_Cours_Complet_56_jours.pdf';
  function getWeekPDF(week) { return `weekly/Semaine_${week}_Jours_${String((week-1)*7+1).padStart(2,'0')}-${String(week*7).padStart(2,'0')}.pdf`; }
  function getLocalProgress(id) { return safeJSON(localStorage.getItem(PROGRESS_PREFIX+id), defaultProgress()); }
  function storeProfiles(profiles) { localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles)); }
  function storeActiveProfile(p) { profile=p; localStorage.setItem(ACTIVE_KEY,p.id); }
  function saveNow() {
    if (!profile || !progress) return;
    try { localStorage.setItem(PROGRESS_PREFIX+profile.id, JSON.stringify(progress)); } catch(e) { toast('Le stockage local semble plein. Exporte tes données dans Profil.'); }
    updateChrome();
    if (profile.mode === 'supabase' && isCloudMode() && navigator.onLine) {
      window.EACloud.saveProgress(progress).then(()=>setConnectionLabel('Synchronisé')).catch(()=>setConnectionLabel('Sauvegarde locale · sync à réessayer'));
    }
  }
  function saveSoon() {
    if (!profile || !progress) return;
    try { localStorage.setItem(PROGRESS_PREFIX+profile.id, JSON.stringify(progress)); } catch(e) { toast('Stockage local plein : exporte une sauvegarde.'); }
    updateChrome();
    if (profile.mode === 'supabase' && isCloudMode()) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        if (navigator.onLine) window.EACloud.saveProgress(progress).then(()=>setConnectionLabel('Synchronisé')).catch(()=>setConnectionLabel('Mode local · sync à réessayer'));
      }, 18000);
    }
  }
  function touchStudy(minutes=2) {
    const now=todayKey(), yesterday=todayKey(new Date(Date.now()-86400000));
    if (progress.lastStudyDate !== now) {
      progress.streak = progress.lastStudyDate === yesterday ? (progress.streak||0)+1 : 1;
      progress.lastStudyDate = now;
    }
    progress.studyMinutes=(progress.studyMinutes||0)+minutes;
    saveSoon();
  }
  function addXP(points, reason) { progress.xp=(progress.xp||0)+points; if(points) toast(`+${points} XP · ${reason || 'Bien joué !'}`); checkAchievements(); saveSoon(); if(window.EAMascot)EAMascot.update(progress); mascot('xp'); }
  const mascot=(ev,d)=>{try{window.EAMascot&&EAMascot.react(ev,d)}catch(_){}};
  function bump(k,n=1){progress.stats=progress.stats||{};progress.stats[k]=(progress.stats[k]||0)+n;checkAchievements();saveSoon();}
  function checkAchievements() {
    const fresh=window.EABadges?EABadges.check(progress):[];
    fresh.forEach(b=>{toast(`🏅 Badge débloqué : ${b.title}`);mascot('badge',{text:`Badge « ${b.title} » ${b.emoji} — bravo !`});});
  }
  function toast(message) {
    const node=$('#toast'); node.textContent=message; node.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>node.classList.remove('show'),2800);
  }
  function setConnectionLabel(label) { const el=$('#connectionLabel'); if(el) el.textContent=label; const footer=$('#footerMode'); if(footer) footer.textContent=label; }
  function updateChrome() {
    if (!profile || !progress) return;
    $('#topAvatar').textContent=(profile.name||'?').trim().charAt(0).toUpperCase()||'?';
    $('#sidebarStreak').textContent=`${progress.streak||0} jour${progress.streak===1?'':'s'}`;
    $('#streakFill').style.width=`${Math.min(100,(progress.streak||0)/7*100)}%`;
    $('#connectionLabel').textContent=profile.mode==='supabase'?(navigator.onLine?'Cloud prêt':'Hors ligne · données locales'):'Mode hors ligne prêt';
    $('#onlineText').textContent=profile.mode==='supabase'?(navigator.onLine?'CLOUD SYNC':'OFFLINE'):'LOCAL-FIRST';updateOnline();
    $('#footerMode').textContent=profile.mode==='supabase'?'Les progrès se synchronisent quand la connexion est disponible.':'Tes progrès restent sur cet appareil en mode local.';
  }
  function openModal(html) { $('#modalContent').innerHTML=html; $('#modalBackdrop').hidden=false; document.body.style.overflow='hidden'; }
  function closeModal() { if(window.EAVoice)EAVoice.close(); if(window.EASim)EASim.stop(); if(window.EAGames)EAGames.stop(); if(window.EADuel)EADuel.leave(); $('#modalBackdrop').hidden=true; document.body.style.overflow=''; $('#modalContent').innerHTML=''; }
  function setView(view) {
    activeView=view;
    $$('.nav-item[data-view], .mobile-nav button[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
    const labels={home:'Vue d’ensemble',courses:'Parcours & cours',speak:'Speaking Lab',vocab:'Vocabulaire',practice:'Quiz & examens',community:'Classe & discussion',library:'Bibliothèque',profile:'Mon profil & outils'};
    $('#currentPageLabel').textContent=labels[view]||'English Arena';
    mascot('view',{view});
    $('#sidebar').classList.remove('open');
    renderView();
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function renderView() {
    if (!progress || !profile) return;
    const container=$('#viewContainer');
    const views={home:renderHome,courses:renderCourses,speak:renderSpeak,vocab:renderVocab,practice:renderPractice,community:renderCommunity,library:renderLibrary,profile:renderProfile};
    container.innerHTML=(views[activeView]||renderHome)();
    if (activeView==='home' && profile.mode==='supabase' && isCloudMode()) loadCloudExtras();
    if(window.EAMascot)EAMascot.update(progress);
    if(!window.__helloDone){window.__helloDone=1;setTimeout(()=>mascot('hello'),1200);}
    if(chatCloud())startRealtime();
    if (activeView==='community') { loadChat(); stopChatPolling(); if(chatCloud()) chatTimer=setInterval(()=>{if(!document.hidden)loadChat();},30000); } else stopChatPolling();
    if (activeView==='vocab') renderVocabCard();
    if (activeView==='practice' && quizSession) renderQuizSession();
    if (activeView==='profile' && profile.mode==='supabase' && isCloudMode() && !classStatsFetched) {
      classStatsFetched = true; window.EACloud.stats().then(stats => { classStatsCache = stats; const count = $('#classCountValue'); if(count) count.textContent = formatNum(stats?.students_total || 0); const caption = $('#classCountCaption'); if(caption) caption.textContent = `${formatNum(stats?.active_7_days || 0)} actif(s) au cours des 7 derniers jours. Statistiques de la classe, sans afficher les noms.`; }).catch(() => { classStatsFetched=false; const count=$('#classCountValue'); if(count) count.textContent='—'; const caption=$('#classCountCaption'); if(caption) caption.textContent='Connexion cloud nécessaire pour actualiser ce compteur.'; });
    }
  }

  async function openPDF(path,download){
    if(!isCloudMode()||!profile||profile.mode!=='supabase'){toast('Les PDF sont réservés aux élèves connectés avec leur code individuel.');return;}
    if(!navigator.onLine){toast('Connexion Internet nécessaire pour ouvrir ce PDF.');return;}
    const w=download?null:window.open('','_blank');
    try{const url=await window.EACloud.fileUrl(path,download);if(w)w.location.href=url;else window.location.href=url;}
    catch(e){if(w)w.close();toast('PDF indisponible : '+(e.message||'réessaie plus tard.'));}
  }
  let extrasCache=null,extrasAt=0;
  async function loadCloudExtras(){
    try{
      if(!extrasCache||Date.now()-extrasAt>60000){const [ann,lb]=await Promise.all([window.EACloud.announcements(),window.EACloud.leaderboard()]);extrasCache={ann,lb};extrasAt=Date.now();}
      if(activeView!=='home'||$('#cloudExtras'))return;
      const hero=$('#viewContainer .hero-grid');if(!hero)return;
      const me=(profile.name||'').toLowerCase();
      const ann=(extrasCache.ann||[]).map(a=>`<div class="notice blue" style="margin-bottom:10px"><strong>${a.is_pinned?'📌 ':'📣 '}${escapeHTML(a.title)}</strong><br>${escapeHTML(a.body)}<br><small>${new Date(a.created_at).toLocaleDateString('fr-FR')}</small></div>`).join('');
      const medals=['🥇','🥈','🥉'];
      const lb=(extrasCache.lb||[]).map((r,i)=>`<div class="journey-item"><div class="journey-day">${medals[i]||i+1}</div><div class="journey-copy"><strong>${escapeHTML(r.display_name)}${r.display_name.toLowerCase()===me?' (toi)':''}</strong><small>${formatNum(r.xp)} XP · ${r.lessons} leçon(s) terminée(s)</small></div></div>`).join('');
      hero.insertAdjacentHTML('beforebegin',`<div id="cloudExtras">${ann}${lb?`<div class="card panel-pad" style="margin-bottom:16px"><div class="section-head"><div><h3>🏆 Classement de la classe</h3><p>Les 10 élèves les plus réguliers. Un peu de motivation entre amis !</p></div></div><div class="journey-list">${lb}</div></div>`:''}</div>`);
    }catch(e){}
  }
  function pageHeading(eyebrow,title,desc,extra='') { return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${desc}</p></div>${extra?`<div class="button-row">${extra}</div>`:''}</div>`; }
  function currentMission() { const d=new Date(); const n=Math.floor((new Date(d.getFullYear(),d.getMonth(),d.getDate())-new Date(d.getFullYear(),0,0))/86400000); return DATA.missionBank[n%DATA.missionBank.length]; }
  function renderHome() {
    const completed=progress.completedDays.length, percent=Math.round(completed/DATA.curriculum.length*100), mission=currentMission();
    const next=DATA.curriculum.find(l=>!progress.completedDays.includes(l.day))||DATA.curriculum[55];
    const recently=DATA.curriculum.filter(l=>progress.completedDays.includes(l.day)).slice(-3).reverse();
    const journey= recently.length ? recently.map(l=>`<div class="journey-item"><div class="journey-day">✓</div><div class="journey-copy"><strong>${escapeHTML(l.title)}</strong><small>Jour ${l.day} · Semaine ${l.week}</small></div><span class="journey-status">TERMINÉ</span></div>`).join('') : `<div class="journey-item"><div class="journey-day">01</div><div class="journey-copy"><strong>Commence ton parcours de 56 jours</strong><small>Une petite séance aujourd'hui, une grande différence demain.</small></div><button class="text-button" data-action="start-day" data-day="${next.day}">Démarrer ↗</button></div>`;
    return `${pageHeading('TON ESPACE D’APPRENTISSAGE',`Hey ${escapeHTML(profile.name.split(' ')[0])}, ready to <em>level up?</em>`,'Progresse à ton rythme. Le plus important n’est pas d’être parfait dès aujourd’hui, mais d’oser pratiquer un peu plus chaque jour.',`<button class="ghost-button" data-action="view" data-view="courses">Voir le parcours ↗</button>`)}
      <section class="hero-grid"><div class="card welcome-hero"><div class="hero-stamp"><span>✦</span> YOUR ENGLISH JOURNEY</div><h2>Less fear.<br><em>More English.</em></h2><p>Apprends les notions utiles en Terminale, entraîne-toi à parler et construis une vraie confiance — le tout avec une expérience pensée pour les connexions limitées.</p><div class="hero-buttons"><button class="primary-button" data-action="view" data-view="speak">◖ &nbsp;Parler maintenant</button><button class="ghost-button" data-action="view" data-view="practice">Lancer un quiz ↗</button></div><div class="hero-footnote">56 LEÇONS · 18 ATELIERS BONUS · SIMULATIONS GUIDÉES</div></div>
      <div class="card daily-card"><div class="daily-top"><span>MISSION DU JOUR</span><div class="daily-number">✦</div></div><h3>${escapeHTML(mission.title)}</h3><p>${escapeHTML(mission.desc)}</p><div class="mission-meta"><span>⏱ 5–10 min</span><span>Récompense <strong>+${mission.points} XP</strong></span></div><button class="primary-button" data-action="mission-start">Accepter la mission ↗</button></div></section>
      <section class="stats-grid"><div class="card stat-card"><div class="stat-top">XP gagnés <span class="stat-icon">✦</span></div><strong class="stat-number">${formatNum(progress.xp)}</strong><div class="stat-bottom"><span>Ton effort compte</span><em>● En progression</em></div></div><div class="card stat-card"><div class="stat-top">Leçons terminées <span class="stat-icon">▤</span></div><strong class="stat-number">${completed}<small style="font-size:13px;color:#8791b1"> / 56</small></strong><div class="stat-bottom"><span>Programme Terminale</span><em>${percent}%</em></div></div><div class="card stat-card"><div class="stat-top">Mots maîtrisés <span class="stat-icon">Aa</span></div><strong class="stat-number">${progress.knownWords.length}</strong><div class="stat-bottom"><span>Vocabulaire actif</span><em>À retenir</em></div></div><div class="card stat-card"><div class="stat-top">Série actuelle <span class="stat-icon">♨</span></div><strong class="stat-number">${progress.streak||0}<small style="font-size:13px;color:#8791b1"> j</small></strong><div class="stat-bottom"><span>Reviens demain</span><em>Régularité</em></div></div></section>
      <section class="two-column"><div class="card panel-pad"><div class="section-head"><div><h3>Ton parcours récent</h3><p>Chaque pas te rapproche de ton objectif.</p></div><button class="text-button" data-action="view" data-view="courses">Les 56 jours ↗</button></div><div class="journey-list">${journey}</div><div class="progress-card" style="padding:18px 0 0"><h3>Programme de Terminale</h3><p>${completed===0?'Tout commence par une première leçon.':`Tu as terminé ${completed} leçon${completed>1?'s':''}. Continue sans te mettre la pression.`}</p><div class="progress-line"><span style="width:${percent}%"></span></div><div class="progress-label"><span>${completed} / 56 jours</span><span>${percent}%</span></div></div></div>
      <div class="right-stack"><div class="card progress-card"><div class="section-head"><h3>Les compétences</h3><span class="pill purple">TON PLAN</span></div><p>Travaille toutes les compétences pour devenir plus à l'aise à l'oral comme à l'écrit.</p><div class="skill-chips"><span>Speaking</span><span>Grammar</span><span>Vocabulary</span><span>Listening</span><span>Writing</span><span>Terminale</span></div></div><div class="card progress-card"><div class="section-head"><h3>Le meilleur réflexe</h3><span>✧</span></div><p>Dis tes phrases à voix haute avant de regarder la correction. La confiance vient aussi en parlant quand on n'est pas encore parfait.</p><button class="secondary-button" style="width:100%" data-action="view" data-view="speak">Ouvrir Speaking Lab ↗</button></div></div></section>
      <div class="section-title"><h3>Choisis ton prochain entraînement</h3><span>Courtes séances · progression mesurable</span></div><section class="course-grid"><article class="card course-card"><div class="course-meta"><span class="course-icon">◖</span><span class="pill green">ORAL</span></div><h3>Simulation de conversation</h3><p>Entraîne-toi à te présenter, débattre et répondre en anglais dans des situations réalistes.</p><div class="course-end"><span>Sans IA obligatoire</span><button class="text-button" data-action="view" data-view="speak">Commencer ↗</button></div></article><article class="card course-card"><div class="course-meta"><span class="course-icon">✳</span><span class="pill purple">QUIZ</span></div><h3>Test de 10 questions</h3><p>Repère tes erreurs, comprends pourquoi une réponse est correcte et progresse étape par étape.</p><div class="course-end"><span>5–8 minutes</span><button class="text-button" data-action="start-quiz">Jouer ↗</button></div></article><article class="card course-card"><div class="course-meta"><span class="course-icon">Aa</span><span class="pill orange">MÉMOIRE</span></div><h3>Réviser le vocabulaire</h3><p>Apprends les mots du programme grâce aux cartes, exemples et révisions personnelles.</p><div class="course-end"><span>${DATA.vocab.length} mots</span><button class="text-button" data-action="view" data-view="vocab">Réviser ↗</button></div></article></section>`;
  }
  function renderCourses() {
    const lessons=DATA.curriculum.filter(l=>(courseFilter==='all'||(courseFilter==='review'?l.isReview:courseFilter===`week${l.week}`?true:(courseFilter===l.level))) && (!courseSearch || `${l.title} ${l.goal} ${l.theme}`.toLowerCase().includes(courseSearch.toLowerCase())));
    const extras=DATA.extraCourses.filter(c=>!courseSearch||`${c.title} ${c.track} ${c.objective} ${c.explanation}`.toLowerCase().includes(courseSearch.toLowerCase()));
    const filters=[['all','Tout le programme'],['A1–A2','Débutant'],['A2–B1','Intermédiaire'],['B1–B2','Terminale+'],['review','Révisions']];
    const completedExtra=progress.completedMiniCourses||[];
    return `${pageHeading('LE PARCOURS',`Build your <em>English.</em>`,'Le cours intensif de 56 jours fourni avec ton ZIP, complété par des objectifs clairs et des activités pratiques. Chaque leçon renvoie aussi au PDF hebdomadaire pour retrouver le cours complet.',`<button class="secondary-button" data-action="open-pdf" data-path="${COURSE_PDF}">Ouvrir le cours complet ↗</button>`)}
      <div class="notice blue" style="margin-bottom:15px"><strong>Conseil de connexion :</strong> les leçons et quiz intégrés se chargent sans bibliothèque externe. Les PDF ne sont téléchargés que lorsque tu les ouvres; une fois visités, le navigateur peut les garder en cache pour une lecture hors ligne.</div>
      <div class="filter-bar"><input class="search-field" id="courseSearch" placeholder="Rechercher un cours ou une notion…" value="${escapeHTML(courseSearch)}"><div class="button-row">${filters.map(([v,label])=>`<button class="filter-chip ${courseFilter===v?'active':''}" data-action="course-filter" data-filter="${v}">${label}</button>`).join('')}</div></div>
      <div class="section-head"><div><h3>56 leçons · 8 semaines</h3><p>${lessons.length} leçon${lessons.length>1?'s':''} affichée${lessons.length>1?'s':''} · coche celles que tu termines.</p></div><span class="pill">${progress.completedDays.length}/56 TERMINÉES</span></div>
      <div class="lesson-list">${lessons.map(l=>`<article class="lesson-row"><div class="lesson-index">${String(l.day).padStart(2,'0')}</div><div class="lesson-main"><strong>${escapeHTML(l.title)}</strong><p>${escapeHTML(l.goal)}</p><div class="lesson-tags"><span class="pill">Semaine ${l.week}</span><span class="pill">${l.level}</span>${l.isReview?'<span class="pill orange">Révision</span>':''}${progress.completedDays.includes(l.day)?'<span class="pill green">✓ Terminée</span>':''}</div></div><div class="lesson-actions"><button class="ghost-button" data-action="lesson-open" data-day="${l.day}">Étudier</button></div></article>`).join('')||'<div class="empty-state"><strong>Aucun résultat</strong><p>Essaie avec un autre mot-clé ou un autre niveau.</p></div>'}</div>
      <div class="section-head" style="margin-top:28px"><div><h3>${DATA.extraCourses.length} ateliers complémentaires</h3><p>De courtes leçons guidées pour parler, réussir l’oral, expliquer un sujet scientifique et écrire avec plus de clarté.</p></div><span class="pill green">${completedExtra.length}/${DATA.extraCourses.length} TERMINÉS</span></div>
      <div class="course-grid">${extras.map((c,i)=>`<article class="card course-card"><div class="course-meta"><span class="course-icon">${['◖','↗','Aa','⚙','✳'][i%5]}</span><span class="pill ${completedExtra.includes(c.id)?'green':c.level==='B1–B2'?'purple':'orange'}">${completedExtra.includes(c.id)?'TERMINÉ':escapeHTML(c.level)}</span></div><h3>${escapeHTML(c.title)}</h3><p>${escapeHTML(c.objective)}</p><div class="course-end"><span>${escapeHTML(c.track)}</span><button class="text-button" data-action="mini-course-open" data-course="${c.id}">Ouvrir ↗</button></div></article>`).join('')||'<div class="empty-state"><strong>Aucun atelier trouvé</strong><p>Essaie avec un autre mot-clé.</p></div>'}</div>`;
  }
  function renderSpeak() {
    return `${pageHeading('SPEAKING LAB',`Use English. <em>Out loud.</em>`,'Le meilleur entraînement est celui qui t’aide à prendre la parole. Choisis un scénario, réponds avec tes propres mots et compare ton idée à un modèle. Tout le scénario fonctionne hors ligne.',`<button class="secondary-button" data-action="speak-daily">Défi oral de 60 s ↗</button>`)}
      <div class="notice blue" style="margin-bottom:17px"><strong>La règle d’or :</strong> parle avant de chercher la phrase parfaite. Le bouton « Écouter » utilise la synthèse vocale disponible sur l'appareil. Le micro dépend du navigateur; certains navigateurs transmettent la reconnaissance vocale en ligne. Tu peux toujours écrire ta réponse à la place.</div>
      <div class="section-head"><div><h3>Choisis ton mode</h3><p>8 façons de t’entraîner : chaque mode change vraiment le déroulement.</p></div><span class="pill green">${EASim.MODES.find(m=>m.id===EASim.mode()).label.toUpperCase()}</span></div><div class="arcade-grid" style="margin-bottom:22px">${EASim.MODES.map(m=>`<button class="card game-card" style="text-align:left;${EASim.mode()===m.id?'border-color:var(--mint);box-shadow:0 0 0 1px var(--mint) inset':''}" data-action="simulation-mode" data-mode="${m.id}"><span class="game-ico">${m.icon}</span><strong>${m.label}</strong><small>${m.desc}</small></button>`).join('')}</div>
      <div class="speaking-layout"><div><div class="section-head"><div><h3>Simulations de la vraie vie</h3><p>Des débuts guidés vers des réponses plus riches.</p></div><span class="pill green">${DATA.simulations.length} SCÉNARIOS</span></div><div class="scenario-grid">${DATA.simulations.map((s,i)=>`<article class="card scenario-card"><div class="scenario-top"><span class="scenario-symbol">${(['☻','↗','◇','◎','⇄','⚙','⌁','◖','✚','✈','🍽','💼','☎','🎤','🛠','🔭'][i]||['💬','🗣️','🎯','🌍','📞','🧠','🎓','🤝'][i%8])}</span><span class="pill ${s.level==='B1–B2'?'purple':'green'}">${s.level}</span></div><h3>${escapeHTML(s.title)}</h3><p>${escapeHTML(s.setting)}</p><div class="scenario-bottom"><span>⏱ ${s.duration}</span><button class="text-button" data-action="scenario-open" data-scenario="${s.id}">S'entraîner ↗</button></div></article>`).join('')}</div></div>
      <aside class="speaking-aside"><div class="card"><h3>Une méthode en 4 étapes</h3><p>Ne cherche pas à parler vite. Cherche à transmettre ton idée.</p><div class="tip-row"><span class="tip-bullet">1</span><div><strong>Think</strong><small>Prends cinq secondes pour organiser ton idée.</small></div></div><div class="tip-row"><span class="tip-bullet">2</span><div><strong>Speak</strong><small>Réponds en anglais même avec des phrases simples.</small></div></div><div class="tip-row"><span class="tip-bullet">3</span><div><strong>Improve</strong><small>Repère une chose à améliorer, pas dix.</small></div></div><div class="tip-row"><span class="tip-bullet">4</span><div><strong>Repeat</strong><small>Refais la réponse avec une phrase plus claire.</small></div></div></div><div class="card"><h3>Useful phrases</h3><p>Enregistre les phrases qui t’aident à débloquer une conversation.</p><div class="hint-list"><span class="hint-chip">Could you repeat that?</span><span class="hint-chip">In my opinion…</span><span class="hint-chip">I see your point, but…</span><span class="hint-chip">Let me think for a moment.</span></div><button class="ghost-button" style="width:100%" data-action="phrase-list">Mes phrases sauvées (${progress.savedPhrases.length})</button></div><div class="card"><h3>Ressources gratuites</h3><p>Des activités structurées sont proposées par le British Council. Ouvre-les quand tu as une connexion disponible.</p><a class="text-button" href="https://learnenglish.britishcouncil.org/free-resources/speaking" target="_blank" rel="noopener">British Council Speaking ↗</a></div></aside></div>`;
  }
  function renderVocab() {
    const known=progress.knownWords.length;
    return `${pageHeading('VOCABULARY BUILDER',`Words become <em>power.</em>`,'Apprends le vocabulaire de la Terminale en contexte : sens, exemple et révision active. Essaie de créer une phrase personnelle avec chaque mot.',`<button class="ghost-button" data-action="vocab-shuffle">Mélanger les cartes ↻</button>`)}
      <div class="vocab-layout"><section><div class="card flashcard-stage"><div><div class="flashcard" id="flashcard" data-action="vocab-flip" role="button" tabindex="0" aria-label="Retourner la carte"><small id="flashcardLabel">ENGLISH WORD</small><h2 id="flashcardWord">${escapeHTML(DATA.vocab[vocabIndex].word)}</h2><p id="flashcardTranslation">Appuie pour révéler la traduction et un exemple.</p><div class="tap-note" id="flashcardHint">TOUCHER POUR RETOURNER ↻</div></div><div class="flashcard-nav"><button class="round-button" data-action="vocab-prev" aria-label="Mot précédent">←</button><span class="tiny" id="flashcardCount">1 / ${DATA.vocab.length}</span><button class="round-button" data-action="vocab-next" aria-label="Mot suivant">→</button></div></div></div><div class="button-row" style="justify-content:center;margin-top:12px"><button class="secondary-button" data-action="vocab-speak">🔊 Écouter le mot</button><button class="primary-button" data-action="vocab-known">✓ Je le connais</button></div><p class="tiny" style="text-align:center;margin-top:10px">Marque un mot comme maîtrisé seulement si tu peux le comprendre et le réutiliser.</p></section>
      <aside class="right-stack"><div class="card progress-card"><div class="section-head"><h3>Mon vocabulaire</h3><span class="pill green">${known}/${DATA.vocab.length}</span></div><div class="progress-line"><span style="width:${known/DATA.vocab.length*100}%"></span></div><div class="progress-label"><span>Mots maîtrisés</span><span>${Math.round(known/DATA.vocab.length*100)}%</span></div><p style="margin-top:12px">Revois un mot demain, puis trois jours plus tard et une semaine après. Ce petit rythme renforce la mémoire.</p></div><div class="card panel-pad"><div class="section-head"><div><h3>Liste des mots</h3><p>Appuie sur un mot pour le revoir.</p></div></div><input class="search-field" style="max-width:none;margin-bottom:11px" id="vocabSearch" placeholder="Chercher un mot…"><div class="vocab-list" id="vocabList">${renderVocabList()}</div></div></aside></div>`;
  }
  function renderVocabList(filter='') {
    const words=DATA.vocab.filter(v=>!filter||`${v.word} ${v.fr}`.toLowerCase().includes(filter.toLowerCase())).slice(0,18);
    return words.map(v=>`<div class="vocab-row"><button class="text-button" style="padding:0" data-action="vocab-pick" data-id="${v.id}"><div class="vocab-word"><strong>${escapeHTML(v.word)}</strong><small>${escapeHTML(v.fr)}</small></div></button><button class="known-mark ${progress.knownWords.includes(v.id)?'active':''}" data-action="vocab-toggle" data-id="${v.id}" aria-label="Marquer ${escapeHTML(v.word)} comme connu">✓</button></div>`).join('')||'<p class="tiny">Aucun mot trouvé.</p>';
  }
  function renderVocabCard() {
    const word=DATA.vocab[vocabIndex]; if(!word)return;
    $('#flashcardLabel').textContent=vocabFlipped?word.type.toUpperCase():'ENGLISH WORD';
    $('#flashcardWord').textContent=vocabFlipped?word.fr:word.word;
    $('#flashcardTranslation').textContent=vocabFlipped?word.example:'Appuie pour révéler la traduction et un exemple.';
    $('#flashcardHint').textContent=vocabFlipped?'RETOURNER ↻':'TOUCHER POUR RETOURNER ↻';
    $('#flashcardCount').textContent=`${vocabIndex+1} / ${DATA.vocab.length}`;
    $('#vocabList').innerHTML=renderVocabList($('#vocabSearch')?.value||'');
  }
  const CHALLENGES=['Parle 60 secondes en anglais sans lire, puis écris ce que tu as dit.','Présente ton meilleur ami en 5 phrases.','Décris ta journée d’hier au past simple.','Donne 3 conseils pour réussir l’oral du bac.','Explique ton plat préféré à quelqu’un qui ne le connaît pas.','Dis 5 phrases avec « I would like to… ».','Raconte un souvenir de vacances en anglais.','Donne ton avis : les téléphones en classe, pour ou contre ?'];
  function weeklyChallenge(){const d=new Date();const w=Math.floor((d-new Date(d.getFullYear(),0,1))/604800000);return CHALLENGES[w%CHALLENGES.length];}
  let chatTimer=null,classRoom=null,onlineCount=0,chatLoadAt=0;
  function startRealtime(){
    if(classRoom||!chatCloud())return;classRoom='pending';
    window.EACloud.openRoom('ea-class-v1',{
      onMessage:m=>{if(m.t==='chat'&&activeView==='community'&&Date.now()-chatLoadAt>1500){chatLoadAt=Date.now();loadChat();}else if(m.t==='news'){extrasCache=null;if(activeView==='home'){const e=$('#cloudExtras');if(e)e.remove();loadCloudExtras();}mascot('say',{text:'📣 Nouvelle annonce de ton professeur !',force:true});}},
      onPresence:l=>{onlineCount=l.length;updateOnline();}
    }).then(r=>{classRoom=r;}).catch(()=>{classRoom=null;setTimeout(()=>{if(!classRoom)classRoom=null;},0);});
  }
  function updateOnline(){const el=$('#onlineText');if(el&&onlineCount>1&&navigator.onLine&&profile&&profile.mode==='supabase')el.textContent=`👥 ${onlineCount} EN LIGNE`;}
  function stopChatPolling(){clearInterval(chatTimer);chatTimer=null;}
  function chatCloud(){return isCloudMode()&&profile&&profile.mode==='supabase';}
  function chatItem(m){const t=new Date(m.created_at||m.createdAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});const d=new Date(m.created_at||m.createdAt).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'});
    const action=m.id&&chatCloud()?(m.mine?`<button class="text-button" data-action="chat-del" data-id="${escapeHTML(m.id)}">Supprimer</button>`:`<button class="text-button" data-action="chat-report" data-id="${escapeHTML(m.id)}">Signaler</button>`):'';
    return `<div class="journey-item"><div class="journey-day">${escapeHTML((m.author||'C').charAt(0).toUpperCase())}</div><div class="journey-copy"><strong>${escapeHTML(m.author||'Classe')}${m.mine?' (toi)':''}</strong><small>${escapeHTML(m.body||m.text)}</small></div><div style="text-align:right"><span class="pill">${d} ${t}</span><br>${action}</div></div>`;}
  async function loadChat(){
    const list=$('#chatList');if(!list||activeView!=='community')return;
    try{
      if(chatCloud()){const [msgs,lb]=await Promise.all([window.EACloud.messages(),window.EACloud.leaderboard()]);
        if(activeView!=='community')return;
        const l=$('#chatList');if(l)l.innerHTML=msgs.length?msgs.map(chatItem).join(''):'<div class="empty-state"><strong>Aucun message</strong><p>Sois le premier à écrire quelque chose de positif !</p></div>';
        const c=$('#chatCount');if(c)c.textContent=`${msgs.length} message${msgs.length>1?'s':''}`;
        const lbEl=$('#lbList');if(lbEl)lbEl.innerHTML=lb.slice(0,5).map((e,i)=>`<div class="journey-item"><div class="journey-day">${i+1}</div><div class="journey-copy"><strong>${escapeHTML(e.display_name)}</strong><small>${formatNum(e.xp)} XP · ${e.lessons} leçons</small></div>${i===0?'<span class="pill green">LEADER</span>':''}</div>`).join('')||'<p>Pas encore de classement.</p>';
      }
    }catch(e){const l=$('#chatList');if(l)l.innerHTML='<div class="notice">Messages indisponibles (connexion ?). Réessaie dans un instant.</div>';}
  }
  function renderCommunity() {
    const cloud=chatCloud();
    const local=getCommunityMessages(), lb=getLeaderBoard();
    const challenge=weeklyChallenge();
    const lbHTML=cloud?'<div id="lbList"><p>Chargement…</p></div>':lb.map((e,i)=>`<div class="journey-item"><div class="journey-day">${i+1}</div><div class="journey-copy"><strong>${escapeHTML(e.name)}</strong><small>${formatNum(e.xp)} XP · ${e.streak} jours de série · ${e.lessons} leçons</small></div>${i===0?'<span class="pill green">LEADER</span>':''}</div>`).join('');
    return `${pageHeading('COMMUNITY','Talk. <em>Share.</em>','Une mini-salle de classe : messages courts (220 caractères), classement et défi de la semaine. Reste positif et respectueux.')}
      ${cloud?'':'<div class="notice" style="margin-bottom:14px"><strong>Mode local :</strong> les messages restent sur cet appareil. Active le cloud pour discuter avec toute la classe.</div>'}
      <div class="two-column">
        <div class="card panel-pad"><div class="section-head"><div><h3>Défi de la semaine</h3><p>Change automatiquement chaque semaine.</p></div><span class="pill green">NEW</span></div>
          <div class="notice blue" style="margin-bottom:12px"><strong>🎯</strong> ${escapeHTML(challenge)}</div>
          <div class="button-row"><button class="primary-button" data-action="community-challenge">Je relève le défi</button><button class="ghost-button" data-action="view" data-view="speak">Ouvrir Speaking Lab</button></div></div>
        <div class="card panel-pad"><div class="section-head"><div><h3>Classement</h3><p>Le top de la motivation.</p></div><span class="pill purple">XP</span></div><div class="journey-list">${lbHTML}</div></div>
      </div>
      <div class="card panel-pad" style="margin-top:18px"><div class="section-head"><div><h3>Discussion rapide</h3><p>Message bref, positif, utile. Tu peux signaler un message qui ne va pas.</p></div><span class="pill" id="chatCount">${cloud?'…':local.length+' messages'}</span></div>
        <textarea id="communityInput" class="response-area" rows="3" placeholder="Pose une question, donne une idée, ou envoie une phrase motivante…" maxlength="220"></textarea>
        <div class="button-row" style="margin:12px 0 16px"><button class="primary-button" data-action="community-post">Envoyer à la classe</button><button class="ghost-button" data-action="community-random">Idée de phrase</button></div>
        <div class="journey-list" id="chatList">${cloud?'<p>Chargement…</p>':(local.length?local.map(chatItem).join(''):'<div class="empty-state"><strong>Aucun message</strong></div>')}</div></div>`;
  }
  function renderPractice() {
    return renderPracticeBase()+(quizSession?'':`<div class="section-title" style="margin-top:26px"><h3>⚔️ Duel de classe · temps réel</h3><span>Toute la classe en même temps</span></div><div class="card panel-pad"><p>Crée un duel et donne le code à tes camarades (ou rejoins celui de ton prof). Mêmes questions pour tous, classement en direct, rien n’est enregistré.</p><div class="button-row"><button class="primary-button" data-action="duel-open">Ouvrir le duel</button></div></div><div class="section-title" style="margin-top:26px"><h3>🎮 Arcade du vocabulaire</h3><span>6 jeux · records personnels</span></div><div class="arcade-grid">${EAGames.cardsHTML()}</div>`);
  }
  function renderPracticeBase() {
    return `${pageHeading('TRAINING GROUND',`Practise. <em>Get sharper.</em>`,'Des quiz pour vérifier ta grammaire et ton vocabulaire, comprendre tes erreurs et préparer les épreuves de Terminale.',`<button class="primary-button" data-action="start-quiz">✳ Démarrer un quiz</button>`)}
      ${quizSession?'<div id="quizLiveHost"></div>':`<div class="course-grid"><article class="card course-card"><div class="course-meta"><span class="course-icon">⚡</span><span class="pill purple">RAPIDE</span></div><h3>Quiz mixte · 10 questions</h3><p>Un entraînement rapide mêlant grammaire, vocabulaire et communication. Chaque erreur reçoit une explication.</p><div class="course-end"><span>5–8 minutes · + XP</span><button class="text-button" data-action="start-quiz">Jouer ↗</button></div></article><article class="card course-card"><div class="course-meta"><span class="course-icon">▤</span><span class="pill green">GRAMMAR</span></div><h3>Grammaire ciblée</h3><p>Concentre-toi sur les temps verbaux, les conditionnels, le passif et le discours rapporté.</p><div class="course-end"><span>Réponses expliquées</span><button class="text-button" data-action="start-quiz" data-category="Grammar">S'entraîner ↗</button></div></article><article class="card course-card"><div class="course-meta"><span class="course-icon">Aa</span><span class="pill orange">EXAMEN</span></div><h3>Stratégie d'examen</h3><p>Apprends à lire les consignes, structurer un paragraphe, organiser un essai et vérifier tes réponses.</p><div class="course-end"><span>Méthode Terminale</span><button class="text-button" data-action="exam-tips">Voir les conseils ↗</button></div></article></div>
      <div class="section-title"><h3>Derniers résultats</h3><span>${progress.quizHistory.length} quiz terminé${progress.quizHistory.length===1?'':'s'}</span></div><div class="card panel-pad">${progress.quizHistory.length?`<div class="journey-list">${progress.quizHistory.slice(-5).reverse().map(q=>`<div class="journey-item"><div class="journey-day">${q.score}%</div><div class="journey-copy"><strong>${escapeHTML(q.label||'Quiz mixte')}</strong><small>${new Date(q.date).toLocaleDateString('fr-FR')} · ${q.correct}/${q.total} bonnes réponses</small></div><span class="pill ${q.score>=80?'green':'orange'}">${q.score>=80?'SOLIDE':'À REVOIR'}</span></div>`).join('')}</div>`:'<div class="empty-state"><strong>Ton premier score t’attend</strong><p>Termine un quiz pour identifier tes points forts et les notions à réviser.</p><button class="primary-button" data-action="start-quiz">Lancer le premier quiz</button></div>'}</div>`}`;
  }
  function renderQuizSession() {
    const host=$('#quizLiveHost'); if(!host||!quizSession)return;
    if (quizSession.finished) { host.innerHTML=renderQuizResults(); return; }
    const q=quizSession.questions[quizSession.index];
    if(!q) { host.innerHTML=renderQuizResults(); return; }
    const chosen=quizSession.answers[quizSession.index];
    const answered=chosen!==undefined;
    host.innerHTML=`<div class="quiz-layout"><section class="card quiz-main"><div class="quiz-meta"><span class="pill purple">${escapeHTML(q.category)}</span><span class="tiny">Question ${quizSession.index+1} / ${quizSession.questions.length}</span></div><div class="quiz-progress"><span style="width:${quizSession.index/quizSession.questions.length*100}%"></span></div><h2 class="quiz-question">${escapeHTML(q.question)}</h2><div class="answer-list">${q.options.map((o,i)=>`<button class="answer-option ${answered&&i===q.answer?'correct':''} ${answered&&i===chosen&&chosen!==q.answer?'incorrect':''}" data-action="quiz-answer" data-answer="${i}" ${answered?'disabled':''}><span class="option-letter">${String.fromCharCode(65+i)}</span><span>${escapeHTML(o)}</span>${answered&&i===q.answer?'<b style="margin-left:auto;color:var(--mint)">✓</b>':''}</button>`).join('')}</div><div class="quiz-feedback ${answered?'show':''}"><strong>${answered?(chosen===q.answer?'Correct! Nice work.':'Not quite — learn from it.'):'Feedback'}</strong><p>${answered?escapeHTML(q.explanation):''}</p></div><div class="quiz-bottom"><button class="ghost-button" data-action="quiz-exit">Quitter</button>${answered?`<button class="primary-button" data-action="quiz-next">${quizSession.index+1===quizSession.questions.length?'Voir mon score':'Question suivante →'}</button>`:'<span class="tiny">Choisis une réponse pour continuer.</span>'}</div></section><aside class="quiz-side"><div class="card"><h3>Le réflexe gagnant</h3><p>Lis toute la phrase avant de choisir. Cherche l'indice grammatical (temps, sujet, connecteur) plutôt que de deviner.</p></div><div class="card"><h3>Ton score de session</h3><div class="result-score" style="font-size:35px">${quizSession.correct}</div><p>Bonne${quizSession.correct===1?'':'s'} réponse${quizSession.correct===1?'':'s'} jusqu'ici.</p></div><div class="card"><h3>Mode faible connexion</h3><p>Les questions sont intégrées au site : aucun appel réseau n’est nécessaire pour les faire.</p></div></aside></div>`;
  }
  function renderQuizResults() {
    const total=quizSession.questions.length, correct=quizSession.correct, score=Math.round(correct/total*100);
    return `<div class="card quiz-main" style="text-align:center"><span class="pill green">SESSION TERMINÉE</span><h2 style="font-size:26px;margin:20px 0 8px">Good work — tu as terminé !</h2><div class="result-score">${score}%</div><p>${correct}/${total} bonnes réponses. ${score>=80?'Très bon travail. Continue à consolider ces acquis.':score>=50?'Tu progresses. Relis les explications des questions ratées et refais un quiz demain.':'C’est un point de départ. Revois une petite leçon puis réessaie.'}</p><div class="progress-line" style="max-width:420px;margin:20px auto"><span style="width:${score}%"></span></div><div class="button-row" style="justify-content:center"><button class="primary-button" data-action="start-quiz">Refaire un quiz ↻</button><button class="ghost-button" data-action="quiz-exit">Retour aux entraînements</button></div><div class="section-title" style="text-align:left"><h3>À revoir</h3><span>Réponses expliquées</span></div><div class="journey-list" style="text-align:left">${quizSession.questions.map((q,i)=>{const a=quizSession.answers[i];return `<div class="journey-item"><div class="journey-day" style="background:${a===q.answer?'#8cf0ce14':'#ff8e9d10'};color:${a===q.answer?'var(--mint)':'var(--bad)'}">${a===q.answer?'✓':'↻'}</div><div class="journey-copy"><strong>${escapeHTML(q.question)}</strong><small>Ta réponse : ${escapeHTML(q.options[a])} · Réponse : ${escapeHTML(q.options[q.answer])}<br>${escapeHTML(q.explanation)}</small></div></div>`;}).join('')}</div></div>`;
  }
  function renderLibrary() {
    const files=[{name:'Cours complet · English for Terminale',detail:'317 pages · programme de 56 jours',path:COURSE_PDF,size:'PDF'},...Array.from({length:8},(_,i)=>({name:`Semaine ${i+1} · ${DATA.weekThemes[i]}`,detail:`Jours ${String(i*7+1).padStart(2,'0')}–${String(i*7+7).padStart(2,'0')} · format léger par semaine`,path:getWeekPDF(i+1),size:'PDF'}))];
    return `${pageHeading('BIBLIOTHÈQUE',`Your learning <em>toolbox.</em>`,'Tes documents de Terminale et des ressources gratuites sélectionnées pour travailler les quatre compétences. Les contenus téléchargés restent sur ton appareil selon la politique de cache du navigateur.',`<button class="secondary-button" data-action="open-pdf" data-path="${COURSE_PDF}">Ouvrir le cours complet ↗</button>`)}
      <div class="section-title"><h3>Documents du cours (réservés aux élèves connectés)</h3><span>1 cours complet + 8 supports hebdomadaires</span></div><div class="card">${files.map(f=>`<div class="file-row"><div class="file-icon">${f.size}</div><div class="file-details"><strong>${escapeHTML(f.name)}</strong><small>${escapeHTML(f.detail)}</small></div><button class="text-button" data-action="open-pdf" data-path="${f.path}">Ouvrir ↗</button><button class="text-button" data-action="download-pdf" data-path="${f.path}">Télécharger ↓</button></div>`).join('')}</div>
      <div class="section-title"><h3>Ressources gratuites sélectionnées</h3><span>Connexion nécessaire pour ces sites externes</span></div><div class="library-grid">${DATA.resources.map((r,i)=>`<article class="card resource-card"><div class="resource-icon">${['◖','Aa','✳','▣'][i]}</div><div><span class="pill">${escapeHTML(r.tag)}</span><h3 style="margin-top:9px">${escapeHTML(r.title)}</h3><p>${escapeHTML(r.desc)}</p><a class="text-button" href="${r.url}" target="_blank" rel="noopener">Ouvrir la ressource ↗</a></div></article>`).join('')}</div>
      <div class="notice" style="margin-top:16px"><strong>Respect des ressources :</strong> le site conserve les PDF que tu as fournis et ajoute des exercices originaux. Les ressources externes restent la propriété de leurs éditeurs; ouvre-les sur leur site officiel.</div>`;
  }
  function renderProfile() {
    const unlocked=progress.achievements||[];
    const badges=[['firstLesson','📘','Premier pas','Terminer une leçon'],['week1','🧭','Une semaine','Terminer 7 leçons'],['word10','🔤','Mots en poche','Maîtriser 10 mots'],['quiz80','🎯','Précision','Atteindre 80 % à un quiz'],['streak7','🔥','Une vraie série','Étudier 7 jours de suite'],['phrase5','💬','Voix confiante','Sauver 5 phrases utiles']];
    return `${pageHeading('TON PROFIL',`Own your <em>progress.</em>`,"Gère tes préférences, protège tes données et exporte une sauvegarde de tes progrès avant de changer d’appareil.",`<button class="secondary-button" data-action="export-progress">↓ Exporter une sauvegarde</button>`)}
      <div class="profile-grid"><section class="card profile-card"><div class="profile-id"><div class="profile-avatar">${escapeHTML(profile.name.charAt(0).toUpperCase())}</div><div><h3>${escapeHTML(profile.name)}</h3><p>${profile.mode==='supabase'?'Compte avec synchronisation cloud':'Profil local sur cet appareil'} · Depuis ${new Date(profile.createdAt).toLocaleDateString('fr-FR')}</p></div></div><div class="settings-row"><div><strong>Mon niveau préféré</strong><small>Les leçons restent accessibles à tous les niveaux.</small></div><select id="levelSelect" class="select-field"><option value="mixte" ${progress.level==='mixte'?'selected':''}>Mixte</option><option value="debutant" ${progress.level==='debutant'?'selected':''}>Débutant</option><option value="intermediaire" ${progress.level==='intermediaire'?'selected':''}>Intermédiaire</option><option value="avance" ${progress.level==='avance'?'selected':''}>Avancé</option></select></div><div class="settings-row"><div><strong>Mon objectif journalier</strong><small>Choisis une durée réaliste pour rester régulier.</small></div><select id="goalSelect" class="select-field"><option value="15" ${progress.goalMinutes===15?'selected':''}>15 minutes</option><option value="30" ${progress.goalMinutes===30?'selected':''}>30 minutes</option><option value="45" ${progress.goalMinutes===45?'selected':''}>45 minutes</option><option value="60" ${progress.goalMinutes===60?'selected':''}>60 minutes</option></select></div><div class="settings-row"><div><strong>Rappels dans le navigateur</strong><small>Notification locale quand tu reviens sur l’app. Ce n’est pas un SMS.</small></div><button class="toggle ${progress.reminder.enabled?'on':''}" data-action="toggle-reminder" aria-label="Activer les rappels locaux"></button></div><div class="settings-row"><div><strong>Heure souhaitée</strong><small>Heure locale approximative du rappel.</small></div><input id="reminderTime" class="form-field" style="max-width:125px" type="time" value="${escapeHTML(progress.reminder.time||'19:00')}"></div><div class="button-row" style="margin-top:17px"><button class="primary-button" data-action="export-progress">Exporter les données JSON</button><button class="ghost-button" data-action="import-progress">Importer une sauvegarde</button><button class="ghost-button" data-action="export-ics">Ajouter au calendrier (.ics)</button><input id="importFile" type="file" accept="application/json" hidden></div><div style="margin-top:15px"><button class="ghost-button danger-button" data-action="logout">Changer de profil sur cet appareil</button></div></section>
      <div class="right-stack"><section class="card profile-card"><div class="section-head"><h3>Mes badges</h3><span class="pill orange">${unlocked.length}/${window.EABadges?EABadges.total:0}</span></div>${window.EABadges?EABadges.wall(progress):''}</section><section class="card profile-card"><div class="section-head"><h3>Confidentialité & compte</h3><span class="pill">À SAVOIR</span></div>${isCloudMode()?`<div class="notice blue"><strong>Mode cloud prêt.</strong> Les codes individuels sont vérifiés par Supabase et les progrès sont synchronisés lorsque la connexion est disponible.</div>`:`<div class="notice"><strong>Mode local activé.</strong> Tes progrès sont enregistrés uniquement dans le navigateur de cet appareil. Pour valider des codes différents par élève, compter la classe sur plusieurs appareils et synchroniser les progrès, configure le backend optionnel dans <code>docs/CLOUD_SETUP.md</code>.</div>`}<div class="settings-row"><div><strong>Profil local</strong><small>Nom et progrès sauvegardés sur cet appareil.</small></div><span class="pill green">ACTIF</span></div><div class="settings-row"><div><strong>Connexion réseau</strong><small>Leçons, cartes et quiz fonctionnent sans requêtes réseau.</small></div><span class="pill green">ÉCONOME</span></div><div class="settings-row"><div><strong>Rappels SMS</strong><small>Non activés : nécessite un service côté serveur et un budget SMS.</small></div><span class="pill orange">PHASE 2</span></div></section><section class="card profile-card"><div class="section-head"><h3>${profile.mode==='supabase'?'Compteur de la classe':'Compteur local'}</h3><span class="pill purple">${profile.mode==='supabase'?'CLOUD':'CET APPAREIL'}</span></div><strong class="stat-number" id="classCountValue">${profile.mode==='supabase'?'…':getProfiles().length}</strong><p class="tiny" id="classCountCaption">${profile.mode==='supabase'?'Chargement du compteur de classe…':'Nombre de profils enregistrés dans ce navigateur, pas le nombre réel d’élèves. Le compteur partagé nécessite le cloud.'}</p><button class="ghost-button" style="width:100%" data-action="show-cloud-guide">Voir les étapes cloud ↗</button></section></div></div>`;
  }
  function renderOnboarding() {
    const wrap=$('#onboardingFormWrap');
    if (isCloudMode()) {
      wrap.innerHTML=`<form id="cloudLoginForm" class="onboarding-form"><label class="field-label" for="cloudCode">Ton code individuel</label><input class="form-field" id="cloudCode" autocomplete="off" placeholder="EA-XXXX-XXXX-XXXX-XXXX" required minlength="12"><label class="field-label" for="cloudName">Ton prénom ou pseudo</label><input class="form-field" id="cloudName" autocomplete="nickname" maxlength="32" placeholder="Ex. Awa" required><button class="primary-button" style="width:100%;margin-top:15px" type="submit">Entrer dans l’arène ↗</button></form>`;
    } else {
      const profiles=getProfiles();
      wrap.innerHTML=`<div class="notice blue" style="margin:15px 0"><strong>Mode de démonstration hors ligne.</strong> Crée ton profil sur cet appareil. Pour des codes privés vérifiés et un compteur commun à toute la classe, le guide cloud est inclus dans le ZIP.</div><div class="onboarding-tabs"><button class="filter-chip active" data-action="onboard-tab" data-tab="create">Créer un profil</button><button class="filter-chip" data-action="onboard-tab" data-tab="login">J’ai déjà un profil ici (${profiles.length})</button></div><div id="onboardTabContent">${renderCreateProfileForm()}</div>`;
    }
  }
  function renderCreateProfileForm() { return `<form id="createProfileForm"><label class="field-label" for="newName">Ton prénom ou pseudo</label><input id="newName" class="form-field" maxlength="32" placeholder="Ex. Awa" autocomplete="nickname" required><label class="field-label" for="newPin">Code PIN local (4 à 12 caractères)</label><input id="newPin" class="form-field" type="password" minlength="4" maxlength="12" placeholder="Choisis ton code secret sur cet appareil" autocomplete="new-password" required><label class="field-label" for="newPinConfirm">Confirme ton code PIN</label><input id="newPinConfirm" class="form-field" type="password" minlength="4" maxlength="12" placeholder="Répète le code" autocomplete="new-password" required><button class="primary-button" style="width:100%;margin-top:16px" type="submit">Créer mon espace personnel ↗</button></form>`; }
  function renderLocalLoginForm() {
    const profiles=getProfiles();
    return `<form id="localLoginForm"><label class="field-label" for="localProfile">Profil sur cet appareil</label><select class="form-field" id="localProfile" required>${profiles.map(p=>`<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)}</option>`).join('')}</select><label class="field-label" for="localPin">Code PIN</label><input id="localPin" type="password" class="form-field" minlength="4" maxlength="12" placeholder="Ton code PIN" required autocomplete="current-password"><button class="primary-button" type="submit" style="width:100%;margin-top:16px">Se connecter ↗</button></form>`;
  }
  async function createLocalProfile(name,pin) {
    const profiles=getProfiles();
    const normalized=name.trim().replace(/\s+/g,' ');
    if (normalized.length<2) throw new Error('Choisis un pseudo d’au moins deux caractères.');
    if (profiles.some(p=>p.name.toLowerCase()===normalized.toLowerCase())) throw new Error('Ce pseudo existe déjà sur cet appareil. Choisis-en un autre.');
    const p={id:randomId(),name:normalized,pinHash:await hashText(pin),createdAt:new Date().toISOString(),mode:'local'};
    profiles.push(p);storeProfiles(profiles);storeActiveProfile(p);progress=defaultProgress();saveNow();
    $('#onboardingBackdrop').hidden=true;document.body.style.overflow='';setConnectionLabel('Mode hors ligne prêt');setView('home');toast(`Bienvenue ${p.name} ! Ton espace est prêt.`);
  }
  async function loginLocal(id,pin) {
    const p=getProfiles().find(x=>x.id===id);if(!p)throw new Error('Profil introuvable.');
    if(await hashText(pin)!==p.pinHash)throw new Error('Code PIN incorrect.');
    storeActiveProfile(p);progress=getLocalProgress(p.id);$('#onboardingBackdrop').hidden=true;document.body.style.overflow='';setView('home');toast(`Content de te revoir, ${p.name} !`);
  }
  async function cloudLogin(code,name) {
    if(!navigator.onLine) throw new Error('La première connexion cloud nécessite Internet. Ensuite, tes contenus restent utilisables hors ligne.');
    const remote=await window.EACloud.login(code,name);
    const profiles=getProfiles();
    let p=profiles.find(x=>x.id===remote.id);
    if(!p) { p={...remote,pinHash:null};profiles.push(p); }
    else { p.name=remote.name||name; p.mode='supabase';p.cloudId=remote.cloudId; }
    p.mode='supabase'; p.cloudId=remote.cloudId; p.name=remote.name||name; p.createdAt=p.createdAt||remote.createdAt;
    storeProfiles(profiles);storeActiveProfile(p);
    progress=getLocalProgress(p.id);
    try { const remoteState=await window.EACloud.loadProgress(); if(remoteState && typeof remoteState==='object'){progress={...defaultProgress(),...remoteState};localStorage.setItem(PROGRESS_PREFIX+p.id,JSON.stringify(progress));} }
    catch(e) { console.warn('Cloud state load skipped:',e.message); }
    $('#onboardingBackdrop').hidden=true;document.body.style.overflow='';setView('home');saveNow();toast(`Bienvenue dans la classe, ${p.name} !`);
  }
  function showOnboarding() { renderOnboarding();$('#onboardingBackdrop').hidden=false;document.body.style.overflow='hidden'; }
  function showLesson(day) {
    const l=DATA.curriculum.find(x=>x.day===Number(day));if(!l)return;
    const done=progress.completedDays.includes(l.day);
    openModal(`<div class="eyebrow">SEMAINE ${l.week} · JOUR ${String(l.day).padStart(2,'0')}</div><h2>${escapeHTML(l.title)}</h2><p>${escapeHTML(l.goal)}</p><div class="lesson-example"><small>EXEMPLE À DIRE À VOIX HAUTE</small>${escapeHTML(l.example)} <button class="text-button" data-action="speak-text" data-text="${escapeHTML(l.example)}">🔊 Écouter</button></div><h3>Ton vocabulaire de départ</h3><div class="hint-list">${l.vocabulary.map(w=>`<span class="hint-chip">${escapeHTML(w)}</span>`).join('')}</div><h3>Défi de compréhension</h3><p>Sans regarder le cours complet, explique cette notion avec tes propres mots. Donne un exemple anglais et crée une phrase personnelle.</p><div class="notice blue"><strong>Plan de 10 minutes :</strong> 2 min pour relire la règle, 3 min pour dire les exemples, 3 min pour inventer une phrase et 2 min pour répondre à haute voix.</div><h3>Document complet de la semaine</h3><p>Le PDF contient les explications détaillées et exercices corrigés de cette leçon.</p><div class="button-row"><button class="secondary-button" data-action="open-pdf" data-path="${l.pdf}">Ouvrir le PDF semaine ${l.week} ↗</button><button class="ghost-button" data-action="open-pdf" data-path="${COURSE_PDF}">Cours complet ↗</button></div><div class="button-row" style="margin-top:18px"><button class="primary-button" data-action="complete-day" data-day="${l.day}">${done?'Leçon terminée ✓':'Marquer comme terminée · +20 XP'}</button><button class="ghost-button" data-action="scenario-open" data-scenario="oral">Pratiquer à l’oral ↗</button></div>`);
  }
  function completeDay(day) {
    day=Number(day);if(!progress.completedDays.includes(day)){progress.completedDays.push(day);progress.completedDays.sort((a,b)=>a-b);touchStudy(10);addXP(20,`Jour ${day} terminé`);mascot('lesson');}else toast('Cette leçon est déjà terminée.');
    closeModal();setView('courses');
  }
  function openMiniCourse(id) {
    const c=DATA.extraCourses.find(x=>x.id===id); if(!c)return;
    const done=(progress.completedMiniCourses||[]).includes(c.id);
    openModal(`<div class="eyebrow">${escapeHTML(c.track)} · ${escapeHTML(c.level)}</div><h2>${escapeHTML(c.title)}</h2><p>${escapeHTML(c.objective)}</p><div class="lesson-example"><small>THE KEY IDEA</small>${escapeHTML(c.explanation)}</div><h3>Useful phrases — utilise celles qui t’aident</h3><div class="hint-list">${c.phrases.map(phrase=>`<button class="hint-chip" data-action="mini-course-hint" data-hint="${escapeHTML(phrase)}">${escapeHTML(phrase)}</button>`).join('')}</div><h3>Your challenge</h3><p>${escapeHTML(c.challenge)}</p><label class="field-label" for="miniCourseDraft">Prépare ta réponse ou ton plan (facultatif)</label><textarea id="miniCourseDraft" class="response-area" rows="4" placeholder="Write your answer in English…"></textarea><div class="button-row" style="margin-top:10px"><button class="secondary-button" data-action="mini-course-speak" data-course="${c.id}">🔊 Écouter le modèle</button><button class="ghost-button" data-action="mini-course-example">${'Voir une réponse modèle'}</button></div><div id="miniCourseModel" hidden class="feedback-box show" style="margin-top:12px"><strong>Model answer</strong><p style="white-space:pre-wrap">${escapeHTML(c.model)}</p><p class="tiny">Ne recopie pas mot pour mot : repère la structure, puis reformule avec tes propres idées.</p></div><div class="notice blue" style="margin-top:15px"><strong>Routine orale :</strong> prépare 30 secondes, parle à voix haute sans lire, puis recommence en améliorant un seul point.</div><div class="button-row" style="margin-top:15px"><button class="primary-button" data-action="mini-course-complete" data-course="${c.id}">${done?'Atelier déjà terminé ✓':'Terminer cet atelier · +10 XP'}</button><button class="ghost-button" data-action="close-modal">Fermer</button></div>`);
  }
  function openScenario(id) { EASim.open(id); }

  function sendScenarioAnswer() { EASim.send(false); }
  function startQuiz(category='') {
    const available=category?DATA.quizzes.filter(q=>q.category===category):DATA.quizzes;
    const qs=shuffle(available.length>=10?available:DATA.quizzes).slice(0,10);
    quizSession={questions:qs,index:0,answers:[],correct:0,category:category||'Mixte'};quizStartTime=Date.now();setView('practice');
  }
  function answerQuiz(answer) {
    if(!quizSession||quizSession.answers[quizSession.index]!==undefined)return;
    const q=quizSession.questions[quizSession.index];quizSession.answers[quizSession.index]=Number(answer);if(Number(answer)===q.answer)quizSession.correct++;
    renderQuizSession();
  }
  function nextQuiz() {
    if(quizSession.index+1<quizSession.questions.length){quizSession.index++;renderQuizSession();return;}
    const total=quizSession.questions.length,score=Math.round(quizSession.correct/total*100),duration=Math.max(1,Math.round((Date.now()-quizStartTime)/60000));
    quizSession.finished=true;
    progress.quizHistory.push({date:new Date().toISOString(),score,correct:quizSession.correct,total,label:`Quiz ${quizSession.category}`});progress.quizHistory=progress.quizHistory.slice(-20);progress.totalAnswers=(progress.totalAnswers||0)+total;progress.correctAnswers=(progress.correctAnswers||0)+quizSession.correct;touchStudy(duration);addXP(10+quizSession.correct*3,'Quiz terminé');mascot('quiz',{score});
    renderQuizSession();saveNow();
  }
  function completeMission() {
    const m=currentMission(), today=todayKey();if(progress.lastMissionDate===today){toast('Mission du jour déjà terminée. Reviens demain !');return;}
    openModal(`<div class="eyebrow">MISSION DU JOUR</div><h2>${escapeHTML(m.title)}</h2><p>${escapeHTML(m.desc)}</p><p>Prends quelques minutes pour faire l’activité dans le module correspondant. Coche ensuite la mission pour enregistrer ton effort.</p><div class="notice blue"><strong>Petit conseil :</strong> la mission récompense la régularité, pas la perfection. Fais-la avec tes propres mots.</div><div class="button-row" style="margin-top:17px"><button class="primary-button" data-action="mission-done">J’ai fait la mission · +${m.points} XP</button><button class="ghost-button" data-action="view" data-view="${m.kind==='speak'?'speak':m.kind==='vocab'?'vocab':m.kind==='quiz'?'practice':'courses'}">Ouvrir l’activité ↗</button></div>`);
  }
  function finishMission() { const m=currentMission(),today=todayKey();if(progress.lastMissionDate===today){toast('Mission déjà validée.');closeModal();return;}progress.lastMissionDate=today;progress.completedMissions.push({date:today,title:m.title});addXP(m.points,'Mission accomplie');touchStudy(5);closeModal();renderView(); }
  function speakText(text) {
    if(!('speechSynthesis' in window)){toast('La synthèse vocale n’est pas disponible sur ce navigateur.');return;}
    window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(String(text||''));utterance.lang='en-US';utterance.rate=.87;utterance.pitch=1;const voices=window.speechSynthesis.getVoices();const english=voices.find(v=>/^en(-|_)/i.test(v.lang));if(english)utterance.voice=english;window.speechSynthesis.speak(utterance);
  }
  function voiceUI(on){const b=$('[data-action="voice-test"]');if(b)b.textContent=on?'Couper le micro':'🎧 Tester mon micro';}
  async function voiceToggle(){
    if(!window.EAVoice){toast('Module micro indisponible.');return;}
    if(EAVoice.isOpen()){EAVoice.close();voiceUI(false);const m=$('#microMeter');if(m)m.style.width='0%';const st=$('#microStatus');if(st)st.textContent='Micro coupé.';mascot('idle');return;}
    try{await EAVoice.open({onLevel:(lvl,speaking)=>{const m=$('#microMeter');if(m){m.style.width=lvl+'%';m.style.opacity=speaking?'1':'.45';}},onStatus:t=>{const st=$('#microStatus');if(st)st.textContent=t;if(/Très bruyant/.test(t))mascot('noisy');}});voiceUI(true);bump('mic');mascot('listen');}
    catch(e){toast(e.name==='NotAllowedError'?'Autorise le micro dans le navigateur, ou réponds par écrit.':(e.message||'Micro indisponible.'));}
  }
  async function voiceRecToggle(){
    const b=$('[data-action="voice-rec"]');
    try{
      if(!EAVoice.isOpen())await voiceToggle();
      if(EAVoice.isRecording()){const url=await EAVoice.stopRecording();if(b)b.textContent='⏺ Enregistrer';const au=$('#voiceAudio');if(au&&url){au.src=url;}const pb=$('#voicePlayBtn');if(pb)pb.hidden=false;toast('Enregistrement prêt : appuie sur Réécouter.');}
      else{EAVoice.startRecording();if(b)b.textContent='⏹ Arrêter';}
    }catch(e){toast(e.message||'Enregistrement impossible.');}
  }
  async function startSpeechRecognition() {
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){toast('Reconnaissance vocale non disponible ici. Écris ta réponse; Chrome la propose.');return;}
    let track=null;
    try{if(window.EAVoice){if(!EAVoice.isOpen())await voiceToggle();track=EAVoice.cleanTrack();}}catch(_){}
    try{
      const rec=new SR();rec.lang='en-US';rec.interimResults=false;rec.maxAlternatives=1;
      rec.onresult=e=>{const target=$('#scenarioAnswer');if(target)target.value+=(target.value?' ':'')+e.results[0][0].transcript;toast('Texte reconnu. Relis-le puis envoie ta réponse.');if(window.EASim)EASim.onSpeech();};
      rec.onerror=e=>toast(e.error==='not-allowed'?'Autorise le micro dans le navigateur, ou réponds par écrit.':e.error==='no-speech'?'Je n’ai rien entendu : parle plus près du micro.':'Micro indisponible. Essaie de répondre par écrit.');
      try{rec.start(track||undefined);}catch(_){rec.start();}
      toast('Parle maintenant en anglais 🎙');
    }catch(_){toast('Impossible de démarrer le micro. Utilise le champ texte.');}
  }
  function exportData() {
    const payload={app:'English Arena',version:1,exportedAt:new Date().toISOString(),profile:{name:profile.name,createdAt:profile.createdAt},progress};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`english-arena-${profile.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-backup.json`;a.click();URL.revokeObjectURL(url);toast('Sauvegarde exportée. Garde ce fichier privé.');
  }
  function importData(file) {
    if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const data=JSON.parse(reader.result);if(!data||data.app!=='English Arena'||!data.progress)throw new Error('Fichier non reconnu.');progress={...defaultProgress(),...data.progress};saveNow();renderView();toast('Sauvegarde importée avec succès.');}catch(e){toast(e.message||'Impossible de lire ce fichier.');}};reader.readAsText(file);
  }
  function exportICS() {
    const time=progress.reminder.time||'19:00';const [h,m]=time.split(':').map(Number);const start=new Date();start.setHours(h,m,0,0);const end=new Date(start.getTime()+15*60000);const fmt=d=>d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+'T'+String(d.getHours()).padStart(2,'0')+String(d.getMinutes()).padStart(2,'0')+'00';
    const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//English Arena//Terminale English Lab//FR','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:english-arena-daily-${profile.id}@english-arena.local`,`DTSTAMP:${fmt(new Date())}`,`DTSTART:${fmt(start)}`,`DTEND:${fmt(end)}`,'RRULE:FREQ=DAILY','SUMMARY:English Arena · 15 minutes of English','DESCRIPTION:Practise speaking, review five words and complete one small English task.','BEGIN:VALARM','TRIGGER:-PT0M','ACTION:DISPLAY','DESCRIPTION:Time for English Arena!','END:VALARM','END:VEVENT','END:VCALENDAR'].join('\r\n');
    const blob=new Blob([ics],{type:'text/calendar;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='english-arena-daily-reminder.ics';a.click();URL.revokeObjectURL(url);toast('Rappel exporté : ouvre le fichier avec ton application calendrier.');
  }
  function showExamTips() { openModal(`<div class="eyebrow">EXAM PREP</div><h2>Une méthode simple pour réussir</h2><h3>1. Comprendre la consigne</h3><p>Repère le verbe de consigne : describe, explain, compare, discuss, justify, summarise. Souligne le sujet et le nombre de points à traiter.</p><h3>2. Organiser tes idées</h3><p>Pour un essai, prépare une introduction courte, deux ou trois paragraphes argumentés et une conclusion. Chaque paragraphe doit défendre une idée.</p><h3>3. Gagner des points à l'oral</h3><p>Utilise des connecteurs (firstly, moreover, however, therefore), donne un exemple concret et termine ta réponse. Si tu bloques, dis “Let me think for a moment”.</p><h3>4. Vérifier</h3><p>Garde deux minutes pour vérifier les temps, les accords, les articles, les pluriels et les verbes après les auxiliaires.</p><div class="button-row"><button class="primary-button" data-action="start-quiz">S’entraîner maintenant ↗</button><button class="ghost-button" data-action="speak-daily">Pratiquer un oral ↗</button></div>`); }
  function showCloudGuide() { openModal(`<div class="eyebrow">MODE CLASSE</div><h2>Des codes individuels entre appareils</h2><p>Le mode local fourni fonctionne sans serveur : chaque navigateur conserve ses propres profils et résultats. Pour valider des codes individuels, compter toute la classe et synchroniser les progrès, il faut activer Supabase.</p><div class="journey-list"><div class="journey-item"><div class="journey-day">1</div><div class="journey-copy"><strong>Créer le projet Supabase</strong><small>Suivre docs/CLOUD_SETUP.md ; aucune clé privée ne doit être publiée.</small></div></div><div class="journey-item"><div class="journey-day">2</div><div class="journey-copy"><strong>Déployer le schéma SQL</strong><small>Tables, règles de sécurité et fonctions de validation des codes.</small></div></div><div class="journey-item"><div class="journey-day">3</div><div class="journey-copy"><strong>Créer un code long et unique par élève</strong><small>Distribuer les codes en privé; ne jamais les committer dans le dépôt public.</small></div></div><div class="journey-item"><div class="journey-day">4</div><div class="journey-copy"><strong>Renseigner la configuration</strong><small>Mettre mode = supabase puis URL et clé publique/anon dans js/config.js.</small></div></div></div><div class="button-row" style="margin-top:16px"><button class="primary-button" data-action="close-modal">Compris</button><button class="ghost-button" data-action="export-progress">Sauvegarder mes données</button></div>`); }
  function onClick(event) {
    const btn=event.target.closest('[data-action]');if(!btn)return;
    const a=btn.dataset.action;
    if(a==='view')return setView(btn.dataset.view);
    if(a==='community-post'){
      const input=$('#communityInput');const text=input?input.value.trim():'';
      if(!text){toast('Écris un message pour la classe.');return;}
      if(chatCloud()){
        btn.disabled=true;
        window.EACloud.postMessage(text).then(()=>{if(input)input.value='';bump('msgs');if(classRoom&&classRoom.send)classRoom.send({t:'chat'});if(progress.lastPostDate!==todayKey()){progress.lastPostDate=todayKey();addXP(3,'Message à la classe');}loadChat();}).catch(e=>toast(e.message||'Envoi impossible.')).finally(()=>{btn.disabled=false;});
      } else {addCommunityMessage(text,profile?profile.name:'Classe');if(input)input.value='';renderView();}
      return;
    }
    if(a==='community-random'){
      const ideas=['Je viens de finir une leçon, et j’ai appris…','Je veux parler 1 minute sans lire pour gagner du courage.','L’important n’est pas d’être parfait, c’est de parler avec confiance.','Mon mot du jour : confidence.'];
      const input=$('#communityInput');if(input)input.value=ideas[Math.floor(Math.random()*ideas.length)];return;
    }
    if(a==='community-challenge'){const input=$('#communityInput');if(input){input.value='🎯 Mon défi : '+weeklyChallenge().slice(0,150)+' → ';input.focus();}return;}
    if(a==='chat-del'){window.EACloud.deleteMessage(btn.dataset.id).then(loadChat).catch(e=>toast(e.message||'Erreur'));return;}
    if(a==='chat-report'){if(!confirm('Signaler ce message à l’administrateur ?'))return;window.EACloud.reportMessage(btn.dataset.id).then(()=>{toast('Merci, message signalé.');loadChat();}).catch(e=>toast(e.message||'Erreur'));return;}
    if(a==='voice-test')return voiceToggle();
    if(a==='voice-rec')return voiceRecToggle();
    if(a==='voice-play'){const au=$('#voiceAudio');if(au){au.hidden=false;au.play().catch(()=>{});}return;}
    if(a==='simulation-mode'){EASim.setMode(btn.dataset.mode);toast('Mode activé : '+EASim.MODES.find(m=>m.id===btn.dataset.mode).label);renderView();return;}
    if(a==='start-day')return showLesson(btn.dataset.day);
    if(a==='lesson-open')return showLesson(btn.dataset.day);
    if(a==='mini-course-open')return openMiniCourse(btn.dataset.course);
    if(a==='mini-course-hint'){const field=$('#miniCourseDraft');if(field){field.value+=(field.value?' ':'')+btn.dataset.hint;field.focus();}return;}
    if(a==='mini-course-example'){const model=$('#miniCourseModel');if(model){model.hidden=!model.hidden;btn.textContent=model.hidden?'Voir une réponse modèle':'Masquer la réponse modèle';}return;}
    if(a==='mini-course-speak'){const c=DATA.extraCourses.find(x=>x.id===btn.dataset.course);if(c)return speakText(c.model);return;}
    if(a==='mini-course-complete'){const id=btn.dataset.course;if(!progress.completedMiniCourses)progress.completedMiniCourses=[];if(!progress.completedMiniCourses.includes(id)){progress.completedMiniCourses.push(id);touchStudy(8);addXP(10,'Atelier terminé');}else toast('Cet atelier est déjà terminé.');closeModal();return renderView();}
    if(a==='complete-day')return completeDay(btn.dataset.day);
    if(a==='course-filter'){courseFilter=btn.dataset.filter;return renderView();}
    if(a==='scenario-open')return openScenario(btn.dataset.scenario);
    if(a==='scenario-send')return sendScenarioAnswer();
    if(a==='scenario-mic')return startSpeechRecognition();
    if(a==='scenario-sample')return EASim.sample();
    if(a==='scenario-restart')return EASim.open(EASim.currentId());
    if(a==='scenario-close'){closeModal();return setView('speak');}
    if(a==='speak-text')return speakText(btn.dataset.text);
    if(a==='insert-hint'){const field=$('#scenarioAnswer');if(field){field.value+=(field.value?' ':'')+btn.dataset.hint;field.focus();}return;}
    if(a==='save-phrase'){const phrase=btn.dataset.phrase;progress.savedPhrases=[...new Set([...(progress.savedPhrases||[]),phrase])].slice(0,60);saveNow();toast('Phrase ajoutée à tes favoris.');return;}
    if(a==='phrase-list'){const phrases=progress.savedPhrases||[];return openModal(`<div class="eyebrow">MY PHRASES</div><h2>Mes phrases utiles</h2>${phrases.length?`<div class="journey-list">${phrases.map((p,i)=>`<div class="journey-item"><div class="journey-day">${i+1}</div><div class="journey-copy"><strong>${escapeHTML(p)}</strong></div><button class="text-button" data-action="speak-text" data-text="${escapeHTML(p)}">🔊</button></div>`).join('')}</div>`:'<p>Tu n’as pas encore enregistré de phrase. Pendant les simulations, utilise « Sauver la phrase » pour créer ta collection personnelle.</p>'}`);}
    if(a==='speak-daily')return openScenario('oral');
    if(a==='start-quiz')return startQuiz(btn.dataset.category||'');
    if(a==='quiz-answer')return answerQuiz(btn.dataset.answer);
    if(a==='quiz-next')return nextQuiz();
    if(a==='quiz-exit'){quizSession=null;return setView('practice');}
    if(a==='exam-tips')return showExamTips();
    if(a==='mission-start')return completeMission();
    if(a==='mission-done')return finishMission();
    if(a==='vocab-flip'){vocabFlipped=!vocabFlipped;return renderVocabCard();}
    if(a==='vocab-next'){vocabIndex=(vocabIndex+1)%DATA.vocab.length;vocabFlipped=false;return renderVocabCard();}
    if(a==='vocab-prev'){vocabIndex=(vocabIndex-1+DATA.vocab.length)%DATA.vocab.length;vocabFlipped=false;return renderVocabCard();}
    if(a==='vocab-speak')return speakText(DATA.vocab[vocabIndex].word);
    if(a==='vocab-known'){const id=DATA.vocab[vocabIndex].id;if(!progress.knownWords.includes(id)){progress.knownWords.push(id);addXP(2,'Mot mémorisé');}else toast('Ce mot est déjà dans tes mots maîtrisés.');vocabIndex=(vocabIndex+1)%DATA.vocab.length;vocabFlipped=false;saveNow();return renderVocabCard();}
    if(a==='vocab-toggle'){const id=Number(btn.dataset.id);if(progress.knownWords.includes(id))progress.knownWords=progress.knownWords.filter(x=>x!==id);else{progress.knownWords.push(id);addXP(2,'Mot maîtrisé');}saveNow();return renderVocabCard();}
    if(a==='vocab-pick'){const id=Number(btn.dataset.id);vocabIndex=DATA.vocab.findIndex(v=>v.id===id);vocabFlipped=false;return renderVocabCard();}
    if(a==='vocab-shuffle'){const known=progress.knownWords;const candidates=DATA.vocab.filter(v=>!known.includes(v.id));vocabIndex=DATA.vocab.findIndex(v=>v.id===((candidates.length?shuffle(candidates):shuffle(DATA.vocab))[0].id));vocabFlipped=false;return renderVocabCard();}
    if(a==='export-progress')return exportData();
    if(a==='import-progress')return $('#importFile').click();
    if(a==='export-ics')return exportICS();
    if(a==='toggle-reminder') {progress.reminder.enabled=!progress.reminder.enabled;saveNow();renderView();if(progress.reminder.enabled){if('Notification'in window&&Notification.permission==='default')Notification.requestPermission().then(()=>toast('Rappel local activé si le navigateur l’autorise.'));else toast('Rappel local activé.');}else toast('Rappel désactivé.');return;}
    if(a==='logout'){if(classRoom&&classRoom.leave)classRoom.leave();classRoom=null;if(window.EAMascot)EAMascot.update(null);localStorage.removeItem(ACTIVE_KEY);profile=null;progress=null;showOnboarding();return;}
    if(a==='show-cloud-guide')return showCloudGuide();
    if(a==='open-pdf')return openPDF(btn.dataset.path,false);
    if(a==='download-pdf')return openPDF(btn.dataset.path,true);
    if(a.startsWith('sim-'))return EASim.action(a,btn);
    if(a.startsWith('duel-'))return EADuel.action(a,btn);
    if(a.startsWith('game-'))return EAGames.action(a,btn);
    if(a==='close-modal')return closeModal();
    if(a==='onboard-tab'){const area=$('#onboardTabContent');$$('.onboarding-tabs .filter-chip').forEach(b=>b.classList.toggle('active',b===btn));area.innerHTML=btn.dataset.tab==='login'?renderLocalLoginForm():renderCreateProfileForm();return;}
  }
  function onSubmit(event) {
    const form=event.target;
    if(form.id==='createProfileForm'){event.preventDefault();const name=$('#newName').value,pin=$('#newPin').value,confirm=$('#newPinConfirm').value;if(pin!==confirm){toast('Les deux codes PIN ne correspondent pas.');return;}createLocalProfile(name,pin).catch(e=>toast(e.message));}
    if(form.id==='localLoginForm'){event.preventDefault();loginLocal($('#localProfile').value,$('#localPin').value).catch(e=>toast(e.message));}
    if(form.id==='cloudLoginForm'){event.preventDefault();const btn=$('button[type="submit"]',form);btn.disabled=true;btn.textContent='Connexion…';cloudLogin($('#cloudCode').value,$('#cloudName').value).catch(e=>toast(e.message||'Connexion impossible.')).finally(()=>{if(btn){btn.disabled=false;btn.textContent='Entrer dans l’arène ↗';}});}
  }
  function onInput(event) {
    if(event.target.id==='courseSearch'){courseSearch=event.target.value;const pos=event.target.selectionStart;renderView();const n=$('#courseSearch');if(n){n.focus();n.setSelectionRange(pos,pos);} }
    if(event.target.id==='vocabSearch'){const list=$('#vocabList');if(list)list.innerHTML=renderVocabList(event.target.value);}
    if(event.target.id==='reminderTime'){progress.reminder.time=event.target.value;saveSoon();}
  }
  function onChange(event) {
    if(event.target.id==='goalSelect'){progress.goalMinutes=Number(event.target.value);saveNow();toast('Objectif quotidien mis à jour.');}
    if(event.target.id==='levelSelect'){progress.level=event.target.value;saveNow();toast('Niveau préféré enregistré.');}
    if(event.target.id==='importFile'){importData(event.target.files?.[0]);event.target.value='';}
  }
  function setupEvents() {
    document.addEventListener('click',onClick);document.addEventListener('submit',onSubmit);document.addEventListener('input',onInput);document.addEventListener('change',onChange);
    $('#modalClose').addEventListener('click',closeModal);$('#modalBackdrop').addEventListener('click',e=>{if(e.target.id==='modalBackdrop')closeModal();});
    $('#menuToggle').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
    $('#profileShortcut').addEventListener('click',()=>setView('profile'));
    $$('.nav-item[data-view], .mobile-nav button[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
    $('#onboardingBackdrop').addEventListener('click',e=>{if(e.target.id==='onboardingBackdrop'){} });
    window.addEventListener('online',()=>{updateChrome();if(profile?.mode==='supabase')saveNow();});window.addEventListener('offline',updateChrome);
    window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;const btn=$('#installButton');btn.hidden=false;btn.addEventListener('click',async()=>{if(!deferredInstallPrompt)return;deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;btn.hidden=true;});});
    window.addEventListener('appinstalled',()=>toast('English Arena est installée !'));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();$('#sidebar').classList.remove('open');}if(e.key==='Enter'&&e.target.id==='flashcard') {vocabFlipped=!vocabFlipped;renderVocabCard();}});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&progress?.reminder?.enabled)checkReminderOnReturn();if(document.visibilityState==='hidden')saveNow();});
  }
  function checkReminderOnReturn() {
    const reminder=progress.reminder;if(!reminder?.enabled)return;
    const now=new Date(),[h,m]=String(reminder.time||'19:00').split(':').map(Number);if(now.getHours()===h&&now.getMinutes()<=10&&progress.lastStudyDate!==todayKey()){
      if('Notification'in window&&Notification.permission==='granted')new Notification('English Arena',{body:'Your 15-minute English practice is waiting.',icon:'assets/icons/icon.svg'});else toast('C’est l’heure de ta petite séance d’anglais !');
    }
  }
  function boot() {
    setupEvents();
    if(!('speechSynthesis'in window)){}else window.speechSynthesis.getVoices();
    const profiles=getProfiles(), activeId=localStorage.getItem(ACTIVE_KEY);profile=profiles.find(p=>p.id===activeId)||null;
    if(profile){progress=getLocalProgress(profile.id);if(profile.mode==='supabase'&&isCloudMode()&&navigator.onLine){window.EACloud.loadProgress().then(remote=>{if(remote&&typeof remote==='object'){progress={...defaultProgress(),...remote};saveNow();renderView();}}).catch(()=>{});}updateChrome();renderView();}
    else showOnboarding();
  }
  window.EAApp={DATA,openModal,closeModal,toast,addXP,touchStudy,saveNow,bump,esc:escapeHTML,getProgress:()=>progress,getProfile:()=>profile,isCloud:()=>chatCloud(),view:setView};
  boot();
})();
