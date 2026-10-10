(function () {
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let client = null, students = [], lastCodes = '';

  function msg(text, bad) { const m = $('#msg'); m.hidden = !text; m.textContent = text || ''; m.style.borderColor = bad ? 'var(--bad)' : ''; }
  function randCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', b = crypto.getRandomValues(new Uint8Array(16));
    let s = ''; for (let i = 0; i < 16; i++) { if (i && i % 4 === 0) s += '-'; s += alphabet[b[i] % alphabet.length]; }
    return 'EA-' + s;
  }
  async function rpc(name, args) { const r = await client.rpc(name, args); if (r.error) throw r.error; return r.data; }
  async function run(fn) { try { msg(''); await fn(); } catch (e) { msg(e.message || 'Erreur', true); } }

  async function init() {
    if (!window.EACloud || !EACloud.isEnabled()) { $('#loginMsg').hidden = false; $('#loginMsg').textContent = 'Le mode cloud n’est pas configuré dans js/config.js.'; $('#loginBtn').disabled = true; return; }
    client = await EACloud.client();
    const { data } = await client.auth.getSession();
    if (data.session && !data.session.user.is_anonymous) tryEnter();
  }
  async function tryEnter() {
    try { await rpc('admin_overview'); } catch (e) {
      const lm = $('#loginMsg'); lm.hidden = false; lm.textContent = 'Ce compte n’est pas administrateur.';
      await client.auth.signOut(); return;
    }
    const { data } = await client.auth.getUser();
    $('#who').textContent = data.user.email; $('#loginBox').hidden = true; $('#app').hidden = false;
    refreshAll();
  }
  $('#loginBtn').addEventListener('click', async () => {
    const lm = $('#loginMsg'); lm.hidden = true;
    if (!client) return;
    const { error } = await client.auth.signInWithPassword({ email: $('#email').value.trim(), password: $('#pwd').value });
    if (error) { lm.hidden = false; lm.textContent = 'E-mail ou mot de passe incorrect.'; return; }
    $('#pwd').value = ''; tryEnter();
  });
  $('#logoutBtn').addEventListener('click', async () => { await client.auth.signOut(); location.reload(); });

  document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('active', x === b));
    document.querySelectorAll('[data-panel]').forEach(p => p.hidden = p.dataset.panel !== b.dataset.tab);
  }));

  async function refreshAll() { await run(async () => { await Promise.all([loadOverview(), loadStudents(), loadNews(), loadChat(), loadAudit()]); }); }

  async function loadOverview() {
    const d = (await rpc('admin_overview'))[0] || {};
    const k = (n, l) => `<div class="card kpi"><b>${esc(n)}</b><small>${l}</small></div>`;
    $('#kpis').innerHTML = k(d.codes_total, 'Codes créés') + k(d.codes_used, 'Élèves inscrits') + k(d.active_7_days, 'Actifs (7 jours)') + k(Math.round(d.avg_xp || 0), 'XP moyen') + k(d.total_lessons, 'Leçons terminées (total)');
  }
  function fmtDate(d) { return d ? new Date(d).toLocaleDateString('fr-FR') : '—'; }
  async function loadStudents() {
    students = await rpc('admin_list_students');
    const week = Date.now() - 7 * 864e5;
    const idle = students.filter(s => s.is_enabled && (!s.display_name || new Date(s.last_seen_at).getTime() < week));
    $('#inactive').innerHTML = idle.length ? idle.map(s => `<div class="file-row"><div class="file-details"><strong>${esc(s.label)}</strong><small>${s.display_name ? 'Dernière visite : ' + fmtDate(s.last_seen_at) : 'Code jamais utilisé'}</small></div></div>`).join('') : '<p>Tout le monde est actif 🎉</p>';
    renderRows();
  }
  function renderRows() {
    const q = ($('#search').value || '').toLowerCase();
    $('#rows').innerHTML = students.filter(s => (s.label + ' ' + (s.display_name || '')).toLowerCase().includes(q)).map(s => {
      const status = !s.is_enabled ? '<span class="pill">Désactivé</span>' : !s.display_name ? '<span class="pill orange">Pas encore utilisé</span>' : '<span class="pill green">Actif</span>';
      return `<tr><td><b>${esc(s.label)}</b></td><td>${esc(s.display_name || '—')}</td><td>${s.xp}</td><td>${s.lessons}/56</td><td>${s.streak}</td><td>${fmtDate(s.last_seen_at)}</td><td>${status}</td>
      <td><div class="row-actions">
        <button class="ghost-button" data-act="toggle" data-h="${s.code_hash}" data-en="${s.is_enabled}">${s.is_enabled ? 'Désactiver' : 'Réactiver'}</button>
        <button class="ghost-button" data-act="replace" data-h="${s.code_hash}" data-n="${esc(s.label)}">Nouveau code</button>
        <button class="ghost-button" data-act="reset" data-h="${s.code_hash}">Libérer l’appareil</button>
        <button class="ghost-button" data-act="delete" data-h="${s.code_hash}" data-n="${esc(s.label)}">Supprimer</button>
      </div></td></tr>`;
    }).join('') || '<tr><td colspan="8">Aucun élève.</td></tr>';
  }
  $('#search').addEventListener('input', renderRows);
  $('#refreshBtn').addEventListener('click', refreshAll);
  $('#rows').addEventListener('click', e => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const h = b.dataset.h, act = b.dataset.act;
    run(async () => {
      if (act === 'toggle') await rpc('admin_set_code_enabled', { p_code_hash: h, p_enabled: b.dataset.en !== 'true' });
      else if (act === 'reset') { if (!confirm('Libérer l’appareil ? L’élève pourra se reconnecter avec son code sur un nouveau téléphone.')) return; await rpc('admin_reset_device', { p_code_hash: h }); }
      else if (act === 'delete') { if (!confirm('Supprimer définitivement ' + b.dataset.n + ' et sa progression ?')) return; await rpc('admin_delete_code', { p_code_hash: h }); }
      else if (act === 'replace') {
        if (!confirm('Créer un nouveau code pour ' + b.dataset.n + ' ? L’ancien code cessera de fonctionner, la progression est conservée.')) return;
        const code = randCode(); await rpc('admin_replace_code', { p_old_hash: h, p_new_code: code });
        prompt('Nouveau code pour ' + b.dataset.n + ' (copie-le maintenant, il ne sera plus affiché) :', code);
      }
      await refreshAll();
    });
  });
  $('#csvBtn').addEventListener('click', () => {
    const lines = [['Eleve', 'Pseudo', 'XP', 'Lecons', 'Serie', 'Derniere visite', 'Actif']].concat(students.map(s => [s.label, s.display_name || '', s.xp, s.lessons, s.streak, s.last_seen_at || '', s.is_enabled ? 'oui' : 'non']));
    const csv = lines.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
    download('english-arena-eleves.csv', '\ufeff' + csv, 'text/csv');
  });
  function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }

  $('#genBtn').addEventListener('click', () => run(async () => {
    const names = $('#names').value.split('\n').map(x => x.trim()).filter(Boolean);
    if (!names.length) throw new Error('Écris au moins un nom.');
    if (names.length > 200) throw new Error('Maximum 200 élèves à la fois.');
    const codes = names.map(randCode);
    await rpc('admin_add_codes', { p_codes: codes, p_labels: names });
    lastCodes = 'ENGLISH ARENA — CODES PRIVÉS (ne pas publier)\n\n' + names.map((n, i) => `${n} : ${codes[i]}`).join('\n') + '\n';
    $('#codesText').textContent = lastCodes; $('#genOut').hidden = false; $('#names').value = '';
    await refreshAll();
  }));
  $('#copyBtn').addEventListener('click', async () => { try { await navigator.clipboard.writeText(lastCodes); msg('Copié.'); } catch (_) { msg('Copie impossible : sélectionne le texte à la main.', true); } });
  $('#dlBtn').addEventListener('click', () => download('english-arena-codes-PRIVE.txt', lastCodes, 'text/plain'));

  async function loadNews() {
    const list = await rpc('list_announcements');
    $('#newsList').innerHTML = list.length ? list.map(a => `<div class="file-row"><div class="file-details"><strong>${a.is_pinned ? '📌 ' : ''}${esc(a.title)}</strong><small>${esc(a.body)}</small></div><button class="text-button" data-del="${a.id}">Supprimer</button></div>`).join('') : '<p>Aucune annonce.</p>';
  }
  $('#newsBtn').addEventListener('click', () => run(async () => {
    const t = $('#newsTitle').value.trim(), b = $('#newsBody').value.trim();
    if (!t || !b) throw new Error('Titre et message obligatoires.');
    await rpc('admin_post_announcement', { p_title: t, p_body: b, p_pinned: $('#newsPin').checked });
    $('#newsTitle').value = ''; $('#newsBody').value = ''; $('#newsPin').checked = false; msg('Annonce publiée.'); await loadNews(); try { const r = await EACloud.openRoom('ea-class-v1', {}); r.send({ t: 'news' }); setTimeout(() => r.leave(), 2000); } catch (_) {}
  }));
  $('#newsList').addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (b) run(async () => { await rpc('admin_delete_announcement', { p_id: b.dataset.del }); await loadNews(); }); });

  async function loadChat() {
    const list = await rpc('admin_list_messages');
    $('#chatAdmin').innerHTML = list.length ? list.map(m => `<div class="file-row"><div class="file-details"><strong>${esc(m.author)} ${m.is_hidden ? '<span class="pill orange">Masqué (' + m.reports + ' signalements)</span>' : (m.reports > 0 ? '<span class="pill">' + m.reports + ' signalement(s)</span>' : '')}${m.is_muted ? ' <span class="pill">Muet</span>' : ''}</strong><small>${esc(m.body)} · ${new Date(m.created_at).toLocaleString('fr-FR')}</small></div>
      <div class="row-actions">${m.is_hidden ? `<button class="text-button" data-m="restore" data-id="${m.id}">Rétablir</button>` : ''}<button class="text-button" data-m="del" data-id="${m.id}">Supprimer</button><button class="text-button" data-m="mute" data-h="${m.code_hash}" data-muted="${m.is_muted}">${m.is_muted ? 'Rendre la parole' : 'Rendre muet'}</button></div></div>`).join('') : '<p>Aucun message.</p>';
  }
  $('#chatRefresh').addEventListener('click', () => run(loadChat));
  $('#chatAdmin').addEventListener('click', e => {
    const b = e.target.closest('[data-m]'); if (!b) return;
    run(async () => {
      if (b.dataset.m === 'del') await rpc('admin_delete_message', { p_id: b.dataset.id });
      else if (b.dataset.m === 'restore') await rpc('admin_restore_message', { p_id: b.dataset.id });
      else await rpc('admin_set_muted', { p_code_hash: b.dataset.h, p_muted: b.dataset.muted !== 'true' });
      await loadChat();
    });
  });

  async function loadAudit() {
    const rows = await rpc('admin_audit'), fails = await rpc('admin_failed_logins');
    $('#secKpis').innerHTML = `<div class="card kpi"><b>${esc(fails)}</b><small>Codes refusés (24 h)</small></div><div class="card kpi"><b>${rows.length}</b><small>Actions récentes</small></div>`;
    $('#auditRows').innerHTML = rows.map(r => `<tr><td>${new Date(r.at).toLocaleString('fr-FR')}</td><td>${esc(r.email || '—')}</td><td>${esc(r.tbl)}</td><td>${esc(r.op)}</td><td>${esc(r.ref)}</td></tr>`).join('') || '<tr><td colspan="5">Rien pour l’instant.</td></tr>';
  }
  $('#auditRefresh').addEventListener('click', () => run(loadAudit));
  // Déconnexion automatique après 15 min d'inactivité
  let idle; const bumpIdle = () => { clearTimeout(idle); idle = setTimeout(async () => { if (client) { await client.auth.signOut(); location.reload(); } }, 15 * 60 * 1000); };
  ['pointerdown', 'keydown', 'touchstart'].forEach(e => document.addEventListener(e, bumpIdle, { passive: true })); bumpIdle();

  init();
})();
