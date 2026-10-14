/* English Arena — EATournament : génération AUTOMATIQUE de toutes les manches d'un tournoi complet.
 * Formats : « toutes rondes » (chaque équipe rencontre toutes les autres) et « élimination directe » (tableau complet avec exempts).
 * Même algorithme que la fonction SQL create_tournament (mode cloud) : le tournoi local et le tournoi cloud sont identiques. */
(function (root) {
  'use strict';
  const names = teams => teams.map(t => String(t).trim()).filter(Boolean);
  function validate(teams) {
    const t = names(teams); if (t.length < 2) throw new Error('Il faut au moins 2 équipes.'); if (t.length > 32) throw new Error('32 équipes maximum.');
    if (new Set(t.map(x => x.toLowerCase())).size !== t.length) throw new Error('Deux équipes ont le même nom.'); return t;
  }
  function roundRobin(teams) {
    const t = validate(teams), n = t.length, m = n + (n % 2); let arr = Array.from({ length: m }, (_, i) => (i + 1 <= n ? i + 1 : 0)); const matches = [];
    for (let r = 1; r < m; r++) {
      for (let i = 1; i <= m / 2; i++) { const a = arr[i - 1], b = arr[m - i]; matches.push({ id: `r${r}m${i}`, round: r, slot: i, a: a && b ? a : Math.max(a, b), b: a && b ? b : null, bye: !(a && b), sa: null, sb: null, winner: null }); }
      arr = [arr[0], arr[m - 1], ...arr.slice(1, m - 1)];
    }
    return { format: 'roundrobin', teams: t.map((name, i) => ({ seed: i + 1, name })), matches, rounds: m - 1 };
  }
  function knockout(teams) {
    const t = validate(teams), n = t.length; let p = 2; while (p < n) p *= 2;
    let ord = [1]; while (ord.length < p) { const len = ord.length, next = []; ord.forEach(x => next.push(x, 2 * len + 1 - x)); ord = next; }
    const rounds = Math.round(Math.log2(p)), matches = [];
    for (let r = 1; r <= rounds; r++) for (let i = 1; i <= p / 2 ** r; i++) {
      const m = { id: `r${r}m${i}`, round: r, slot: i, a: null, b: null, bye: false, sa: null, sb: null, winner: null, next: r < rounds ? `r${r + 1}m${Math.ceil(i / 2)}` : null, side: i % 2 ? 'a' : 'b' };
      if (r === 1) { const a = ord[2 * i - 2], b = ord[2 * i - 1]; m.a = a <= n ? a : null; m.b = b <= n ? b : null; m.bye = m.a == null || m.b == null; }
      matches.push(m);
    }
    const by = Object.fromEntries(matches.map(m => [m.id, m]));
    matches.filter(m => m.round === 1 && m.bye).forEach(m => { m.winner = m.a != null ? m.a : m.b; const nx = by[m.next]; if (nx) nx[m.side] = m.winner; });
    return { format: 'knockout', teams: t.map((name, i) => ({ seed: i + 1, name })), matches, rounds };
  }
  const generate = (teams, format) => (format === 'knockout' ? knockout(teams) : roundRobin(teams));
  /** Saisit un score ; renvoie true si le tournoi est terminé. */
  function report(T, matchId, sa, sb) {
    const m = T.matches.find(x => x.id === matchId); if (!m) throw new Error('Match introuvable.'); if (m.bye || m.a == null || m.b == null) throw new Error('Match pas encore prêt.');
    if (!(sa >= 0 && sb >= 0)) throw new Error('Score invalide.'); if (T.format === 'knockout' && sa === sb) throw new Error('Pas d’égalité en élimination directe.');
    const nx = m.next && T.matches.find(x => x.id === m.next); if (nx && nx.sa != null) throw new Error('Le match suivant est déjà joué.');
    m.sa = sa; m.sb = sb; m.winner = sa > sb ? m.a : sb > sa ? m.b : null; if (nx) nx[m.side] = m.winner;
    return isDone(T);
  }
  const isDone = T => T.matches.filter(m => !m.bye).every(m => (T.format === 'knockout' ? m.winner != null : m.sa != null));
  function standings(T) {
    const tb = {}; T.teams.forEach(t => { tb[t.seed] = { seed: t.seed, name: t.name, played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }; });
    T.matches.forEach(m => { if (m.bye || m.sa == null) return; const A = tb[m.a], B = tb[m.b]; A.played++; B.played++; A.gf += m.sa; A.ga += m.sb; B.gf += m.sb; B.ga += m.sa; if (m.sa > m.sb) { A.w++; B.l++; A.pts += 3; } else if (m.sb > m.sa) { B.w++; A.l++; B.pts += 3; } else { A.d++; B.d++; A.pts++; B.pts++; } });
    return Object.values(tb).sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || x.seed - y.seed);
  }
  const champion = T => { if (!isDone(T)) return null; if (T.format === 'knockout') { const f = T.matches.find(m => m.round === T.rounds); return T.teams.find(t => t.seed === f.winner) || null; } const s = standings(T)[0]; return s ? T.teams.find(t => t.seed === s.seed) : null; };
  const API = { generate, report, standings, isDone, champion, roundRobin, knockout };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.EATournament = API;
})(typeof window !== 'undefined' ? window : globalThis);
