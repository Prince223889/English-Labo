/* Optional cloud adapter. It loads Supabase only after a learner chooses cloud login. */
(function () {
  let clientPromise = null;
  function isEnabled() {
    const c = window.EA_CONFIG || {};
    return c.mode === 'supabase' && /^https:\/\//.test(c.supabaseUrl || '') && (c.supabaseAnonKey || '').length > 20;
  }
  function loadClient() {
    if (!isEnabled()) return Promise.reject(new Error('Le mode cloud n’est pas configuré.'));
    if (!clientPromise) clientPromise = (async () => {
      // Le client Supabase est publié avec ton site (js/vendor/supabase.js, ajouté par le workflow GitHub) : aucun script tiers n'est chargé.
      if (!(window.supabase && window.supabase.createClient)) throw new Error('Bibliothèque cloud absente : le site doit être déployé via GitHub Actions (voir le guide).');
      return window.supabase.createClient(EA_CONFIG.supabaseUrl, EA_CONFIG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    })();
    return clientPromise;
  }
  async function login(code, displayName) {
    const client = await loadClient();
    let sessionResult = await client.auth.getSession();
    if (!sessionResult.data.session) {
      const signIn = await client.auth.signInAnonymously();
      if (signIn.error) throw signIn.error;
    }
    const result = await client.rpc('login_with_code', { p_code: code.trim().toUpperCase(), p_display_name: displayName.trim() });
    if (result.error) throw result.error;
    const profile = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!profile || !profile.id) throw new Error('Code non reconnu. Vérifie le code individuel fourni par l’administrateur.');
    return { id: profile.id, name: profile.display_name || displayName.trim(), createdAt: profile.created_at || new Date().toISOString(), cloudId: profile.id, mode: 'supabase' };
  }
  async function saveProgress(state) {
    const client = await loadClient();
    const result = await client.rpc('save_student_state', { p_state: state });
    if (result.error) throw result.error;
    return true;
  }
  async function loadProgress() {
    const client = await loadClient();
    const result = await client.rpc('load_student_state');
    if (result.error) throw result.error;
    return result.data || null;
  }
  async function stats() {
    const client = await loadClient();
    const result = await client.rpc('class_stats');
    if (result.error) throw result.error;
    return Array.isArray(result.data) ? result.data[0] : result.data;
  }
  async function fileUrl(path, download) {
    const client = await loadClient();
    const r = await client.storage.from('course-files').createSignedUrl(path, 180, download ? { download: true } : undefined);
    if (r.error) throw r.error;
    return r.data.signedUrl;
  }
  async function announcements() { const c = await loadClient(); const r = await c.rpc('list_announcements'); if (r.error) throw r.error; return r.data || []; }
  async function leaderboard() { const c = await loadClient(); const r = await c.rpc('leaderboard'); if (r.error) throw r.error; return r.data || []; }
  async function messages() { const c = await loadClient(); const r = await c.rpc('list_messages'); if (r.error) throw r.error; return r.data || []; }
  async function postMessage(body) { const c = await loadClient(); const r = await c.rpc('post_message', { p_body: body }); if (r.error) throw r.error; return true; }
  async function deleteMessage(id) { const c = await loadClient(); const r = await c.rpc('delete_my_message', { p_id: id }); if (r.error) throw r.error; return true; }
  async function reportMessage(id) { const c = await loadClient(); const r = await c.rpc('report_message', { p_id: id }); if (r.error) throw r.error; return true; }
  // Temps réel (Supabase Realtime Broadcast + Presence) : aucun contenu stocké, seulement des signaux éphémères.
  async function openRoom(name, cfg) {
    cfg = cfg || {};
    const c = await loadClient(), key = Math.random().toString(36).slice(2, 10);
    try { await c.realtime.setAuth(); } catch (_) {}
    const ch = c.channel(name, { config: { private: true, broadcast: { self: true }, presence: { key } } });
    ch.on('broadcast', { event: 'msg' }, ({ payload }) => cfg.onMessage && cfg.onMessage(payload || {}));
    ch.on('presence', { event: 'sync' }, () => { if (cfg.onPresence) cfg.onPresence(Object.entries(ch.presenceState()).map(([k, v]) => Object.assign({ key: k }, v[0] || {}))); });
    await new Promise((res, rej) => {
      const to = setTimeout(() => rej(new Error('Temps réel indisponible (vérifie la connexion).')), 9000);
      ch.subscribe(st => { if (st === 'SUBSCRIBED') { clearTimeout(to); res(); } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') { clearTimeout(to); rej(new Error('Temps réel indisponible.')); } });
    });
    await ch.track(cfg.presence || {});
    return { key, send: payload => ch.send({ type: 'broadcast', event: 'msg', payload }), update: p => ch.track(p), leave: () => { try { c.removeChannel(ch); } catch (_) {} } };
  }
  // Duels / tournois : moteur de score autoritaire côté serveur (voir supabase/schema.sql)
  async function rpc(name, args) { const c = await loadClient(); const r = await c.rpc(name, args || {}); if (r.error) throw new Error(r.error.message || 'Erreur serveur'); return r.data; }
  const duel = {
    create: (code, questions, qtimeMs) => rpc('create_duel', { p_code: code, p_questions: questions, p_qtime_ms: qtimeMs }),
    join: code => rpc('join_duel', { p_code: code }), start: code => rpc('start_duel', { p_code: code }), advance: code => rpc('advance_duel', { p_code: code }),
    answer: (code, idx, choice) => rpc('submit_duel_answer', { p_code: code, p_idx: idx, p_choice: choice }), state: code => rpc('duel_state', { p_code: code })
  };
  const tournament = {
    create: (name, format, teams) => rpc('create_tournament', { p_name: name, p_format: format, p_teams: teams }),
    report: (id, a, b) => rpc('report_match', { p_match: id, p_score_a: a, p_score_b: b }),
    state: id => rpc('tournament_state', { p_id: id }), list: () => rpc('list_tournaments')
  };
  window.EACloud = { duel, tournament, openRoom, messages, postMessage, deleteMessage, reportMessage, isEnabled, login, saveProgress, loadProgress, stats, fileUrl, announcements, leaderboard, client: loadClient };
})();
